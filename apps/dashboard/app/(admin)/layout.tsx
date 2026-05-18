// admin 영역 공통 레이아웃 — 네비게이션 바 + 서버 측 admin 재확인
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { config as appConfig } from '@zettlink/shared'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { LogoutButton } from './_components/LogoutButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (!appConfig.adminUserIds.includes(user.id)) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-status-error)' }}>
        403 Forbidden
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-normal)' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '0 1.5rem',
          height: '56px',
          borderBottom: '1px solid var(--color-line-normal)',
          position: 'sticky',
          top: 0,
          background: 'var(--color-background-normal)',
          zIndex: 10,
        }}
      >
        <a
          href="/"
          style={{
            fontWeight: 700,
            fontSize: '1.125rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          zettlink
        </a>
        <a
          href="/monitor"
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-label-alternative)',
            textDecoration: 'none',
          }}
        >
          모니터
        </a>
        <div style={{ flex: 1 }} />
        <LogoutButton />
      </nav>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
