# Dashboard 메인 페이지 UI 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before touching any .tsx file:** invoke `/react-best-practices` skill as required by CLAUDE.md.

**Goal:** `apps/dashboard/app/(admin)/page.tsx`의 인라인 스타일 리스트뷰를 통계 행 + 태그/상태 칩 필터 + 그리드 카드 + 클릭 모달로 교체한다.

**Architecture:** Server Component(`page.tsx`)에서 카드·태그·통계를 Supabase에서 병렬 조회(`async-parallel`)해 서버 컴포넌트(`TagFilter`, `StatusFilter`)와 클라이언트 컴포넌트(`CardGrid`)에 props로 전달한다. 필터링은 URL 파라미터(`?tag=`, `?status=`) 기반 서버 렌더링을 유지한다. `CardGrid`만 `'use client'`로 모달 열기/닫기와 `/api/publish` 호출을 처리한다. 색상은 기존 `--color-*` CSS 변수 체계를 그대로 사용한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, `--color-*` CSS 변수 (인라인 스타일), Supabase

---

## 파일 변경 맵

| 파일 | 작업 |
|---|---|
| `apps/dashboard/app/(admin)/_components/TagFilter.tsx` | 신규 — 태그 칩 필터 (서버 컴포넌트) |
| `apps/dashboard/app/(admin)/_components/StatusFilter.tsx` | 신규 — 상태 SegmentedControl (서버 컴포넌트) |
| `apps/dashboard/app/(admin)/_components/CardGrid.tsx` | 신규 — 그리드 카드 + 모달 (클라이언트 컴포넌트) |
| `apps/dashboard/app/(admin)/page.tsx` | 수정 — 통계 행 추가 + 새 컴포넌트 연결 |

---

## Task 1: TagFilter + StatusFilter 서버 컴포넌트

**Files:**
- Create: `apps/dashboard/app/(admin)/_components/TagFilter.tsx`
- Create: `apps/dashboard/app/(admin)/_components/StatusFilter.tsx`

- [ ] **Step 1: TagFilter.tsx 생성**

`apps/dashboard/app/(admin)/_components/TagFilter.tsx`:

```tsx
// 태그 칩 필터 — URL 파라미터 기반 서버 컴포넌트
import React from 'react'

interface TagFilterProps {
  tags: string[]
  activeTag: string | undefined
  activeStatus: string
  q: string | undefined
}

function buildTagHref(tag: string | undefined, activeStatus: string, q: string | undefined) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  if (activeStatus !== 'all') params.set('status', activeStatus)
  return params.toString() ? `/?${params.toString()}` : '/'
}

export function TagFilter({ tags, activeTag, activeStatus, q }: TagFilterProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    textDecoration: 'none',
    border: '1px solid var(--color-line-normal)',
    whiteSpace: 'nowrap',
  }
  const activeStyle: React.CSSProperties = {
    background: 'rgba(0, 102, 255, 0.1)',
    color: 'var(--color-primary-normal)',
    borderColor: 'rgba(0, 102, 255, 0.4)',
  }
  const inactiveStyle: React.CSSProperties = {
    background: 'var(--color-background-alternative)',
    color: 'var(--color-label-alternative)',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      <a
        href={buildTagHref(undefined, activeStatus, q)}
        style={{ ...base, ...(activeTag == null ? activeStyle : inactiveStyle) }}
      >
        전체
      </a>
      {tags.map((t) => (
        <a
          key={t}
          href={buildTagHref(t, activeStatus, q)}
          style={{ ...base, ...(activeTag === t ? activeStyle : inactiveStyle) }}
        >
          <span style={{ marginRight: '2px', opacity: 0.5 }}>#</span>
          {t}
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: StatusFilter.tsx 생성**

`apps/dashboard/app/(admin)/_components/StatusFilter.tsx`:

```tsx
// 상태 탭 필터 — SegmentedControl 형태 서버 컴포넌트

interface StatusFilterProps {
  activeStatus: string
  activeTag: string | undefined
  q: string | undefined
}

