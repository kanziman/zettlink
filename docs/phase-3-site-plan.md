# Phase 3 — Public Site 구현 계획

## 목표

published 카드를 익명 방문자에게 공개하는 Next.js 15 정적 사이트를 구현한다. Supabase에서 빌드 타임에 데이터를 조회해 완전 정적 HTML을 생성하고, Pagefind로 클라이언트 검색을 제공한다. Phase 2에서 누락된 "심화 콘텐츠(deep/til/guide) DB 저장" 단계를 포함해 사이트가 Supabase에서 전체 콘텐츠를 읽을 수 있게 한다.

---

## 핵심 결정

- **`output: 'export'`** — 완전 정적 HTML 출력. Node.js 런타임 없음. API Route 없음. Vercel deploy hook으로 수동 재빌드.
- **anon 키만 사용** — site 빌드 환경에 `SUPABASE_SERVICE_ROLE_KEY` 없음. RLS로 `published=true` 카드만 노출.
- **DB 마이그레이션 선행** — `cards` 테이블에 `deep_content TEXT`, `til_content TEXT`, `guide_content TEXT` 추가. enrich API도 DB에 저장하도록 업데이트.
- **Pagefind** — `next build` 후 `pagefind --site out`으로 인덱스 생성. `<PagefindSearch>` 클라이언트 컴포넌트로 검색 UI 제공.
- **react-markdown + @tailwindcss/typography** — summary, insights, 심화 콘텐츠를 Markdown→HTML 렌더.
- **packages/ui 재사용** — Phase 2에서 만든 `CardRow`, `Badge`, `Tag` 컴포넌트를 사이트에서도 사용. 스타일은 dashboard의 `globals.css`와 동일한 DESIGN.md semantic 토큰.
- **별도 Vercel project** — ADR-005. rootDirectory=`apps/site`, GitHub auto-deploy **OFF**, deploy hook **ON**. `pnpm deploy` 수동 트리거.

---

## Step별 구현 순서

```
Step 0: DB 마이그레이션 + enrich API 업데이트
  ↓ (cards에 content 컬럼이 있어야 사이트에서 읽을 수 있음)
Step 1: scaffold
  ↓ (Next.js 15 SSG 기본 구조 + 의존성)
Step 2: lib/cards.ts — 빌드 타임 Supabase 조회
  ↓ (getPublishedCards / getCardBySlug / getCardsByTag / getAllTags)
Step 3: 홈 페이지 (카드 리스트 + 태그 필터)
  ↓ (기본 탐색 흐름 확인)
Step 4: [platform]/[slug] 카드 상세 페이지
  ↓ (summary/insights/tags + 심화 콘텐츠 탭)
Step 5: /tags/[tag] 페이지
  ↓ (태그별 필터링)
Step 6: Pagefind 통합
  ↓ (빌드 후 정적 검색 인덱스)
Step 7: 배포 설정 + pnpm deploy
```

---

### Step 0 — DB 마이그레이션 + enrich API 업데이트

**마이그레이션 파일:** `supabase/migrations/0002_content_columns.sql`

```sql
-- cards 테이블에 심화 콘텐츠 저장 컬럼 추가
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS deep_content  text,
  ADD COLUMN IF NOT EXISTS til_content   text,
  ADD COLUMN IF NOT EXISTS guide_content text;
```

**enrich API 업데이트:** `apps/dashboard/app/api/enrich/route.ts`

Claude 호출 후 vault write와 함께 Supabase DB에도 content를 저장한다.

```typescript
// 기존: has_deep/has_til/has_guide = true만 업데이트
// 추가: deep_content / til_content / guide_content에 텍스트 저장
await supabase.from('cards').update({
  [`${type}_content`]: enrichedText,
  [`has_${type}`]: true,
  updated_at: new Date().toISOString(),
}).eq('id', id)
```

**타입 재생성:** `pnpm gen-types` → `packages/db/types.gen.ts` 업데이트

**검증:**
- `supabase/migrations/0002_content_columns.sql` 파일 존재
- `supabase db push` 성공
- `pnpm gen-types` 후 `Database['public']['Tables']['cards']['Row']`에 `deep_content: string | null` 포함
- enrich API 호출 → `cards.deep_content`에 텍스트 저장 확인

---

### Step 1 — scaffold

**디렉토리 구조:**

```
apps/site/
├── app/
│   ├── layout.tsx           # root layout, ThemeProvider, Pretendard
│   ├── globals.css          # DESIGN.md semantic 토큰 (dashboard와 동일)
│   ├── page.tsx             # 홈 — 카드 리스트
│   ├── [platform]/
│   │   └── [slug]/
│   │       └── page.tsx     # 카드 상세
│   ├── tags/
│   │   └── [tag]/
│   │       └── page.tsx     # 태그 필터
│   └── not-found.tsx
├── components/
│   └── PagefindSearch.tsx   # 'use client' 검색 UI
├── lib/
│   └── cards.ts             # 빌드 타임 Supabase 조회 함수
├── next.config.ts           # output: 'export', transpilePackages
├── tailwind.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

**의존성:**

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2",
    "next-themes": "^0.4",
    "react-markdown": "^9",
    "remark-gfm": "^4"
  },
  "devDependencies": {
    "pagefind": "^1",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "@tailwindcss/typography": "^0.5",
    "typescript": "^5"
  }
}
```

