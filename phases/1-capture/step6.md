# Step 6: vault-write

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(vault write는 atomic temp+rename으로만)
- `docs/ADR.md` — ADR-013(vault = 옵션 backup·이식 채널)
- `docs/ARCHITECTURE.md` — §1(디렉토리 구조 — vault/{youtube,github}/<slug>/)
- `packages/shared/src/slug.ts` — titleToSlug, repoToSlug
- `packages/shared/src/types.ts` — Card 인터페이스
- `apps/worker/src/llm/summarize.ts` — SummaryResult
- `phases/1-capture/index.json` — step 0~5 summary

## 작업

`apps/worker/src/vault/write.ts`를 구현하라. Supabase card 데이터를 vault/.md로 atomic export.

### 생성할 파일

**`apps/worker/src/vault/write.ts`**

인터페이스:

```typescript
export interface VaultWriteInput {
  card: Card
  summary: SummaryResult
  transcript?: string       // YouTube: VTT 파싱 텍스트
  extract?: string          // GitHub: README markdown
}

// vault/{platform}/{slug}/index.md 를 atomic하게 기록
// 반환값: 작성된 파일 경로
export async function writeVault(input: VaultWriteInput): Promise<string>
```

구현 상세 — **반드시 이 순서 (atomic 패턴)**:

```typescript
import { writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function writeVault(input: VaultWriteInput): Promise<string> {
  const { card, summary, transcript, extract } = input

  // 1. 디렉토리 경로 결정
  const vaultRoot = join(process.cwd(), 'vault')
  const dir = join(vaultRoot, card.platform, card.id)
  await mkdir(dir, { recursive: true })

  // 2. index.md 내용 생성
  const content = buildIndexMd(card, summary)
  const finalPath = join(dir, 'index.md')
  const tempPath = finalPath + '.tmp'

  // 3. temp 파일에 먼저 쓰기
  await writeFile(tempPath, content, 'utf-8')

  // 4. atomic rename (temp → final)
  await rename(tempPath, finalPath)

  // 5. 선택: transcript 또는 extract 파일
  if (transcript) {
    const tPath = join(dir, 'transcript.md')
    const tTemp = tPath + '.tmp'
    await writeFile(tTemp, `# Transcript\n\n${transcript}`, 'utf-8')
    await rename(tTemp, tPath)
  }
  if (extract) {
    const ePath = join(dir, 'extract.md')
    const eTemp = ePath + '.tmp'
    await writeFile(eTemp, `# README\n\n${extract}`, 'utf-8')
    await rename(eTemp, ePath)
  }

  return finalPath
}
```

**frontmatter 생성 함수**:

```typescript
function buildIndexMd(card: Card, summary: SummaryResult): string {
  const frontmatter = [
    '---',
    `id: ${card.id}`,
    `platform: ${card.platform}`,
    `url: ${card.url}`,
    `title: "${summary.title.replace(/"/g, '\\"')}"`,
    `status: ${card.status}`,
    `published: ${card.published}`,
    `created_at: ${card.createdAt}`,
    '---',
  ].join('\n')

  const body = [
    `# ${summary.title}`,
    '',
    `> ${card.url}`,
    '',
    '## 요약',
    '',
    summary.summary,
    '',
    '## 인사이트',
    '',
    ...summary.insights.map(i => `- ${i}`),
  ].join('\n')

  return frontmatter + '\n\n' + body + '\n'
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# atomic 패턴 (temp+rename) 확인
grep -r "\.tmp\|rename" apps/worker/src/vault/write.ts && echo "atomic write OK"

# rename을 writeFile 이후에 하는지 확인 (writeFile → rename 순서)
grep -n "writeFile\|rename" apps/worker/src/vault/write.ts
# writeFile 라인이 rename 라인보다 먼저 나와야 함
```

## 금지사항

- `writeFile`로 finalPath에 직접 쓰지 마라. 반드시 temp → rename 순서.
- temp 파일을 finally 블록에서 cleanup하지 마라. rename 성공 후에는 temp가 이미 없음. 실패 시에는 남겨두는 게 디버깅에 유리.
- vault 경로를 하드코딩하지 마라. `process.cwd()` 기준 상대 경로 사용.
