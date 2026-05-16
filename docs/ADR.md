# Architecture Decision Records

## 철학

1인 운영자의 학습 자산을 잃지 않으면서 1단계부터 자동화한다. **boring tech** (검증된 기술) 기본, **innovation token**은 LLM 요약 한 곳에만 쓴다. 모든 결정은 (a) 1인 운영 부담을 늘리지 않고, (b) 데이터 손실 가능성을 줄이는 방향으로 한다.

---

### ADR-001: Primary store = Supabase Postgres

**결정:** 모든 메타데이터·큐·이벤트를 Supabase Postgres에 저장. vault/.md는 옵션 backup·이식 채널.

**이유:** 대시보드가 Vercel public(admin auth-gated)이라 Vercel과 Mac worker 양쪽이 같은 DB를 봐야 함. SQLite는 single-Mac 환경에서만 유효한데, 대시보드 public화로 그 가정이 깨짐. Supabase 무료 tier가 1인 사용에 충분하고 Auth·SQL 콘솔·자동 백업까지 묶음.

**트레이드오프:** Worker가 매 단계 네트워크 호출 (50~200ms × ~10회 = 0.5~2초). 전체 job 30~300초 대비 무시 가능. Vendor lock-in은 Postgres 표준 + `pg_dump` 이식성으로 완화.

---

### ADR-002: 인증 = Supabase Auth + admin user_id whitelist (RLS)

**결정:** Supabase Auth (이메일+비번)로 로그인, middleware에서 `session.user_id ∈ ADMIN_USER_IDS` 추가 검증. RLS로 anon은 published 카드만 read.

**이유:** 1인 admin 전용. 별도 IDP (Auth0, Clerk) 도입 비용 0의 가치. Supabase Auth 가입 자체는 누구나 가능하지만 ADMIN_USER_IDS에 없으면 middleware가 403.

**트레이드오프:** ADMIN_USER_IDS 환경변수 누락 시 모두 거부 (fail-closed). 비번 분실 시 Supabase Studio에서 reset.

---

### ADR-003: 공개 사이트 = Next.js 15 + Vercel (Astro 대신)

**결정:** Astro + Cloudflare Pages를 Next.js 15 + Vercel로 변경.

**이유:** 대시보드도 Next.js라 같은 프레임워크면 packages/ui 컴포넌트와 DESIGN.md 토큰을 100% 재사용. Vercel은 Next.js 1급 시민이고, deploy hook 패턴은 Cloudflare Pages와 동일.

**트레이드오프:** Astro가 정적 사이트로는 더 가볍지만 (작은 JS 번들), Next.js SSG도 충분히 작음. Vercel free tier는 단일 운영자에 충분.

---

### ADR-004: 대시보드 배포 = Vercel public (admin-gated)

**결정:** 대시보드를 로컬 dev only가 아니라 Vercel public에 admin-gated로 배포.

**이유:** 모바일·외부 네트워크에서도 카드 관리·publish 가능. 노트북을 켜야만 쓰는 도구는 결국 안 쓰게 됨.

**트레이드오프:** 클라우드 DB 강제 (ADR-001과 짝). middleware 오설정 시 admin route 노출 위험 → 별도 Vercel project + rootDirectory 분리 (ADR-005)로 완화.

---

### ADR-005: dashboard ↔ site 코드베이스 분리 (별도 Vercel project)

**결정:** `apps/dashboard`와 `apps/site`를 같은 monorepo 내 별도 Vercel project로 분리. rootDirectory 설정으로 빌드 격리.

**이유:** 단일 codebase + 환경 분기 (`NEXT_PUBLIC_IS_LOCAL` 같은 플래그) 패턴은 실수로 admin route가 public site에 노출되는 사고가 흔함. 코드 단계 분리가 가장 안전.

**트레이드오프:** Vercel project 2개 관리, 환경변수 2번 등록. packages/ui로 컴포넌트는 공유되므로 중복은 최소.

---

### ADR-006: 영속 작업 큐 = Postgres `jobs` 테이블 + `pick_next_job()` RPC

**결정:** Telegram bot 수신과 worker 처리 사이에 `jobs` 테이블을 두고, worker는 `FOR UPDATE SKIP LOCKED` 기반 RPC로 픽업.

**이유:** in-memory 재시도는 데몬 재시작 시 작업 증발. Postgres 큐는 데몬 crash 후 자동 재개. `picked_at` 30분 초과 reaper로 stuck job 복구. SKIP LOCKED는 worker 다중 인스턴스 race도 미리 차단.

**트레이드오프:** 본격 큐 시스템(BullMQ, Sidekiq)에 비해 기능 적음. 1인 처리량(일 N건)에서는 차고 넘침.

---

### ADR-007: URL canonical 정규화 (folder check 대신)

**결정:** `packages/shared/url-normalize.ts`에서 YouTube/GitHub URL을 canonical form으로 변환 후 `(platform, external_id)` UNIQUE 제약으로 중복 차단.

