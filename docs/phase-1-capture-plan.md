# Phase 1-capture 구현 플랜

> Gate 1 플랜. Reviewer(/codex:review) 승인 후 구현 시작.

---

## 1. 구현 순서와 이유

```
Step 0: bot-core
  ↓ (jobs 테이블 INSERT 담당. worker가 poll할 데이터 공급원)
Step 1: worker-loop
  ↓ (poll loop + dispatch skeleton. 이후 steps가 여기에 연결됨)
Step 2: extractor-yt
  ↓ (YouTube 자막 추출. Step 4 LLM 입력 준비)
Step 3: extractor-gh
  ↓ (GitHub README 추출. Step 4 LLM 입력 준비. yt와 독립)
Step 4: llm-summarize
  ↓ (extractors 결과 → LLM → SummaryResult. config 스키마도 여기서 확장)
Step 5: tag-normalize
  ↓ (SummaryResult.tags → canonical tags → card_tags. Step 4 의존)
Step 6: vault-write
  ↓ (card + summary → vault/.md atomic export. DB 의존 없음, 독립)
Step 7: vault-git
  ↓ (vault write 후 git commit+push. Step 6 의존)
Step 8: retry
  ↓ (backoffMs TDD. markFailed에서 참조. Step 1 의존)
Step 9: observability
  (worker dispatch 완성 — 전 단계 연결 + events INSERT + bot notify)
```

**순서 이유:**

- Step 0이 선행이어야 jobs 테이블에 데이터가 들어오고 worker가 처리할 대상이 생긴다.
- Step 1은 dispatch skeleton만 구현하므로 Step 2~8 없이도 컴파일된다. 이후 각 step이 완성되면 Step 9에서 dispatch를 연결한다.
- Step 2와 Step 3은 플랫폼이 달라 서로 독립적이다. Step 4보다 먼저 구현해야 LLM 입력 타입이 정해진다.
- Step 4에서 `packages/shared/src/config.ts`를 수정한다 (`openrouter`, `llm` 섹션 추가). Step 2~3은 config 변경 없이 동작하므로 Step 4 이후에도 재컴파일로 충분하다.
- Step 5는 SummaryResult.tags를 입력으로 받아 card_tags에 쓰므로 Step 4 이후.
- Step 6, 7은 DB write가 없고 파일시스템·git 작업만이라 Step 4~5와 독립적으로 구현 가능하나, SummaryResult 타입이 Step 4에서 확정되므로 Step 4 이후 배치.
- Step 8(retry)은 TDD이므로 backoffMs 인터페이스가 확정된 시점에 구현. Step 1의 markFailed가 참조하므로 Step 1 이후.
- Step 9는 전 단계를 연결하는 통합 단계이므로 마지막.

---

## 2. 각 Step의 검증 방법 (AC)

### Step 0: bot-core

```bash
pnpm install
pnpm --filter @zettlink/bot build
# → 컴파일 에러 없음

# whitelist 검사 코드 확인
grep -r "whitelist" apps/bot/src/ && echo "whitelist check OK"

# createClient 직접 호출 없음 확인
grep -r "from '@supabase/supabase-js'" apps/bot/src/ && echo "FAIL" || echo "OK"

# 환경변수를 직접 읽지 않는지 확인
grep -r "process\.env\." apps/bot/src/ && echo "FAIL: direct env read" || echo "OK"

# 실행 확인 (token 있는 경우)
# TELEGRAM_BOT_TOKEN=<token>이 .env에 있으면:
# pnpm --filter @zettlink/bot dev
# → Telegram URL 전송 → "⏳ queued #N" 응답
# → Supabase jobs 테이블 row 생성 확인
```

### Step 1: worker-loop

```bash
pnpm install
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# pick_next_job RPC 사용 확인 (직접 UPDATE 금지)
grep -r "pick_next_job" apps/worker/src/ && echo "RPC OK"
grep -r "\.update.*status.*'processing'" apps/worker/src/ && echo "FAIL: direct processing update" || echo "OK"

# reaper picked_at 확인
grep -r "picked_at" apps/worker/src/ && echo "reaper OK"

# while(true) + await sleep 패턴 (setInterval 대신)
grep -r "while.*true" apps/worker/src/index.ts && echo "poll loop OK"
```

### Step 2: extractor-yt

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# yt-dlp 설치 확인
yt-dlp --version && echo "yt-dlp OK"

# execa 의존성
grep '"execa"' apps/worker/package.json && echo "execa OK"

# 자막 없음 에러 처리
grep -r "no transcript" apps/worker/src/extractors/youtube.ts && echo "no-transcript error OK"

