// Next.js 15 정적 사이트 설정 — output: 'export', anon 키 전용
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
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
