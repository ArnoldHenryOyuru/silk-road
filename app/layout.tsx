import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  // Change this to https://silkroadug.com once you buy the domain
  metadataBase: new URL('https://silkroadug.vercel.app'),
  title: 'Silk Road',
  description: 'A campus-focused connections platform.',
  openGraph: {
    title: 'Silk Road',
    description: 'A campus-focused connections platform.',
    url: '/',
    siteName: 'Silk Road',
    type: 'website',
    locale: 'en_UG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Silk Road',
    description: 'A campus-focused connections platform.',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  )
}
