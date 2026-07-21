# Site Publish 404 Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Published site card URLs must render instead of hiding Supabase schema/query failures behind 404.

**Architecture:** The site keeps using anon-key Supabase build-time queries, but query errors become explicit failures. The live DB schema must match checked-in migrations before static export is trusted.

**Tech Stack:** Next.js 15 static export, Supabase JS, Vitest, Pagefind.

---

### Task 1: Capture The Regression

**Files:**
- Create: `apps/site/lib/__tests__/cards.test.ts`
- Modify: `apps/site/package.json`

- [x] Add a Vitest test showing `getCardBySlug()` throws when Supabase returns a query error.
- [x] Add a Vitest test showing `getCardBySlug()` returns `null` only for a real "no rows" response.
- [x] Add `test` script and `vitest` dev dependency to the site package.
- [x] Run the new test and confirm it fails against the current implementation.

### Task 2: Fix Error Handling

**Files:**
- Modify: `apps/site/lib/cards.ts`

- [x] Update site Supabase helpers to check `error` for card detail and slug generation queries.
- [x] Throw errors for unexpected Supabase query failures.
- [x] Preserve `null` for real missing card results.
- [x] Run the new tests and confirm they pass.

### Task 3: Repair Live Schema And Static Export

**Files:**
- Existing migration: `supabase/migrations/0002_content_columns.sql`

- [x] Apply the missing `deep_content`, `til_content`, and `guide_content` columns to the configured Supabase DB using idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- [x] Verify anon query for `youtube/anthropic-5-karpathy-ai` succeeds with the full detail select.
- [x] Run `pnpm --filter @zettlink/site build`.
- [x] Confirm `apps/site/out/youtube/anthropic-5-karpathy-ai/index.html` exists.

### Task 4: Document The Guardrail

**Files:**
- Modify: `docs/AGENT_WORKFLOW.md`

- [x] Add a short publish/site verification guardrail: after publishing and rebuilding, verify a real published detail URL returns 200.

### Acceptance Criteria

- `pnpm --filter @zettlink/site test` passes.
- `pnpm --filter @zettlink/site typecheck` passes.
- `pnpm --filter @zettlink/site build` passes.
- `curl http://localhost:3002/youtube/anthropic-5-karpathy-ai/` returns 200 after dev server refresh/restart.
- Supabase schema drift fails loudly in tests/build instead of rendering a misleading 404.
