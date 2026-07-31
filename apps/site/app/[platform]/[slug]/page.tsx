// 카드 상세 페이지 — SSG(라우트/메타/초기 데이터) + CardDetailView가 클라이언트에서 재조회
import { notFound } from 'next/navigation'
import { getAllPublishedSlugs, getCardBySlug } from '../../../lib/cards'
import { CardDetailView } from './CardDetailView'

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

export default async function CardPage({ params }: PageProps) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  if (!card) notFound()

  return <CardDetailView platform={platform} slug={slug} initial={card} />
}
