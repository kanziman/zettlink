# Site 디자인 개선 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
>
> **Before touching any .tsx file:** invoke `/react-best-practices` skill as required by CLAUDE.md.

**Goal:** blog에서 검증된 컴포넌트를 site에 이식하고 Wanted Montage 시맨틱 토큰을 적용해 인라인 스타일 기반 리스트뷰를 그리드 카드 UI로 교체한다.

**Architecture:** `apps/site/components/`에 blog 컴포넌트(Icon, Badge, Button, Card, TopNavigation)를 이식하고, `globals.css`에 `--semantic-*` CSS 변수 전체를 정의한 뒤 `tailwind.config.mjs`로 Tailwind 유틸리티 클래스에 매핑한다. `CardList.tsx`는 3열 그리드 + 새 필터 칩으로 재작성한다.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, next-themes, React 19

---

## 파일 변경 맵

| 파일 | 작업 |
|---|---|
| `apps/site/app/globals.css` | 교체 — `--semantic-*` 전체 토큰 + `@config` 추가 |
| `apps/site/tailwind.config.mjs` | 신규 — 시맨틱 색상·그림자·타이포그래피 매핑 |
| `apps/site/components/Icon.tsx` | 신규 (blog 이식) |
| `apps/site/components/Badge.tsx` | 신규 (blog 이식) |
| `apps/site/components/Button.tsx` | 신규 (blog 이식) |
| `apps/site/components/TopNavigation.tsx` | 신규 (blog 이식 + next-themes 적용) |
| `apps/site/app/layout.tsx` | 수정 — 인라인 헤더 → TopNavigation |
| `apps/site/components/Card.tsx` | 신규 (blog 이식) |
| `apps/site/components/CardList.tsx` | 수정 — 그리드 레이아웃 + 새 필터 칩 |

---

## Task 1: 토큰 파운데이션 — globals.css + tailwind.config.mjs

**Files:**
- Modify: `apps/site/app/globals.css`
- Create: `apps/site/tailwind.config.mjs`

- [x] **Step 1: tailwind.config.mjs 생성**

