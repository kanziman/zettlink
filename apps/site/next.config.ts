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
  // 워크스페이스 패키지를 소스에서 트랜스파일 (dist 미빌드 의존 제거).
  // @zettlink/db는 ./anon 소스 엔트리(createAnonClient)만 사용한다.
  transpilePackages: ['@zettlink/ui', '@zettlink/shared', '@zettlink/db'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
