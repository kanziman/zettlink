---
name: Zettlink
colors:
  primary: '#0066FF'
  primary-strong: '#005EEB'
  primary-heavy: '#0054D1'
  background: '#FFFFFF'
  background-alternative: '#F7F7F8'
  background-elevated: '#FFFFFF'
  label-normal: '#171719'
  label-strong: '#000000'
  label-neutral: 'rgba(23, 23, 25, 0.88)'
  label-alternative: 'rgba(55, 56, 60, 0.61)'
  label-assistive: 'rgba(55, 56, 60, 0.28)'
  label-disable: 'rgba(55, 56, 60, 0.16)'
  line-normal: 'rgba(112, 115, 124, 0.22)'
  line-solid: '#E1E2E4'
  status-positive: '#00C853'
  status-cautionary: '#FF9100'
  status-negative: '#FF3B30'
  inverse-primary: '#3385FF'
  inverse-background: '#1B1C1E'
  inverse-label: '#F7F7F8'
typography:
  display-lg:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
  headline-lg:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: 'Wanted Sans, Pretendard, sans-serif'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.375rem
  md: 0.5rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  0: 0px
  0.5: 0.5px
  1: 1px
  2: 2px
  4: 4px
  6: 6px
  8: 8px
  10: 10px
  12: 12px
  14: 14px
  16: 16px
  20: 20px
  24: 24px
  32: 32px
  40: 40px
  48: 48px
  56: 56px
  64: 64px
  72: 72px
  80: 80px
---

## Brand & Style

The visual identity of this design system is based on **Wanted Montage**, the official design system by Wanted Lab. The brand personality is professional, empowering, and highly readable, aiming to support "all possibilities for working people." 

The style prioritizes clarity, a clean structural grid, and an elegant corporate modern feel. It uses a semantic color system with clear distinctions for interactions, lines, and states.

## Colors

The color palette is built on Montage's semantic tokens:
- **Primary:** The vibrant Montage Blue (`#0066FF`), representing growth, trust, and dynamic possibilities.
- **Backgrounds:** Pure white (`#FFFFFF`) for elevated surfaces and a cool neutral alternative (`#F7F7F8`) to provide subtle framing without heavy lines.
- **Labels (Text):** Text colors range from solid black (`#000000`) for strong emphasis, to cool neutral 10 (`#171719`) for normal reading, down to semi-transparent cool neutrals for assistive and disabled states.
- **Lines & Borders:** A robust line system using both solid (`#E1E2E4`) and transparent (`rgba(112, 115, 124, 0.22)`) options for dividing content gently.

## Typography

Typography relies on **Wanted Sans** (or Pretendard as a fallback). Wanted Sans is a typeface designed specifically for modern digital interfaces, offering excellent legibility and a contemporary corporate look.

- Headlines use strong weights to establish hierarchy.
- Body text is optimized for readability across long sessions.
- Labels are clear and precise.

## Layout & Spacing

Montage uses a defined 4px/8px-based spacing scale, but it introduces granular control with small increments (2px, 4px, 6px, 8px, 10px, 12px, 14px, 16px...) to perfect alignment. Layouts should utilize this spacing scale to maintain consistent rhythm and density.

## Elevation & Depth

Depth is primarily managed through:
- **Drop Shadows:** Soft, multi-layered shadows to provide realistic, subtle elevation (e.g., `0px 1px 2px -1px rgba(23, 23, 25, 0.1)`).
- **Tonal Layers:** Using `background-alternative` (`#F7F7F8`) behind elevated pure white surfaces to create depth without shadows.

## Shapes

Shapes are generally clean with subtle rounding. Radii should be consistent, often using values like 6px, 8px, or 12px for standard components, avoiding overly pill-shaped forms unless for specific interactive elements like tags.

## Icons

Icons use Coolicons as the default visual reference. Use 24x24 outline icons with consistent stroke weight, rounded caps/joins,
and simple geometric shapes. When embedding actual Coolicons assets, preserve license attribution required by CC BY 4.0.

## Components

### Buttons
Buttons should feature the primary blue (`#0066FF`) for primary actions, with appropriate hover (`#005EEB`) and active (`#0054D1`) states.

### Input Fields
Inputs use subtle borders that shift to the primary color on focus. They should be clear, spacious, and easily scannable.

### Lists & Data Tables
Focus on clean row separation using `line-normal` or `line-solid`. Use whitespace efficiently to prevent data from feeling cramped.