`apps/site/tailwind.config.mjs`를 아래 내용으로 생성한다. 이 파일은 `--semantic-*` CSS 변수를 Tailwind 유틸리티 클래스에 매핑한다.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          normal: 'var(--semantic-primary-normal)',
          strong: 'var(--semantic-primary-strong)',
          heavy: 'var(--semantic-primary-heavy)',
        },
        label: {
          normal: 'var(--semantic-label-normal)',
          strong: 'var(--semantic-label-strong)',
          neutral: 'var(--semantic-label-neutral)',
          alternative: 'var(--semantic-label-alternative)',
          assistive: 'var(--semantic-label-assistive)',
          disable: 'var(--semantic-label-disable)',
        },
        background: {
          'normal-normal': 'var(--semantic-background-normal-normal)',
          'normal-alternative': 'var(--semantic-background-normal-alternative)',
          'elevated-normal': 'var(--semantic-background-elevated-normal)',
        },
        interaction: {
          inactive: 'var(--semantic-interaction-inactive)',
          disable: 'var(--semantic-interaction-disable)',
        },
        line: {
          'normal-normal': 'var(--semantic-line-normal-normal)',
          'solid-normal': 'var(--semantic-line-solid-normal)',
        },
        status: {
          positive: 'var(--semantic-status-positive)',
          cautionary: 'var(--semantic-status-cautionary)',
          negative: 'var(--semantic-status-negative)',
        },
        fill: {
          normal: 'var(--semantic-fill-normal)',
          strong: 'var(--semantic-fill-strong)',
        },
        material: {
          dimmer: 'var(--semantic-material-dimmer)',
        },
        inverse: {
          primary: 'var(--semantic-inverse-primary)',
          background: 'var(--semantic-inverse-background)',
        },
      },
      boxShadow: {
        'normal-xsmall': 'var(--elevation-shadow-normal-xsmall)',
        'normal-small': 'var(--elevation-shadow-normal-small)',
        'normal-medium': 'var(--elevation-shadow-normal-medium)',
        'normal-large': 'var(--elevation-shadow-normal-large)',
        'normal-xlarge': 'var(--elevation-shadow-normal-xlarge)',
        'spread-small': 'var(--elevation-shadow-spread-small)',
        'spread-medium': 'var(--elevation-shadow-spread-medium)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
      },
      fontSize: {
        display1: ['var(--font-display1-size)', { lineHeight: 'var(--font-display1-lh)', letterSpacing: 'var(--font-display1-ls)', fontWeight: 'var(--font-display1-weight)' }],
        display2: ['var(--font-display2-size)', { lineHeight: 'var(--font-display2-lh)', letterSpacing: 'var(--font-display2-ls)', fontWeight: 'var(--font-display2-weight)' }],
        title1:   ['var(--font-title1-size)',   { lineHeight: 'var(--font-title1-lh)',   letterSpacing: 'var(--font-title1-ls)',   fontWeight: 'var(--font-title1-weight)' }],
        title2:   ['var(--font-title2-size)',   { lineHeight: 'var(--font-title2-lh)',   letterSpacing: 'var(--font-title2-ls)',   fontWeight: 'var(--font-title2-weight)' }],
        title3:   ['var(--font-title3-size)',   { lineHeight: 'var(--font-title3-lh)',   letterSpacing: 'var(--font-title3-ls)',   fontWeight: 'var(--font-title3-weight)' }],
        heading1: ['var(--font-heading1-size)', { lineHeight: 'var(--font-heading1-lh)', letterSpacing: 'var(--font-heading1-ls)', fontWeight: 'var(--font-heading1-weight)' }],
        heading2: ['var(--font-heading2-size)', { lineHeight: 'var(--font-heading2-lh)', letterSpacing: 'var(--font-heading2-ls)', fontWeight: 'var(--font-heading2-weight)' }],
        headline1:['var(--font-headline1-size)',{ lineHeight: 'var(--font-headline1-lh)',letterSpacing: 'var(--font-headline1-ls)',fontWeight: 'var(--font-headline1-weight)' }],
        headline2:['var(--font-headline2-size)',{ lineHeight: 'var(--font-headline2-lh)',letterSpacing: 'var(--font-headline2-ls)',fontWeight: 'var(--font-headline2-weight)' }],
        body1:    ['var(--font-body1-size)',    { lineHeight: 'var(--font-body1-lh)',    letterSpacing: 'var(--font-body1-ls)',    fontWeight: 'var(--font-body1-weight)' }],
        body2:    ['var(--font-body2-size)',    { lineHeight: 'var(--font-body2-lh)',    letterSpacing: 'var(--font-body2-ls)',    fontWeight: 'var(--font-body2-weight)' }],
        label1:   ['var(--font-label1-size)',   { lineHeight: 'var(--font-label1-lh)',   letterSpacing: 'var(--font-label1-ls)',   fontWeight: 'var(--font-label1-weight)' }],
        label2:   ['var(--font-label2-size)',   { lineHeight: 'var(--font-label2-lh)',   letterSpacing: 'var(--font-label2-ls)',   fontWeight: 'var(--font-label2-weight)' }],
        caption1: ['var(--font-caption1-size)', { lineHeight: 'var(--font-caption1-lh)', letterSpacing: 'var(--font-caption1-ls)', fontWeight: 'var(--font-caption1-weight)' }],
        caption2: ['var(--font-caption2-size)', { lineHeight: 'var(--font-caption2-lh)', letterSpacing: 'var(--font-caption2-ls)', fontWeight: 'var(--font-caption2-weight)' }],
      },
    },
  },
  plugins: [],
}
```

- [x] **Step 2: globals.css 교체**

`apps/site/app/globals.css` 전체를 아래로 교체한다. 기존 `--color-*` 체계를 `--semantic-*` 2단계 구조로 교체하고 `@config`를 추가한다.

```css
/* 공개 사이트 전역 스타일 — Wanted Montage semantic token CSS 변수 */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@config "../tailwind.config.mjs";

