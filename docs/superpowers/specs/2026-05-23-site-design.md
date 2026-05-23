# Site 디자인 개선 스펙

날짜: 2026-05-23  
대상: `apps/site`  
전략: blog 폴더의 완성된 컴포넌트를 site에 이식하고, 인라인 스타일을 Tailwind 시맨틱 토큰으로 교체한다.

---

## 1. 배경 및 목표

현재 site는 다음 문제를 가지고 있다.

- `layout.tsx`와 `CardList.tsx` 전체가 인라인 스타일로 작성되어 DESIGN.md 토큰을 활용하지 못함
- CSS 변수가 `--color-*` 단순 체계로 DESIGN.md의 `--semantic-*` 2단계 구조와 불일치
- Tailwind 설정이 없어 시맨틱 유틸리티 클래스 사용 불가
- 카드가 리스트형으로 시각적 밀도가 낮음
- 다크모드 토글 UI가 없음

목표: DESIGN.md(Wanted Montage) 기반 토큰 체계를 site에 완전히 적용하고, blog에서 검증된 컴포넌트를 이식해 시각 품질을 높인다.

---

## 2. 컴포넌트 이식 범위

blog(`/Users/zorba/AI/dev/blog/src`) → site(`apps/site/components/`)

| blog 파일 | site 위치 | 비고 |
|---|---|---|
| `components/Layout/TopNavigation.tsx` | `components/TopNavigation.tsx` | next-themes 기반 토글 포함 |
| `components/Card/Card.tsx` | `components/Card.tsx` | youtube/github 아이콘, hover 효과 |
| `components/Badge/Badge.tsx` | `components/Badge.tsx` | 태그 내부 렌더링에 사용 |
| `components/Icon/Icon.tsx` | `components/Icon.tsx` | youtube, github, search, sun, moon |
| `components/Button/Button.tsx` | `components/Button.tsx` | TopNavigation 내 버튼 |

이식 시 Astro 의존성(`import ... from 'astro'`)을 Next.js 호환 코드로 교체한다.

---

## 3. 토큰 체계 교체

### 3.1 globals.css

현재 `--color-*` 체계를 blog `global.css`의 `--semantic-*` 전체 변수 세트로 교체한다.

- Light / Dark 모드 변수 모두 포함
- Atomic 색상 → Semantic 2단계 구조 유지
- Spacing, Shadow, Typography 변수 포함

### 3.2 tailwind.config.ts 추가

blog `tailwind.config.mjs`를 기반으로 `apps/site/tailwind.config.ts`를 신규 생성한다.

- `colors`: primary, label, background, line, status, fill, interaction, inverse
- `boxShadow`: normal-xsmall ~ xlarge, spread-small / medium
- `fontFamily`: Pretendard
- `fontSize`: display1 ~ caption2 전체 타이포그래피 스케일

---

## 4. 화면별 설계

### 4.1 네비게이션 (`layout.tsx`)

현재 인라인 스타일 `<header>` → `<TopNavigation />` 컴포넌트로 교체.

```
[zettlink]                    [🔍] [🌙 Dark]
```

- sticky top-0, z-100
- 높이 56px, 배경 `bg-background-normal-alternative`
- 하단 `border-b border-line-normal-normal`
- 검색: `PagefindSearch` 연결 (기존 유지)
- 다크모드 토글: `next-themes`의 `useTheme` 사용, sun/moon 아이콘 전환

### 4.2 필터 칩 (`CardList.tsx`)

```
전체 24   #AI 8   #Next.js 5   #Rust 3   #TypeScript 6
```

- 형태: Rect (border-radius 6px), fill tint 배경
- # prefix: `::before { content: '#' }`, muted 색상, '전체' 칩은 # 없음
- 카운트: 뱃지 없이 흐린 텍스트(`text-label-assistive`)로 태그명 뒤에 표시
- inactive: `bg-fill-normal text-label-alternative`
- active: `bg-primary-normal/10 text-primary-normal`, # 도 `text-primary-normal/40`
- 카운트 데이터: `getAllTags()`가 반환하는 `TagItem`에 `count` 필드 추가 필요

### 4.3 카드 그리드 (`CardList.tsx`)

```
[ Card ] [ Card ] [ Card ]
[ Card ] [ Card ] [ Card ]
```

- 레이아웃: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, gap-4
- 각 카드: `<Card>` 컴포넌트 사용, `hoverable` prop 활성화
- 카드 내부:
  - 플랫폼 아이콘: `<Icon name="youtube" />` 또는 `<Icon name="github" />`, 40×40 bg-primary/10 컨테이너
  - 우측 상단: 날짜 (`text-caption1 text-label-assistive`)
  - 제목: `text-heading2 font-bold`, 2줄 clamp
  - 요약: `text-body1 text-label-neutral`, 3줄 clamp
  - 태그: `<Badge variant="subtle" color="neutral">#태그명</Badge>`, B1 스타일

### 4.4 빈 상태

카드 0개일 때:

```
게시된 노트가 없습니다.
```

- `text-label-assistive`, 세로 중앙 정렬, padding 4rem

---

## 5. 반응형

| 브레이크포인트 | 카드 열 수 |
|---|---|
| 기본 (모바일) | 1열 |
| sm (768px+) | 2열 |
| lg (1200px+) | 3열 |

필터 칩은 `flex-wrap`으로 자연스럽게 줄바꿈.

---

## 6. 다크모드

- `next-themes`의 `ThemeProvider`로 이미 구성된 구조 유지
- `--semantic-*` 변수를 `.dark` 클래스 하위에서 재정의하는 방식 (blog와 동일)
- 다크모드에서 카드 배경: `bg-background-elevated-normal` (`coolNeutral-17`)

---

## 7. 변경하지 않는 것

- `lib/cards.ts` 페칭 쿼리 로직 (`getPublishedCards` 등) — `TagItem` 타입에 `count` 필드만 추가하고 쿼리는 그대로
- `PagefindSearch.tsx` 컴포넌트
- `not-found.tsx`
- Vercel/Next.js 빌드 설정

---

## 8. 파일 변경 목록

| 파일 | 변경 유형 |
|---|---|
| `app/globals.css` | 교체 (--semantic-* 전체 토큰) |
| `app/layout.tsx` | 수정 (TopNavigation 컴포넌트 교체) |
| `app/page.tsx` | 유지 |
| `components/CardList.tsx` | 수정 (그리드 레이아웃 + 새 태그 칩) |
| `components/TopNavigation.tsx` | 신규 (blog에서 이식) |
| `components/Card.tsx` | 신규 (blog에서 이식) |
| `components/Badge.tsx` | 신규 (blog에서 이식) |
| `components/Icon.tsx` | 신규 (blog에서 이식) |
| `components/Button.tsx` | 신규 (blog에서 이식) |
| `tailwind.config.ts` | 신규 (시맨틱 토큰 매핑) |
| `lib/cards.ts` | 수정 (TagItem.count 필드 추가) |
