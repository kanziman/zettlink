# zettlink — Checklist

## 0. 셋업

- [x] `pnpm` workspace 모노레포 초기화
- [x] TypeScript strict + ESM 단일 + Node 22 LTS 고정 (`.nvmrc`)
- [x] `.env.example` 작성 (OpenRouter, OpenAI, Telegram token + user ID, GitHub PAT, `REPO_LOCAL_PATH`, `CLOUDFLARE_DEPLOY_HOOK_URL`, `YTDLP_COOKIES_BROWSER`, `OPENROUTER_MODEL`)
- [x] `.gitignore` (`.env`, `node_modules`, build artifacts, `vault/`)
- [x] 단일 public repo (`owner/zettlink`) 생성 — vault 폴더 + Astro 소스 합침
- [x] Cloudflare Pages 연결, 자동 빌드 비활성화 ("Pause deployments"), deploy hook URL 발급
- [x] env 검증 모듈 (`config.ts`): 필수 키 누락 시 시작 즉시 종료

## 1. 공유 패키지 (`packages/core/`)

- [x] frontmatter 타입 정의 (공통 + YouTube + GitHub variants)
- [x] frontmatter parser/serializer (gray-matter 사용)
- [x] LLM 클라이언트 래퍼 (OpenRouter 경유 Sonnet/Haiku) + prompt caching 셋업
- [x] LLM 출력 스키마 (`{ title, slug, summary_one_line, summary_body, insights, tags }`) Zod 검증 + ```json 코드펜스 흡수
- [x] slug 생성 (YouTube=영어 제목 소문자+하이픈, GitHub=`owner-repo`)
- [x] URL 정규화 (YouTube=`video_id`, GitHub=`owner/repo`)
- [x] 토큰 근사치 함수 (`text.length / 4`)
- [x] Truncation 헬퍼 (head/tail 분할, `llm.truncated: true` 기록)
- [x] 시드 vocabulary 상수 (`ai`, `agents`, `claude`, `codex`, `productivity`)
- [x] 기존 vault 태그 빈도 집계 (system prompt 주입용)
- [x] git 헬퍼 (`simple-git`, in-memory 2회 재시도, `REPO_LOCAL_PATH` 단일 repo)

## 2. 1단계 데몬 (`apps/daemon/`)

### 2.1 Telegram bot 골격
- [x] Telegraf 셋업, long polling 시작
- [x] 화이트리스트 (`TELEGRAM_USER_ID` 만 통과, 외부 무시)
- [x] URL 추출 (메시지에서 첫 URL만 처리)
- [x] URL 외 텍스트는 frontmatter `note` 필드에 저장
- [x] `+whisper` / `+force` 플래그 파싱

### 2.2 URL 종류 감지 + 라우팅
- [x] YouTube 패턴 매칭 (`youtube.com/watch`, `youtu.be/`)
- [x] GitHub 패턴 매칭 (`github.com/{owner}/{repo}`)
- [x] 미지원 URL → `❌ 지원하지 않는 URL ...` 답장
- [x] 직렬 처리 (Telegraf 핸들러 `async` + `await`)

### 2.3 YouTube 추출
- [x] yt-dlp subprocess 래퍼 (`execa`, `--skip-download`, `--no-check-formats`, `--ignore-no-formats-error`)
- [x] yt-dlp PATH 누락 감지 → 식별 가능한 에러
- [x] 단계별 자막 fallback (ko 수동 → ko 자동 → en 수동 → 임의 언어 수동 → description) — Python `yt-fetcher` 디자인
- [x] 각 시도 격리 tmp 디렉토리, 100 자 미만 자막은 무의미 처리
- [x] `subtitle_source` frontmatter 표시 (`auto` / `manual` / `whisper` / `description` / `none`)
- [x] VTT → Markdown 변환 (헤더/타임스탬프 제거, HTML 마크업 제거, 글로벌 dedup, 문장 종결자 줄바꿈)
- [x] tlang= 파라미터 기반 원본 ASR 우선 (한국어 영상에서 한국어 자막 자동 선택)
- [x] `--cookies-from-browser` 옵션 (YouTube IP 429 우회) 환경변수 (`YTDLP_COOKIES_BROWSER`) 로 제어
- [x] 자막 없고 `+whisper` 있으면 OpenAI whisper-1 호출
- [x] 영상 메타데이터 추출 (제목, 채널, 업로드 일자, 길이, 썸네일)

### 2.4 GitHub 추출
- [x] octokit 셋업, `GITHUB_TOKEN` 환경변수
- [x] README 다운로드
- [x] 디렉토리 트리 (depth 2)
- [x] 메타데이터 (stars, primary_language, topics)

### 2.5 LLM 자동 처리
- [x] 추출된 콘텐츠 + 시드 vocab + 기존 태그 빈도 → OpenRouter (Sonnet/Haiku 4.5+) 호출
- [x] System prompt: "한국어 지식 요약 전문가, 유효한 JSON만 반환"
- [x] 6,000 토큰 초과 시 head/tail truncation
- [x] 출력 스키마 검증 (Zod), 실패 시 1회 재시도, ```json 코드펜스 자동 흡수

### 2.6 파일 생성
- [x] 폴더 경로 생성 (`sources/{platform}/{date}-{slug}/`)
- [x] `index.md` 작성 (frontmatter + 자동 요약 본문)
- [x] `transcript.md` (YouTube) / `extract.md` (GitHub) 작성
- [x] frontmatter `status: extracted` → LLM 후 `status: summarized`

