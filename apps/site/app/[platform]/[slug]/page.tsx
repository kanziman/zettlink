// 카드 상세 페이지 — summary/insights/심화 콘텐츠 렌더, SSG
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getAllPublishedSlugs, getCardBySlug } from '../../../lib/cards'

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs()
  return slugs.map(({ platform, slug }) => ({ platform, slug }))
}

interface PageProps {
  params: Promise<{ platform: string; slug: string }>
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  github: 'GitHub',
}

export default async function CardPage({ params }: PageProps) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  if (!card) notFound()

  const date = new Date(card.created_at)
  const dateLabel = Number.isNaN(date.getTime())
    ? card.created_at
    : date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const proseStyle = {
    lineHeight: 1.7,
    color: 'var(--color-label-normal)',
  } as const

  return (
    <article data-pagefind-body>
      {/* 헤더 */}
      <header style={{ marginBottom: '2rem' }}>
        <h1
          data-pagefind-meta="title"
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            lineHeight: 1.4,
            color: 'var(--color-label-strong)',
            margin: '0 0 0.75rem',
          }}
        >
          {card.title ?? card.url}
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* 플랫폼 뱃지 */}
          <span
            style={{
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--color-background-alternative)',
              color: 'var(--color-label-alternative)',
              border: '1px solid var(--color-line-normal)',
            }}
          >
            {PLATFORM_LABEL[card.platform] ?? card.platform}
          </span>

          {/* 원본 URL */}
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-primary-normal)',
              textDecoration: 'none',
            }}
          >
            원본 보기 →
          </a>

          {/* 날짜 */}
          <span
            style={{ fontSize: '0.8125rem', color: 'var(--color-label-assistive)', marginLeft: 'auto' }}
          >
            {dateLabel}
          </span>
        </div>

        {/* 태그 */}
        {card.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
            {card.tags.map((tag) => (
              <a
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                style={{
                  padding: '0.125rem 0.625rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  background: 'var(--color-background-alternative)',
                  color: 'var(--color-label-alternative)',
                  textDecoration: 'none',
                  border: '1px solid var(--color-line-normal)',
                }}
              >
                {tag}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* 요약 */}
      {card.summary && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-label-normal)' }}>
            요약
          </h2>
          <div style={proseStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.summary}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* 인사이트 */}
      {card.insights && card.insights.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-label-normal)' }}>
            인사이트
          </h2>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, ...proseStyle }}>
            {card.insights.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.375rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 심화 콘텐츠 */}
      {card.has_deep && card.deep_content && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-label-normal)' }}>
            심화 분석
          </h2>
          <div style={proseStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.deep_content}</ReactMarkdown>
          </div>
        </section>
      )}

      {card.has_til && card.til_content && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-label-normal)' }}>
            TIL
          </h2>
          <div style={proseStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.til_content}</ReactMarkdown>
          </div>
        </section>
      )}

      {card.has_guide && card.guide_content && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-label-normal)' }}>
            실용 가이드
          </h2>
          <div style={proseStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.guide_content}</ReactMarkdown>
          </div>
        </section>
      )}
    </article>
  )
}