**next.config.ts:**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  transpilePackages: ['@zettlink/ui', '@zettlink/shared'],
}

export default config
```

**package.json build script:**

```json
{
  "scripts": {
    "build": "next build && pagefind --site out",
    "dev": "next dev"
  }
}
```

**검증:** `pnpm --filter site build` 성공, `out/` 디렉토리 생성.

---

### Step 2 — lib/cards.ts

anon 키로 Supabase에 접속해 빌드 타임 데이터를 조회한다. 브라우저 번들에 포함되지 않고 서버(빌드) 환경에서만 실행된다.

```typescript
// lib/cards.ts — 빌드 타임 Supabase anon 조회 함수
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@zettlink/db/types.gen'

// anon key 직접 사용 (NEXT_PUBLIC_ prefix로 클라이언트에도 노출 가능하지만,
// 이 파일은 서버 전용이므로 NEXT_PUBLIC_ prefix 없는 env도 OK)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function getPublishedCards(tag?: string) {
  // cards + card_tags + tags JOIN
  // published=true, status='done'
  // 최신순
}

export async function getCardBySlug(platform: string, slug: string) {
  // single card detail (platform + id)
}

export async function getCardsByTag(tag: string) {
  // tag canonical_name으로 필터
}

export async function getAllTags() {
  // usage_count DESC, published 카드에 달린 태그만
}

export async function getAllPublishedSlugs() {
  // generateStaticParams용 [{platform, slug}] 배열
}
```

**검증:** 함수 단위 테스트 (vitest + mock Supabase 응답). RLS로 unpublished 카드가 응답에 포함되지 않음 확인.

---

### Step 3 — 홈 페이지 (카드 리스트 + 태그 필터)

`app/page.tsx` — Server Component (빌드 타임 실행)

- searchParams의 `tag` 파라미터로 태그 필터. `tag` 없으면 전체.
- `<CardRow>` 리스트, 각 행 클릭 → `/[platform]/[slug]`
- 태그 목록 사이드바 or 상단 chip 목록 (클릭 → `?tag=xxx`)
- data-pagefind-body 속성으로 Pagefind 인덱싱 범위 지정

```tsx
// app/page.tsx
import { getPublishedCards, getAllTags } from '../lib/cards'
import { CardRow } from '@zettlink/ui'

export default async function HomePage({ searchParams }: { searchParams: { tag?: string } }) {
  const [cards, tags] = await Promise.all([
    getPublishedCards(searchParams.tag),
    getAllTags(),
  ])

  return (
    <main data-pagefind-body>
      {/* 태그 필터 chips */}
      {/* CardRow 리스트 */}
    </main>
  )
}
```

**검증:** 카드 리스트 표시, 태그 클릭 시 필터 동작, `out/index.html` 생성.

---

### Step 4 — [platform]/[slug] 카드 상세 페이지

`app/[platform]/[slug]/page.tsx`

- `generateStaticParams()` — `getAllPublishedSlugs()` 결과 반환
- 없는 slug → `notFound()`
- 상단: title, platform badge, 원본 URL 링크, 날짜, tags
- 본문: `<ReactMarkdown>` + `remark-gfm`으로 summary 렌더
- insights: `<ul>` 목록 (jsonb 배열)
- 심화 콘텐츠: has_deep/has_til/has_guide에 따라 탭 또는 섹션 표시. content 컬럼에서 `<ReactMarkdown>` 렌더.

```tsx
// app/[platform]/[slug]/page.tsx
import { getCardBySlug, getAllPublishedSlugs } from '../../../lib/cards'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs()
  return slugs.map(({ platform, slug }) => ({ platform, slug }))
}

