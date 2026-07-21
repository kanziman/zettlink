// 그리드 카드 목록 + 상세 모달 — 클라이언트 컴포넌트
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CloseIcon, IdeaIcon } from './Icons'

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

function platformBadgeStyle(platform: string): React.CSSProperties {
  if (platform === 'youtube') {
    return {
      background: 'rgba(239, 68, 68, 0.08)',
      color: '#EF4444',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    }
  }
  return {
    background: 'rgba(71, 85, 105, 0.08)',
    color: '#475569',
    borderColor: 'rgba(71, 85, 105, 0.2)',
  }
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

  const closeModal = useCallback(() => {
    setSelectedId(null)
    setPublishError(null)
  }, [])

  useEffect(() => {
    if (selectedCard == null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCard, closeModal])

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
        gap: '1.25rem',
      }}>
        {cards.map((card) => {
          const isProcessing = card.status === 'processing'
          return (
            <div
              key={card.id}
              onClick={() => { if (!isProcessing) setSelectedId(card.id) }}
              style={{
                background: 'var(--color-background-normal)',
                border: '1px solid var(--color-line-normal)',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: '0 4px 12px rgba(12, 74, 110, 0.03)',
                cursor: isProcessing ? 'default' : 'pointer',
                opacity: isProcessing ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease',
              }}
              onMouseEnter={(e) => {
                if (isProcessing) return
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 12px 24px -4px rgba(12, 74, 110, 0.08), 0 4px 12px -2px rgba(12, 74, 110, 0.04)'
                el.style.transform = 'translateY(-3px)'
                el.style.borderColor = 'rgba(3, 105, 161, 0.28)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 4px 12px rgba(12, 74, 110, 0.03)'
                el.style.transform = ''
                el.style.borderColor = 'var(--color-line-normal)'
              }}
            >
              {/* 플랫폼 + 상태 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid transparent',
                  ...platformBadgeStyle(card.platform)
                }}>
                  {platformLabel(card.platform)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {card.status !== 'done' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: statusColor(card.status) }}>
                      {statusLabel(card.status)}
                    </span>
                  )}
                  {card.published && (
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--color-status-success)',
                      background: 'rgba(22,163,74,0.08)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(22,163,74,0.15)',
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
                color: 'var(--color-label-strong)',
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
                  lineHeight: 1.6,
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '0.625rem', borderTop: '1px solid rgba(3, 105, 161, 0.06)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {card.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        padding: '1px 5px',
                        borderRadius: '6px',
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
            background: 'rgba(8, 47, 73, 0.4)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
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
              maxWidth: '540px',
              maxHeight: '85vh',
              background: 'var(--color-background-normal)',
              borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(8, 47, 73, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--color-line-normal)',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.125rem 1.5rem',
              borderBottom: '1px solid var(--color-line-normal)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid transparent',
                  ...platformBadgeStyle(selectedCard.platform)
                }}>
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
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <CloseIcon />
              </button>
            </div>

            {/* 모달 바디 */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.45, color: 'var(--color-label-strong)' }}>
                {selectedCard.title ?? selectedCard.id}
              </h2>

              {/* 발행 상태 + 태그 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: selectedCard.published ? 'rgba(22,163,74,0.08)' : 'var(--color-background-alternative)',
                  color: selectedCard.published ? 'var(--color-status-success)' : 'var(--color-label-alternative)',
                  border: `1px solid ${selectedCard.published ? 'rgba(22,163,74,0.2)' : 'var(--color-line-normal)'}`,
                }}>
                  {selectedCard.published ? '공개' : '비공개'}
                </span>
                {selectedCard.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(3, 105, 161, 0.06)',
                      color: 'var(--color-primary-normal)',
                      border: '1px solid rgba(3, 105, 161, 0.12)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 요약 (Key Takeaway) */}
              {selectedCard.summary != null && (
                <div style={{
                  background: 'rgba(3, 105, 161, 0.04)',
                  borderRadius: '12px',
                  padding: '1.125rem 1.25rem',
                  border: '1px solid rgba(3, 105, 161, 0.08)',
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-primary-normal)',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}>
                    <IdeaIcon /> 핵심 요약
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    lineHeight: 1.65,
                    color: 'var(--color-label-normal)',
                    fontWeight: 450,
                  }}>
                    {selectedCard.summary}
                  </p>
                </div>
              )}

              {publishError != null && (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-status-error)', fontWeight: 500 }}>
                  {publishError}
                </p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              padding: '1.125rem 1.5rem',
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
                  padding: '0.625rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid var(--color-line-strong)',
                  color: 'var(--color-label-normal)',
                  background: 'var(--color-background-normal)',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-background-alternative)'
                  e.currentTarget.style.borderColor = 'var(--color-primary-normal)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-background-normal)'
                  e.currentTarget.style.borderColor = 'var(--color-line-strong)'
                }}
              >
                상세 보기
              </a>
              <button
                onClick={() => handlePublishToggle(selectedCard)}
                disabled={publishing}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  opacity: publishing ? 0.6 : 1,
                  background: selectedCard.published ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-primary-normal)',
                  color: selectedCard.published ? '#EF4444' : '#fff',
                  border: selectedCard.published ? '1px solid rgba(239, 68, 68, 0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (publishing) return
                  if (selectedCard.published) {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
                  } else {
                    e.currentTarget.style.background = 'var(--color-primary-strong)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCard.published) {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'
                  } else {
                    e.currentTarget.style.background = 'var(--color-primary-normal)'
                  }
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
