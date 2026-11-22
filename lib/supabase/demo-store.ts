import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { PLANS, isPlanId } from '@/lib/payments/plans'

export type DemoRow = Record<string, unknown>

export interface DemoStore {
  users: DemoRow[]
  profiles: DemoRow[]
  profile_photos: DemoRow[]
  profile_edits: DemoRow[]
  likes: DemoRow[]
  blocks: DemoRow[]
  reports: DemoRow[]
  phone_unlock_events: DemoRow[]
  subscriptions: DemoRow[]
  payment_transactions: DemoRow[]
  deletion_requests: DemoRow[]
  admin_push_subscriptions: DemoRow[]
  blocked_numbers: DemoRow[]
  refund_requests: DemoRow[]
  email_otps: DemoRow[]
  rate_limit_hits: DemoRow[]
  passwords: Map<string, string>
  uploadedPhotos: Map<string, string>
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${derived}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const derived = scryptSync(password, salt, 32)
  const storedBuf = Buffer.from(hashHex, 'hex')
  if (derived.length !== storedBuf.length) return false
  return timingSafeEqual(derived, storedBuf)
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

const SEED_PEERS = [
  { name: 'Nana', age: 21, campus: 'Makerere', lookingFor: 'Dating', bio: 'Coffee, books, and long afternoon walks around Makerere hill.', interests: ['Music', 'Travel', 'Reading'], photo: 'dummy01.png', verified: true, teaser: true },
  { name: 'Amina', age: 22, campus: 'MUBS', lookingFor: 'Something casual', bio: 'Business student who loves food spots in Kololo and weekend drives.', interests: ['Food', 'Photography', 'Afrobeats'], photo: 'dummy02.png', verified: true, teaser: true },
  { name: 'Selly', age: 23, campus: 'Kyambogo', lookingFor: 'Long-term', bio: 'Architecture major sketching cafes and looking for genuine conversation.', interests: ['Design', 'Art', 'Coffee'], photo: 'dummy03.png', verified: true, teaser: true },
  { name: 'Lala', age: 22, campus: 'Makerere', lookingFor: 'New friends', bio: 'Always up for a campus festival, live band night, or lakeside brunch.', interests: ['Concerts', 'Dancing', 'Brunch'], photo: 'dummy04.png', verified: false, teaser: true },
  { name: 'Victoria', age: 23, campus: 'UCU', lookingFor: 'Dating', bio: 'Law student in Mukono. Books, podcasts, and quiet Sunday evenings.', interests: ['Podcasts', 'Reading', 'Cinema'], photo: 'dummy05.png', verified: true, teaser: true },
  { name: 'Shami', age: 22, campus: 'KIU', lookingFor: 'Something casual', bio: 'Medical student balancing rounds with gym sessions and sushi nights.', interests: ['Fitness', 'Cooking', 'Music'], photo: 'dummy06.png', verified: true, teaser: true },
  { name: 'Tamara', age: 22, campus: 'MUBS', lookingFor: 'Dating', bio: 'Warm, grounded, and always down for a spontaneous road trip to Jinja.', interests: ['Travel', 'Road trips', 'Photography'], photo: 'dummy07.png', verified: true, teaser: true },
  { name: 'Valentina', age: 21, campus: 'Kyambogo', lookingFor: 'Dating', bio: 'Fashion design student who loves vintage markets and acoustic sets.', interests: ['Fashion', 'Live music', 'Art'], photo: 'dummy08.png', verified: true, teaser: true },
  { name: 'Milly', age: 24, campus: 'KIU', lookingFor: 'New friends', bio: 'Tech enthusiast and gamer looking to meet creative people around Kampala.', interests: ['Gaming', 'Tech', 'Coffee'], photo: 'dummy09.png', verified: false, teaser: false },
  { name: 'Jojo', age: 23, campus: 'UCU', lookingFor: 'Long-term', bio: 'Journalism finalist who loves storytelling, sunsets, and good playlists.', interests: ['Writing', 'Podcasts', 'Travel'], photo: 'dummy10.png', verified: true, teaser: false },
  { name: 'Lilian', age: 24, campus: 'Makerere', lookingFor: 'Dating', bio: 'Software engineering student. Let us debate over iced lattes in Acacia.', interests: ['Coding', 'Coffee', 'Tennis'], photo: 'dummy11.png', verified: true, teaser: false },
  { name: 'Luna', age: 23, campus: 'Kyambogo', lookingFor: 'Something casual', bio: 'Art teacher in training. Catch me at gallery openings or Ntinda bakeries.', interests: ['Painting', 'Baking', 'Films'], photo: 'dummy12.png', verified: true, teaser: false },
  { name: 'Gisella', age: 22, campus: 'MUBS', lookingFor: 'Dating', bio: 'Finance student with a soft spot for jazz nights and good conversation.', interests: ['Jazz', 'Cooking', 'Reading'], photo: 'dummy13.png', verified: true, teaser: false },
  { name: 'Cindy', age: 22, campus: 'IUIU', lookingFor: 'New friends', bio: 'Curious spirit who loves trying new restaurants and hiking on weekends.', interests: ['Hiking', 'Food', 'Photography'], photo: 'dummy14.png', verified: false, teaser: false },
  { name: 'Mimi', age: 25, campus: 'Kyambogo', lookingFor: 'Long-term', bio: 'Postgrad researcher. Calm energy, great listener, loves board games.', interests: ['Board games', 'Coffee', 'Cycling'], photo: 'dummy15.png', verified: true, teaser: false },
  { name: 'Sophia', age: 22, campus: 'KIU', lookingFor: 'Dating', bio: 'Pharmacy student who unwinds with sunset runs and late-night shawarma.', interests: ['Running', 'Music', 'Food'], photo: 'dummy16.png', verified: true, teaser: false },
  { name: 'Brenda', age: 21, campus: 'Makerere', lookingFor: 'Dating', bio: 'Economics major. Looking for someone kind with a great sense of humor.', interests: ['Comedy', 'Cinema', 'Travel'], photo: 'dummy17.png', verified: true, teaser: false },
  { name: 'Grace', age: 23, campus: 'UCU', lookingFor: 'Long-term', bio: 'Mass comm student. Big fan of poetry slams and Sunday picnics.', interests: ['Poetry', 'Picnics', 'Reading'], photo: 'dummy18.png', verified: true, teaser: false },
  { name: 'Hana', age: 22, campus: 'MUBS', lookingFor: 'New friends', bio: 'Entrepreneurship club lead. Always building something or exploring town.', interests: ['Startups', 'Coffee', 'Afrobeats'], photo: 'dummy19.png', verified: false, teaser: false },
  { name: 'Chloe', age: 24, campus: 'Makerere', lookingFor: 'Dating', bio: 'Civil engineering student who loves architecture, swimming, and gelato.', interests: ['Swimming', 'Travel', 'Design'], photo: 'dummy20.png', verified: true, teaser: false },
]

function createInitialStore(): DemoStore {
  const users: DemoRow[] = []
  const profiles: DemoRow[] = []
  const profile_photos: DemoRow[] = []
  const passwords = new Map<string, string>()

  const demoMemberId = '11111111-1111-4111-8111-111111111101'
  const demoPendingId = '11111111-1111-4111-8111-111111111102'
  const demoAdminId = '11111111-1111-4111-8111-111111111103'

  const memberPass = hashPassword('demo1234')
  const adminPass = hashPassword('admin1234')

  users.push(
    {
      id: demoMemberId,
      email: 'member@silkroad.demo',
      phone_number: '+256700111222',
      email_verified_at: daysAgoIso(12),
      status: 'active',
      is_admin: false,
      terms_accepted_at: daysAgoIso(12),
      created_at: daysAgoIso(12),
    },
    {
      id: demoPendingId,
      email: 'pending@silkroad.demo',
      phone_number: '+256700333444',
      email_verified_at: hoursAgoIso(4),
      status: 'active',
      is_admin: false,
      terms_accepted_at: hoursAgoIso(4),
      created_at: hoursAgoIso(4),
    },
    {
      id: demoAdminId,
      email: 'admin@silkroad.demo',
      phone_number: '+256700999000',
      email_verified_at: daysAgoIso(30),
      status: 'active',
      is_admin: true,
      terms_accepted_at: daysAgoIso(30),
      created_at: daysAgoIso(30),
    }
  )

  passwords.set(demoMemberId, memberPass)
  passwords.set(demoPendingId, memberPass)
  passwords.set(demoAdminId, adminPass)

  const demoMemberProfileId = '22222222-2222-4222-8222-222222222101'
  const demoPendingProfileId = '22222222-2222-4222-8222-222222222102'

  profiles.push(
    {
      id: demoMemberProfileId,
      user_id: demoMemberId,
      display_name: 'David K',
      age: 23,
      campus: 'Makerere',
      bio: 'Computer science student into weekend road trips, photography, and specialty coffee.',
      looking_for: 'Dating',
      show_me: 'Everyone',
      interests: ['Photography', 'Coffee', 'Travel'],
      status: 'approved',
      is_discoverable: true,
      teaser_opt_in: false,
      face_match_verified: true,
      verification_selfie_path: 'demo-photos/dummy21.png',
      created_at: daysAgoIso(12),
    },
    {
      id: demoPendingProfileId,
      user_id: demoPendingId,
      display_name: 'Sarah N',
      age: 21,
      campus: 'MUBS',
      bio: 'Marketing student in Nakawa. Love concerts, lakeside brunches, and good books.',
      looking_for: 'New friends',
      show_me: 'Everyone',
      interests: ['Concerts', 'Reading', 'Brunch'],
      status: 'pending_review',
      is_discoverable: true,
      teaser_opt_in: true,
      face_match_verified: false,
      verification_selfie_path: 'demo-photos/dummy22.png',
      created_at: hoursAgoIso(4),
    }
  )

  profile_photos.push(
    {
      id: '33333333-3333-4333-8333-333333333101',
      profile_id: demoMemberProfileId,
      image_url: 'demo-photos/dummy21.png',
      is_primary: true,
      status: 'approved',
      rejection_reason: null,
      reviewed_at: daysAgoIso(11),
      created_at: daysAgoIso(12),
    },
    {
      id: '33333333-3333-4333-8333-333333333102',
      profile_id: demoPendingProfileId,
      image_url: 'demo-photos/dummy22.png',
      is_primary: true,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: hoursAgoIso(4),
    }
  )

  SEED_PEERS.forEach((peer, idx) => {
    const n = idx + 1
    const uid = `11111111-1111-4111-8111-111111110${String(n).padStart(3, '0')}`
    const pid = `22222222-2222-4222-8222-222222220${String(n).padStart(3, '0')}`
    const phid = `33333333-3333-4333-8333-333333330${String(n).padStart(3, '0')}`
    const createdDays = (idx % 10) + 1

    users.push({
      id: uid,
      email: `peer${n}@silkroad.demo`,
      phone_number: `+256701${String(100000 + n * 137).slice(0, 6)}`,
      email_verified_at: daysAgoIso(createdDays),
      status: 'active',
      is_admin: false,
      terms_accepted_at: daysAgoIso(createdDays),
      created_at: daysAgoIso(createdDays),
    })
    passwords.set(uid, memberPass)

    profiles.push({
      id: pid,
      user_id: uid,
      display_name: peer.name,
      age: peer.age,
      campus: peer.campus,
      bio: peer.bio,
      looking_for: peer.lookingFor,
      show_me: 'Everyone',
      interests: peer.interests,
      status: 'approved',
      is_discoverable: true,
      teaser_opt_in: peer.teaser,
      face_match_verified: peer.verified,
      verification_selfie_path: `demo-photos/${peer.photo}`,
      created_at: daysAgoIso(createdDays),
    })

    profile_photos.push({
      id: phid,
      profile_id: pid,
      image_url: `demo-photos/${peer.photo}`,
      is_primary: true,
      status: 'approved',
      rejection_reason: null,
      reviewed_at: daysAgoIso(createdDays),
      created_at: daysAgoIso(createdDays),
    })
  })

  // Add extra profiles for Batches 2-4 testing & Admin priority queue:
  // 1) queueUserId (Brian T): pending_review + active weekly plan + open report (Tier 1 priority)
  // 2) paidPendingUserId (Kevin L): pending_review + active monthly plan (Tier 2 priority)
  // 3) draftUserId (Alex M): draft + unverified email (Checklist & OTP testing)
  // 4) rejectedUserId (Grace K): rejected + paused weekly plan (14-day recovery & refund testing)
  const queueUserId = '11111111-1111-4111-8111-111111110901'
  const queueProfileId = '22222222-2222-4222-8222-222222220901'
  const paidPendingUserId = '11111111-1111-4111-8111-111111110902'
  const paidPendingProfileId = '22222222-2222-4222-8222-222222220902'
  const draftUserId = '11111111-1111-4111-8111-111111110903'
  const draftProfileId = '22222222-2222-4222-8222-222222220903'
  const rejectedUserId = '11111111-1111-4111-8111-111111110904'
  const rejectedProfileId = '22222222-2222-4222-8222-222222220904'

  users.push(
    {
      id: queueUserId,
      email: 'brian@silkroad.demo',
      phone_number: '+256702889911',
      email_verified_at: hoursAgoIso(2),
      status: 'active',
      is_admin: false,
      terms_accepted_at: hoursAgoIso(2),
      created_at: hoursAgoIso(2),
    },
    {
      id: paidPendingUserId,
      email: 'kevin@silkroad.demo',
      phone_number: '+256702889922',
      email_verified_at: hoursAgoIso(1),
      status: 'active',
      is_admin: false,
      terms_accepted_at: hoursAgoIso(1),
      created_at: hoursAgoIso(1),
    },
    {
      id: draftUserId,
      email: 'draft@silkroad.demo',
      phone_number: '+256702889933',
      email_verified_at: null,
      status: 'active',
      is_admin: false,
      terms_accepted_at: hoursAgoIso(26),
      created_at: hoursAgoIso(26),
    },
    {
      id: rejectedUserId,
      email: 'rejected@silkroad.demo',
      phone_number: '+256702889944',
      email_verified_at: daysAgoIso(2),
      status: 'active',
      is_admin: false,
      terms_accepted_at: daysAgoIso(2),
      created_at: daysAgoIso(2),
    }
  )
  passwords.set(queueUserId, memberPass)
  passwords.set(paidPendingUserId, memberPass)
  passwords.set(draftUserId, memberPass)
  passwords.set(rejectedUserId, memberPass)
  profiles.push(
    {
      id: queueProfileId,
      user_id: queueUserId,
      display_name: 'Brian T',
      age: 24,
      campus: 'Kyambogo',
      bio: 'Industrial engineering student who enjoys chess, hiking, and live comedy.',
      looking_for: 'Dating',
      show_me: 'Everyone',
      interests: ['Chess', 'Hiking', 'Comedy'],
      status: 'pending_review',
      is_discoverable: true,
      teaser_opt_in: false,
      face_match_verified: false,
      verification_selfie_path: 'demo-photos/dummy23.png',
      created_at: hoursAgoIso(2),
    },
    {
      id: paidPendingProfileId,
      user_id: paidPendingUserId,
      display_name: 'Kevin L',
      age: 23,
      campus: 'Makerere University',
      bio: 'Economics finalist who loves acoustic guitar, weekend futsal, and espresso.',
      looking_for: 'Dating',
      show_me: 'Women',
      interests: ['Music', 'Coffee', 'Football'],
      status: 'pending_review',
      is_discoverable: true,
      teaser_opt_in: false,
      face_match_verified: false,
      verification_selfie_path: 'demo-photos/dummy24.png',
      created_at: hoursAgoIso(1),
    },
    {
      id: draftProfileId,
      user_id: draftUserId,
      display_name: 'Alex M',
      age: null,
      campus: null,
      bio: null,
      looking_for: null,
      show_me: null,
      interests: [],
      status: 'draft',
      draft_nudged_at: null,
      is_discoverable: true,
      teaser_opt_in: false,
      face_match_verified: false,
      verification_selfie_path: null,
      created_at: hoursAgoIso(26),
    },
    {
      id: rejectedProfileId,
      user_id: rejectedUserId,
      display_name: 'Grace K',
      age: 22,
      campus: 'MUBS',
      bio: 'Business analytics student into baking and sunset walks.',
      looking_for: 'Dating',
      show_me: 'Everyone',
      interests: ['Baking', 'Walking'],
      status: 'rejected',
      rejected_at: daysAgoIso(1),
      rejection_reason: 'Main photo was blurry — upload a clearer photo of just yourself.',
      is_discoverable: true,
      teaser_opt_in: false,
      face_match_verified: false,
      verification_selfie_path: 'demo-photos/dummy25.png',
      created_at: daysAgoIso(2),
    }
  )
  profile_photos.push(
    {
      id: '33333333-3333-4333-8333-333333330901',
      profile_id: queueProfileId,
      image_url: 'demo-photos/dummy23.png',
      is_primary: true,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: hoursAgoIso(2),
    },
    {
      id: '33333333-3333-4333-8333-333333330902',
      profile_id: '22222222-2222-4222-8222-222222220001',
      image_url: 'demo-photos/dummy24.png',
      is_primary: false,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: hoursAgoIso(3),
    },
    {
      id: '33333333-3333-4333-8333-333333330903',
      profile_id: '22222222-2222-4222-8222-222222220002',
      image_url: 'demo-photos/dummy25.png',
      is_primary: true,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: hoursAgoIso(1),
    },
    {
      id: '33333333-3333-4333-8333-333333330904',
      profile_id: paidPendingProfileId,
      image_url: 'demo-photos/dummy24.png',
      is_primary: true,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: hoursAgoIso(1),
    },
    {
      id: '33333333-3333-4333-8333-333333330905',
      profile_id: rejectedProfileId,
      image_url: 'demo-photos/dummy25.png',
      is_primary: true,
      status: 'pending',
      rejection_reason: null,
      reviewed_at: null,
      created_at: daysAgoIso(2),
    }
  )

  const profile_edits: DemoRow[] = [
    {
      id: '44444444-4444-4444-8444-444444440001',
      profile_id: '22222222-2222-4222-8222-222222220003',
      field_changed: 'bio',
      old_value: 'Architecture major sketching cafes and looking for genuine conversation.',
      new_value: 'Architecture finalist in Kampala. Weekend pottery, rooftop coffee, and good conversation.',
      status: 'pending_review',
      reviewed_at: null,
      created_at: hoursAgoIso(3),
    },
  ]

  const reports: DemoRow[] = [
    {
      id: '55555555-5555-4555-8555-555555550001',
      reporter_id: '11111111-1111-4111-8111-111111110001',
      reported_user_id: '11111111-1111-4111-8111-111111110009',
      reason: 'Profile bio mentions an external link that looks promotional.',
      status: 'open',
      created_at: hoursAgoIso(5),
    },
    {
      id: '55555555-5555-4555-8555-555555550002',
      reporter_id: '11111111-1111-4111-8111-111111110002',
      reported_user_id: queueUserId,
      reason: 'Suspicious duplicate photo flagged for review.',
      status: 'open',
      created_at: hoursAgoIso(1),
    },
  ]

  const subscriptions: DemoRow[] = [
    {
      id: '66666666-6666-4666-8666-666666660001',
      user_id: '11111111-1111-4111-8111-111111110002',
      plan_type: 'monthly',
      start_date: daysAgoIso(3),
      end_date: daysFromNowIso(27),
      payment_ref: 'SR-DEMO-0001',
      status: 'active',
      created_at: daysAgoIso(3),
    },
    {
      id: '66666666-6666-4666-8666-666666660002',
      user_id: '11111111-1111-4111-8111-111111110005',
      plan_type: 'weekly',
      start_date: daysAgoIso(1),
      end_date: daysFromNowIso(6),
      payment_ref: 'SR-DEMO-0002',
      status: 'active',
      created_at: daysAgoIso(1),
    },
    {
      id: '66666666-6666-4666-8666-666666660003',
      user_id: queueUserId,
      plan_type: 'weekly',
      start_date: hoursAgoIso(2),
      end_date: daysFromNowIso(7),
      payment_ref: 'SR-DEMO-0003',
      status: 'active',
      created_at: hoursAgoIso(2),
    },
    {
      id: '66666666-6666-4666-8666-666666660004',
      user_id: paidPendingUserId,
      plan_type: 'monthly',
      start_date: hoursAgoIso(1),
      end_date: daysFromNowIso(30),
      payment_ref: 'SR-DEMO-0004',
      status: 'active',
      created_at: hoursAgoIso(1),
    },
    {
      id: '66666666-6666-4666-8666-666666660005',
      user_id: rejectedUserId,
      plan_type: 'weekly',
      start_date: daysAgoIso(2),
      end_date: daysFromNowIso(5),
      paused_at: daysAgoIso(1),
      paused_remaining_ms: 6 * 86_400_000,
      payment_ref: 'SR-DEMO-0005',
      status: 'paused',
      created_at: daysAgoIso(2),
    },
  ]

  const payment_transactions: DemoRow[] = [
    {
      id: '77777777-7777-4777-8777-777777770001',
      user_id: '11111111-1111-4111-8111-111111110002',
      plan_type: 'monthly',
      amount: PLANS.monthly.amount,
      currency: 'UGX',
      merchant_reference: 'SR-DEMO-0001',
      order_tracking_id: 'sandbox-demo-0001',
      provider: 'pesapal',
      status: 'completed',
      pesapal_status: 'Completed',
      created_at: daysAgoIso(3),
      updated_at: daysAgoIso(3),
    },
    {
      id: '77777777-7777-4777-8777-777777770002',
      user_id: '11111111-1111-4111-8111-111111110005',
      plan_type: 'weekly',
      amount: PLANS.weekly.amount,
      currency: 'UGX',
      merchant_reference: 'SR-DEMO-0002',
      order_tracking_id: 'sandbox-demo-0002',
      provider: 'pesapal',
      status: 'completed',
      pesapal_status: 'Completed',
      created_at: daysAgoIso(1),
      updated_at: daysAgoIso(1),
    },
  ]

  return {
    users,
    profiles,
    profile_photos,
    profile_edits,
    likes: [
      {
        id: '88888888-8888-4888-8888-888888880001',
        liker_id: demoMemberId,
        liked_profile_id: '22222222-2222-4222-8222-222222220001',
        created_at: daysAgoIso(1),
      },
    ],
    blocks: [],
    reports,
    phone_unlock_events: [],
    subscriptions,
    payment_transactions,
    deletion_requests: [],
    admin_push_subscriptions: [],
    blocked_numbers: [
      {
        id: '99999999-9999-4999-8999-999999990001',
        phone_number: '256709000999',
        reason: 'Banned for repeated promotional spam.',
        blocked_by: demoAdminId,
        created_at: daysAgoIso(4),
      },
    ],
    refund_requests: [],
    email_otps: [],
    rate_limit_hits: [],
    passwords,
    uploadedPhotos: new Map<string, string>(),
  }
}

const globalForDemo = globalThis as unknown as { __silkRoadDemoStore?: DemoStore }

export function getDemoStore(): DemoStore {
  if (!globalForDemo.__silkRoadDemoStore) {
    globalForDemo.__silkRoadDemoStore = createInitialStore()
  }
  return globalForDemo.__silkRoadDemoStore
}

export function resolveDemoPhotoUrl(path: string): string {
  const store = getDemoStore()
  const uploaded = store.uploadedPhotos.get(path)
  if (uploaded) return uploaded
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (path.startsWith('demo-photos/')) {
    return `/${path}`
  }
  if (path.startsWith('/demo-photos/')) {
    return path
  }
  return '/demo-photos/dummy01.png'
}

type FilterFn = (row: DemoRow) => boolean

function parseInList(raw: string): string[] {
  const trimmed = raw.trim()
  const inner = trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed.slice(1, -1) : trimmed
  if (!inner) return []
  return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
}

function evalSimpleCondition(row: DemoRow, expr: string): boolean {
  const m = expr.match(/^([a-zA-Z0-9_]+)\.(eq|neq|gt|gte|lt|lte|is|ilike|in)\.([\s\S]+)$/)
  if (!m) return true
  const [, col, op, rawVal] = m
  const val = row[col]
  switch (op) {
    case 'eq':
      return String(val ?? '') === rawVal
    case 'neq':
      return String(val ?? '') !== rawVal
    case 'gt':
      return String(val ?? '') > rawVal
    case 'gte':
      return String(val ?? '') >= rawVal
    case 'lt':
      return String(val ?? '') < rawVal
    case 'lte':
      return String(val ?? '') <= rawVal
    case 'is':
      if (rawVal === 'null') return val === null || val === undefined
      if (rawVal === 'true') return val === true
      if (rawVal === 'false') return val === false
      return val === rawVal
    case 'ilike': {
      const needle = rawVal.replace(/^%|%$/g, '').toLowerCase()
      return String(val ?? '').toLowerCase().includes(needle)
    }
    case 'in': {
      const list = parseInList(rawVal)
      return list.includes(String(val ?? ''))
    }
    default:
      return true
  }
}

function splitTopLevelCommas(expr: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function evalOrExpr(row: DemoRow, expr: string): boolean {
  const branches = splitTopLevelCommas(expr)
  return branches.some((branch) => {
    if (branch.startsWith('and(') && branch.endsWith(')')) {
      const inner = branch.slice(4, -1)
      return splitTopLevelCommas(inner).every((c) => evalSimpleCondition(row, c))
    }
    return evalSimpleCondition(row, branch)
  })
}

function attachRelations(table: string, row: DemoRow, selectSpec: string, store: DemoStore): DemoRow {
  const copy: DemoRow = { ...row }
  if (table === 'profiles' && selectSpec.includes('profile_photos')) {
    copy.profile_photos = store.profile_photos
      .filter((ph) => ph.profile_id === row.id)
      .map((ph) => ({ ...ph }))
  }
  if (table === 'profile_photos' && selectSpec.includes('profiles')) {
    const prof = store.profiles.find((p) => p.id === row.profile_id)
    copy.profiles = prof ? { ...prof } : null
  }
  if (table === 'profile_edits' && selectSpec.includes('profiles')) {
    const prof = store.profiles.find((p) => p.id === row.profile_id)
    copy.profiles = prof ? { ...prof } : null
  }
  return copy
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

interface DemoQueryResult {
  data: unknown
  error: { message: string; code?: string } | null
  count?: number | null
}

class DemoQueryBuilder implements PromiseLike<DemoQueryResult> {
  private table: keyof DemoStore
  private store: DemoStore
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private selectSpec = '*'
  private countMode: 'exact' | null = null
  private headOnly = false
  private filters: FilterFn[] = []
  private orderBy: { col: string; ascending: boolean } | null = null
  private rangeSlice: { from: number; to: number } | null = null
  private limitCount: number | null = null
  private singleMode: 'single' | 'maybeSingle' | null = null
  private payload: DemoRow | DemoRow[] | null = null
  private returnSelect = false

  constructor(table: keyof DemoStore, store: DemoStore) {
    this.table = table
    this.store = store
  }

  private rows(): DemoRow[] {
    const list = this.store[this.table]
    return Array.isArray(list) ? list : []
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this.op === 'insert' || this.op === 'update' || this.op === 'delete') {
      this.returnSelect = true
      this.selectSpec = columns
      return this
    }
    this.op = 'select'
    this.selectSpec = columns
    if (opts?.count) this.countMode = opts.count
    if (opts?.head) this.headOnly = true
    return this
  }

  insert(values: DemoRow | DemoRow[]) {
    this.op = 'insert'
    this.payload = values
    return this
  }

  update(values: DemoRow) {
    this.op = 'update'
    this.payload = values
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val)
    return this
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val)
    return this
  }

