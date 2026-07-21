// 카드 상세 페이지 — 요약·인사이트·태그 표시 + 액션 버튼 + 심화/TIL/가이드 미리보기
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'
import { Badge } from '@zettlink/ui'
import { CardActions } from './CardActions'
import {
  ArrowLeftIcon,
  LinkIcon,
  IdeaIcon,
  KeyIcon,
  CheckIcon,
  BookOpenIcon,
  EditIcon,
  ToolIcon,
  FolderIcon,
} from '../../_components/Icons'

type BadgeStatus = Parameters<typeof Badge>[0]['status']

// server-cache-react: 동일 요청 내 중복 조회 방지
const getCard = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('cards')
    .select('*, card_tags(tags(canonical_name))')
    .eq('id', slug)
    .single()
  return data
})

interface PageProps {
  params: Promise<{ slug: string }>
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

function PreviewSection({
  title,
  icon,
  content,
  badgeText,
  badgeColor,
}: {
  title: string
  icon: React.ReactNode
  content: string | null
  badgeText: string
  badgeColor: string
}) {
  if (!content) return null
  return (
    <section style={{
      background: 'var(--color-background-normal)',
      border: '1px solid var(--color-line-normal)',
      borderRadius: '16px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 4px 12px rgba(12, 74, 110, 0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--color-label-strong)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}>
          {icon}
          {title}
        </h2>
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '6px',
          background: badgeColor,
          color: 'var(--color-static-white, white)',
        }}>
          {badgeText}
        </span>
      </div>
      <div style={{
        lineHeight: 1.65,
        fontSize: '0.875rem',
        color: 'var(--color-label-neutral)',
        whiteSpace: 'pre-wrap',
        background: 'var(--color-background-alternative)',
        padding: '1rem',
        borderRadius: '10px',
        border: '1px solid var(--color-line-normal)',
        maxHeight: '320px',
        overflowY: 'auto',
      }}>
        {content}
      </div>
    </section>
  )
}

export default async function CardDetailPage({ params }: PageProps) {
  const { slug } = await params
  const card = await getCard(slug)

  if (!card) notFound()

  const tags = (card.card_tags ?? [])
    .map((ct: { tags: { canonical_name: string } | null }) => ct.tags?.canonical_name ?? '')
    .filter(Boolean)

  const createdAt = new Date(card.created_at).toLocaleString('ko-KR')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 뒤로 가기 / 브레드크럼 */}
      <div>
        <a href="/" style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-primary-normal)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          transition: 'opacity 0.2s',
        }}>
          <ArrowLeftIcon /> 목록으로 돌아가기
        </a>
      </div>

      {/* 헤더 카드 */}
      <div style={{
        background: 'var(--color-background-normal)',
        border: '1px solid var(--color-line-normal)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(12, 74, 110, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
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
          <Badge status={card.status as BadgeStatus} />
          {card.published ? (
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--color-status-success)',
              background: 'rgba(22, 163, 74, 0.08)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(22, 163, 74, 0.15)',
            }}>
              공개 완료
            </span>
          ) : (
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--color-label-alternative)',
              background: 'var(--color-background-alternative)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--color-line-normal)',
            }}>
              비공개
            </span>
          )}
        </div>
        <h1 style={{
          fontSize: '1.625rem',
          fontWeight: 800,
          lineHeight: 1.35,
          color: 'var(--color-label-strong)',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {card.title ?? card.url}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }}>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--color-primary-normal)',
              textDecoration: 'none',
              fontWeight: 500,
              wordBreak: 'break-all',
            }}
          >
            <LinkIcon /> 원본 링크 방문하기 →
          </a>
          <span style={{ color: 'var(--color-line-normal)' }}>|</span>
          <span style={{ color: 'var(--color-label-alternative)' }}>
            생성일: {createdAt}
          </span>
        </div>
      </div>

      {/* 태그 */}
      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                background: 'var(--color-background-alternative)',
                color: 'var(--color-label-alternative)',
                border: '1px solid var(--color-line-normal)',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      {/* 요약 */}
      {card.summary !== null ? (
        <section style={{
          background: 'rgba(3, 105, 161, 0.03)',
          border: '1px solid rgba(3, 105, 161, 0.06)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 12px rgba(12, 74, 110, 0.02)',
        }}>
          <h2 style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--color-primary-normal)',
            margin: '0 0 0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <IdeaIcon /> 핵심 요약
          </h2>
          <p style={{
            lineHeight: 1.7,
            fontSize: '0.9375rem',
            color: 'var(--color-label-normal)',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}>{card.summary}</p>
        </section>
      ) : null}

      {/* 인사이트 */}
      {Array.isArray(card.insights) && card.insights.length > 0 ? (
        <section style={{
          background: 'var(--color-background-normal)',
          border: '1px solid var(--color-line-normal)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 12px rgba(12, 74, 110, 0.02)',
        }}>
          <h2 style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--color-label-strong)',
            margin: '0 0 0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <KeyIcon /> 주요 인사이트
          </h2>
          <ul style={{
            padding: 0,
            margin: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
          }}>
            {(card.insights as string[]).map((ins, i) => (
              <li
                key={i}
                style={{
                  lineHeight: 1.6,
                  fontSize: '0.9375rem',
                  color: 'var(--color-label-normal)',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  background: 'var(--color-background-alternative)',
                  border: '1px solid var(--color-line-normal)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <CheckIcon style={{ color: 'var(--color-primary-normal)', flexShrink: 0, marginTop: '5px' }} />
                <span style={{ flex: 1 }}>{ins}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 심화 분석 / TIL / 가이드 미리보기 */}
      <PreviewSection
        title="심화 분석"
        icon={<BookOpenIcon />}
        content={card.deep_content}
        badgeText="Deep Dive"
        badgeColor="var(--color-primary-normal)"
      />
      <PreviewSection
        title="TIL (Today I Learned)"
        icon={<EditIcon />}
        content={card.til_content}
        badgeText="TIL"
        badgeColor="var(--color-accent-normal)"
      />
      <PreviewSection
        title="실용 가이드"
        icon={<ToolIcon />}
        content={card.guide_content}
        badgeText="Guide"
        badgeColor="var(--color-status-success)"
      />

      {/* 액션 버튼 */}
      <CardActions
        cardId={card.id}
        hasDeep={card.has_deep}
        hasTil={card.has_til}
        hasGuide={card.has_guide}
        published={card.published}
      />

      {/* vault 경로 */}
      {card.vault_path !== null ? (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'var(--color-background-alternative)',
          border: '1px solid var(--color-line-normal)',
        }}>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--color-label-assistive)',
            fontFamily: 'monospace',
            margin: 0,
            wordBreak: 'break-all',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <FolderIcon /> vault path: {card.vault_path}
          </p>
        </div>
      ) : null}
    </div>
  )
}
