# 서버 실행 명령어

## 개발 서버

### 대시보드 (admin-gated, <http://localhost:3001>)

```bash
pnpm --filter dashboard dev
```

### 공개 사이트 (<http://localhost:3000>)

```bash
pnpm --filter site dev
```

### Bot (Telegram long polling)

```bash
pnpm --filter bot dev
```

### Worker (job queue processor)

```bash
pnpm --filter worker dev
```

---

## Supabase 로컬

```bash
supabase start          # 로컬 컨테이너 시작 (http://127.0.0.1:54321)
supabase stop           # 중지
supabase status         # 상태 확인 (API URL, Studio URL, 키 등)
supabase studio         # Studio 브라우저 열기 (http://127.0.0.1:54323)
```

---

## 빌드

```bash
pnpm build                        # 전체 워크스페이스 빌드

pnpm --filter @zettlink/shared build   # shared 패키지 단독 빌드 (dist/ 갱신)
pnpm --filter @zettlink/db build       # db 패키지 단독 빌드 (dist/ 갱신)
pnpm --filter site build               # 공개 사이트 정적 빌드 (out/ 생성)
pnpm --filter dashboard build          # 대시보드 빌드
```

> **주의:** `packages/shared`·`packages/db` 소스를 수정했다면 `build`를 먼저 실행해야 대시보드/사이트가 최신 코드를 참조합니다.

---

## Mac launchd 데몬 (Bot · Worker 상시 실행)

```bash
# 등록 (처음 한 번)
launchctl load ~/Library/LaunchAgents/com.zettlink.bot.plist
launchctl load ~/Library/LaunchAgents/com.zettlink.worker.plist

# 상태 확인
launchctl list | grep zettlink

# 중지
launchctl unload ~/Library/LaunchAgents/com.zettlink.bot.plist
launchctl unload ~/Library/LaunchAgents/com.zettlink.worker.plist
```

---

## 배포

```bash
pnpm deploy:site       # 공개 사이트 Vercel deploy hook POST (수동 트리거)
```

대시보드는 GitHub push 시 Vercel 자동 배포.

---

## 타입 · 코드 검증

```bash
pnpm gen-types         # Supabase → packages/db/types.gen.ts 재생성
pnpm typecheck         # 전체 워크스페이스 tsc --noEmit
pnpm lint              # ESLint
pnpm test              # 전체 단위/통합 테스트
```

---

## 어드민 계정 (로컬 개발)

| 항목 | 값 |
|---|---|
| 이메일 | <admin@zettlink.dev> |
| 비밀번호 | admin1234 |
| 환경 | 클라우드 Supabase |

`ADMIN_USER_IDS` — `.env` 참고.