function buildStatusHref(status: string, activeTag: string | undefined, q: string | undefined) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (activeTag) params.set('tag', activeTag)
  if (status !== 'all') params.set('status', status)
  return params.toString() ? `/?${params.toString()}` : '/'
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'done', label: '완료' },
  { value: 'failed', label: '실패' },
] as const

export function StatusFilter({ activeStatus, activeTag, q }: StatusFilterProps) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(112, 115, 124, 0.08)',
      borderRadius: '8px',
      padding: '3px',
    }}>
      {STATUS_OPTIONS.map((opt) => {
        const isActive = activeStatus === opt.value
        return (
          <a
            key={opt.value}
            href={buildStatusHref(opt.value, activeTag, q)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textDecoration: 'none',
              background: isActive ? 'var(--color-background-normal)' : 'transparent',
              color: isActive ? 'var(--color-label-strong)' : 'var(--color-label-alternative)',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {opt.label}
          </a>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter dashboard typecheck
```

Expected: 오류 없음.

- [ ] **Step 4: 커밋**

```bash
git add 'apps/dashboard/app/(admin)/_components/TagFilter.tsx' 'apps/dashboard/app/(admin)/_components/StatusFilter.tsx'
git commit -m "feat(dashboard): TagFilter·StatusFilter 서버 컴포넌트 추가"
```

---

## Task 2: CardGrid 클라이언트 컴포넌트

**Files:**
- Create: `apps/dashboard/app/(admin)/_components/CardGrid.tsx`

- [ ] **Step 1: CardGrid.tsx 생성**

`apps/dashboard/app/(admin)/_components/CardGrid.tsx`:

```tsx
// 그리드 카드 목록 + 상세 모달 — 클라이언트 컴포넌트
'use client'

import { useState } from 'react'
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

  async function handlePublishToggle(card: CardForGrid) {
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
```

- [ ] **Step 2: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter dashboard typecheck
```

Expected: 오류 없음.

- [ ] **Step 3: 커밋**

```bash
git add 'apps/dashboard/app/(admin)/_components/CardGrid.tsx'
git commit -m "feat(dashboard): CardGrid 그리드 카드 + 상세 모달 추가"
```

---

## Task 3: page.tsx 업데이트 — 통계 행 + 새 컴포넌트 연결

**Files:**
- Modify: `apps/dashboard/app/(admin)/page.tsx`

- [ ] **Step 1: page.tsx 전체 교체**

`apps/dashboard/app/(admin)/page.tsx`:

```tsx
// 카드 리스트 메인 페이지 — 통계 행 + 태그/상태 필터 + 그리드 카드
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { TagFilter } from './_components/TagFilter'
import { StatusFilter } from './_components/StatusFilter'
import { CardGrid } from './_components/CardGrid'
import type { CardForGrid } from './_components/CardGrid'

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; status?: string }>
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type CardRow = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  created_at: string
  summary: string | null
  card_tags: Array<{ tags: { canonical_name: string } | null }> | null
}

async function fetchCards(
  supabase: SupabaseClient,
  { q, tag, status }: { q?: string; tag?: string; status?: string },
): Promise<CardRow[]> {
  if (tag) {
    const { data: tagRow } = await supabase
      .from('tags')
      .select('id')
      .eq('canonical_name', tag)
      .single()
    if (!tagRow) return []

    const { data: cardTagRows } = await supabase
      .from('card_tags')
      .select('card_id')
      .eq('tag_id', tagRow.id)
    const cardIds = (cardTagRows ?? []).map((r: { card_id: string }) => r.card_id)
    if (cardIds.length === 0) return []

    let query = supabase
      .from('cards')
      .select('id, title, url, platform, status, published, created_at, summary, card_tags(tags(canonical_name))')
      .in('id', cardIds)
      .order('created_at', { ascending: false })
      .limit(50)
    if (q) query = query.ilike('title', `%${q}%`)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data } = await query
    return (data ?? []) as CardRow[]
  }

  let query = supabase
    .from('cards')
    .select('id, title, url, platform, status, published, created_at, summary, card_tags(tags(canonical_name))')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.ilike('title', `%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data } = await query
  return (data ?? []) as CardRow[]
}

function StatChip({
  value,
  label,
  color = 'var(--color-label-normal)',
}: {
  value: number
  label: string
  color?: string
}) {
  return (
    <div style={{
      background: 'var(--color-background-normal)',
      border: '1px solid var(--color-line-normal)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { q, tag, status } = await searchParams
  const supabase = await createSupabaseServerClient()

  // async-parallel: 카드 목록·태그 목록·전체 통계 병렬 조회
  const [cards, tagsResult, statsResult] = await Promise.all([
    fetchCards(supabase, { q, tag, status }),
    supabase
      .from('tags')
      .select('canonical_name')
      .order('usage_count', { ascending: false })
      .limit(30),
    supabase.from('cards').select('status, published'),
  ])

  const tags = (tagsResult.data ?? []).map((t: { canonical_name: string }) => t.canonical_name)
  const allCards = (statsResult.data ?? []) as Array<{ status: string; published: boolean }>
  const stats = {
    total: allCards.length,
    done: allCards.filter((c) => c.status === 'done').length,
    published: allCards.filter((c) => c.published).length,
  }

  const activeStatus = status ?? 'all'

  const gridCards: CardForGrid[] = cards.map((c) => ({
    id: c.id,
    title: c.title,
    url: c.url,
    platform: c.platform,
    status: c.status,
    published: c.published,
    created_at: c.created_at,
    summary: c.summary,
    tags: (c.card_tags ?? []).flatMap((ct) => (ct.tags ? [ct.tags.canonical_name] : [])),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 통계 행 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <StatChip value={stats.total} label="전체 카드" />
        <StatChip value={stats.done} label="완료" color="var(--color-status-success)" />
        <StatChip value={stats.published} label="공개" color="var(--color-primary-normal)" />
      </div>

      {/* 검색 바 */}
      <form method="GET" style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="제목 또는 URL 검색"
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: '8px',
            border: '1px solid var(--color-line-strong)',
            background: 'var(--color-background-normal)',
            color: 'var(--color-label-normal)',
            fontSize: '0.9375rem',
          }}
        />
        {tag != null ? <input type="hidden" name="tag" value={tag} /> : null}
        {status != null ? <input type="hidden" name="status" value={status} /> : null}
        <button
          type="submit"
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            background: 'var(--color-primary-normal)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          검색
        </button>
      </form>

      {/* 태그 필터 */}
      <TagFilter tags={tags} activeTag={tag} activeStatus={activeStatus} q={q} />

      {/* 상태 필터 */}
      <StatusFilter activeStatus={activeStatus} activeTag={tag} q={q} />

      {/* 카드 그리드 */}
      <CardGrid cards={gridCards} />

      <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-assistive)' }}>
        최대 50개 표시
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter dashboard typecheck
```

Expected: 오류 없음.

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter dashboard build
```

Expected: 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add 'apps/dashboard/app/(admin)/page.tsx'
git commit -m "feat(dashboard): 통계 행·그리드 카드·칩 필터로 메인 페이지 재작성"
```

---

## 완료 기준

- `pnpm --filter dashboard typecheck` 통과
- `pnpm --filter dashboard build` 성공
- `http://localhost:3001` 시각 확인:
  - 통계 행 3개 (전체/완료/공개) 카운트 정확히 표시
  - 태그 칩 클릭 시 URL 변경 + 카드 필터링 동작
  - 상태 SegmentedControl 탭 전환 동작
  - 그리드 카드: YouTube 빨간 액센트 바, GitHub 다크 액센트 바
  - 카드 hover 시 shadow 증가 + 2px 위로 이동
  - 카드 클릭 시 모달: 요약, 태그, Publish/Unpublish 버튼, 상세 보기 링크
  - 모달 Publish 클릭 후 카드 상태 갱신 확인
