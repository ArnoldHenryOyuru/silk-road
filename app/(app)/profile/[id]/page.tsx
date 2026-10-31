import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileView, { type ProfileViewData } from './ProfileView'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function isNewProfile(createdAt: string) {
  const created = new Date(createdAt).getTime()
  return Date.now() - created < 7 * 24 * 60 * 60 * 1000
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // (app)/layout.tsx already redirects signed-out users

  // Round 1: the profile, your like and your subscription don't depend on
  // each other, so fetch them together.
  const [{ data: profile }, { data: likeRow }, { data: subscription }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `
        id, user_id, status, display_name, age, campus, bio, looking_for, interests,
        face_match_verified, created_at,
        profile_photos ( image_url, status, is_primary )
      `
      )
      .eq('id', id)
      .single(),
    supabase
      .from('likes')
      .select('id')
      .eq('liker_id', user.id)
      .eq('liked_profile_id', id)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .maybeSingle(),
  ])

  if (!profile) notFound()

  // Not found, or pending review and not your own — same 404 either way,
  // so a stranger can't tell "doesn't exist" apart from "not approved yet".
  if (profile.status !== 'approved' && profile.user_id !== user.id) {
    notFound()
  }

  // Primary photo first.
  const approvedPhotos = (profile.profile_photos ?? [])
    .filter((p: any) => p.status === 'approved')
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
  const paths: string[] = approvedPhotos.map((p: any) => p.image_url)

  // Round 2: the block check needs the profile owner's id, and signing needs
  // the photo paths. Both are ready now and independent of each other.
  const [{ data: blockRow }, signResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${profile.user_id}),and(blocker_id.eq.${profile.user_id},blocked_id.eq.${user.id})`
      )
      .maybeSingle(),
    paths.length > 0
      ? supabase.storage.from('profile-photos').createSignedUrls(paths, 3600)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  // Don't let a blocked relationship (either direction) be viewable.
  if (blockRow) notFound()

  if (signResult.error) {
    console.error('Profile: batch signing failed:', signResult.error.message)
  }

  // Results are matched by path, then put back in the original order.
  const signedByPath = new Map<string, string>()
  for (const item of signResult.data ?? []) {
    if (item.signedUrl && item.path) {
      signedByPath.set(item.path, item.signedUrl)
    } else if (item.error) {
      console.error('Profile: sign failed for', item.path, item.error)
    }
  }

  const photoUrls = paths
    .map((path) => signedByPath.get(path))
    .filter((url): url is string => !!url)

  const data: ProfileViewData = {
    id: profile.id,
    displayName: profile.display_name,
    age: profile.age,
    campus: profile.campus,
    bio: profile.bio,
    lookingFor: profile.looking_for,
    interests: profile.interests ?? [],
    verified: !!profile.face_match_verified,
    isNew: isNewProfile(profile.created_at),
    photoUrls,
    initials: getInitials(profile.display_name),
    liked: !!likeRow,
  }

  return <ProfileView profile={data} isSubscribed={!!subscription} isOwner={profile.user_id === user.id} />
}
