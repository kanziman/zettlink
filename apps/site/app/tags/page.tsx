// 전체 태그 목록 인덱스 페이지 — 정적 셸(메타데이터) + 클라이언트 실시간 조회
import { TagsIndex } from './TagsIndex'

export const metadata = { title: '태그 목록 — zettlink' }

export default function TagsIndexPage() {
  return <TagsIndex />
}
