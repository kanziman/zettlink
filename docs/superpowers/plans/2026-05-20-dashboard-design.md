# Dashboard 디자인 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard UI를 통계 행 + SegmentedControl 필터 + 플랫폼 액센트 바 카드 + 사이드바 액션 모달로 개선한다.

**Architecture:** 기존 단일 `page.tsx` 구조를 유지하면서 모달 JSX를 `CardModal` 컴포넌트로 분리하고, `SegmentedControl` / `StatCard` 두 신규 컴포넌트를 추가한다. `CardData` 타입은 `src/types/card.ts`로 추출해 두 파일이 공유한다.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind CSS v3, next-themes, pnpm

---

## File Map

| 파일 | 작업 |
|---|---|
| `src/types/card.ts` | 신규 — CardData, CardPlatform, CardStatus 타입 |
| `src/components/Button/Button.tsx` | 수정 — gap-4 → gap-2 버그 수정 |
| `src/components/Badge/Badge.tsx` | 수정 — rounded-md → rounded |
| `src/components/Icon/Icon.tsx` | 수정 — aria-hidden 적용 |
| `src/components/Card/Card.tsx` | 수정 — platform prop + 좌측 액센트 바 |
| `src/components/SegmentedControl/SegmentedControl.tsx` | 신규 |
| `src/components/StatCard/StatCard.tsx` | 신규 |
| `src/components/CardModal/CardModal.tsx` | 신규 — 사이드바 액션 패널 포함 |
| `src/app/page.tsx` | 수정 — 통계 행 + SegmentedControl + CardModal 연결 |

---

## Task 1: 공유 타입 추출 + 원자 컴포넌트 버그 3개 수정

**Files:**
- Create: `src/types/card.ts`
- Modify: `src/components/Button/Button.tsx`
- Modify: `src/components/Badge/Badge.tsx`
- Modify: `src/components/Icon/Icon.tsx`

- [ ] **Step 1-1: `src/types/card.ts` 생성**

```typescript
// 대시보드 카드 도메인 타입
export type CardPlatform = 'youtube' | 'github' | 'processing';
export type CardStatus = 'done' | 'error' | 'processing';

export type CardData = {
  id: string;
  type: 'youtube' | 'github';
  title: string;
  summary: string;
  tags: string[];
  status: CardStatus;
  published: boolean;
  date: string;
};
```

- [ ] **Step 1-2: Button gap 버그 수정**

`src/components/Button/Button.tsx` 51번째 줄 근처 classNames 배열에서:
```typescript
// Before
'inline-flex items-center justify-center gap-4 rounded-lg font-semibold transition-all duration-200 border',

// After
'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border',
```

- [ ] **Step 1-3: Badge border-radius 수정**

`src/components/Badge/Badge.tsx` classNames 배열에서:
```typescript
// Before
'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',

// After
'inline-flex items-center justify-center rounded font-medium whitespace-nowrap',
```

- [ ] **Step 1-4: Icon aria-label → aria-hidden 수정**

`src/components/Icon/Icon.tsx` SVG props에서:
```typescript
// Before
role="img"
aria-label={name}

// After
aria-hidden="true"
```

결과: 장식용 아이콘이 스크린 리더에서 숨겨진다.

- [ ] **Step 1-5: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 1-6: 커밋**

```bash
cd /Users/zorba/AI/dev/dashboard
git add src/types/card.ts src/components/Button/Button.tsx src/components/Badge/Badge.tsx src/components/Icon/Icon.tsx
git commit -m "fix: Button gap, Badge radius, Icon aria-hidden + 타입 파일 추출"
```

---

## Task 2: Card 컴포넌트 — 플랫폼 액센트 바

**Files:**
- Modify: `src/components/Card/Card.tsx`

- [ ] **Step 2-1: Card.tsx 전체 교체**

```typescript
// 플랫폼별 좌측 액센트 바를 가진 카드 컴포넌트
import React from 'react';
import type { CardPlatform } from '@/types/card';

const PLATFORM_ACCENT: Record<CardPlatform, string> = {
  youtube: '#FF4242',
  github: '#2E2F33',
  processing: '#FF7A00',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  platform?: CardPlatform;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, platform, className = '', style, children, ...props }, ref) => {
    const classNames = [
      'bg-background-elevated-normal text-label-normal border border-line-normal-normal p-6 rounded-[16px] shadow-normal-small transition-all duration-200',
      hoverable ? 'hover:shadow-normal-medium hover:-translate-y-0.5 cursor-pointer' : '',
      className,
    ].filter(Boolean).join(' ');

    const accentStyle: React.CSSProperties = platform
      ? { borderLeftWidth: 3, borderLeftColor: PLATFORM_ACCENT[platform], ...style }
      : (style ?? {});

    return (
      <div ref={ref} className={classNames} style={accentStyle} {...props}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
```

