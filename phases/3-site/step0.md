# Step 0: db-migration

## 읽어야 할 파일

- `supabase/migrations/0001_init.sql` — cards 테이블 현재 컬럼 확인
- `apps/dashboard/app/api/enrich/route.ts` — 현재 DB 업데이트 로직 확인 (baseUpdate, enrichUpdate 분기)
- `packages/db/src/types.gen.ts` — 현재 cards Row 타입 확인 (migration 후 비교용)
- `docs/ARCHITECTURE.md` — §3.2 심화 흐름, vault atomic write 설명

## 작업

사이트가 Supabase에서 심화 콘텐츠를 읽을 수 있도록 cards 테이블에 content 컬럼을 추가하고, enrich API가 vault write와 함께 DB에도 저장하도록 업데이트한다.

### 생성할 파일

**`supabase/migrations/0002_content_columns.sql`**

```sql
-- cards 테이블에 심화 콘텐츠 컬럼 추가 — 사이트 빌드 타임 조회용
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS deep_content  text,
  ADD COLUMN IF NOT EXISTS til_content   text,
  ADD COLUMN IF NOT EXISTS guide_content text;
```

### 수정할 파일

**`apps/dashboard/app/api/enrich/route.ts`**

현재 enrichUpdate 분기에서 `has_deep/has_til/has_guide = true`만 업데이트한다.
여기에 `{type}_content = resultText`를 함께 저장하도록 각 분기를 수정한다.

```typescript
// 기존 분기 (변경 전)
const enrichUpdate =
  enrichType === 'deep'
    ? { ...baseUpdate, has_deep: true }
    : enrichType === 'til'
      ? { ...baseUpdate, has_til: true }
      : { ...baseUpdate, has_guide: true }

// 수정 후 — content 컬럼에도 저장
const enrichUpdate =
  enrichType === 'deep'
    ? { ...baseUpdate, has_deep: true, deep_content: resultText }
    : enrichType === 'til'
      ? { ...baseUpdate, has_til: true, til_content: resultText }
      : { ...baseUpdate, has_guide: true, guide_content: resultText }
```

## Acceptance Criteria

```bash
# 마이그레이션 파일 존재 확인
ls supabase/migrations/0002_content_columns.sql

# 로컬 Supabase에 적용
supabase db push
# → 성공 (에러 없음)

# 타입 재생성
pnpm gen-types
# → packages/db/src/types.gen.ts 갱신

# 갱신된 타입 확인 — deep_content 포함 여부
grep 'deep_content' packages/db/src/types.gen.ts
# → deep_content: string | null

# enrich API 변경 확인
grep 'deep_content' apps/dashboard/app/api/enrich/route.ts
# → deep_content: resultText 포함

# 타입 체크
pnpm --filter @zettlink/dashboard typecheck
# → 에러 없음
```

## 금지사항

- 기존 `0001_init.sql` 파일을 수정하지 마라. 새 migration 파일만 추가한다.
- `has_deep/has_til/has_guide` 플래그 업데이트를 제거하지 마라. 사이트에서 content null 체크 대신 플래그를 사용하는 코드가 있을 수 있다.
- content 컬럼을 NOT NULL로 선언하지 마라. 기존 카드는 content가 없으므로 반드시 nullable이어야 한다.
