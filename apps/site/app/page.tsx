// 공개 사이트 홈 페이지 — published 카드 전체 로드, 태그 필터는 CardList 클라이언트에서 처리
import { getPublishedCards, getAllTags } from '../lib/cards'
import { CardList } from '../components/CardList'

export default async function HomePage() {
  const [cards, tags] = await Promise.all([
    getPublishedCards(),
    getAllTags(),
  ])

  return <CardList cards={cards} tags={tags} />
}
