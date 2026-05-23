// 그리드 카드 목록 + 상세 모달 — 클라이언트 컴포넌트
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type CardForGrid = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  created_at: string
  summary: string | null
  tags: string[]
}

const PLATFORM_ACCENT: Record<string, string> = {
  youtube: '#FF4242',
  github: '#37383C',
}

function accentColor(platform: string, status: string): string {
  if (status === 'processing') return 'var(--color-status-caution)'
  if (status === 'failed' || status === 'error') return 'var(--color-status-error)'
  return PLATFORM_ACCENT[platform] ?? 'var(--color-label-alternative)'
}

function platformLabel(platform: string): string {
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'github') return 'GitHub'
  return platform
}

function statusLabel(status: string): string {
  if (status === 'done') return '완료'
  if (status === 'processing') return '처리 중'
  if (status === 'failed') return '실패'
  if (status === 'error') return '오류'
  return status
}

function statusColor(status: string): string {
  if (status === 'done') return 'var(--color-status-success)'
  if (status === 'processing') return 'var(--color-status-caution)'
  return 'var(--color-status-error)'
}

interface CardGridProps {
  cards: CardForGrid[]
}

export function CardGrid({ cards }: CardGridProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const selectedCard = cards.find((c) => c.id === selectedId) ?? null

  function closeModal() {
    setSelectedId(null)
    setPublishError(null)
  }

  useEffect(() => {
    if (selectedCard == null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCard])

  async function handlePublishToggle(card: CardForGrid) {
    if (publishing) return
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
      closeModal()
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setPublishing(false)
    }
  }

  if (cards.length === 0) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--color-label-assistive)', padding: '3rem 0' }}>
        카드가 없습니다.
      </p>
    )
  }

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {cards.map((card) => {
          const accent = accentColor(card.platform, card.status)
          const isProcessing = card.status === 'processing'
          return (
            <div
              key={card.id}
              onClick={() => { if (!isProcessing) setSelectedId(card.id) }}
              style={{
                background: 'var(--color-background-normal)',
                border: '1px solid var(--color-line-normal)',
                borderLeft: `3px solid ${accent}`,
                borderRadius: '12px',
                padding: '1.125rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                cursor: isProcessing ? 'default' : 'pointer',
                opacity: isProcessing ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                if (isProcessing) return
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                el.style.transform = ''
              }}
            >
              {/* 플랫폼 + 상태 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: accent }}>
                  {platformLabel(card.platform)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {card.status !== 'done' && (
                    <span style={{ fontSize: '0.75rem', color: statusColor(card.status) }}>
                      {statusLabel(card.status)}
                    </span>
                  )}
                  {card.published && (
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--color-status-success)',
                      background: 'rgba(18,213,137,0.1)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}>공개</span>
                  )}
                </div>
              </div>

              {/* 제목 */}
              <h3 style={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {card.title ?? card.id}
              </h3>

              {/* 요약 */}
              {card.summary != null && (
                <p style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-label-alternative)',
                  margin: 0,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flex: 1,
                }}>
                  {card.summary}
                </p>
              )}

              {/* 태그 + 날짜 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--color-line-normal)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {card.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.6875rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'var(--color-background-alternative)',
                        color: 'var(--color-label-alternative)',
                        border: '1px solid var(--color-line-normal)',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-label-assistive)', flexShrink: 0, marginLeft: '0.5rem' }}>
                  {new Date(card.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 상세 모달 */}
      {selectedCard != null && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              background: 'var(--color-background-normal)',
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--color-line-normal)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{
                  width: '3px',
                  height: '18px',
                  borderRadius: '2px',
                  background: accentColor(selectedCard.platform, selectedCard.status),
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-label-alternative)' }}>
                  {platformLabel(selectedCard.platform)}
                </span>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-label-alternative)',
                  fontSize: '1.125rem',
                  lineHeight: 1,
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* 모달 바디 */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.4 }}>
                {selectedCard.title ?? selectedCard.id}
              </h2>

              {/* 발행 상태 + 태그 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: selectedCard.published ? 'rgba(18,213,137,0.1)' : 'var(--color-background-alternative)',
                  color: selectedCard.published ? 'var(--color-status-success)' : 'var(--color-label-alternative)',
                  border: `1px solid ${selectedCard.published ? 'rgba(18,213,137,0.3)' : 'var(--color-line-normal)'}`,
                }}>
                  {selectedCard.published ? '● 공개' : '비공개'}
                </span>
                {selectedCard.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0,102,255,0.08)',
                      color: 'var(--color-primary-normal)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 요약 */}
              {selectedCard.summary != null && (
                <div style={{
                  background: 'var(--color-background-alternative)',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-label-neutral)' }}>
                    {selectedCard.summary}
                  </p>
                </div>
              )}

              {publishError != null && (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-status-error)' }}>
                  {publishError}
                </p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{
              display: 'flex',
              gap: '0.625rem',
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--color-line-normal)',
              flexShrink: 0,
            }}>
              <a
                href={`/cards/${selectedCard.id}`}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid var(--color-line-normal)',
                  color: 'var(--color-label-normal)',
                  background: 'transparent',
                }}
              >
                상세 보기
              </a>
              <button
                onClick={() => handlePublishToggle(selectedCard)}
                disabled={publishing}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  opacity: publishing ? 0.6 : 1,
                  background: selectedCard.published ? 'rgba(255,66,66,0.1)' : 'var(--color-primary-normal)',
                  color: selectedCard.published ? 'var(--color-status-error)' : '#fff',
                }}
              >
                {publishing ? '처리 중…' : selectedCard.published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