  gt(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && compareValues(r[col], val) > 0)
    return this
  }

  gte(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && compareValues(r[col], val) >= 0)
    return this
  }

  lt(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && compareValues(r[col], val) < 0)
    return this
  }

  lte(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && compareValues(r[col], val) <= 0)
    return this
  }

  in(col: string, vals: unknown[]) {
    const set = new Set(vals)
    this.filters.push((r) => set.has(r[col]))
    return this
  }

  is(col: string, val: null | boolean) {
    this.filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val))
    return this
  }

  not(col: string, op: string, val: unknown) {
    if (op === 'in') {
      const list = Array.isArray(val) ? val.map(String) : parseInList(String(val))
      const set = new Set(list)
      this.filters.push((r) => !set.has(String(r[col] ?? '')))
    } else if (op === 'is') {
      this.filters.push((r) => (val === null ? r[col] !== null && r[col] !== undefined : r[col] !== val))
    } else if (op === 'eq') {
      this.filters.push((r) => r[col] !== val)
    }
    return this
  }

  or(expr: string) {
    this.filters.push((r) => evalOrExpr(r, expr))
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false }
    return this
  }

  range(from: number, to: number) {
    this.rangeSlice = { from, to }
    return this
  }

  limit(n: number) {
    this.limitCount = n
    return this
  }

  single() {
    this.singleMode = 'single'
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle'
    return this
  }

  private execute(): DemoQueryResult {
    const tableArr = this.rows()

    if (this.op === 'insert') {
      const rawItems = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []
      const items = rawItems.map((item) => {
        const now = new Date().toISOString()
        const row: DemoRow = {
          id: item.id ?? randomUUID(),
          created_at: item.created_at ?? now,
          ...item,
        }
        return row
      })

      if (this.table === 'users') {
        for (const item of items) {
          if (item.phone_number && tableArr.some((u) => u.phone_number === item.phone_number && u.id !== item.id)) {
            return { data: null, error: { message: 'duplicate phone_number', code: '23505' } }
          }
        }
      }

      tableArr.push(...items)
      if (!this.returnSelect) {
        return { data: null, error: null }
      }
      if (this.singleMode) {
        return { data: items[0] ? { ...items[0] } : null, error: null }
      }
      return { data: items.map((r) => ({ ...r })), error: null }
    }

    if (this.op === 'update') {
      const patch = (Array.isArray(this.payload) ? this.payload[0] : this.payload) ?? {}
      const matched: DemoRow[] = []
      for (const row of tableArr) {
        if (this.filters.every((fn) => fn(row))) {
          if (this.table === 'users' && patch.phone_number) {
            const clash = tableArr.some(
              (u) => u.phone_number === patch.phone_number && u.id !== row.id
            )
            if (clash) {
              return { data: null, error: { message: 'duplicate phone_number', code: '23505' } }
            }
          }
          Object.assign(row, patch)
          matched.push(row)
        }
      }
      if (!this.returnSelect) {
        return { data: null, error: null }
      }
      if (this.singleMode === 'maybeSingle') {
        return { data: matched[0] ? { ...matched[0] } : null, error: null }
      }
      if (this.singleMode === 'single') {
        return matched[0]
          ? { data: { ...matched[0] }, error: null }
          : { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      }
      return { data: matched.map((r) => ({ ...r })), error: null }
    }

    if (this.op === 'delete') {
      const remaining: DemoRow[] = []
      const removed: DemoRow[] = []
      for (const row of tableArr) {
        if (this.filters.every((fn) => fn(row))) {
          removed.push(row)
        } else {
          remaining.push(row)
        }
      }
      if (this.table === 'users') this.store.users = remaining
      else if (this.table === 'profiles') this.store.profiles = remaining
      else if (this.table === 'profile_photos') this.store.profile_photos = remaining
      else if (this.table === 'profile_edits') this.store.profile_edits = remaining
      else if (this.table === 'likes') this.store.likes = remaining
      else if (this.table === 'blocks') this.store.blocks = remaining
      else if (this.table === 'reports') this.store.reports = remaining
      else if (this.table === 'phone_unlock_events') this.store.phone_unlock_events = remaining
      else if (this.table === 'subscriptions') this.store.subscriptions = remaining
      else if (this.table === 'payment_transactions') this.store.payment_transactions = remaining
      else if (this.table === 'deletion_requests') this.store.deletion_requests = remaining
      else if (this.table === 'admin_push_subscriptions') this.store.admin_push_subscriptions = remaining
      else if (this.table === 'blocked_numbers') this.store.blocked_numbers = remaining
      else if (this.table === 'refund_requests') this.store.refund_requests = remaining
      else if (this.table === 'email_otps') this.store.email_otps = remaining
      else if (this.table === 'rate_limit_hits') this.store.rate_limit_hits = remaining
      return { data: this.returnSelect ? removed : null, error: null }
    }

    // SELECT
    let matched = tableArr.filter((r) => this.filters.every((fn) => fn(r)))
    const totalCount = this.countMode === 'exact' ? matched.length : null

    if (this.orderBy) {
      const { col, ascending } = this.orderBy
      matched = [...matched].sort((a, b) => {
        const cmp = compareValues(a[col], b[col])
        return ascending ? cmp : -cmp
      })
    }

    if (this.rangeSlice) {
      matched = matched.slice(this.rangeSlice.from, this.rangeSlice.to + 1)
    } else if (this.limitCount !== null) {
      matched = matched.slice(0, this.limitCount)
    }

    if (this.headOnly) {
      return { data: null, error: null, count: totalCount }
    }

    const projected = matched.map((r) => attachRelations(String(this.table), r, this.selectSpec, this.store))

    if (this.singleMode === 'single') {
      if (projected.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: totalCount }
      }
      return { data: projected[0], error: null, count: totalCount }
    }

    if (this.singleMode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null, count: totalCount }
    }

    return { data: projected, error: null, count: totalCount }
  }

  then<TResult1 = DemoQueryResult, TResult2 = never>(
    onfulfilled?: ((value: DemoQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }
}

export interface DemoSessionBridge {
  getUserId: () => string | null | Promise<string | null>
  setUserId?: (id: string) => void | Promise<void>
  clearUserId?: () => void | Promise<void>
}

export function createDemoClient(bridge: DemoSessionBridge) {
  const store = getDemoStore()

  const auth = {
    async getUser() {
      const uid = await bridge.getUserId()
      if (!uid) return { data: { user: null }, error: null }
      const userRow = store.users.find((u) => u.id === uid)
      if (!userRow) return { data: { user: null }, error: null }
      return {
        data: {
          user: {
            id: String(userRow.id),
            email: String(userRow.email),
            user_metadata: {},
            app_metadata: {},
            aud: 'authenticated',
            created_at: String(userRow.created_at),
          },
        },
        error: null,
      }
    },

    async getSession() {
      const { data } = await auth.getUser()
      return {
        data: {
          session: data.user ? { user: data.user, access_token: 'demo-token' } : null,
        },
        error: null,
      }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const normalized = email.trim().toLowerCase()
      const userRow = store.users.find((u) => String(u.email).toLowerCase() === normalized)
      if (!userRow) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } }
      }
      const userId = String(userRow.id)
      const storedHash = store.passwords.get(userId)
      if (!storedHash || !verifyPassword(password, storedHash)) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } }
      }
      await bridge.setUserId?.(userId)
      const user = {
        id: userId,
        email: String(userRow.email),
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
        created_at: String(userRow.created_at),
      }
      return { data: { user, session: { user, access_token: 'demo-token' } }, error: null }
    },

    async signUp({ email, password }: { email: string; password: string }) {
      const normalized = email.trim().toLowerCase()
      if (store.users.some((u) => String(u.email).toLowerCase() === normalized)) {
        return {
          data: { user: null, session: null },
          error: { message: 'User already registered', code: 'user_already_exists' },
        }
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      const userRow: DemoRow = {
        id,
        email: normalized,
        phone_number: null,
        email_verified_at: null,
        status: 'active',
        is_admin: false,
        terms_accepted_at: null,
        created_at: now,
      }
      store.users.push(userRow)
      store.passwords.set(id, hashPassword(password))
      await bridge.setUserId?.(id)
      const user = {
        id,
        email: normalized,
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
        created_at: now,
      }
      return { data: { user, session: { user, access_token: 'demo-token' } }, error: null }
    },

    async signOut() {
      await bridge.clearUserId?.()
      return { error: null }
    },

    async verifyOtp() {
      return { data: { user: null, session: null }, error: null }
    },

    async resend() {
      return { data: {}, error: null }
    },

    async resetPasswordForEmail() {
      return { data: {}, error: null }
    },

    admin: {
      async deleteUser(userId: string) {
        store.users = store.users.filter((u) => u.id !== userId)
        store.passwords.delete(userId)
        return { data: { user: null }, error: null }
      },
    },
  }

  const storage = {
    from() {
      return {
        async upload(path: string, file: File | Blob | Buffer | ArrayBuffer, opts?: { contentType?: string }) {
          let dataUrl = ''
          try {
            if (typeof File !== 'undefined' && file instanceof Blob) {
              const buf = Buffer.from(await file.arrayBuffer())
              const mime = opts?.contentType || file.type || 'image/jpeg'
              dataUrl = `data:${mime};base64,${buf.toString('base64')}`
            } else if (Buffer.isBuffer(file)) {
              const mime = opts?.contentType || 'image/jpeg'
              dataUrl = `data:${mime};base64,${file.toString('base64')}`
            } else if (file instanceof ArrayBuffer) {
              const mime = opts?.contentType || 'image/jpeg'
              dataUrl = `data:${mime};base64,${Buffer.from(file).toString('base64')}`
            }
          } catch {
            dataUrl = '/demo-photos/dummy01.png'
          }
          if (dataUrl) {
            store.uploadedPhotos.set(path, dataUrl)
          }
          return { data: { path }, error: null }
        },

        async createSignedUrl(path: string) {
          return { data: { signedUrl: resolveDemoPhotoUrl(path) }, error: null }
        },

        async createSignedUrls(paths: string[]) {
          return {
            data: paths.map((p) => ({
              path: p,
              signedUrl: resolveDemoPhotoUrl(p),
              error: null,
            })),
            error: null,
          }
        },

        async list(folder: string) {
          const prefix = folder.endsWith('/') ? folder : `${folder}/`
          const files: { name: string }[] = []
          for (const key of store.uploadedPhotos.keys()) {
            if (key.startsWith(prefix)) {
              files.push({ name: key.slice(prefix.length) })
            }
          }
          for (const ph of store.profile_photos) {
            if (String(ph.image_url).startsWith(prefix)) {
              files.push({ name: String(ph.image_url).slice(prefix.length) })
            }
          }
          return { data: files, error: null }
        },

        async remove(paths: string[]) {
          for (const p of paths) {
            store.uploadedPhotos.delete(p)
          }
          return { data: paths.map((name) => ({ name })), error: null }
        },
      }
    },
  }

  async function rpc(name: string, args: Record<string, unknown> = {}) {
    if (name === 'get_teaser_profiles') {
      const maxRows = Number(args.max_rows ?? 8)
      const eligible = store.profiles.filter((p) => {
        if (p.status !== 'approved' || p.is_discoverable === false || !p.teaser_opt_in) return false
        const owner = store.users.find((u) => u.id === p.user_id)
        if (!owner || owner.status !== 'active') return false
        return store.profile_photos.some((ph) => ph.profile_id === p.id && ph.status === 'approved')
      })
      const rows = eligible.slice(0, maxRows).map((p) => {
        const photos = store.profile_photos.filter((ph) => ph.profile_id === p.id && ph.status === 'approved')
        const primary = photos.find((ph) => ph.is_primary) ?? photos[0]
        return {
          first_name: String(p.display_name || '').split(' ')[0],
          age: p.age,
          campus: p.campus,
          photo_path: primary.image_url,
        }
      })
      return { data: rows, error: null }
    }

    if (name === 'complete_payment') {
      const ref = String(args.p_merchant_reference ?? '')
      const tx = store.payment_transactions.find((t) => t.merchant_reference === ref)
      if (!tx) return { data: 'not_found', error: null }
      if (tx.status === 'completed') return { data: 'already_completed', error: null }
      if (Number(args.p_amount) !== Number(tx.amount) || String(args.p_currency) !== String(tx.currency)) {
        tx.status = 'review'
        tx.updated_at = new Date().toISOString()
        return { data: 'amount_mismatch', error: null }
      }
      const now = new Date()
      const planDays = isPlanId(tx.plan_type) ? PLANS[tx.plan_type].days : 7
      const end = new Date(now.getTime() + planDays * 86_400_000)
      tx.status = 'completed'
      tx.order_tracking_id = args.p_order_tracking_id ?? tx.order_tracking_id
      tx.payment_method = args.p_payment_method ?? null
      tx.confirmation_code = args.p_confirmation_code ?? null
      tx.pesapal_status = 'Completed'
      tx.updated_at = now.toISOString()

      store.subscriptions.push({
        id: randomUUID(),
        user_id: tx.user_id,
        plan_type: tx.plan_type,
        start_date: now.toISOString(),
        end_date: end.toISOString(),
        payment_ref: ref,
        status: 'active',
        created_at: now.toISOString(),
      })
      return { data: 'activated', error: null }
    }

    if (name === 'purge_user_data') {
      const userId = String(args.p_user_id ?? '')
      const userProfiles = store.profiles.filter((p) => p.user_id === userId).map((p) => p.id)
      const profileSet = new Set(userProfiles)
      store.profile_photos = store.profile_photos.filter((ph) => !profileSet.has(ph.profile_id))
      store.profile_edits = store.profile_edits.filter((pe) => !profileSet.has(pe.profile_id))
      store.profiles = store.profiles.filter((p) => p.user_id !== userId)
      store.likes = store.likes.filter((l) => l.liker_id !== userId && !profileSet.has(l.liked_profile_id))
      store.blocks = store.blocks.filter((b) => b.blocker_id !== userId && b.blocked_id !== userId)
      store.phone_unlock_events = store.phone_unlock_events.filter(
        (ev) => ev.viewer_id !== userId && !profileSet.has(ev.profile_id)
      )
      store.subscriptions = store.subscriptions.filter((s) => s.user_id !== userId)
      store.refund_requests = store.refund_requests.filter((r) => r.user_id !== userId)
      store.email_otps = store.email_otps.filter((o) => o.user_id !== userId)
      store.users = store.users.filter((u) => u.id !== userId)
      return { data: null, error: null }
    }

    return { data: null, error: { message: `Unknown RPC: ${name}` } }
  }

  return {
    from(table: keyof DemoStore) {
      return new DemoQueryBuilder(table, store)
    },
    rpc,
    auth,
    storage,
  }
}
