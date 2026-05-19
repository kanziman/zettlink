// Next.js 15 정적 사이트 설정 — output: 'export', anon 키 전용
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // @zettlink/shared(config.ts)는 SERVICE_ROLE_KEY가 필요하므로 포함하지 않는다
  // @zettlink/ui 컴포넌트만 트랜스파일
  transpilePackages: ['@zettlink/ui'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
