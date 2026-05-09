# zettlink — Checklist

## 0. 셋업

- [ ] `pnpm` workspace 모노레포 초기화
- [ ] TypeScript strict + ESM 단일 + Node 22 LTS 고정 (`.nvmrc`)
- [ ] `.env.example` 작성 (Anthropic, OpenAI, Telegram bot token, Telegram user ID, GitHub PAT, `REPO_LOCAL_PATH`, `CLOUDFLARE_DEPLOY_HOOK_URL`)
- [ ] `.gitignore` (`.env`, `node_modules`, build artifacts)
- [ ] 단일 public repo (`owner/zettlink`) 생성 — vault 폴더 + Astro 소스 합침
- [ ] Cloudflare Pages 연결, 자동 빌드 비활성화 ("Pause deployments"), deploy hook URL 발급
- [ ] env 검증 모듈 (`config.ts`): 필수 키 누락 시 시작 즉시 종료

## 1. 공유 패키지 (`packages/core/`)

- [ ] frontmatter 타입 정의 (공통 + YouTube + GitHub variants, `artifacts:` 키 Day 1 포함)
- [ ] frontmatter parser/serializer (gray-matter 사용)
- [ ] LLM 클라이언트 래퍼 (Claude Sonnet 4.6) + prompt caching 셋업
- [ ] LLM 출력 스키마 (`{ title, summary_one_line, summary_body, insights, tags }`) Zod 검증
- [ ] slug 생성 (YouTube=영어 제목 소문자+하이픈, GitHub=`owner-repo`; 한글 변환 라이브러리 불필요)
- [ ] URL 정규화 (YouTube=`video_id`, GitHub=`owner/repo`)
- [ ] 토큰 근사치 함수 (`text.length / 4`) — transcript truncation 게이트
- [ ] Truncation 헬퍼 (head 3,000 + tail 3,000 token, `llm.truncated: true` 기록)
- [ ] 시드 vocabulary 상수 (`ai`, `agents`, `claude`, `codex`, `productivity`)
- [ ] 기존 vault 태그 빈도 집계 (system prompt 주입용)
- [ ] git 헬퍼 (`simple-git` 사용, `REPO_LOCAL_PATH` 단일 repo)

## 2. 1단계 데몬 (`apps/daemon/`)

### 2.1 Telegram bot 골격
- [ ] Telegraf 셋업, long polling 시작
- [ ] 화이트리스트 (본인 user ID만 통과, 외부는 무시)
- [ ] URL 추출 (메시지에서 첫 URL만 처리, D1 정책)
- [ ] URL 외 텍스트는 frontmatter `note` 필드에 저장 (B3 폴백)
- [ ] `+whisper` / `+force` 플래그 파싱

### 2.2 URL 종류 감지 + 라우팅
- [ ] YouTube 패턴 매칭 (`youtube.com/watch`, `youtu.be/`)
- [ ] GitHub 패턴 매칭 (`github.com/{owner}/{repo}`)
- [ ] 그 외는 `❌ 지원하지 않는 URL입니다. YouTube 또는 GitHub URL을 보내주세요.` 답장
- [ ] 직렬 처리 (Telegraf 핸들러 `async` + `await`, 외부 큐 없음)

### 2.3 YouTube 추출
- [ ] yt-dlp subprocess 래퍼 (`execa`, `--skip-download`, `--write-subs --write-auto-subs`, `--sub-langs en,ko`, `--sub-format vtt`)
- [ ] yt-dlp PATH 누락 감지 → `❌ yt-dlp를 설치해주세요: brew install yt-dlp` 답장
- [ ] 자막 다운로드 (수동 → 자동 → 없음 순서)
- [ ] `subtitle_source` frontmatter 표시 (`auto` / `manual` / `whisper` / `none`)
- [ ] VTT → Markdown 변환 (헤더/타임스탬프 제거 + **인접 중복**만 제거: `lines.filter((l, i) => l !== lines[i - 1])`)
- [ ] 자동 자막 시 Telegram 답장에 알림 (B3)
- [ ] 자막 없고 `+whisper` 있으면 OpenAI whisper-1 호출 (A3)
- [ ] 영상 메타데이터 추출 (제목, 업로더, 길이, 썸네일)

### 2.4 GitHub 추출
- [ ] octokit 셋업, `GITHUB_TOKEN` 환경변수
- [ ] README 다운로드
- [ ] 디렉토리 트리 (depth 2)
- [ ] 핵심 파일 식별 (entry point, 주요 모듈 5~10개)
- [ ] 메타데이터 (stars, primary_language, topics)

### 2.5 LLM 자동 처리
- [ ] 추출된 콘텐츠 + 시드 vocab + 기존 태그 빈도 → Claude 호출
- [ ] System prompt: "당신은 한국어 지식 요약 전문가입니다. 지시에 따라 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요."
- [ ] 6,000 토큰 초과 시 head 3,000 + tail 3,000 truncation
- [ ] 출력 스키마 검증 (Zod), 실패 시 1회 재시도
- [ ] Exponential backoff 3회 (E2)

### 2.6 파일 생성
- [ ] 폴더 경로 생성 (`vault/sources/{channel}/{date}-{slug}/`)
- [ ] `index.md` 작성 (frontmatter + 자동 요약 본문, A2)
- [ ] `transcript.md` (YouTube) 또는 `extract.md` (GitHub) 작성
- [ ] frontmatter `status: extracted` → LLM 후 `status: summarized`

