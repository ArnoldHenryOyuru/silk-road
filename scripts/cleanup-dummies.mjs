// scripts/cleanup-dummies.mjs
// Removes every dummy account made by seed-dummies.mjs (anything with an
// email ending in @silkroad-test.invalid) and all rows/files tied to them.
//
// Usage (from the project root):
//   node --env-file=.env.local scripts/cleanup-dummies.mjs            # dry run: only shows counts
//   node --env-file=.env.local scripts/cleanup-dummies.mjs --confirm  # actually deletes

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'profile-photos';
const DUMMY_SUFFIX = '@silkroad-test.invalid';
const CONFIRM = process.argv.includes('--confirm');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/cleanup-dummies.mjs');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const chunk = (arr, n = 50) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function listDummyUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    found.push(...data.users.filter((u) => u.email?.toLowerCase().endsWith(DUMMY_SUFFIX)));
    if (data.users.length < 200) break;
  }
  return found;
}

// Count or delete rows where `column` is in `ids`
async function run(table, column, ids) {
  let total = 0;
  for (const part of chunk(ids)) {
    if (CONFIRM) {
      const { error, count } = await sb.from(table).delete({ count: 'exact' }).in(column, part);
      if (error) throw new Error(`${table}.${column}: ${error.message}`);
      total += count ?? 0;
    } else {
      const { error, count } = await sb.from(table).select('*', { count: 'exact', head: true }).in(column, part);
      if (error) throw new Error(`${table}.${column}: ${error.message}`);
      total += count ?? 0;
    }
  }
  console.log(`  ${table}.${column}: ${total} row(s) ${CONFIRM ? 'deleted' : 'found'}`);
}

const dummyUsers = await listDummyUsers();
if (!dummyUsers.length) { console.log('No dummy accounts found. Nothing to do.'); process.exit(0); }

const userIds = dummyUsers.map((u) => u.id);
const { data: profs, error: profErr } = await sb.from('profiles').select('id').in('user_id', userIds);
if (profErr) throw profErr;
const profileIds = (profs ?? []).map((p) => p.id);
const allIds = [...userIds, ...profileIds]; // uuids never collide, so matching both is safe

console.log(`${CONFIRM ? 'DELETING' : 'DRY RUN for'} ${dummyUsers.length} dummy account(s), ${profileIds.length} profile(s)\n`);

try {
  // Rows that point at the dummies (including rows made by your real test accounts)
  await run('reports', 'reporter_id', allIds);
  await run('reports', 'reported_user_id', allIds);
  await run('blocks', 'blocker_id', allIds);
  await run('blocks', 'blocked_id', allIds);
  await run('likes', 'liker_id', allIds);
  await run('likes', 'liked_profile_id', allIds);
  await run('phone_unlock_events', 'viewer_id', allIds);
  await run('phone_unlock_events', 'profile_id', allIds);
  await run('profile_edits', 'profile_id', profileIds);
  await run('profile_photos', 'profile_id', profileIds);

  // Files in the private bucket (folder per user id)
  let fileCount = 0;
  for (const uid of userIds) {
    const { data: files, error } = await sb.storage.from(BUCKET).list(uid, { limit: 100 });
    if (error) throw new Error(`storage list: ${error.message}`);
    const paths = (files ?? []).map((f) => `${uid}/${f.name}`);
    fileCount += paths.length;
    if (CONFIRM && paths.length) {
      const { error: rmErr } = await sb.storage.from(BUCKET).remove(paths);
      if (rmErr) throw new Error(`storage remove: ${rmErr.message}`);
    }
  }
  console.log(`  storage ${BUCKET}: ${fileCount} file(s) ${CONFIRM ? 'deleted' : 'found'}`);

  await run('subscriptions', 'user_id', userIds);
  await run('payment_transactions', 'user_id', userIds);
  await run('deletion_requests', 'user_id', userIds);
  await run('profiles', 'user_id', userIds);
  await run('users', 'id', userIds);

  if (CONFIRM) {
    for (const u of dummyUsers) {
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`auth delete ${u.email}: ${error.message}`);
    }
    console.log(`  auth users: ${dummyUsers.length} deleted`);
  } else {
    console.log(`  auth users: ${dummyUsers.length} found`);
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  console.error('Nothing after this point was deleted. Paste me the error and I will adjust the order.');
  process.exit(1);
}

console.log(CONFIRM ? '\nCleanup complete.' : '\nDry run only. Re-run with --confirm to delete.');