:root {
  /* ── Atomic Colors ── */
  --blue-40: #0054D1;
  --blue-45: #005EEB;
  --blue-50: #0066FF;
  --blue-55: #1A75FF;
  --blue-60: #3385FF;

  --coolNeutral-5:  #0F0F10;
  --coolNeutral-10: #171719;
  --coolNeutral-15: #1B1C1E;
  --coolNeutral-17: #222325;
  --coolNeutral-22: #2E2F33;
  --coolNeutral-25: #37383C;
  --coolNeutral-40: #5A5C63;
  --coolNeutral-50: #70737C;
  --coolNeutral-70: #989BA2;
  --coolNeutral-80: #C2C4C8;
  --coolNeutral-90: #DBDCDF;
  --coolNeutral-96: #F0F1F2;
  --coolNeutral-98: #F4F4F5;
  --coolNeutral-99: #F7F7F8;

  --green-50:  #12D589;
  --green-60:  #2FE59A;
  --orange-50: #FF7A00;
  --orange-60: #FF9533;
  --red-50:    #FF4242;
  --red-60:    #FF6363;
  --common-0:   #000000;
  --common-100: #FFFFFF;

  /* ── Semantic Colors (Light) ── */
  --semantic-primary-normal: var(--blue-50);
  --semantic-primary-strong: var(--blue-45);
  --semantic-primary-heavy:  var(--blue-40);

  --semantic-label-normal:      var(--coolNeutral-10);
  --semantic-label-strong:      var(--common-0);
  --semantic-label-neutral:     rgba(46, 47, 51, 0.88);
  --semantic-label-alternative: rgba(55, 56, 60, 0.61);
  --semantic-label-assistive:   rgba(55, 56, 60, 0.28);
  --semantic-label-disable:     rgba(55, 56, 60, 0.16);

  --semantic-background-normal-normal:      var(--common-100);
  --semantic-background-normal-alternative: var(--coolNeutral-99);
  --semantic-background-elevated-normal:    var(--common-100);

  --semantic-interaction-inactive: var(--coolNeutral-70);
  --semantic-interaction-disable:  var(--coolNeutral-98);

  --semantic-line-normal-normal: rgba(112, 115, 124, 0.22);
  --semantic-line-solid-normal:  var(--coolNeutral-96);

  --semantic-status-positive:  var(--green-50);
  --semantic-status-cautionary: var(--orange-50);
  --semantic-status-negative:  var(--red-50);

  --semantic-fill-normal: rgba(112, 115, 124, 0.08);
  --semantic-fill-strong: rgba(112, 115, 124, 0.16);

  --semantic-material-dimmer: rgba(23, 23, 25, 0.52);

  --semantic-inverse-primary:    var(--blue-60);
  --semantic-inverse-background: var(--coolNeutral-15);

  /* ── Elevation Shadows ── */
  --elevation-shadow-normal-xsmall: 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --elevation-shadow-normal-small:  0 2px 4px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.05);
  --elevation-shadow-normal-medium: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.08);
  --elevation-shadow-normal-large:  0 6px 10px rgba(0, 0, 0, 0.05), 0 16px 24px rgba(0, 0, 0, 0.1);
  --elevation-shadow-normal-xlarge: 0 10px 15px rgba(0, 0, 0, 0.05), 0 24px 38px rgba(0, 0, 0, 0.12);
  --elevation-shadow-spread-small:  0 0 60px rgba(0, 102, 255, 0.1);
  --elevation-shadow-spread-medium: 0 15px 75px rgba(0, 102, 255, 0.16);

  /* ── Typography ── */
  --font-family: 'Pretendard', sans-serif;

  --font-display1-size: 3.5rem;    --font-display1-lh: 4.5rem;    --font-display1-ls: -0.0319em; --font-display1-weight: 700;
  --font-display2-size: 2.5rem;    --font-display2-lh: 3.25rem;   --font-display2-ls: -0.0282em; --font-display2-weight: 700;
  --font-title1-size:   2.0rem;    --font-title1-lh:   2.75rem;   --font-title1-ls:   -0.0253em; --font-title1-weight:   700;
  --font-title2-size:   1.75rem;   --font-title2-lh:   2.375rem;  --font-title2-ls:   -0.0236em; --font-title2-weight:   700;
  --font-title3-size:   1.5rem;    --font-title3-lh:   2.0rem;    --font-title3-ls:   -0.023em;  --font-title3-weight:   700;
  --font-heading1-size: 1.375rem;  --font-heading1-lh: 1.875rem;  --font-heading1-ls: -0.0194em; --font-heading1-weight: 600;
  --font-heading2-size: 1.25rem;   --font-heading2-lh: 1.75rem;   --font-heading2-ls: -0.012em;  --font-heading2-weight: 600;
  --font-headline1-size:1.125rem;  --font-headline1-lh:1.625rem;  --font-headline1-ls:-0.002em;  --font-headline1-weight:600;
  --font-headline2-size:1.0625rem; --font-headline2-lh:1.5rem;    --font-headline2-ls:0em;       --font-headline2-weight:600;
  --font-body1-size:    1.0rem;    --font-body1-lh:    1.5rem;    --font-body1-ls:    0.0057em;  --font-body1-weight:    400;
  --font-body2-size:    0.9375rem; --font-body2-lh:    1.375rem;  --font-body2-ls:    0.0096em;  --font-body2-weight:    400;
  --font-label1-size:   0.875rem;  --font-label1-lh:   1.25rem;   --font-label1-ls:   0.0145em;  --font-label1-weight:   500;
  --font-label2-size:   0.8125rem; --font-label2-lh:   1.125rem;  --font-label2-ls:   0.0194em;  --font-label2-weight:   500;
  --font-caption1-size: 0.75rem;   --font-caption1-lh: 1.0rem;    --font-caption1-ls: 0.0252em;  --font-caption1-weight: 500;
  --font-caption2-size: 0.6875rem; --font-caption2-lh: 0.875rem;  --font-caption2-ls: 0.0311em;  --font-caption2-weight: 500;
}