export default async function CardPage({ params }: { params: { platform: string; slug: string } }) {
  const card = await getCardBySlug(params.platform, params.slug)
  if (!card) notFound()

  return (
    <article data-pagefind-body>
      <h1 data-pagefind-meta="title">{card.title}</h1>
      {/* summary 마크다운 렌더 */}
      {/* insights 목록 */}
      {/* 심화 콘텐츠 탭 (has_deep, has_til, has_guide) */}
    </article>
  )
}
```

**검증:** `/youtube/<slug>` 경로 접근 시 카드 상세 표시, `out/youtube/` 정적 파일 생성.

---

### Step 5 — /tags/[tag] 페이지

`app/tags/[tag]/page.tsx`

- `generateStaticParams()` — `getAllTags()` 결과로 태그별 slug 반환
- `getCardsByTag(tag)`로 필터링된 카드 리스트
- 없는 tag → `notFound()`

**검증:** `/tags/typescript` 경로 표시, `out/tags/` 정적 파일 생성.

---

### Step 6 — Pagefind 통합

**빌드 파이프라인:**

```bash
# package.json build script
next build && pagefind --site out --output-path out/pagefind
```

Pagefind는 `data-pagefind-body` 속성이 있는 HTML 영역을 인덱싱한다. `data-pagefind-meta="title"` 속성으로 제목을 메타데이터로 등록한다.

**검색 UI:**

`components/PagefindSearch.tsx` — `'use client'` 컴포넌트

- `@pagefind/default-ui` 사용 (`import('@pagefind/default-ui')` 동적 import)
- `window.pagefind` API로 검색 결과 표시
- layout.tsx의 nav 영역에 배치

```tsx
// components/PagefindSearch.tsx
'use client'
import { useEffect, useRef } from 'react'

export function PagefindSearch() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadPagefind() {
      // @ts-expect-error pagefind is injected by pagefind CLI
      const pagefind = await import('/pagefind/pagefind.js')
      const { PagefindUI } = await import('@pagefind/default-ui')
      if (ref.current) {
        new PagefindUI({ element: ref.current, showImages: false })
      }
    }
    loadPagefind()
  }, [])

  return <div ref={ref} />
}
```

**검증:** `out/pagefind/` 디렉토리 생성, 로컬 `npx serve out` 후 검색어 입력 시 결과 표시.

---

### Step 7 — 배포 설정 + pnpm deploy

**`apps/site/vercel.json`:**

```json
{
  "framework": null,
  "buildCommand": "cd ../.. && pnpm --filter site build",
  "outputDirectory": "out",
  "installCommand": "cd ../.. && pnpm install"
}
```

> Note: rootDirectory=`apps/site`는 Vercel 프로젝트 설정에서 지정.

**`.env.example` 추가 (site용):**

```
# apps/site (Vercel 환경변수 — public read-only)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# deploy hook
VERCEL_DEPLOY_HOOK_SITE=
```

**`scripts/deploy-site.ts`** (없으면 신규 작성):

```typescript
// scripts/deploy-site.ts — Vercel site deploy hook POST
const hookUrl = process.env.VERCEL_DEPLOY_HOOK_SITE
if (!hookUrl) throw new Error('VERCEL_DEPLOY_HOOK_SITE 환경변수 없음')
const res = await fetch(hookUrl, { method: 'POST' })
if (!res.ok) throw new Error(`deploy hook 실패: ${res.status}`)
console.log('site deploy triggered')
```

**`pnpm` root workspace `deploy` 스크립트:**

```json
{
  "scripts": {
    "deploy": "tsx scripts/deploy-site.ts"
  }
}
```

**Vercel 프로젝트 설정 체크리스트:**

- [ ] Vercel project rootDirectory: `apps/site`
- [ ] GitHub auto-deploy: **OFF**
- [ ] Deploy hook 생성 → `VERCEL_DEPLOY_HOOK_SITE` 등록
- [ ] 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Build command: `pnpm build` (next.config.ts에서 pagefind 포함)

**검증:** `pnpm deploy` → Vercel build 트리거 → 공개 사이트 접근 가능.

---

## Gate 1 검증 기준

1. `0002_content_columns.sql` 마이그레이션 적용 후 `cards.deep_content` 컬럼 존재하는가?
2. enrich API 호출 후 `cards.deep_content` (or til/guide)에 텍스트가 저장되는가?
3. `pnpm --filter site build` 후 `out/` 디렉토리가 생성되는가?
4. `out/index.html`이 published 카드 리스트를 포함하는가?
5. `out/pagefind/` 디렉토리가 존재하는가?
6. site 빌드 환경에 `SUPABASE_SERVICE_ROLE_KEY`가 없어도 빌드 성공하는가?

---

## Gate 2 검증 기준

1. 홈(`/`) — published 카드 리스트 표시, 태그 클릭 시 필터 동작하는가?
2. 카드 상세(`/youtube/<slug>`) — title/summary/insights/tags 표시, markdown 렌더되는가?
3. 심화 콘텐츠(`has_deep=true` 카드) — deep_content가 렌더되는가?
4. 태그 페이지(`/tags/<tag>`) — 해당 태그 카드만 표시되는가?
5. Pagefind 검색 — 키워드 입력 시 관련 카드가 결과에 표시되는가?
6. unpublished 카드 — anon 키 RLS로 조회 결과에 미포함되는가?
7. `pnpm deploy` — Vercel 재빌드 트리거되고 publish 변경이 사이트에 반영되는가?
8. 새 TypeScript 파일 첫 줄에 한국어 역할 주석이 있는가?
