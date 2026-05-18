// Next.js 15 dashboard 설정 — turbopack 개발, workspace 패키지 트랜스파일
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@zettlink/ui', '@zettlink/shared', '@zettlink/db'],
}

export default nextConfig
