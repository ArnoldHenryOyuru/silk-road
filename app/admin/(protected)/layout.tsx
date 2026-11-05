import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import AdminTopNav from '@/components/AdminTopNav'

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'SR Admin', statusBarStyle: 'black-translucent' },
  icons: { apple: '/admin-icon-192.png' },
}

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/sign-in')

  const { data: accountRow } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!accountRow?.is_admin) redirect('/admin/sign-in')

  // Admin queries bypass RLS on purpose — a moderator needs to see other
  // people's pending/private data by definition. The is_admin check above
  // is what stands in for RLS here; guard it carefully.
  const service = createServiceClient()

  const [profiles, photos, edits, reports] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    service.from('profile_photos').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('profile_edits').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  const counts = {
    profiles: profiles.count ?? 0,
    photos: photos.count ?? 0,
    edits: edits.count ?? 0,
    reports: reports.count ?? 0,
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <AdminTopNav counts={counts} />
      <main>{children}</main>
    </div>
  )
}
