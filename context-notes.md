# zettlink — Context Notes

`grill-me` 세션 (2026-05-07) 에서 결정된 17개 갈래와 그 이유. 미래 세션에서 이 결정들의 배경을 재유도하지 않도록 기록.

---

## Q1. 프로젝트 목표
**결정.** YouTube 및 기타 소스 링크를 아카이빙하고, 아이디어를 요약·인사이트 도출하는 1인 지식 관리 도구. TIL 블로그 포함.

## Q2. 아카이빙의 범위
**결정.** (D) 전부 — 콘텐츠 추출 + LLM 요약·태그 + TIL 블로그 자동화.
**이유.** 중간 단계만 구현하면 단순한 북마크 앱이 됨. 핵심 가치는 "링크 → 인사이트"의 자동화.

## Q3. 입력 소스 다양성
**결정.** **YouTube + GitHub** 두 플랫폼.
**이유.** 입력의 80%는 이 둘로 커버. PDF/팟캐스트/Twitter는 Phase 3로 미룸. 추출 라이브러리 성숙 + 빠른 안정화 가능.

## Q4. GitHub 추출 깊이
**결정.** **(B) 중간** — README + 디렉토리 구조 + 핵심 파일 (entry point + 주요 모듈 5~10개).
**이유.** 자동 단계에서 (C) 전체 저장소를 LLM에 통째로 넣으면 비용 폭발. (A) README만은 학습 가치 낮음. 심화 버튼 클릭 시 (C) 깊이로 재추출은 추후 결정.

## Q5. 시스템 토폴로지
**결정.** **(A) 전부 로컬** + **Vault Git repo**.
**이유.** 사용자 선호. 클라우드 인프라 없이 시작, Mac이 꺼져 있어도 Telegram이 메시지를 며칠 큐에 보관해서 "지연 처리"로 회복 가능. 향후 클라우드로 마이그레이션할 때 vault repo만 옮기면 되는 깔끔한 분리.

## Q6. Vault 파일 구조
**결정.** **(C) 폴더 단위** — 카드 1개 = 폴더 1개. `index.md` + `transcript.md`/`extract.md` + `deep.md` + `til.md` + `guide.md`.
**이유.** 산출물이 5종으로 늘어나는데 두 파일 구조나 단일 파일 구조는 전부 재설계 필요. **폴더 = 카드**라는 1:1 매핑이 정적 사이트 빌드를 단순화.

## Q7. 플랫폼 구분 방식
**결정.** **(B) 플랫폼별 폴더 + frontmatter**. `vault/sources/youtube/...` + `vault/sources/github/...` + frontmatter `channel` 필드 양쪽 모두.
**이유.** Obsidian 탐색에서 플랫폼 분리 자연스러움 + 웹 빌드는 단일 글롭(`sources/**/index.md`) + frontmatter 필드만 읽음. 플랫폼 추가 시 빌드 코드 변경 없음.

## Q8. 번역 정책
**결정.** **(B) 원본 영어 유지, 산출물만 한국어**.
**이유.** 한국어 산출물은 LLM이 영어 원본을 읽고 한국어로 출력하면서 자연스럽게 만들어짐. 별도 번역 단계는 토큰 낭비 + 인용 정확성 손실. GitHub 코드는 절대 번역하지 않음 (펜스 보호 필요).

## Q9. LLM 선택
**결정.** **Claude Sonnet 4.6 단일 모델**, 자동·심화 단계 모두.
**이유.** 한국어 글쓰기 품질이 핵심 가치, Sonnet 4.6이 안정적. 30건/월 가정 시 ~$3/월로 비용을 최적화 변수에서 제거. 멀티 벤더는 분기/SDK/키 비용이 큼.

## Q10. `index.md` 본문 + frontmatter 스키마
**결정.** **(A2) 본문에 자동 요약 포함**. frontmatter는 식별(url/channel/slug/captured_at) + 표시(title/tags/summary_one_line) + 산출물 트래킹(generated.deep/til/guide) + 플랫폼별 메타 + LLM 메타.
**이유.** 트랜스크립트는 별도 파일로 두고 `index.md`는 요약 표면만. 카드 클릭의 90%는 요약만 보면 충분. `summary_one_line`은 frontmatter에 둠 (카드 빌드 시 본문 파싱 불필요).

## Q11. 태그 정책
**결정.** **(C) 하이브리드 학습형**. LLM에 기존 vault 태그 빈도를 system prompt로 주입 → 기존 태그 우선, 없으면 신규 생성. 시드 vocabulary `ai`, `agents`, `claude`, `codex`, `productivity`.
**이유.** vocabulary가 자연스럽게 진화. 통제 vocabulary는 새 토픽 어려움, 자유 태그는 일관성 무너짐. Sonnet 4.6은 이런 지시를 잘 따름.
**규칙.** 영문 소문자, 하이픈, 카드당 3~7개, 한국어 금지.