.dark {
  --semantic-primary-normal: var(--blue-60);
  --semantic-primary-strong: var(--blue-55);
  --semantic-primary-heavy:  var(--blue-50);

  --semantic-label-normal:      var(--coolNeutral-99);
  --semantic-label-strong:      var(--common-100);
  --semantic-label-neutral:     rgba(219, 220, 223, 0.88);
  --semantic-label-alternative: rgba(194, 196, 200, 0.61);
  --semantic-label-assistive:   rgba(194, 196, 200, 0.28);
  --semantic-label-disable:     rgba(152, 155, 162, 0.16);

  --semantic-background-normal-normal:      var(--coolNeutral-15);
  --semantic-background-normal-alternative: var(--coolNeutral-5);
  --semantic-background-elevated-normal:    var(--coolNeutral-17);

  --semantic-interaction-inactive: var(--coolNeutral-40);
  --semantic-interaction-disable:  var(--coolNeutral-22);

  --semantic-line-normal-normal: rgba(112, 115, 124, 0.32);
  --semantic-line-solid-normal:  var(--coolNeutral-25);

  --semantic-status-positive:   var(--green-60);
  --semantic-status-cautionary: var(--orange-60);
  --semantic-status-negative:   var(--red-60);

  --semantic-fill-normal: rgba(112, 115, 124, 0.22);
  --semantic-fill-strong: rgba(112, 115, 124, 0.28);

  --semantic-material-dimmer: rgba(23, 23, 25, 0.74);

  --semantic-inverse-primary:    var(--blue-50);
  --semantic-inverse-background: var(--common-100);

  --elevation-shadow-normal-small: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@layer base {
  html, body {
    @apply font-sans bg-background-normal-alternative text-label-normal transition-colors duration-300;
  }
}
```

- [x] **Step 3: 빌드 확인**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site build
```

Expected: 빌드 성공 (CSS 변수 관련 오류 없음). 실패 시 오류 메시지를 읽고 `@config` 경로를 수정한다.

- [x] **Step 4: 커밋**

```bash
git add apps/site/app/globals.css apps/site/tailwind.config.mjs
git commit -m "feat(site): semantic token 체계 교체 및 tailwind config 추가"
```

---

## Task 2: 원자 컴포넌트 이식 — Icon, Badge, Button

**Files:**
- Create: `apps/site/components/Icon.tsx`
- Create: `apps/site/components/Badge.tsx`
- Create: `apps/site/components/Button.tsx`

- [x] **Step 1: Icon.tsx 생성**

`apps/site/components/Icon.tsx`:

```tsx
// 공개 사이트 아이콘 컴포넌트 — coolicons 스타일 SVG
import React from 'react'

export type IconName =
  | 'search' | 'check' | 'close' | 'chevron-down'
  | 'github' | 'youtube' | 'book' | 'star' | 'file-text'
  | 'sun' | 'moon'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName
  size?: 16 | 20 | 24 | 32
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '', ...props }) => {
  const getPath = () => {
    switch (name) {
      case 'search':
        return <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
      case 'check':
        return <polyline points="20 6 9 17 4 12" />
      case 'close':
        return <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
      case 'chevron-down':
        return <polyline points="6 9 12 15 18 9" />
      case 'github':
        return <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      case 'youtube':
        return <><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></>
      case 'book':
        return <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>
      case 'star':
        return <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      case 'file-text':
        return <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>
      case 'sun':
        return <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>
      case 'moon':
        return <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      default:
        return null
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={name}
      {...props}
    >
      {getPath()}
    </svg>
  )
}
```

- [x] **Step 2: Badge.tsx 생성**

`apps/site/components/Badge.tsx`:

```tsx
// 공개 사이트 뱃지 컴포넌트 — 태그 표시용
import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outlined' | 'subtle'
  color?: 'primary' | 'positive' | 'cautionary' | 'negative' | 'neutral'
  size?: 'small' | 'medium'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'subtle', color = 'neutral', size = 'medium', className = '', children, ...props }, ref) => {
    const sizeClasses = size === 'small' ? 'px-1 h-5 text-caption1' : 'px-1.5 h-6 text-label2'

    let colorClasses = ''
    if (variant === 'subtle') {
      if (color === 'neutral') colorClasses = 'bg-fill-normal text-label-normal'
      else if (color === 'primary') colorClasses = 'bg-[rgba(0,102,255,0.1)] text-primary-normal'
      else if (color === 'positive') colorClasses = 'bg-[rgba(18,213,137,0.1)] text-status-positive'
      else if (color === 'cautionary') colorClasses = 'bg-[rgba(255,122,0,0.1)] text-status-cautionary'
      else if (color === 'negative') colorClasses = 'bg-[rgba(255,66,66,0.1)] text-status-negative'
    } else if (variant === 'solid') {
      if (color === 'neutral') colorClasses = 'bg-label-normal text-background-normal-normal'
      else if (color === 'primary') colorClasses = 'bg-primary-normal text-white'
    } else if (variant === 'outlined') {
      colorClasses = 'bg-transparent border'
      if (color === 'neutral') colorClasses += ' border-line-normal-normal text-label-normal'
      else if (color === 'primary') colorClasses += ' border-primary-normal text-primary-normal'
    }

    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
          sizeClasses,
          colorClasses,
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </span>
    )
  },
)
Badge.displayName = 'Badge'
```

- [x] **Step 3: Button.tsx 생성**

`apps/site/components/Button.tsx`:

```tsx
// 공개 사이트 버튼 컴포넌트 — TopNavigation 아이콘 버튼 전용
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outlined'
  color?: 'primary' | 'assistive'
  size?: 'small' | 'medium' | 'large'
  leadingContent?: React.ReactNode
  iconOnly?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      color = 'primary',
      size = 'medium',
      leadingContent,
      iconOnly,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    let sizeClasses = ''
    if (size === 'small') sizeClasses = iconOnly ? 'w-8 h-8' : 'px-3 h-8 text-label2'
    else if (size === 'medium') sizeClasses = iconOnly ? 'w-11 h-11' : 'px-4 h-10 text-label1'
    else if (size === 'large') sizeClasses = iconOnly ? 'w-12 h-12' : 'px-5 h-12 text-body1'

    let colorClasses = ''
    if (variant === 'outlined') {
      if (color === 'assistive')
        colorClasses = 'bg-transparent text-label-normal border-line-normal-normal hover:bg-fill-normal disabled:text-label-disable'
      else if (color === 'primary')
        colorClasses = 'bg-transparent text-primary-normal border-primary-normal hover:bg-[rgba(0,102,255,0.04)] disabled:text-label-disable'
    } else {
      if (color === 'assistive')
        colorClasses = 'bg-fill-normal text-label-normal hover:bg-fill-strong disabled:bg-interaction-disable disabled:text-label-disable border-transparent'
      else if (color === 'primary')
        colorClasses = 'bg-primary-normal text-white hover:bg-primary-strong disabled:bg-interaction-disable border-transparent'
    }

    return (
      <button
        ref={ref}
        className={[
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 border cursor-pointer',
          disabled ? 'cursor-not-allowed opacity-80' : '',
          sizeClasses,
          colorClasses,
          className,
        ].filter(Boolean).join(' ')}
        disabled={disabled}
        {...props}
      >
        {leadingContent && <span className="inline-flex">{leadingContent}</span>}
        {!iconOnly && <span>{children}</span>}
        {iconOnly && children}
      </button>
    )
  },
)
Button.displayName = 'Button'
```

- [x] **Step 4: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site typecheck
```

Expected: 오류 없음.

- [x] **Step 5: 커밋**

```bash
git add apps/site/components/Icon.tsx apps/site/components/Badge.tsx apps/site/components/Button.tsx
git commit -m "feat(site): Icon, Badge, Button 컴포넌트 이식"
```

---

## Task 3: TopNavigation 컴포넌트

**Files:**
- Create: `apps/site/components/TopNavigation.tsx`

TopNavigation은 `'use client'`가 필요하다 (`useTheme` hook 사용). `PagefindSearch`는 props로 전달받는다.

- [x] **Step 1: TopNavigation.tsx 생성**

`apps/site/components/TopNavigation.tsx`:

```tsx
// 공개 사이트 상단 고정 네비게이션 — 다크모드 토글 + 검색 슬롯
'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import { Button } from './Button'
import { Icon } from './Icon'

interface TopNavigationProps {
  searchSlot?: React.ReactNode
}

export function TopNavigation({ searchSlot }: TopNavigationProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <header className="sticky top-0 z-[100] h-14 border-b border-line-normal-normal bg-background-normal-alternative flex items-center">
      <div className="w-full max-w-[1120px] mx-auto px-6 flex items-center justify-between">
        <a
          href="/"
          className="font-bold text-title3 text-label-strong tracking-tight no-underline"
        >
          zettlink
        </a>
        <div className="flex items-center gap-2">
          {searchSlot}
          <Button
            variant="outlined"
            color="assistive"
            size="small"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            leadingContent={<Icon name={isDark ? 'sun' : 'moon'} size={16} />}
          >
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </div>
      </div>
    </header>
  )
}
```

- [x] **Step 2: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site typecheck
```