### 2.7 중복 / 부분 성공
- [ ] URL 정규화 후 slug 계산 → `vault/sources/{platform}/{slug}/` 폴더 존재 확인 (빠른 경로)
- [ ] vault 전체 frontmatter 인덱스에서 URL 매칭 (보조 — slug 변경 가능성 대비)
- [ ] 중복이고 `+force` 없으면 `⚠️ 이미 처리된 URL입니다: {slug}` 답장
- [ ] LLM 실패 시 추출 파일은 commit, summary는 `status: failed` (D2)

### 2.8 git push (단일 repo)
- [ ] 카드 1개당 1 commit (커밋 메시지 자동 생성)
- [ ] `REPO_LOCAL_PATH` push: `simpleGit().add().commit().push()`
- [ ] push 실패 시 in-memory 5초 간격 2회 재시도, 최종 실패 시 `❌ git push 실패` Telegram 답장

### 2.9 Telegram 답장
- [ ] 메시지 수신 시 👀 reaction (C3)
- [ ] 완료 시 답장에 vault 경로 + 공개 상태 ("비공개. Publish 버튼으로 공개")
- [ ] 실패 시 ❌ + 사유

### 2.10 안전장치
- [ ] URL당 처리 최대 10분 타임아웃 (F2)
- [ ] OpenAI/Anthropic API 키 누락 시 시작 실패
- [ ] yt-dlp 바이너리 PATH 검사 (없으면 시작 시 경고, 호출 시 사용자 안내)

### 2.11 배포 스크립트
- [ ] `pnpm deploy` 명령: `CLOUDFLARE_DEPLOY_HOOK_URL`로 POST 요청
- [ ] `published: true` 카드 확인 후 배포 여부 결정은 사용자 판단
- [ ] Astro 빌드: `vault/sources/**/index.md` 글롭 → `published: true`만 렌더링

## 3. 2단계 대시보드 (`apps/dashboard/`)

- [ ] Next.js 15 App Router 셋업
- [ ] vault 디렉토리 환경변수로 받기
- [ ] RSC로 vault 글롭 (`sources/**/index.md`) → 카드 메타 수집
- [ ] 카드 리스트 페이지 (필터: channel/tags/published 상태)
- [ ] 검색 (Array.filter, 카드 < 1000 가정)
- [ ] 상세 페이지 (영상 임베드, 요약, 트랜스크립트 펼치기, 산출물 탭)
- [ ] "심화 요약" 버튼 → API route → core LLM 호출 → `deep.md` 작성 + git commit
- [ ] "TIL 작성" 버튼 → core LLM (TIL 프롬프트, 1인칭 학습자) → `til.md` + git commit
- [ ] "실용 가이드 작성" 버튼 → core LLM (가이드 프롬프트, 적용자 관점) → `guide.md` + git commit
- [ ] "Publish" 버튼 → frontmatter `published: true` 토글 + git commit
- [ ] dev only 빌드 가드 (production 빌드 차단)

## 4. 2단계 공개 사이트 (`apps/blog/`)

- [ ] Astro 셋업 + content collections
- [ ] vault 글롭 + `published: true` 필터
- [ ] `private/` 폴더 절대 제외 (안전장치)
- [ ] 카드 리스트 페이지 + 플랫폼/태그 필터
- [ ] 상세 페이지 (영상 임베드 또는 GitHub 링크, 요약, TIL/가이드 탭)
- [ ] 트랜스크립트는 별도 펼침 섹션
- [ ] Pagefind 검색 인덱스 빌드 단계
- [ ] Cloudflare Pages 연결 (private vault repo 빌드 토큰)
- [ ] 빌드 시 `published` 누락 카드 검증 (실수로 publish 빠뜨린 경우 경고)

## 5. 운영

- [ ] README — 셋업 단계, `.env`, 명령어, `brew install yt-dlp` 사전 조건
- [ ] `pnpm daemon` — 1단계 데몬 시작
- [ ] `pnpm deploy` — Cloudflare deploy hook 수동 트리거 (배포 시점 직접 제어)
- [ ] `pnpm dashboard` — 로컬 대시보드
- [ ] `pnpm blog` — 블로그 dev (로컬 미리보기)
- [ ] `pnpm blog:build` — 정적 빌드

## 5.5 테스트 (vitest)

- [ ] `slug.ts` 단위 테스트 (YouTube/GitHub URL → slug, 특수문자)
- [ ] VTT 파서 단위 테스트 (인접 dedup, 헤더 제거, 타임스탬프 제거)
- [ ] 중복 URL 감지 단위 테스트 (slug 폴더 존재/부재 분기)
- [ ] `config.ts` 단위 테스트 (필수 env 누락 시 throw)
- [ ] Truncation 헬퍼 단위 테스트 (6,000 토큰 경계)
- [ ] yt-dlp wrapper 통합 테스트 (fixture `.vtt` → `transcript.md`)
- [ ] GitHub extractor 통합 테스트 (`@octokit/rest` mock)
- [ ] LLM 호출 통합 테스트 (Anthropic SDK mock + Zod 검증)
- [ ] vault writer 통합 테스트 (`simple-git` mock, dual-commit 흐름)

## 6. 추후 (Phase 3)

- 플랫폼 추가 (PDF, 트위터, 팟캐스트)
- 시드 vocabulary 진화 모니터링
- 태그 계층화 (50개 초과 시)
- 오프라인 LLM 옵션 (whisper.cpp 로컬, 비용 0)
