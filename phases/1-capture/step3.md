# Step 3: extractor-gh

## 읽어야 할 파일

- `docs/ARCHITECTURE.md` — §3.1(7번: GH API extract)
- `packages/shared/src/url-normalize.ts` — CanonicalUrl github externalId 형식('owner/repo')
- `packages/shared/src/config.ts` — config.github.token (optional)
- `apps/worker/src/extractors/youtube.ts` — 동일 패턴 참고
- `phases/1-capture/index.json` — step 0~2 summary

## 작업

`apps/worker/src/extractors/github.ts`를 구현하라. GitHub REST API wrapper.

### 생성할 파일

**`apps/worker/src/extractors/github.ts`**

인터페이스:

```typescript
export interface GithubExtract {
  owner: string
  repo: string
  fullName: string          // 'owner/repo'
  description: string | null
  stars: number
  forks: number
  language: string | null
  topics: string[]
  readme: string            // README.md 본문 (markdown)
  rawMetadata: Record<string, unknown>
}

export async function extractGithub(externalId: string): Promise<GithubExtract>
// externalId = 'owner/repo' (소문자, canonicalize 결과)
```

구현 상세:

1. GitHub REST API 호출 (fetch, Node 22 built-in):
```typescript
const headers: Record<string, string> = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'zettlink/1.0',
}
if (config.github.token) {
  headers['Authorization'] = `Bearer ${config.github.token}`
}

// repo 정보
const repoRes = await fetch(`https://api.github.com/repos/${externalId}`, { headers })
if (!repoRes.ok) {
  if (repoRes.status === 404) throw new Error('repository not found or private')
  throw new Error(`GitHub API error: ${repoRes.status}`)
}
const repoData = await repoRes.json()

// README (없으면 빈 문자열)
const readmeRes = await fetch(`https://api.github.com/repos/${externalId}/readme`, { headers })
let readme = ''
if (readmeRes.ok) {
  const readmeData = await readmeRes.json()
  readme = Buffer.from(readmeData.content, 'base64').toString('utf-8')
}
```

2. topics 조회:
```typescript
const topicsRes = await fetch(`https://api.github.com/repos/${externalId}/topics`, {
  headers: { ...headers, 'Accept': 'application/vnd.github.mercy-preview+json' }
})
const topics = topicsRes.ok ? (await topicsRes.json()).names ?? [] : []
```

3. README 길이 제한 (32,000자):
```typescript
if (readme.length > 32_000) readme = readme.slice(0, 32_000) + '\n[truncated]'
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# GitHub API 사용 확인
grep -r "api.github.com" apps/worker/src/extractors/github.ts && echo "GitHub API OK"

# 404 처리 확인
grep -r "not found or private" apps/worker/src/extractors/github.ts && echo "404 handler OK"

# token optional 사용 확인
grep -r "github.token" apps/worker/src/extractors/github.ts && echo "token optional OK"
```

## 금지사항

- `@octokit/rest` 등 외부 GitHub SDK를 사용하지 마라. Node 22 built-in `fetch`로 구현.
- `config.github.token`이 없어도 동작해야 한다 (rate limit 낮아질 뿐).
- private repo는 처리하지 마라. 404 응답 시 즉시 throw.