Expected: 오류 없음.

- [x] **Step 3: 커밋**

```bash
git add apps/site/components/TopNavigation.tsx
git commit -m "feat(site): TopNavigation 컴포넌트 추가 (다크모드 토글)"
```

---

## Task 4: layout.tsx 업데이트

**Files:**
- Modify: `apps/site/app/layout.tsx`

- [x] **Step 1: layout.tsx 수정**

`apps/site/app/layout.tsx` 전체를 아래로 교체한다. 인라인 `<header>`를 `<TopNavigation>`으로 교체하고 `PagefindSearch`를 `searchSlot`으로 전달한다.

```tsx
// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard 폰트, TopNavigation
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { TopNavigation } from '../components/TopNavigation'
import { PagefindSearch } from '../components/PagefindSearch'
import './globals.css'

export const metadata: Metadata = {
  title: 'zettlink',
  description: 'YouTube·GitHub 지식 카드 아카이브',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TopNavigation searchSlot={<PagefindSearch />} />
          <main className="max-w-[1120px] mx-auto px-6 py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [x] **Step 2: 타입체크 + 빌드**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site typecheck
pnpm --filter site build
```

Expected: 둘 다 성공.

- [x] **Step 3: 커밋**

```bash
git add apps/site/app/layout.tsx
git commit -m "feat(site): layout.tsx — 인라인 헤더를 TopNavigation으로 교체"
```

