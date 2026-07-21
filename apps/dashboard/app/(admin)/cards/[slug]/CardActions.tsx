// 카드 상세 액션 버튼 — enrich / publish / reprocess
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@zettlink/ui'
import { SettingsIcon, LockIcon, AlertTriangleIcon, CheckIcon } from '../../_components/Icons'

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
    <div style={{
      background: 'var(--color-background-normal)',
      border: '1px solid var(--color-line-normal)',
      borderRadius: '16px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 4px 12px rgba(12, 74, 110, 0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    }}>
      {error !== null && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          color: 'var(--color-status-error)',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}>
          <AlertTriangleIcon /> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* 콘텐츠 생성 도구 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--color-label-alternative)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <SettingsIcon /> AI 콘텐츠 추가 생성
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Button
              variant={hasDeep ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => handleEnrich('deep')}
              disabled={hasDeep || loading !== null}
              style={{ flex: 1, minWidth: '100px' }}
            >
              {loading === 'deep' ? (
                '생성 중…'
              ) : hasDeep ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckIcon style={{ width: '14px', height: '14px' }} /> 심화 완료
                </span>
              ) : (
                '심화 분석 생성'
              )}
            </Button>
            <Button
              variant={hasTil ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => handleEnrich('til')}
              disabled={hasTil || loading !== null}
              style={{ flex: 1, minWidth: '100px' }}
            >
              {loading === 'til' ? (
                '생성 중…'
              ) : hasTil ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckIcon style={{ width: '14px', height: '14px' }} /> TIL 완료
                </span>
              ) : (
                'TIL 생성'
              )}
            </Button>
            <Button
              variant={hasGuide ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => handleEnrich('guide')}
              disabled={hasGuide || loading !== null}
              style={{ flex: 1, minWidth: '100px' }}
            >
              {loading === 'guide' ? (
                '생성 중…'
              ) : hasGuide ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckIcon style={{ width: '14px', height: '14px' }} /> 가이드 완료
                </span>
              ) : (
                '실용 가이드 생성'
              )}
            </Button>
          </div>
        </div>

        {/* 관리 작업 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--color-label-alternative)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <LockIcon /> 관리 및 배포 작업
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePublish}
              disabled={loading !== null}
              style={{
                flex: 1,
                minWidth: '120px',
                background: published ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-primary-normal)',
                color: published ? '#EF4444' : '#fff',
                borderColor: published ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              }}
            >
              {loading === 'publish' ? '처리 중…' : published ? '비공개로 전환 (Unpublish)' : '포털 공개 (Publish)'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReprocess}
              disabled={loading !== null}
              style={{ flex: 1, minWidth: '100px' }}
            >
              {loading === 'reprocess' ? '큐잉 중…' : '전체 재분석 (Reprocess)'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
