// 로그아웃 버튼 — 브라우저 Supabase 클라이언트로 세션 종료
'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        fontSize: '0.875rem',
        color: 'var(--color-label-alternative)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem 0.5rem',
      }}
    >
      로그아웃
    </button>
  )
}