---

## Task 5: Card 컴포넌트 이식

**Files:**
- Create: `apps/site/components/Card.tsx`

- [x] **Step 1: Card.tsx 생성**

`apps/site/components/Card.tsx`:

```tsx
// 공개 사이트 카드 컴포넌트 — 플랫폼 아이콘, 제목, 요약, 태그 표시
import React from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import type { IconName } from './Icon'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  platform?: string
  title?: string
  summary?: string
  tags?: string[]
  date?: string
}

function platformIcon(platform: string): IconName {
  if (platform === 'youtube') return 'youtube'
  if (platform === 'github') return 'github'
  return 'file-text'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, platform, title, summary, tags, date, className = '', children, ...props }, ref) => {
    const base =
      'bg-background-elevated-normal text-label-normal border border-line-normal-normal p-6 rounded-[20px] shadow-normal-small transition-all duration-200 flex flex-col'
    const hover = hoverable ? 'hover:shadow-normal-medium hover:-translate-y-1 cursor-pointer' : ''

    return (
      <div ref={ref} className={[base, hover, className].filter(Boolean).join(' ')} {...props}>
        {title != null ? (
          <>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,102,255,0.08)] text-primary-normal flex items-center justify-center">
                <Icon name={platformIcon(platform ?? '')} size={20} />
              </div>
              {date != null && (
                <span className="text-caption1 text-label-assistive">{date}</span>
              )}
            </div>
            <h3 className="text-heading2 font-bold text-label-strong mb-2 line-clamp-2">{title}</h3>
            {summary != null && (
              <p className="text-body1 text-label-neutral mb-6 line-clamp-3 flex-grow">{summary}</p>
            )}
            {tags != null && tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-auto">
                {tags.map((tag) => (
                  <Badge key={tag} variant="subtle" color="neutral">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          children
        )}
      </div>
    )
  },
)
Card.displayName = 'Card'
```

