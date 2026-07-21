// 카드 상세 페이지 — summary/insights/심화 콘텐츠 렌더, SSG
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getAllPublishedSlugs, getCardBySlug } from '../../../lib/cards'
import {
  ArrowLeftIcon,
  LinkIcon,
  IdeaIcon,
  KeyIcon,
  CheckIcon,
  BookOpenIcon,
  EditIcon,
  ToolIcon,
} from '../../_components/Icons'

interface PageProps {
  params: Promise<{ platform: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  return { title: card?.title ?? slug }
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs()
  if (slugs.length === 0) return [{ platform: 'youtube', slug: '_placeholder_' }]
  return slugs.map(({ platform, slug }) => ({ platform, slug }))
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  github: 'GitHub',
}

const PLATFORM_BADGE_CLASSES: Record<string, string> = {
  youtube: 'bg-[rgba(239,68,68,0.08)] text-[#EF4444] border-[rgba(239,68,68,0.15)]',
  github: 'bg-fill-normal text-label-strong border-line-normal-normal',
}

function ContentSection({
  title,
  icon,
  content,
  badgeText,
  badgeColorClass,
  accentBorder,
}: {
  title: string
  icon: React.ReactNode
  content: string | null
  badgeText: string
  badgeColorClass: string
  accentBorder?: boolean
}) {
  if (!content) return null
  return (
    <section className={`detail-section flex flex-col gap-3 ${accentBorder ? 'border-l-[3px] border-l-primary-normal' : ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-body1 font-bold text-label-strong m-0 flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        <span className={`text-caption2 font-semibold px-2 py-0.5 rounded-md text-white ${badgeColorClass}`}>
          {badgeText}
        </span>
      </div>
      <div className="detail-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  )
}

export default async function CardPage({ params }: PageProps) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  if (!card) notFound()

  const date = new Date(card.created_at)
  const dateLabel = Number.isNaN(date.getTime())
    ? card.created_at
    : date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const platformClasses = PLATFORM_BADGE_CLASSES[card.platform] ?? 'bg-fill-normal text-label-alternative border-line-normal-normal'

  return (
    <article data-pagefind-body className="flex flex-col gap-5 max-w-3xl mx-auto">
      {/* ── 뒤로가기 ── */}
      <div>
        <a
          href="/"
          className="detail-back-link text-label1 font-semibold text-primary-normal no-underline inline-flex items-center gap-1.5"
        >
          <ArrowLeftIcon /> 목록으로 돌아가기
        </a>
      </div>

      {/* ── 히어로 헤더 ── */}
      <header className="bg-background-elevated-normal border border-line-normal-normal rounded-2xl shadow-normal-medium overflow-hidden">
        {/* Gradient top bar */}
        <div className="detail-gradient-bar" />

        <div className="p-5 sm:p-6 flex flex-col gap-3">
          {/* 플랫폼 뱃지 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-caption2 font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${platformClasses}`}>
              {PLATFORM_LABEL[card.platform] ?? card.platform}
            </span>
          </div>

          {/* 제목 */}
          <h1
            data-pagefind-meta="title"
            className="text-title2 sm:text-title1 font-extrabold text-label-strong m-0 tracking-tight leading-tight"
          >
            {card.title ?? card.url}
          </h1>

          {/* 메타 정보 */}
          <div className="flex flex-wrap items-center gap-3 text-label2">
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-normal no-underline font-medium hover:opacity-75 transition-opacity break-all"
            >
              <LinkIcon /> 원본 링크 방문하기 →
            </a>
            <span className="text-line-normal-normal hidden sm:inline">|</span>
            <span className="text-label-alternative">
              생성일: {dateLabel}
            </span>
          </div>

          {/* 태그 */}
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {card.tags.map((tag) => (
                <a
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="detail-tag px-2.5 py-1 rounded-full text-label2 font-medium bg-fill-normal text-primary-normal no-underline border border-fill-strong"
                >
                  #{tag}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── 요약 ── */}
      {card.summary !== null && (
        <section className="detail-section border-l-[3px] border-l-primary-normal bg-fill-normal flex flex-col gap-3">
          <h2 className="text-label1 font-bold text-primary-normal m-0 uppercase tracking-widest flex items-center gap-1.5">
            <IdeaIcon /> 요약
          </h2>
          <div className="detail-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.summary}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* ── 인사이트 ── */}
      {card.insights !== null && card.insights.length > 0 && (
        <section className="detail-section flex flex-col gap-3.5">
          <h2 className="text-label1 font-bold text-label-strong m-0 flex items-center gap-1.5">
            <KeyIcon /> 인사이트
          </h2>
          <ul className="p-0 m-0 list-none flex flex-col gap-2.5">
            {card.insights.map((ins, i) => (
              <li
                key={i}
                className="detail-insight-item leading-relaxed text-body2 text-label-neutral py-2.5 px-3.5 rounded-xl bg-background-normal-alternative border border-line-normal-normal flex items-start gap-3"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-normal text-white text-caption1 font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="flex-1">{ins}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 심화 분석 ── */}
      <ContentSection
        title="심화 분석"
        icon={<BookOpenIcon />}
        content={card.deep_content}
        badgeText="Deep Dive"
        badgeColorClass="bg-primary-normal"
      />

      {/* ── TIL ── */}
      <ContentSection
        title="TIL (Today I Learned)"
        icon={<EditIcon />}
        content={card.til_content}
        badgeText="TIL"
        badgeColorClass="bg-accent-normal"
      />

      {/* ── 실용 가이드 ── */}
      <ContentSection
        title="실용 가이드"
        icon={<ToolIcon />}
        content={card.guide_content}
        badgeText="Guide"
        badgeColorClass="bg-status-positive"
      />
    </article>
  )
}
