import type { Metadata } from "next";
import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Silk Road',
  description: 'A campus-focused connections platform.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

// Merge this into your EXISTING app/layout.tsx (replace any current `metadata` export).
// This is not a new file to add on its own.

export const metadata: Metadata = {
  // Change this to https://silkroadug.com once you buy the domain
  metadataBase: new URL("https://silkroadug.vercel.app"),
  title: "Silk Road",
  description: "Discover and connect with people on campus.",
  openGraph: {
    title: "Silk Road",
    description: "Discover and connect with people on campus.",
    url: "/",
    siteName: "Silk Road",
    type: "website",
    locale: "en_UG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silk Road",
    description: "Discover and connect with people on campus.",
  },
};