- [x] **Step 2: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site typecheck
```

Expected: 오류 없음.

- [x] **Step 3: 커밋**

```bash
git add apps/site/components/Card.tsx
git commit -m "feat(site): Card 컴포넌트 이식 (플랫폼 아이콘, 태그 Badge)"
```

---

## Task 6: CardList.tsx 재작성 — 그리드 + 새 필터 칩

**Files:**
- Modify: `apps/site/components/CardList.tsx`

필터 칩 스타일: Rect(6px radius) + `#` prefix + 카운트 흐린 텍스트. `TagItem.usage_count`를 카운트로 사용한다 (별도 필드 추가 불필요).

- [x] **Step 1: CardList.tsx 전체 교체**

`apps/site/components/CardList.tsx`:

```tsx
// 홈 페이지 카드 그리드 — ?tag= URL param 필터링, B1 태그 칩 + usage_count 표시
'use client'

import { useState, useEffect } from 'react'
import type { CardListItem, TagItem } from '../lib/cards'
import { Card } from './Card'

type Props = {
  cards: CardListItem[]
  tags: TagItem[]
}

export function CardList({ cards, tags }: Props) {
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)

  useEffect(() => {
    function readTag() {
      const params = new URLSearchParams(window.location.search)
      setActiveTag(params.get('tag') ?? undefined)
    }
    readTag()
    window.addEventListener('popstate', readTag)
    return () => window.removeEventListener('popstate', readTag)
  }, [])

  function handleTagClick(name: string, e: React.MouseEvent) {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (params.get('tag') === name) {
      params.delete('tag')
    } else {
      params.set('tag', name)
    }
    const next = params.toString() ? `/?${params.toString()}` : '/'
    window.history.pushState({}, '', next)
    setActiveTag(params.get('tag') ?? undefined)
  }

  function handleAllClick(e: React.MouseEvent) {
    e.preventDefault()
    window.history.pushState({}, '', '/')
    setActiveTag(undefined)
  }

  const filtered = activeTag != null
    ? cards.filter((c) => c.tags.includes(activeTag))
    : cards

  const totalCount = cards.length

  // 필터 칩 공통 스타일
  const chipBase =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-label2 font-medium transition-colors duration-150 cursor-pointer no-underline'
  const chipInactive = 'bg-fill-normal text-label-alternative hover:bg-fill-strong'
  const chipActive = 'bg-[rgba(0,102,255,0.1)] text-primary-normal'

  return (
    <div>
      {/* 태그 필터 칩 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-7">
          <a
            href="/"
            onClick={handleAllClick}
            className={[chipBase, activeTag == null ? chipActive : chipInactive].join(' ')}
          >
            전체
            <span className="text-label-assistive text-caption1">
              {totalCount}
            </span>
          </a>
          {tags.map((t) => {
            const isActive = activeTag === t.canonical_name
            return (
              <a
                key={t.canonical_name}
                href={`/?tag=${encodeURIComponent(t.canonical_name)}`}
                onClick={(e) => handleTagClick(t.canonical_name, e)}
                className={[chipBase, isActive ? chipActive : chipInactive].join(' ')}
              >
                <span className={isActive ? 'text-primary-normal/40' : 'text-label-assistive'}>
                  #
                </span>
                {t.canonical_name}
                <span className="text-label-assistive text-caption1">
                  {t.usage_count}
                </span>
              </a>
            )
          })}
        </div>
      )}

      {/* 카드 그리드 */}
      <div data-pagefind-body>
        {filtered.length === 0 ? (
          <p className="text-label-assistive text-center py-16">
            게시된 노트가 없습니다.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((card) => (
              <li key={card.id}>
                <a href={`/${card.platform}/${card.id}`} className="block no-underline h-full">
                  <Card
                    hoverable
                    platform={card.platform}
                    title={card.title ?? card.id}
                    summary={card.summary ?? undefined}
                    tags={card.tags}
                    date={new Date(card.created_at).toLocaleDateString('ko-KR')}
                    className="h-full"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 2: 타입체크**

```bash
cd /Users/zorba/AI/dev/zettlink
pnpm --filter site typecheck
```

Expected: 오류 없음.

- [x] **Step 3: 빌드**

```bash
pnpm --filter site build
```

Expected: 빌드 성공.

- [x] **Step 4: 로컬 dev 서버 실행 후 시각 확인**

```bash
pnpm --filter site dev
```

브라우저에서 `http://localhost:3002` 열어 확인할 것.

- [x] 네비게이션: zettlink 로고 + 검색 버튼 + Dark/Light 토글 버튼
- [x] 다크모드 토글 버튼 클릭 시 테마 전환 동작
- [x] 필터 칩: `전체 N`, `#태그 N` 형태로 카운트 표시
- [x] 필터 칩 클릭 시 active 상태(파란 tint) 전환
- [x] 카드 그리드: 플랫폼 아이콘, 제목, 요약, 태그 Badge 표시
- [x] 카드 hover 시 살짝 올라오는 효과

- [x] **Step 5: 커밋**

```bash
git add apps/site/components/CardList.tsx
git commit -m "feat(site): CardList 그리드 레이아웃 및 B1 필터 칩 재작성"
```

---

## 완료 기준

- `pnpm --filter site typecheck` 통과
- `pnpm --filter site build` 성공
- localhost:3002에서 시각적으로 확인: 그리드 카드, 필터 칩 카운트, 다크모드 토글 동작