# /tmp 외 경로 사용 금지 확인
grep -r "writeFile\|createWriteStream" apps/worker/src/extractors/youtube.ts | grep -v "/tmp" && echo "FAIL: non-tmp write" || echo "OK"
```

### Step 3: extractor-gh

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# Node fetch 사용 확인 (외부 SDK 금지)
grep -r "@octokit\|node-fetch" apps/worker/src/extractors/github.ts && echo "FAIL: external SDK" || echo "OK"
grep -r "api.github.com" apps/worker/src/extractors/github.ts && echo "GitHub API OK"

# 404 처리 확인
grep -r "not found or private\|status.*404" apps/worker/src/extractors/github.ts && echo "404 handler OK"

# token optional 확인
grep -r "github\.token" apps/worker/src/extractors/github.ts && echo "token optional OK"
```

### Step 4: llm-summarize

```bash
# config 스키마 업데이트 확인
grep -r "openrouter\|LLM_MODEL" packages/shared/src/config.ts && echo "config schema OK"
grep "OPENROUTER_API_KEY\|LLM_MODEL" .env.example && echo "env example OK"

# OpenRouter 사용 확인 (Anthropic SDK 직접 import 금지)
grep -r "from '@anthropic-ai/sdk'" apps/worker/src/llm/ && echo "FAIL: direct Anthropic SDK" || echo "OK"
grep -r "openrouter.ai\|baseURL" apps/worker/src/llm/summarize.ts && echo "OpenRouter OK"

# 비용 가드 LLM 호출 전 위치 확인
grep -r "checkBudget\|dailyUsd" apps/worker/src/llm/summarize.ts && echo "budget guard OK"

# tool_choice 강제 사용 확인
grep -r "tool_choice\|save_summary" apps/worker/src/llm/summarize.ts && echo "tool_use OK"

pnpm --filter @zettlink/shared build
pnpm --filter @zettlink/worker build
```

### Step 5: tag-normalize

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# canonical_name + aliases 매칭 확인
grep -r "canonical_name\|aliases" apps/worker/src/llm/tag-normalize.ts && echo "tag matching OK"

# 전체 조회 후 메모리 매칭 (개별 SELECT 금지)
grep -r "from('tags').*select" apps/worker/src/llm/tag-normalize.ts | wc -l
# → 1 (전체 1번만)

# card_tags upsert 확인
grep -r "card_tags" apps/worker/src/llm/tag-normalize.ts && echo "card_tags OK"
grep -r "ignoreDuplicates" apps/worker/src/llm/tag-normalize.ts && echo "upsert ignore OK"
```

### Step 6: vault-write

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# atomic 패턴 확인 (writeFile → rename 순서)
grep -n "writeFile\|rename" apps/worker/src/vault/write.ts
# writeFile 라인 번호 < rename 라인 번호여야 함

# .tmp 파일 사용 확인
grep -r "\.tmp" apps/worker/src/vault/write.ts && echo "temp file OK"

# finalPath 직접 쓰기 금지 확인
grep -r "writeFile.*finalPath\|writeFile.*index\.md" apps/worker/src/vault/write.ts && echo "FAIL: direct write" || echo "OK"
```

### Step 7: vault-git

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# pull --rebase 재시도 로직
grep -r "pull.*rebase\|--rebase" apps/worker/src/vault/git.ts && echo "rebase retry OK"

# push 실패 soft-fail 확인 (throw 없음)
grep -r "warn.*git\|git.*warn\|skipping" apps/worker/src/vault/git.ts && echo "soft-fail OK"

# --force push 금지 확인
grep -r "push.*--force\|--force.*push" apps/worker/src/vault/git.ts && echo "FAIL: force push" || echo "OK"
```

### Step 8: retry

```bash
# RED → GREEN 순서 검증
# 1. 테스트 먼저 작성 후:
pnpm --filter @zettlink/worker test
# → retry.test.ts FAIL (RED) 확인

# 2. 구현 후:
pnpm --filter @zettlink/worker test
# → 5개 테스트 PASS (GREEN)
# → coverage: retry.ts 100% (lines, branches, functions)

pnpm --filter @zettlink/worker build

# worker-loop에서 backoffMs 사용 확인
grep -r "backoffMs" apps/worker/src/index.ts && echo "backoffMs integrated OK"