## Q12. Telegram bot 메커니즘
**결정.**
- **A1** Long polling (공개 URL 불필요).
- **B1 + B3** URL만 추출 + 추가 텍스트는 frontmatter `note` 필드.
- **C3** 시작 reaction(👀) + 완료/실패 답장.
- **D1** 메시지당 첫 URL만.
- **E** 본인 user ID만 화이트리스트.

**이유.** 명령어 강제는 UX 부담, 다중 URL은 LLM 비용 예측 어려움 → 단순화. 화이트리스트는 spam 방지 필수.

## Q13. 에러·중복·재처리
**결정.**
- **A3** Whisper는 `+whisper` 옵트인.
- **B2 + B3** 자막 출처를 frontmatter에 표시 + 자동 자막 시 Telegram 알림.
- **C3** 중복 URL은 무시, `+force` 시 재처리.
- **D2 + D3** 단계별 commit + status 필드.
- **E2** Exponential backoff 3회.
- **F2** URL당 10분 타임아웃.

**이유.** Whisper 자동 폴백은 비용 지뢰. 추출은 비싼 자원이라 보존 우선, summary는 재시도 가능. status 필드로 재시도 대상 추적.

## Q14. 기술 스택
**결정.** **TypeScript / Node.js 22 / pnpm**, 단일 스택.
**이유.** Phase 2 웹 ecosystem(React, Tailwind, Astro, Pagefind)이 핵심. yt-dlp/Whisper는 어차피 subprocess라 Python 직접 호출 대비 차이 적음. 1단계와 2단계 코드 공유 (`packages/core/`). Bun은 안정성 위해 추후로.

## Q15. Phase 2 웹 아키텍처
**결정 (수정됨, Q16 후).** **(D) 통합 정적 사이트 + 로컬 처리**, 인증 없이 외부 공개. + **(W3)** vault private + Cloudflare Pages 빌드 토큰 접근.
**이유.** 사용자 결정. (C) 로컬 대시보드 + 정적 TIL을 처음 추천했으나, 사용자가 외부 공개 정적 사이트로 통합하고 LLM 트리거는 dev 모드 로컬에서만 처리하는 것을 선택. 인프라 추가(Vercel Functions, Auth) 모두 제거.

**구성.**
- 대시보드 (Next.js 15) — 로컬 dev only, 모든 LLM 호출/생성/publish 토글.
- 공개 블로그 (Astro) — 정적 빌드, `published: true` 카드만 노출.
- Cloudflare Pages — vault private repo에서 빌드.
- Pagefind 검색.

## Q16. 보안 + Mac 노출 (Q15 수정으로 폐기)
**결정.** Cloudflare Tunnel/Access 도입 안 함. 사이트는 보안 없이 공개, LLM 트리거 API는 dev 모드 로컬에서만 동작.
**이유.** 사용자가 인프라 단순화 우선. 사이트가 외부에 LLM API를 노출하지 않으면 인증/터널 모두 불필요.

## Q17. 공개 범위
**결정.** **(M2) `published: true` 카드만 공개**.
**이유.** "캡처 = 자동 공개"는 비대칭 리스크 (한 번의 실수가 영구 노출). published 토글은 1초, 안전장치로 충분.
**안전장치.**
- `private/` 폴더는 절대 빌드 제외.
- 빌드 시 `published` 누락 카드 검증.
- Telegram 답장에 "비공개. Publish 버튼으로 공개" 명시.
- frontmatter `note` 필드는 빌드 시 자동 제외.

## 추가 디테일

### 폴더 slug
LLM이 자동 요약 호출 시 `slug` 필드도 함께 출력. 60자 이하, 영문 소문자, 하이픈만. 폴더 경로는 `{date}-{slug}`. 한글 제목도 LLM이 의미 기반 영문 slug로 변환.

### Whisper
**OpenAI `whisper-1` API** ($0.006/분). `+whisper` 명시 시만 호출. OpenAI API 키 별도 필요.

### TIL vs 가이드 차이
- **TIL** (`til.md`) — 1인칭 학습자 관점. "오늘 배운 것 N개" 형식, 짧은 단락, 가벼운 통찰.
- **가이드** (`guide.md`) — 적용자 관점. 본인의 프로젝트에 도입하는 단계별 절차, 코드/명령어 포함.
- 프롬프트 명확히 분리. 같은 콘텐츠라도 두 산출물이 서로 다른 글이 되도록.

### GitHub API 인증
**Personal Access Token (PAT)** 사용. 환경변수 `GITHUB_TOKEN`. 시간당 5000 호출. 30 카드/월 사용량에선 충분히 여유.

---

## Eng Review (2026-05-09)

`/plan-eng-review` 세션에서 추가/수정된 8개 결정. 설계 문서 점수: 7.5/10 → 9/10.

### D1. VTT dedup 알고리즘 버그 수정

