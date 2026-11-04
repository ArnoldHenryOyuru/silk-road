import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The members shown on the public homepage. Eligibility is decided in the
 * database (get_teaser_profiles, migration C): approved, active, listed on
 * Discover, homepage opt-in on, with an approved photo.
 *
 * Results are cached for 60 seconds so a busy homepage doesn't hit the
 * database and storage on every visit. A member who switches to Discreet can
 * therefore linger here for up to a minute. Photo links last 15 minutes.
 */
export type TeaserCard = {
  firstName: string
  age: number
  campus: string
  photoUrl: string
}

const TEASER_SIZE = 8
const PHOTO_LINK_SECONDS = 15 * 60

/** Below this many cards the homepage shows a "Join to see members" block instead. */
export const TEASER_MIN = 4

type TeaserRow = { first_name: string; age: number; campus: string; photo_path: string }

async function loadTeaser(): Promise<TeaserCard[]> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin.rpc('get_teaser_profiles', { max_rows: TEASER_SIZE })
    if (error || !data) {
      console.error('teaser: lookup failed', error?.message)
      return []
    }
    const rows = data as TeaserRow[]
    if (rows.length === 0) return []

    const { data: signedList, error: signError } = await admin.storage
      .from('profile-photos')
      .createSignedUrls(
        rows.map((row) => row.photo_path),
        PHOTO_LINK_SECONDS
      )
    if (signError) console.error('teaser: signing failed', signError.message)

    // Matched by path, so one photo that fails to sign only drops that card.
    const urlByPath = new Map<string, string>()
    for (const item of signedList ?? []) {
      if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl)
    }

    return rows.flatMap((row) => {
      const photoUrl = urlByPath.get(row.photo_path)
      return photoUrl && row.first_name
        ? [{ firstName: row.first_name, age: row.age, campus: row.campus, photoUrl }]
        : []
    })
  } catch (err) {
    // The homepage must still load if this fails; it falls back to the join block.
    console.error('teaser: unexpected error', err instanceof Error ? err.message : err)
    return []
  }
}

export const getTeaser = unstable_cache(loadTeaser, ['home-teaser-v1'], { revalidate: 60 })
