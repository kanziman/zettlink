// 전체 태그 목록 인덱스 페이지 — usage_count 내림차순 나열
import { getAllTags } from '../../lib/cards'

export const metadata = { title: '태그 목록 — zettlink' }

export default async function TagsIndexPage() {
  const tags = await getAllTags()

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-label-strong)' }}>
        태그
      </h1>
      {tags.length === 0 ? (
        <p style={{ color: 'var(--color-label-assistive)' }}>태그가 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {tags.map((tag) => (
            <a
              key={tag.canonical_name}
              href={`/tags/${encodeURIComponent(tag.canonical_name)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: '1px solid var(--color-line-strong)',
                color: 'var(--color-label-alternative)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              {tag.canonical_name}
              <span style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)' }}>
                {tag.usage_count}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