### 2.7 중복 / 부분 성공
- [x] URL 정규화 후 slug 폴더 존재 확인 (빠른 경로)
- [x] vault 전체 frontmatter 인덱스에서 video_id 매칭 (보조)
- [x] 중복 + `+force` 없으면 `⚠️ 이미 처리된 URL ...` 답장
- [x] LLM 실패 시 transcript 는 commit, summary 는 `status: failed`

### 2.8 git push
- [x] 카드 1개당 1 commit
- [x] `REPO_LOCAL_PATH` push: `simpleGit().add().commit().push()`
- [x] push 실패 시 in-memory 5초 간격 2회 재시도

### 2.9 Telegram 답장
- [x] 메시지 수신 시 👀 reaction
- [x] 완료 시 vault 경로 + 비공개 안내
- [x] 실패 시 ❌ + 사유 (1500 자 클립, reply 자체 실패도 데몬 안 죽이기)

### 2.10 안전장치
- [x] URL당 처리 최대 10분 타임아웃
- [x] OpenRouter / Telegram / GitHub 키 누락 시 시작 실패
- [x] yt-dlp 바이너리 PATH 검사 (호출 시 사용자 안내)

### 2.11 배포 스크립트
- [ ] `pnpm deploy` 명령: `CLOUDFLARE_DEPLOY_HOOK_URL`로 POST 요청
- [ ] Astro 빌드: `vault/sources/**/index.md` 글롭 → `published: true`만 렌더링

## 3. 2단계 대시보드 (`apps/dashboard/`)

- [x] Next.js 15 App Router 셋업
- [x] vault 디렉토리 환경변수로 받기
- [x] RSC로 vault 글롭 (`sources/**/index.md`) → 카드 메타 수집
- [x] 카드 리스트 페이지 (필터: channel/tags/published 상태)
- [x] 검색 (Array.filter, 카드 < 1000 가정)
- [x] 상세 페이지 (영상 임베드, 요약, 트랜스크립트 펼치기, 산출물 탭)
- [x] "심화 요약" 버튼 → API route → core LLM 호출 → `deep.md` 작성 + git commit
- [x] "TIL 작성" 버튼 → core LLM (TIL 프롬프트, 1인칭 학습자) → `til.md` + git commit
- [x] "실용 가이드 작성" 버튼 → core LLM (가이드 프롬프트, 적용자 관점) → `guide.md` + git commit
- [x] "Publish" 버튼 → frontmatter `published: true` 토글 + git commit (요약본·산출물 모두 지원)
- [x] dev only 빌드 가드 (production 빌드 차단)
- [x] malformed 카드도 보드 하단 "Malformed cards" 섹션에 노출

## 4. 2단계 공개 사이트 (`apps/blog/`)

- [ ] Astro 셋업 + content collections
- [ ] vault 글롭 + `published: true` 필터
- [ ] `private/` 폴더 절대 제외 (안전장치)
- [ ] 카드 리스트 페이지 + 플랫폼/태그 필터
- [ ] 상세 페이지 (영상 임베드 또는 GitHub 링크, 요약, TIL/가이드 탭)
- [ ] 트랜스크립트는 별도 펼침 섹션
- [ ] Pagefind 검색 인덱스 빌드 단계
- [ ] Cloudflare Pages 연결
- [ ] 빌드 시 `published` 누락 카드 검증

## 5. 운영

- [ ] README — 셋업 단계, `.env`, 명령어, `brew install yt-dlp deno ffmpeg` 사전 조건
- [x] `pnpm daemon` — 1단계 데몬 시작
- [ ] `pnpm deploy` — Cloudflare deploy hook 수동 트리거
- [ ] `pnpm dashboard` — 로컬 대시보드
- [ ] `pnpm blog` — 블로그 dev
- [ ] `pnpm blog:build` — 정적 빌드

## 5.5 테스트 (vitest)

- [x] `slug.ts` 단위 테스트 (YouTube/GitHub URL → slug, 특수문자, 60자 자르기)
- [x] VTT 파서 단위 테스트 (글로벌 dedup, 헤더 제거, 타임스탬프 제거, HTML 마크업 제거, 문장 줄바꿈, 한국어 처리)
- [x] 중복 URL 감지 단위 테스트 (pipeline.test.ts 의 duplicate 시나리오)
- [x] `config.ts` 단위 테스트 (필수 env 누락 시 throw)
- [x] Truncation 헬퍼 단위 테스트
- [x] yt-dlp wrapper 단위 테스트 (mock execa + 단계별 fallback 검증)
- [x] GitHub extractor 통합 테스트 (`@octokit/rest` mock)
- [x] LLM 호출 통합 테스트 (OpenAI SDK mock + Zod 검증 + 코드펜스 흡수)
- [x] vault writer 단위 테스트 (`simple-git` mock + 재시도)
- [x] handler 단위 테스트 (whitelist + reaction + reply + 긴 메시지 클립 + reply 실패 흡수)
- [x] pipeline 통합 테스트 (extract → LLM → write → push)
- [x] flags 메시지 파서 (URL + +force / +whisper + note)

**합계.** core 41 + daemon 31 = **72 tests passing**, typecheck clean.

## 6. 추후 (Phase 3)

- 플랫폼 추가 (PDF, 트위터, 팟캐스트)
- 시드 vocabulary 진화 모니터링
- 태그 계층화 (50개 초과 시)
- 오프라인 LLM 옵션 (whisper.cpp 로컬, 비용 0)
