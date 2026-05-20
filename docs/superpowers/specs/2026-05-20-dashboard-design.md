# Dashboard 디자인 개선 스펙

**날짜:** 2026-05-20  
**대상:** `apps/dashboard/` (Next.js 15, 로컬 전용)  
**범위:** 기존 코드 점진 개선 — 레이아웃 구조 유지, 시각적 품질 향상

---

## 1. 목표

현재 동작하는 dashboard UI를 DESIGN.md(Wanted Montage) 토큰 기반으로 시각적으로 다듬는다. 새 기능 추가 없이, 기존 기능의 가독성과 상호작용 품질을 높인다.

---

## 2. 변경 범위

### 2.1 페이지 헤더 — 통계 행 추가

현재 제목 + 설명만 있는 헤더 아래에 3개 통계 칩을 추가한다.

| 항목 | 값 | 컬러 |
|---|---|---|
| 전체 카드 | `cards.length` | `label-strong` |
| Published | `cards.filter(published).length` | `status-positive` |
| Draft | `cards.filter(!published).length` | `label-alternative` |

- 카드 배경: `background-elevated-normal`, 테두리: `line-normal-normal`, 그림자: `shadow-normal-xsmall`
- 숫자 타이포: `title3`(20px bold), 레이블: `caption1`(12px, `label-assistive`)

### 2.2 필터 — SegmentedControl로 교체

현재 `Button` 3개 조합 → 단일 `SegmentedControl` 컴포넌트.

```
[ All · 24 | Published | Draft ]
```

- 컨테이너: `bg-fill-normal` + `rounded-lg` + `p-[3px]`
- 활성 탭: `bg-background-elevated-normal` + `shadow-normal-xsmall` + `font-semibold`
- 비활성 탭: 텍스트 `label-alternative`, hover 시 `label-normal`
- 카운트 badge는 활성 탭에만 표시 (`· 24` 형식)

### 2.3 카드 — 플랫폼 액센트 바

`Card` 컴포넌트에 `platform` prop 추가. 좌측 3px border로 플랫폼 구분.

| 플랫폼 | 액센트 컬러 | 아이콘 컬러 |
|---|---|---|
| youtube | `red[50]` `#FF4242` | 동일 |
| github | `coolNeutral[22]` `#2E2F33` | 동일 |
| processing | `orange[50]` `#FF7A00` | 동일 |

- `border-l-[3px]` + `rounded-l-none` 처리 (좌측 radius 제거)
- Processing 카드: `opacity-70`, 클릭 불가
- 카드 하단: 구분선(`border-t border-line-normal-normal pt-3`) 위에 태그 + 날짜 배치
- 태그: `bg-fill-normal text-label-alternative`, `rounded-[4px]`, `text-caption1`
- 날짜: `text-caption1 text-label-assistive`

**수정 파일:** `src/components/Card/Card.tsx`

### 2.4 모달 — 사이드바 액션 패널

기존 하단 버튼 행 → 우측 130px 고정 사이드바로 이동.

#### 헤더
- 좌측: 플랫폼 컬러 4px 세로 바 + 제목(`title3`)
- 우측: Close 버튼(`IconButton`, outlined, assistive)

#### 본문 — 2컬럼 grid
```
grid-template-columns: 1fr 130px
```

**좌측 (콘텐츠 영역)**
- published badge + 태그 행
- Auto Summary 섹션: `bg-fill-normal rounded-xl` 카드, 섹션 레이블 `caption1 font-bold text-primary-normal uppercase tracking-wide`
- 생성된 TIL/Guide/Deep이 있으면 동일 스타일 섹션으로 추가 노출

**우측 (액션 사이드바)**
- 배경: `bg-background-normal-alternative`
- `border-l border-line-normal-normal`
- "Generate" 레이블(`caption2`, uppercase, `label-assistive`)
- 버튼 3개 (TIL / Guide / Deep): `outlined`, `assistive`, `fullWidth`, `small`
  - 생성 완료 시: `outlined primary` + 체크 아이콘
- 구분선 후 Publish/Unpublish: `solid positive`/`solid negative`, `fullWidth`, `small`

#### 상태별 사이드바 버튼
```
미생성:   outlined assistive  "📖 TIL"
생성됨:   outlined primary    "✓ TIL"   (클릭 시 내용 펼침)
생성중:   disabled + spinner
```

**수정 파일:** `src/app/page.tsx` (모달 JSX 분리 권장: `src/components/CardModal/CardModal.tsx`)

### 2.5 버그 수정

| 버그 | 현재 | 수정 |
|---|---|---|
| Button 아이콘 간격 | `gap-4` (16px) | `gap-2` (8px) |
| Badge border-radius | `rounded-md` (6px) | `rounded` (4px) — label1 크기에 맞게 |
| Icon `aria-label` | 모든 아이콘에 동일 적용 | `role="presentation"` (장식용) 또는 의미있는 레이블만 유지 |

**수정 파일:** `src/components/Button/Button.tsx`, `src/components/Badge/Badge.tsx`, `src/components/Icon/Icon.tsx`

---

## 3. 컴포넌트 목록

| 컴포넌트 | 작업 | 파일 |
|---|---|---|
| `SegmentedControl` | 신규 생성 | `src/components/SegmentedControl/SegmentedControl.tsx` |
| `StatCard` | 신규 생성 (인라인 가능) | `src/components/StatCard/StatCard.tsx` |
| `CardModal` | 기존 모달 JSX 분리 | `src/components/CardModal/CardModal.tsx` |
| `Card` | platform prop 추가 | `src/components/Card/Card.tsx` |
| `Button` | gap 버그 수정 | `src/components/Button/Button.tsx` |
| `Badge` | radius 수정 | `src/components/Badge/Badge.tsx` |
| `Icon` | aria-label 정리 | `src/components/Icon/Icon.tsx` |

---

## 4. 스코프 외

- 다크 모드 토글 동작: 변경 없음 (이미 작동)
- TopNavigation: 변경 없음
- 라우팅/페이지 추가: 없음
- blog/site: 이번 스펙 외 (별도 진행)
- 실제 vault 데이터 연동: 기존 mock 데이터 유지

---

## 5. 성공 기준

1. 통계 행이 vault mock 데이터에서 정확한 카운트를 보여준다.
2. SegmentedControl 탭 전환이 기존 필터 버튼과 동일하게 동작한다.
3. 카드 좌측 보더가 youtube=빨강, github=다크, processing=주황으로 표시된다.
4. 모달 우측 사이드바에 TIL / Guide / Deep / Publish 버튼이 항상 노출된다.
5. `pnpm typecheck` 통과.
6. 기존 동작(필터, 모달 열기/닫기, 테마 전환) 회귀 없음.
