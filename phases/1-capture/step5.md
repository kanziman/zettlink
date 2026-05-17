# Step 5: tag-normalize

## 읽어야 할 파일

- `docs/ADR.md` — ADR-008(Tag = canonical_name + aliases)
- `supabase/migrations/0001_init.sql` — tags, card_tags 테이블 스키마
- `packages/db/src/index.ts` — createServiceClient
- `apps/worker/src/llm/summarize.ts` — SummaryResult.tags 타입
- `phases/1-capture/index.json` — step 0~4 summary

## 작업

`apps/worker/src/llm/tag-normalize.ts`를 구현하라. LLM 제안 태그를 canonical 태그로 정규화하고 card_tags에 연결.

### 생성할 파일

**`apps/worker/src/llm/tag-normalize.ts`**

인터페이스:

```typescript
export interface NormalizedTag {
  id: number
  canonicalName: string
}

// LLM이 제안한 태그 문자열 배열을 canonical tag ID 배열로 변환
// 새 canonical이 필요하면 INSERT, 기존이면 alias 추가
export async function normalizeTags(
  rawTags: string[],
  cardId: string,
): Promise<NormalizedTag[]>
```

구현 상세:

1. **입력 태그 정규화** (소문자, 앞뒤 공백 제거):
```typescript
const normalizedInputs = rawTags.map(t => t.toLowerCase().trim()).filter(Boolean)
```

2. **기존 tags 전체 조회** (tags 수가 적으므로 전체 로드):
```typescript
const { data: allTags } = await db.from('tags').select('id, canonical_name, aliases')
```

3. **매칭 로직**:
```typescript
function findMatch(input: string, tags: Tag[]): Tag | null {
  // 1) canonical_name 정확 일치
  const exactCanonical = tags.find(t => t.canonical_name === input)
  if (exactCanonical) return exactCanonical

  // 2) aliases 배열 내 일치
  const aliasMatch = tags.find(t =>
    Array.isArray(t.aliases) && t.aliases.includes(input)
  )
  if (aliasMatch) return aliasMatch

  return null
}
```

4. **매칭 실패 시 새 canonical 생성**:
```typescript
const { data: newTag } = await db
  .from('tags')
  .insert({ canonical_name: input, aliases: [] })
  .select()
  .single()
```

5. **기존 canonical에 alias 추가** (input이 canonical과 다른 표기인 경우):
```typescript
// 이미 canonical이 동일하면 alias 추가 불필요
// input이 다른 표기이고 아직 alias에 없으면 append
if (matched.canonical_name !== input && !matched.aliases.includes(input)) {
  await db.from('tags')
    .update({ aliases: [...matched.aliases, input] })
    .eq('id', matched.id)
}
```

6. **usage_count 증가**:
```typescript
await db.from('tags')
  .update({ usage_count: matched.usage_count + 1 })
  .eq('id', matched.id)
```

7. **card_tags INSERT**:
```typescript
await db.from('card_tags').upsert(
  resolvedTags.map(t => ({ card_id: cardId, tag_id: t.id })),
  { onConflict: 'card_id,tag_id', ignoreDuplicates: true }
)
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# canonical 매칭 로직 확인
grep -r "canonical_name\|aliases" apps/worker/src/llm/tag-normalize.ts && echo "tag matching OK"

# card_tags upsert 확인
grep -r "card_tags" apps/worker/src/llm/tag-normalize.ts && echo "card_tags OK"
```

## 금지사항

- 태그 매칭에 외부 라이브러리(fuzzy match 등)를 쓰지 마라. 정확 매칭(exact match)만.
- `tags` 테이블을 태그마다 개별 SELECT하지 마라. 한 번에 전체 조회 후 메모리에서 매칭.
- card_tags를 INSERT IGNORE 없이 중복 삽입하지 마라. upsert + ignoreDuplicates 사용.
