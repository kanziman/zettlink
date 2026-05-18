// Next.js 15 dashboard 설정 — turbopack 개발, workspace 패키지 트랜스파일
import { config as dotenvConfig } from 'dotenv'
import { join } from 'path'
import type { NextConfig } from 'next'

// 모노레포 루트 .env 로드 (apps/dashboard 기준 두 단계 위)
// 빌드 타임 env var 평가 시점에 @zettlink/shared/config.ts가 ZodError를 던지지 않도록
dotenvConfig({ path: join(process.cwd(), '../../.env'), override: false })

const nextConfig: NextConfig = {
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