- [ ] **Step 2-2: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 2-3: 커밋**

```bash
git add src/components/Card/Card.tsx
git commit -m "feat: Card 플랫폼 액센트 바 추가 (youtube/github/processing)"
```

---

## Task 3: SegmentedControl 컴포넌트

**Files:**
- Create: `src/components/SegmentedControl/SegmentedControl.tsx`

- [ ] **Step 3-1: 컴포넌트 생성**

```typescript
// 탭 형태의 필터 선택 컴포넌트
import React from 'react';

export interface SegmentedOption {
  label: string;
  value: string;
  count?: number;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  className = '',
}) => (
  <div className={`bg-fill-normal rounded-lg p-[3px] flex ${className}`}>
    {options.map(opt => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 h-7 rounded-md text-label2 font-medium transition-all duration-150 flex items-center gap-1',
            active
              ? 'bg-background-elevated-normal text-label-strong shadow-normal-xsmall'
              : 'text-label-alternative hover:text-label-normal',
          ].join(' ')}
        >
          <span>{opt.label}</span>
          {active && opt.count !== undefined && (
            <span className="text-label-assistive">· {opt.count}</span>
          )}
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 3-2: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3-3: 커밋**

```bash
git add src/components/SegmentedControl/SegmentedControl.tsx
git commit -m "feat: SegmentedControl 탭 필터 컴포넌트 추가"
```

---

## Task 4: StatCard 컴포넌트

**Files:**
- Create: `src/components/StatCard/StatCard.tsx`

- [ ] **Step 4-1: 컴포넌트 생성**

```typescript
// 단일 통계값을 표시하는 카드
import React from 'react';

interface StatCardProps {
  value: number;
  label: string;
  valueClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  valueClassName = 'text-label-strong',
}) => (
  <div className="bg-background-elevated-normal border border-line-normal-normal rounded-[10px] px-4 py-3 shadow-normal-xsmall">
    <div className={`text-title3 font-bold ${valueClassName}`}>{value}</div>
    <div className="text-caption1 text-label-assistive mt-0.5">{label}</div>
  </div>
);
```

- [ ] **Step 4-2: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4-3: 커밋**

```bash
git add src/components/StatCard/StatCard.tsx
git commit -m "feat: StatCard 통계 칩 컴포넌트 추가"
```

---

## Task 5: CardModal 컴포넌트 — 사이드바 액션 패널

**Files:**
- Create: `src/components/CardModal/CardModal.tsx`

- [ ] **Step 5-1: 컴포넌트 생성**

```typescript
// 카드 상세 모달 — 좌측 요약 + 우측 Generate/Publish 사이드바
"use client";

import React from 'react';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import type { CardData } from '@/types/card';

const PLATFORM_ACCENT: Record<'youtube' | 'github', string> = {
  youtube: '#FF4242',
  github: '#2E2F33',
};

const PLATFORM_LABEL: Record<'youtube' | 'github', string> = {
  youtube: 'YouTube Video',
  github: 'GitHub Repository',
};