# jitter 포함 확인
grep -r "Math.random\|jitter" apps/worker/src/retry.ts && echo "jitter OK"
```

### Step 9: observability

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# 6종 event type 전체 존재 확인
for TYPE in job.pick extract.youtube extract.github llm.call job.done job.fail; do
  grep -r "$TYPE" apps/worker/src/ && echo "$TYPE OK" || echo "❌ $TYPE MISSING"
done

# budget.alert event 확인
grep -r "budget.alert" apps/worker/src/ && echo "budget.alert OK"

# bot notify 확인
grep -r "botNotify\|sendMessage" apps/worker/src/ && echo "notify OK"

# notify 실패가 job done을 막지 않는지 확인 (try/catch 또는 .catch())
grep -A5 "botNotify" apps/worker/src/index.ts | grep -r "catch\|finally" && echo "notify soft-fail OK"

# 전체 최종 확인
pnpm install
pnpm --filter @zettlink/shared test
pnpm --filter @zettlink/worker test
pnpm --filter @zettlink/bot build
pnpm --filter @zettlink/worker build
```

---

## 3. 생성될 파일 목록

### Step 0: bot-core

```
apps/bot/src/index.ts         # Telegraf 데몬 — whitelist, URL 추출, jobs INSERT
apps/bot/tsconfig.json
apps/bot/package.json         # telegraf^4, pino^9, @zettlink/db, @zettlink/shared
```

`apps/bot/package.json` dependencies:
- `telegraf: ^4`
- `pino: ^9`
- `@zettlink/db: workspace:*`
- `@zettlink/shared: workspace:*`
- devDependencies: `tsx: ^4`, `pino-pretty: ^11`, `typescript: ^5`

### Step 1: worker-loop

```
apps/worker/src/index.ts      # poll loop + reaper + dispatch skeleton
apps/worker/tsconfig.json
apps/worker/package.json      # pino^9, @zettlink/db, @zettlink/shared
```

`apps/worker/package.json` dependencies:
- `pino: ^9`
- `@zettlink/db: workspace:*`
- `@zettlink/shared: workspace:*`
- devDependencies: `tsx: ^4`, `typescript: ^5`

### Step 2: extractor-yt

```
apps/worker/src/extractors/youtube.ts   # yt-dlp wrapper, VTT → plain text
apps/worker/src/extractors/index.ts     # re-export (github stub 포함)
```

`apps/worker/package.json`에 추가:
- `execa: ^9`

### Step 3: extractor-gh

```
apps/worker/src/extractors/github.ts   # GitHub REST API, fetch built-in
```

(apps/worker/src/extractors/index.ts 업데이트 — github re-export 완성)

### Step 4: llm-summarize

```
apps/worker/src/llm/summarize.ts        # checkBudget + OpenRouter 호출 + tool_use 파싱
apps/worker/src/llm/prompts.ts          # buildPrompt (YouTube/GitHub 분기)
```

수정 파일:
```
packages/shared/src/config.ts           # openrouter, llm 섹션 추가
.env.example                            # OPENROUTER_API_KEY, LLM_MODEL 추가
```

`apps/worker/package.json`에 추가:
- `openai: ^4`

### Step 5: tag-normalize

```
apps/worker/src/llm/tag-normalize.ts    # rawTags → canonical tags + card_tags upsert
```

### Step 6: vault-write

```
apps/worker/src/vault/write.ts          # atomic temp+rename, frontmatter 생성
```

### Step 7: vault-git

```
apps/worker/src/vault/git.ts            # git add/commit/push, pull --rebase 재시도
```

### Step 8: retry

```
apps/worker/src/__tests__/retry.test.ts  # TDD: RED 먼저 작성
apps/worker/src/retry.ts                 # backoffMs(attempt) — jitter ±10%
```

`apps/worker/package.json`에 추가 (devDependencies):
- `vitest: ^2`
- `@vitest/coverage-v8: ^2`

scripts 추가:
- `"test": "vitest run --coverage"`

### Step 9: observability

```
apps/worker/src/notify.ts               # botNotify — Telegram sendMessage
```

수정 파일:
```
apps/worker/src/index.ts                # dispatch 완성 (전 단계 연결 + events INSERT)
```

---

## 4. CLAUDE.md CRITICAL 규칙 충돌 여부 확인

