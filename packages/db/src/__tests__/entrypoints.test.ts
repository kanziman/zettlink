// DB 패키지 엔트리포인트가 서버/브라우저 경계를 지키는지 검증하는 테스트
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

describe('db package entrypoints', () => {
  test('browser entrypoint does not import server-only shared config', () => {
    const browserSource = source('src/browser.ts')

    expect(browserSource).not.toContain('@zettlink/shared')
    expect(browserSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(browserSource).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(browserSource).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })

  test('server entrypoint owns service role and route client factories', () => {
    const serverSource = source('src/server.ts')

    expect(serverSource).toContain('@zettlink/shared')
    expect(serverSource).toContain('createServiceClient')
    expect(serverSource).toContain('createRouteClient')
  })
})
