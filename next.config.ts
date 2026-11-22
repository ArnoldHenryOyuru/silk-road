import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Default is 1MB — too small for multiple profile photos + a selfie
      // in one submission (profile creation and Edit Profile both upload
      // several files via a single Server Action call).
      bodySizeLimit: '15mb',
    },
  },
}

export default nextConfig
