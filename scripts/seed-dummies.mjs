// scripts/seed-dummies.mjs
// Creates dummy Silk Road accounts + profiles + photos from a CSV, for testing.
// Every dummy email MUST end in @silkroad-test.invalid so cleanup-dummies.mjs can find them.
//
// Usage (from the project root):
//   node --env-file=.env.local scripts/seed-dummies.mjs
//   node --env-file=.env.local scripts/seed-dummies.mjs path/to/other.csv
//
// Photos are read from a "photos/" folder next to the CSV.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = 'profile-photos';
const DUMMY_SUFFIX = '@silkroad-test.invalid';
const PROFILE_APPROVED = 'approved'; // profiles.status value that shows in Discover
const PHOTO_APPROVED = 'approved'; // profile_photos.status value (check against your admin approve action)

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-dummies.mjs');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Small CSV parser (handles quoted fields, commas inside quotes, Excel BOM)
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v !== '')) rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

function validate(r) {
  const problems = [];
  if (!r.email || !r.email.toLowerCase().endsWith(DUMMY_SUFFIX)) problems.push(`email must end in ${DUMMY_SUFFIX}`);
  if (!r.display_name) problems.push('display_name is required');
  if (!r.campus) problems.push('campus is required');
  const age = Number(r.age);
  if (!Number.isInteger(age) || age < 18) problems.push('age must be a whole number, 18 or over');
  if (r.phone_number && !/^\+?\d{9,15}$/.test(r.phone_number)) problems.push('phone_number should be digits, optional leading +');
  return problems;
}

const csvPath = path.resolve(process.argv[2] ?? 'scripts/dummy-data/dummies.csv');
if (!existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1); }
const photosDir = path.join(path.dirname(csvPath), 'photos');

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
console.log(`Read ${rows.length} rows from ${csvPath}\n`);

let created = 0, skipped = 0;

for (const [i, r] of rows.entries()) {
  const label = `[${i + 1}/${rows.length}] ${r.email || '(no email)'}`;
  const problems = validate(r);
  if (problems.length) { console.log(`${label} SKIPPED: ${problems.join('; ')}`); skipped++; continue; }

  try {
    // 1. Auth user (email pre-confirmed, random password: dummies never sign in)
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: r.email.toLowerCase(),
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { dummy: true },
    });
    if (authErr) throw new Error(`auth: ${authErr.message}`);
    const userId = authData.user.id;

    // 2. public.users (upsert in case a trigger already created the row)
    const { error: userErr } = await sb.from('users').upsert(
      {
        id: userId,
        phone_number: r.phone_number || null,
        phone_verified: Boolean(r.phone_number),
        phone_verified_at: r.phone_number ? new Date().toISOString() : null,
        status: 'active',
      },
      { onConflict: 'id' },
    );
    if (userErr) throw new Error(`users: ${userErr.message}`);

    // 3. profiles
    const verified = r.verified ? r.verified.toLowerCase() !== 'false' : true;
    const { data: profile, error: profErr } = await sb
      .from('profiles')
      .insert({
        user_id: userId,
        display_name: r.display_name,
        age: Number(r.age),
        campus: r.campus,
        bio: r.bio || null,
        looking_for: r.looking_for || null,
        show_me: r.show_me || null,
        interests: r.interests ? r.interests.split('|').map((s) => s.trim()).filter(Boolean) : [],
        status: PROFILE_APPROVED,
        face_match_verified: verified,
      })
      .select('id')
      .single();
    if (profErr) throw new Error(`profiles: ${profErr.message}`);

    // 4. photos (first file is the primary one)
    const files = r.photo_file ? r.photo_file.split('|').map((s) => s.trim()).filter(Boolean) : [];
    let photoCount = 0;
    for (const [idx, file] of files.entries()) {
      const full = path.join(photosDir, file);
      const ext = path.extname(file).toLowerCase();
      if (!existsSync(full) || !MIME[ext]) { console.log(`   photo skipped (missing or unsupported): ${file}`); continue; }

      const storagePath = `${userId}/${randomUUID()}-${file}`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, readFileSync(full), { contentType: MIME[ext] });
      if (upErr) throw new Error(`storage: ${upErr.message}`);

      const { error: photoErr } = await sb.from('profile_photos').insert({
        profile_id: profile.id,
        image_url: storagePath, // path inside the private bucket. Change if your app stores something else.
        status: PHOTO_APPROVED,
        is_primary: idx === 0,
      });
      if (photoErr) throw new Error(`profile_photos: ${photoErr.message}`);
      photoCount++;
    }

    console.log(`${label} OK (${r.display_name}, ${photoCount} photo${photoCount === 1 ? '' : 's'})`);
    created++;
  } catch (e) {
    console.log(`${label} FAILED: ${e.message}`);
    skipped++;
  }
}

console.log(`\nDone. Created ${created}, skipped/failed ${skipped}.`);
console.log('When you finish testing, run: node --env-file=.env.local scripts/cleanup-dummies.mjs --confirm');