interface CardModalProps {
  card: CardData;
  onClose: () => void;
  onPublishToggle: (id: string) => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, onClose, onPublishToggle }) => (
  <div
    className="fixed inset-0 bg-material-dimmer z-[1300] flex items-center justify-center p-6 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
    onClick={onClose}
  >
    <div
      className="w-full max-w-[700px] max-h-[90vh] bg-background-elevated-normal rounded-[20px] flex flex-col shadow-normal-xlarge overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-line-normal-normal flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-1 h-5 rounded-full flex-shrink-0"
            style={{ backgroundColor: PLATFORM_ACCENT[card.type] }}
          />
          <span className="text-title3 truncate">{PLATFORM_LABEL[card.type]}</span>
        </div>
        <Button variant="outlined" color="assistive" iconOnly size="small" onClick={onClose}>
          <Icon name="close" size={20} />
        </Button>
      </div>

      {/* Body: 좌측 콘텐츠 + 우측 사이드바 */}
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 130px' }}>

        {/* 좌측: 제목 + 태그 + 요약 */}
        <div className="p-6 border-r border-line-normal-normal overflow-y-auto">
          <h2 className="text-display3 mb-4">{card.title}</h2>

          <div className="flex items-center gap-2 flex-wrap mb-6">
            <Badge
              variant={card.published ? 'solid' : 'subtle'}
              color={card.published ? 'positive' : 'neutral'}
            >
              {card.published ? '● Published' : 'Draft'}
            </Badge>
            {card.tags.map(tag => (
              <Badge key={tag} variant="subtle" color="primary" size="small">#{tag}</Badge>
            ))}
          </div>

          <div className="bg-fill-normal rounded-xl p-5">
            <p className="text-caption1 font-bold text-primary-normal uppercase tracking-widest mb-3">
              Auto Summary
            </p>
            <p className="text-body1 text-label-neutral leading-relaxed">{card.summary}</p>
          </div>
        </div>

        {/* 우측: 액션 사이드바 */}
        <div className="p-4 bg-background-normal-alternative flex flex-col gap-2.5 flex-shrink-0">
          <p className="text-caption2 font-bold text-label-assistive uppercase tracking-widest mb-1">
            Generate
          </p>
          <Button variant="outlined" color="primary" size="small" fullWidth>
            📖 TIL
          </Button>
          <Button variant="outlined" color="assistive" size="small" fullWidth>
            📄 Guide
          </Button>
          <Button variant="outlined" color="assistive" size="small" fullWidth>
            🔍 Deep
          </Button>
          <div className="border-t border-line-normal-normal my-1" />
          <Button
            variant="solid"
            color={card.published ? 'negative' : 'positive'}
            size="small"
            fullWidth
            onClick={() => onPublishToggle(card.id)}
          >
            {card.published ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>

    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    ` }} />
  </div>
);
```

- [ ] **Step 5-2: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5-3: 커밋**

```bash
git add src/components/CardModal/CardModal.tsx
git commit -m "feat: CardModal 사이드바 액션 패널 컴포넌트 추가"
```

---

## Task 6: page.tsx — 통계 행 + SegmentedControl + CardModal 통합

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 6-1: page.tsx 전체 교체**

```typescript
// 대시보드 메인 페이지 — 통계 행 + 필터 + 카드 그리드
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/Card/Card';
import { Badge } from '@/components/Badge/Badge';
import { Icon } from '@/components/Icon/Icon';
import { SegmentedControl } from '@/components/SegmentedControl/SegmentedControl';
import { StatCard } from '@/components/StatCard/StatCard';
import { CardModal } from '@/components/CardModal/CardModal';
import type { CardData } from '@/types/card';

const INITIAL_CARDS: CardData[] = [
  {
    id: '1',
    type: 'youtube',
    title: 'How to build an AI agent with Claude 3.5 Sonnet',
    summary: 'A comprehensive guide on utilizing Claude 3.5 Sonnet to build autonomous AI agents. Covers structured outputs, tool use, and memory management for long-running processes.',
    tags: ['AI', 'Claude', 'Agent'],
    status: 'done',
    published: true,
    date: '2026-05-14',
  },
  {
    id: '2',
    type: 'github',
    title: 'vercel/next.js',
    summary: 'The React Framework. This repository contains the source code for Next.js, a powerful framework for building production-ready React applications with SSR, SSG, and ISR support.',
    tags: ['React', 'Next.js', 'Framework'],
    status: 'done',
    published: false,
    date: '2026-05-15',
  },
  {
    id: '3',
    type: 'youtube',
    title: 'Understanding React Server Components in 10 Minutes',
    summary: 'RSC explained simply. Why they matter, how they work under the hood, and how to incrementally adopt them in your existing codebase.',
    tags: ['React', 'RSC', 'Web'],
    status: 'processing',
    published: false,
    date: '2026-05-15',
  },
];

type FilterValue = 'all' | 'published' | 'unpublished';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' as FilterValue },
  { label: 'Published', value: 'published' as FilterValue },
  { label: 'Draft', value: 'unpublished' as FilterValue },
];

export default function Dashboard() {
  const [cards, setCards] = useState<CardData[]>(INITIAL_CARDS);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [search, setSearch] = useState('');

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null;

  const publishedCount = cards.filter(c => c.published).length;
  const draftCount = cards.filter(c => !c.published).length;

  const filterOptionsWithCount = FILTER_OPTIONS.map(opt =>
    opt.value === 'all' ? { ...opt, count: cards.length } : opt
  );

  const filteredCards = cards.filter(card => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'published' && card.published) ||
      (filter === 'unpublished' && !card.published);
    const matchesSearch =
      !search ||
      card.title.toLowerCase().includes(search.toLowerCase()) ||
      card.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handlePublishToggle = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, published: !c.published } : c));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 페이지 헤더 */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display2">Knowledge Vault</h1>
          <p className="text-body1 text-label-alternative">
            Captured contents automatically summarized and tagged.
          </p>
        </div>

        {/* 통계 행 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={cards.length} label="전체 카드" />
          <StatCard value={publishedCount} label="Published" valueClassName="text-status-positive" />
          <StatCard value={draftCount} label="Draft" valueClassName="text-label-alternative" />
        </div>

        {/* 검색 + 필터 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center bg-background-elevated-normal border border-line-normal-normal rounded-lg px-3 h-9 shadow-normal-xsmall transition-all focus-within:border-primary-normal focus-within:shadow-[0_0_0_2px_rgba(0,102,255,0.2)]">
            <Icon name="search" size={16} className="text-label-assistive mr-2 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="border-none bg-transparent outline-none w-full text-label-normal font-sans text-body2 placeholder:text-label-disable"
            />
          </div>
          <SegmentedControl
            options={filterOptionsWithCount}
            value={filter}
            onChange={v => setFilter(v as FilterValue)}
          />
        </div>
      </header>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
        {filteredCards.map(card => {
          const platform = card.status === 'processing' ? 'processing' : card.type;
          const isProcessing = card.status === 'processing';

          return (
            <Card
              key={card.id}
              hoverable={!isProcessing}
              platform={platform}
              className={`flex flex-col h-full ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}
              onClick={() => !isProcessing && setSelectedCardId(card.id)}
            >
              {/* 플랫폼 + 상태 */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-1.5">
                  <Icon
                    name={card.type}
                    size={16}
                    style={{ color: platform === 'processing' ? '#FF7A00' : platform === 'youtube' ? '#FF4242' : '#2E2F33' }}
                  />
                  <span className="text-label2 font-semibold" style={{ color: platform === 'processing' ? '#FF7A00' : platform === 'youtube' ? '#FF4242' : '#2E2F33' }}>
                    {card.type === 'youtube' ? 'YouTube' : 'GitHub'}
                  </span>
                </div>
                {isProcessing ? (
                  <Badge variant="subtle" color="cautionary" size="small">Processing…</Badge>
                ) : card.published ? (
                  <Badge variant="subtle" color="positive" size="small">Published</Badge>
                ) : null}
              </div>

              {/* 제목 */}
              <h3 className="text-heading2 font-bold mb-2 line-clamp-2">{card.title}</h3>

              {/* 요약 */}
              <p className="text-body2 text-label-neutral line-clamp-3 flex-1 mb-4">{card.summary}</p>

              {/* 태그 + 날짜 */}
              <div className="flex justify-between items-center pt-3 border-t border-line-normal-normal">
                <div className="flex gap-1 flex-wrap">
                  {card.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="subtle" color="neutral" size="small">#{tag}</Badge>
                  ))}
                </div>
                <span className="text-caption1 text-label-assistive flex-shrink-0">{card.date}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 카드 상세 모달 */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCardId(null)}
          onPublishToggle={handlePublishToggle}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6-2: 타입 체크**

