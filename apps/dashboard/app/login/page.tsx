// 이메일/패스워드 로그인 페이지
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase/browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="login-shell">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">zettlink</h1>
        <input
          className="login-input"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="login-input"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error !== null ? <p className="login-error">{error}</p> : null}
        <button className="login-button" type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </main>
  )
}
