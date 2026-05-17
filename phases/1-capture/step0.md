# Step 0: bot-core

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(모든 DB 접근은 packages/db, service_role만), 기술 스택
- `docs/ARCHITECTURE.md` — §3.1(캡처 → 카드 12단계 플로우), §8(환경변수)
- `docs/ADR.md` — ADR-006(영속 작업 큐), ADR-002(인증 whitelist)
- `packages/db/src/index.ts` — createServiceClient export 확인
- `packages/shared/src/index.ts` — config, canonicalize export 확인
- `phases/1-capture/index.json` — phase summary

## 작업

`apps/bot/src/index.ts`를 구현하라. Telegram에서 URL을 수신하고 jobs 테이블에 INSERT하는 데몬.

### 생성할 파일

**`apps/bot/src/index.ts`**

구현 내용:
1. Telegraf 인스턴스 생성 (`config.telegram.botToken`)
2. 기동 전 환경변수 검증:
   - `TELEGRAM_BOT_TOKEN` 미설정 → `logger.fatal('TELEGRAM_BOT_TOKEN missing — blocked')` + `process.exit(1)`
   - `TELEGRAM_WHITELIST` 미설정 또는 빈 문자열 → `logger.fatal('TELEGRAM_WHITELIST missing — blocked')` + `process.exit(1)` (빈 whitelist로 운영하면 모든 메시지를 무시하므로 데몬 자체를 올리지 않는다)
3. `bot.on('message')` 핸들러:
   - `ctx.from?.id` 또는 `ctx.chat?.id`가 `config.telegram.whitelist`에 없으면 무시 (silently)
   - 메시지 텍스트에서 URL 추출 (첫 번째 HTTP URL)
   - `+force` 플래그 감지 (`msg.text.includes('+force')`)
   - `createServiceClient()`로 Supabase 연결
   - **`INSERT INTO events (type, data)` VALUES (`'bot.recv'`, `{ chat_id, msg_id, raw_text, has_url }`)** — whitelist 통과 직후, jobs INSERT 전
   - `INSERT INTO jobs (raw_url, status, telegram_chat, telegram_msg, force, next_attempt_at)` VALUES (`rawUrl`, `'queued'`, `chatId`, `msgId`, `force`, `now()`)
   - 성공: `ctx.reply('⏳ queued #' + job.id)`
   - URL 없음: `ctx.reply('URL을 포함한 메시지를 보내주세요.')`
   - INSERT 실패: `ctx.reply('❌ 서버 오류, 잠시 후 다시 시도해주세요.')`
4. `bot.launch()` + graceful shutdown (SIGINT, SIGTERM)
5. pino 로거 초기화 (`logs/zettlink-YYYY-MM-DD.log`)

**`apps/bot/package.json`**

dependencies:
- `telegraf`: `^4`
- `pino`: `^9`
- `pino-pretty`: `^11` (devDependencies)
- `@zettlink/db`: `workspace:*`
- `@zettlink/shared`: `workspace:*`

scripts:
```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

**`apps/bot/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### URL 추출 로직

```typescript
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}
```

### +force 파싱

```typescript
const force = text.toLowerCase().includes('+force')
const rawUrl = extractUrl(text.replace(/\+force/gi, '').trim())
```

## Acceptance Criteria

```bash
pnpm install
pnpm --filter @zettlink/bot build
# → 컴파일 에러 없음

# 실행 확인 (TELEGRAM_BOT_TOKEN 없으면 blocked 처리)
# 있으면:
# pnpm --filter @zettlink/bot dev
# → Telegram에서 URL 전송 → "⏳ queued #N" 응답 확인
# → Supabase jobs 테이블에 row 생성 확인

# whitelist 검증
grep -r "whitelist" apps/bot/src/ && echo "whitelist check OK"
```

## 금지사항

- `process.env`를 `config` 객체를 우회해 직접 읽지 마라.
- `createClient`를 apps/bot에서 직접 호출하지 마라. `@zettlink/db`의 `createServiceClient`만.
- whitelist에 없는 user의 메시지에 응답하지 마라. 완전히 무시.
- Telegram bot token이 없으면 즉시 `process.exit(1)`로 중단하라.
- `TELEGRAM_WHITELIST`가 미설정이거나 빈 문자열이면 즉시 `process.exit(1)`로 중단하라. 빈 whitelist로 기동하면 어떤 메시지도 처리하지 못하므로 데몬을 올리는 의미가 없다.
- whitelist 통과 후 반드시 `bot.recv` event를 events 테이블에 INSERT하라. jobs INSERT 전에 기록해야 수신 추적이 가능하다.