```bash
cd /Users/zorba/AI/dev/dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6-3: dev 서버로 시각 검증**

```bash
cd /Users/zorba/AI/dev/dashboard
pnpm dev
```

브라우저에서 `http://localhost:3000` 열고 확인:
- [ ] 통계 행 3개 (전체/Published/Draft) 카운트가 정확한가
- [ ] SegmentedControl 탭 전환 시 카드 필터링이 동작하는가
- [ ] YouTube 카드에 빨간 좌측 바, GitHub 카드에 어두운 좌측 바가 보이는가
- [ ] Processing 카드(3번)에 주황 좌측 바 + opacity-70이 적용되었는가
- [ ] 카드 클릭 시 모달이 열리고, 우측 사이드바에 TIL/Guide/Deep/Publish 버튼이 보이는가
- [ ] Publish 버튼 클릭 시 카드 상태와 통계 카운트가 즉시 갱신되는가
- [ ] 다크 모드 전환 시 배경/텍스트 컬러가 정상인가

- [ ] **Step 6-4: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: 통계 행 + SegmentedControl 필터 + CardModal 연결"
```

---

## 완료 기준

1. `npx tsc --noEmit` 에러 없음
2. 통계 행 카운트가 Publish 토글 시 즉시 갱신됨
3. 필터 탭 전환이 기존과 동일하게 동작함
4. YouTube=빨강 / GitHub=다크 / Processing=주황 액센트 바
5. 모달 우측 사이드바에 TIL / Guide / Deep / Publish 버튼 항상 노출
6. 다크 모드 시각 이상 없음
