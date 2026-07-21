// 전체 태그 목록 인덱스 페이지 — usage_count 내림차순 나열
import { getAllTags } from '../../lib/cards'

export const metadata = { title: '태그 목록 — zettlink' }

export default async function TagsIndexPage() {
  const tags = await getAllTags()

  return (
    <div>
      <h1 className="text-title3 font-bold mb-6 text-label-strong">
        태그
      </h1>
      {tags.length === 0 ? (
        <p className="text-label-assistive text-body1">태그가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <a
              key={tag.canonical_name}
              href={`/tags/${encodeURIComponent(tag.canonical_name)}`}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-line-strong text-label-alternative no-underline text-label1 hover:border-primary-normal hover:bg-fill-normal transition-all duration-200"
            >
              {tag.canonical_name}
              <span className="text-caption1 text-label-assistive">
                {tag.usage_count}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
