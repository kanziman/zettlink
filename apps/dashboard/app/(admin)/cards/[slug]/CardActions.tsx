// 카드 상세 액션 버튼 — enrich / publish / reprocess
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@zettlink/ui'

interface CardActionsProps {
  cardId: string
  hasDeep: boolean
  hasTil: boolean
  hasGuide: boolean
  published: boolean
}

export function CardActions({ cardId, hasDeep, hasTil, hasGuide, published }: CardActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function callApi(path: string, body: Record<string, unknown>) {
    setError(null)
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }
    return res.json()
  }

  async function handleEnrich(type: 'deep' | 'til' | 'guide') {
    setLoading(type)
    try {
      await callApi('/api/enrich', { id: cardId, type })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  async function handlePublish() {
    setLoading('publish')
    try {
      await callApi('/api/publish', { id: cardId })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  async function handleReprocess() {
    setLoading('reprocess')
    try {
      await callApi('/api/reprocess', { id: cardId })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('deep')}
          disabled={hasDeep || loading !== null}
        >
          {loading === 'deep' ? '생성 중…' : hasDeep ? '심화 완료' : '심화 요약'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('til')}
          disabled={hasTil || loading !== null}
        >
          {loading === 'til' ? '생성 중…' : hasTil ? 'TIL 완료' : 'TIL'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('guide')}
          disabled={hasGuide || loading !== null}
        >
          {loading === 'guide' ? '생성 중…' : hasGuide ? '가이드 완료' : '가이드'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePublish}
          disabled={loading !== null}
        >
          {loading === 'publish' ? '처리 중…' : published ? 'Unpublish' : 'Publish'}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleReprocess}
          disabled={loading !== null}
        >
          {loading === 'reprocess' ? '큐잉 중…' : '재처리'}
        </Button>
      </div>
      {error !== null ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-status-error)', margin: 0 }}>{error}</p>
      ) : null}
    </div>
  )
}