**이유:** `youtube.com/watch?v=X`, `youtu.be/X`, shorts, live, m. 변형이 모두 같은 영상 ID. folder 존재 check만으로는 다른 변형으로 들어온 중복을 못 막아 카드 + 비용 2배.

**트레이드오프:** 새 platform 추가 시 정규화 함수 추가 필요. 단위 테스트로 변형 케이스 100% 커버.

---

### ADR-008: Tag = canonical_name + aliases 테이블

**결정:** `tags(canonical_name UNIQUE, aliases jsonb)` 구조. LLM이 새 태그 제안하면 alias 매칭 후 기존 canonical에 통합, 없으면 새 canonical 생성.

**이유:** LLM 자유 누적은 "React"/"React.js"/"ReactJS" 폭발. canonical화로 1년 뒤에도 사용 가능한 태그 시스템.

**트레이드오프:** 초기 alias 매칭 정확도 LLM 의존. Phase 4에서 dashboard에 수동 merge UI 추가 검토.

---

### ADR-009: 관측성 = `events` 테이블 + pino 로그 + `/monitor` 페이지

**결정:** 모든 단계 (`bot.recv`, `job.pick`, `extract.*`, `llm.call`, `git.push`, `job.done`, `job.fail`)에 1 row + pino JSONL. 대시보드 `/monitor`에서 비용·큐·실패 시각화.

**이유:** 1인 운영에서 디버깅 인력은 0. 사후 추적이 가능해야 1년 뒤에도 유지 가능.

**트레이드오프:** events 테이블 크기 증가 → Phase 4에서 90일 이상 archive 검토.

---

### ADR-010: LLM 비용 가드 = `daily_usd` cap

**결정:** Worker가 LLM 호출 직전 오늘자 cumulative cost 확인. 한도(`daily_usd`, `per_job_usd`) 초과 시 jobs `dead` + bot 알림.

**이유:** URL 100개 폭주 / 긴 영상 폭탄 / LLM API 가격 변동 등 폭주 시나리오 차단. fail-closed가 fail-open보다 1인 운영에 안전.

**트레이드오프:** False positive(정상 사용이 한도 도달) 가능. `.env`에서 즉시 조정 가능.

---

### ADR-011: YouTube 추출 = yt-dlp (자체 구현 대신)

**결정:** YouTube 메타·자막 추출은 `yt-dlp` CLI wrapper.

**이유:** YouTube 비공식 API는 자주 깨지지만 yt-dlp 커뮤니티가 빠르게 패치. 자체 구현 시 유지보수 부담 0의 가치.

**트레이드오프:** 외부 바이너리 의존. launchd PATH 설정 필요.

---

### ADR-012: Whisper Phase 1 skip, Phase 4 whisper.cpp

**결정:** 1단계는 자막 있는 영상만 처리. 자막 없으면 fail. 음성 → 자막 변환은 Phase 4에 whisper.cpp 로컬로.

**이유:** Phase 1 범위 축소. OpenAI Whisper API는 $0.006/min × 60분 = $0.36/건으로 1인 사용에 부담. whisper.cpp는 비용 0이지만 셋업 복잡 → Phase 1 가치 ↓.

**트레이드오프:** Phase 1 처리 가능 영상 범위 좁아짐.

---

### ADR-013: vault/.md = 옵션 backup·이식 채널 (primary 아님)

**결정:** Supabase가 단일 진실. worker가 카드 처리 후 vault/.md를 export하고 git push (옵션). 사이트는 Supabase에서 빌드 타임 조회.

**이유:** Supabase 데이터 손실 가능성 대비 + Obsidian/타 도구로 이식성 확보 + git diff로 변경 추적. 단, primary로 두면 R1 (git as OLTP) 리스크 재발 → backup으로 강등.

**트레이드오프:** 이중 직렬화 비용. `scripts/export-vault.ts` / `import-vault.ts` 양방향으로 어느 쪽 손실도 복구 가능.

---

### ADR-014: 단일 worker (직렬 처리)

**결정:** Phase 1은 worker 인스턴스 1개. Postgres `pick_next_job()`이 SKIP LOCKED로 future-proof만 해둠.

**이유:** 1인 일일 URL 입력량이 worker 1개로 충분. 다중 worker는 git push race·rate limit 관리 복잡.

**트레이드오프:** 긴 작업 1개가 큐 막음. Phase 4+에서 부하 보이면 worker 늘리고 git push만 직렬화.

---

### ADR-015: 단일 repo (monorepo, pnpm workspace)

**결정:** apps/* + packages/* + supabase/ + vault/를 한 git repo에 둠.

**이유:** 1인 프로젝트에서 multi-repo의 cross-repo PR/release 비용 0의 가치. Vercel은 rootDirectory로 monorepo 1급 지원.

**트레이드오프:** vault가 1,000+ 카드로 커지면 git operation 느려짐. Phase 5+에서 vault 분리 검토.

---

*최종 갱신: 2026-05-16.*
