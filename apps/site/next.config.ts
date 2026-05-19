// Next.js 15 정적 사이트 설정 — output: 'export', anon 키 전용
import { config as dotenvConfig } from 'dotenv'
import { join } from 'path'
import type { NextConfig } from 'next'

// 모노레포 루트 .env 로드 (apps/site 기준 두 단계 위)
// SUPABASE_URL / SUPABASE_ANON_KEY → lib/cards.ts에서 NEXT_PUBLIC_ 폴백으로 참조
dotenvConfig({ path: join(process.cwd(), '../../.env'), override: false })

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // @zettlink/ui와 @zettlink/shared 모두 트랜스파일 (ESM 소스 → 번들)
  transpilePackages: ['@zettlink/ui', '@zettlink/shared'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