**문제.** 설계 문서의 `[...new Set(lines)]`은 전역 중복 제거 — 반복되는 짧은 구절(예: "Yes", "OK")이 자막 전체에서 1회만 남게 됨.
**결정.** `lines.filter((l, i) => l !== lines[i - 1])`로 교체. 인접 중복 큐만 제거.
**이유.** WebVTT 자동 자막은 같은 큐를 짧게 반복 출력하지만 멀리 떨어진 동일 단어는 정상적인 발화. 전역 dedup은 정보 손실.

### D2. Vault → Blog content drift

**문제.** Dual-commit 방식에서 vault `index.md`를 직접 편집하면 blog repo에 자동 반영되지 않음.
**결정.** `pnpm sync:blog` 스크립트 추가. vault의 모든 `index.md`를 blog repo로 재복사 + commit+push.
**이유.** 단방향 sync로 drift 해결. submodule 마이그레이션은 Phase 2.

### D3. 중복 URL 처리

**문제.** 같은 URL이 두 번 들어오면 동일 slug로 카드가 덮어씌워짐 또는 git conflict.
**결정.** URL 수신 즉시 slug 계산 → `vault/sources/{platform}/{slug}/` 존재 확인. 있으면 `⚠️ 이미 처리된 URL입니다: {slug}` 응답 후 중단.
**이유.** URL 정규화는 YouTube=`video_id`, GitHub=`owner/repo` 기준. `+force` 플래그로 재처리는 기존 Q13 결정 그대로.

### D4. 토큰 카운팅 방법

**문제.** "transcript > 6,000 토큰이면 truncate" 조건의 측정 방법 불명.
**결정.** 글자 수 근사치 `text.length / 4` 사용.
**이유.** Phase 1에 외부 tokenizer 의존성 불필요. transcript는 영어이므로 ±20% 오차 허용.

### D5. Git push 실패 시 큐 전략

**문제.** Open Question에 남아있던 "in-memory vs SQLite" 미결정.
**결정.** in-memory 2회 재시도 (5초 간격), 최종 실패 시 Telegram 에러 알림.
**이유.** Phase 1 Spine First 원칙. 데몬 재시작 시 카드 유실 허용. SQLite 큐는 Phase 2.

### D6. 미지원 URL 응답

**문제.** YouTube/GitHub 외 URL 처리 미정의.
**결정.** `❌ 지원하지 않는 URL입니다. YouTube 또는 GitHub URL을 보내주세요.` 응답.
**이유.** 단순 에러 응답으로 충분. 미지원 플랫폼 추가는 Phase 3.

### D7. 동시 URL 처리 순서

**문제.** 두 URL이 거의 동시에 도착하면 git push 충돌 위험.
**결정.** 직렬(serial) 처리. Telegraf 핸들러 `async` + 외부 큐 없이 `await`.
**이유.** 1인 도구에서 동시 수신 빈도 매우 낮음. p-limit 의존성 추가 불필요.

### D8. Slug 변환 라이브러리

**문제.** Open Question에 남아있던 "한글 → 로마자" 라이브러리 선택.
**결정.** 라이브러리 불필요. YouTube=영어 제목 소문자+하이픈, GitHub=`owner-repo`.
**이유.** YouTube의 원문 제목은 대부분 영어. 한글 제목 영상 캡처 빈도 낮음. 라이브러리 의존성 회피.

---

## D9. 저장소 구조 + 배포 주기 변경 (2026-05-09)

**문제.** Dual-commit 방식은 vault/blog 두 repo를 유지하며 drift 위험, push 두 번, sync:blog 스크립트 필요. 또한 카드 push마다 Cloudflare Pages가 자동 빌드되어 배포 주기 제어 불가.

**결정.**
- **Option C 채택**: 단일 public repo (`owner/zettlink`)에 vault 폴더 + Astro 소스 합침.
- **배포 주기**: Cloudflare Pages 자동 빌드 비활성화 + deploy hook으로 수동 트리거. `pnpm deploy` 한 줄로 실행.
- 데몬은 `REPO_LOCAL_PATH` 단일 환경변수, git push 한 번으로 완료.

**이유.** 공부 기록 용도라 모든 카드가 public이어도 무방. 단일 repo로 drift 구조적 해소, 코드 단순화, 배포 시점 직접 제어 가능.

**변경 사항.**
- `VAULT_LOCAL_PATH` + `BLOG_LOCAL_PATH` → `REPO_LOCAL_PATH` 단일 env
- dual-commit 코드 삭제
- `pnpm sync:blog` 스크립트 불필요 → 제거
- `pnpm deploy` 스크립트 추가 (Cloudflare deploy hook POST)
- Codex [medium] drift 이슈 구조적 해소

---

## 메타

- 이 문서는 "왜 그렇게 결정했는가"의 기록. "무엇을 만드는가"는 `PLAN.md`, "어떻게 진행하는가"는 `checklist.md`.
- 결정 변경 시 새 항목으로 추가 (덮어쓰지 않음). 미래 세션이 결정 진화를 따라갈 수 있게.
- 코딩 시작 후 새로운 갈림길을 만나면 여기에 추가.