| CRITICAL 규칙 | Phase 1 관련성 | 충돌 여부 |
|---|---|---|
| 모든 DB 접근은 `packages/db` 클라이언트를 통해서만 | bot/worker 모두 `createServiceClient()`만 사용. `@supabase/supabase-js` 직접 import 금지. AC에 grep 검사 포함. | 없음 |
| `service_role` 키를 `NEXT_PUBLIC_` prefix로 노출 금지 | Phase 1은 bot/worker (서버 사이드)만. Next.js 앱 없음. | 해당 없음 |
| 대시보드 모든 라우트는 middleware.ts admin whitelist 통과 | Phase 1 범위 외 (dashboard 코드 없음). | 해당 없음 |
| URL은 항상 `canonicalize()` 후 DB에 저장 | Step 9 dispatch에서 `canonicalize()` 결과의 `canonical` 필드를 `cards.url`에 저장. raw_url은 jobs에만. AC에서 확인. | 없음 |
| LLM 호출 전 `events`에서 오늘자 cost 합산해 `daily_usd` cap 체크 | Step 4 `checkBudget()`이 `summarize()` 진입 직후 (LLM 호출 전) 실행. AC에 순서 검증 포함. | 없음 |
| vault write는 atomic (temp+rename)으로만 | Step 6 `writeVault()` 구현이 temp → rename 패턴 강제. `writeFile(tempPath)` → `rename(tempPath, finalPath)` 순서. AC에서 라인 번호로 검증. | 없음 |
| 새 기능은 TDD | Step 8 `retry.ts`는 명시적 TDD (RED → GREEN). 나머지 steps (bot, worker, extractors, llm)는 외부 의존성(Telegram, yt-dlp, GH API, OpenRouter)이 있어 순수 단위 테스트 불가 — integration 성격. Step 9 최종 AC에서 `pnpm test` 전체 실행으로 커버. | 없음 |
| 마이그레이션은 새 파일로만 | Phase 1은 스키마 변경 없음. `0001_init.sql`은 Phase 0에서 완성. | 해당 없음 |
| React 컴포넌트 작성 시 `/react-best-practices` 먼저 호출 | Phase 1에 `.tsx` 파일 없음. | 해당 없음 |
| 커밋 메시지는 Conventional Commits | 각 step 완료 시 `feat:`, `test:`, `chore:` 등으로 커밋. | 없음 |

---

## 5. Step별 커밋 계획

```
feat(bot): Telegraf bot — whitelist, URL 추출, jobs INSERT
feat(worker): poll loop, reaper, dispatch skeleton
feat(worker): extractor-yt — yt-dlp wrapper, VTT plain text
feat(worker): extractor-gh — GitHub REST API, README 추출
feat(worker): llm-summarize — OpenRouter, tool_use, budget guard
feat(shared): config — openrouter and llm model sections
test(worker): retry.test.ts — backoffMs RED phase
feat(worker): retry — backoffMs with ±10% jitter GREEN phase
feat(worker): tag-normalize — canonical match, alias upsert, card_tags
feat(worker): vault-write — atomic temp+rename, frontmatter md
feat(worker): vault-git — commit+push, pull --rebase retry
feat(worker): observability — dispatch complete, events, bot notify
```

---

## 6. 추가 설계 결정 (Phase 0 플랜과 달라진 점)

### LLM 호출: Anthropic SDK → OpenRouter

Phase 0 플랜은 `@anthropic-ai/sdk`를 worker에서 직접 사용하도록 설정했으나, Step 4 구현 명세는 **OpenRouter API (openai SDK + baseURL)**를 사용한다.

- **이유:** OpenRouter는 Anthropic API와 동일한 모델(`anthropic/claude-sonnet-4-6`)을 지원하면서 단일 API 키로 여러 모델 실험이 가능. 비용 추적도 OpenRouter 대시보드에서 통합 가능.
- **영향:** `config.ts`에 `openrouter.apiKey` + `llm.model` 섹션 추가. `.env.example`에 `OPENROUTER_API_KEY`, `LLM_MODEL` 추가.
- **비용 집계 한계:** OpenRouter는 응답에 비용을 반환하지 않으므로 `cost_usd = 0`으로 기록, 토큰 수만 실질 추적. `daily_usd` cap은 토큰 기준 경고로 대체 (hard fail 제외). Phase 2에서 대시보드 `/monitor`에서 OpenRouter 대시보드 링크 안내로 보완.

### slug 생성 시점 (2단계)

dispatch에서 slug를 2회 계산한다:
1. cards UPSERT 시: YouTube는 `externalId`(videoId)로 임시 slug, GitHub는 `repoToSlug(externalId)`
2. LLM 완료 후: YouTube는 `titleToSlug(summary.title)`로 교체

이는 LLM 호출 전 cards row를 먼저 생성해 `already-exists` 체크를 가능하게 하기 위함이다.

### bot notify: 별도 REST 호출

worker는 bot 프로세스와 직접 통신하지 않고 Telegram API (`api.telegram.org/bot<token>/sendMessage`)를 직접 호출한다. bot과 worker가 같은 Mac에서 실행되지만 inter-process 통신 의존성 없이 단순하게 유지한다.

---

*작성일: 2026-05-17. Gate 1 — Reviewer 승인 대기.*
