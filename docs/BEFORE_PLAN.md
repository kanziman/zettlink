# zettlink — Plan

> **⚠️ Superseded by [docs/ARCHITECTURE.md](ARCHITECTURE.md) and [docs/ADR.md](ADR.md) — 2026-05-16.**
>
> 이 문서는 초기 계획이며, `/plan-eng-review`를 통해 다음 결정이 변경되었습니다 (히스토리 보존용으로만 유지):
>
> - Primary store: Git frontmatter → **Supabase Postgres** (ADR-001)
> - 인증: 없음(로컬 only) → **Supabase Auth + admin user_id whitelist** (ADR-002)
> - 공개 사이트: Astro + Cloudflare Pages → **Next.js 15 + Vercel** (ADR-003)
> - 대시보드: 로컬 dev only → **Vercel public (admin-gated)** (ADR-004)
> - Job queue: in-memory 2회 → **Postgres `jobs` + `pick_next_job()` RPC** (ADR-006)
> - URL 중복: 폴더 존재 확인 → **canonical 정규화 + UNIQUE** (ADR-007)
> - Tag: LLM 누적 → **canonical_name + aliases** (ADR-008)
> - 관측성: 없음 → **`events` 테이블 + pino + `/monitor`** (ADR-009)
> - LLM 비용 가드: 없음 → **`daily_usd` cap** (ADR-010)
> - Whisper: OpenAI API 옵트인 → **Phase 1 skip, Phase 4 whisper.cpp** (ADR-012)
>
> 변경 안 된 것: 1인 사용자 흐름, TypeScript/Node 22/pnpm, Claude Sonnet 4.6 단일 모델, vault 폴더 단위 카드, 번역 정책(원본 영어/산출물 한국어), `pnpm deploy` 수동 트리거, Telegram bot whitelist.

---

## 무엇을 만드는가

YouTube 영상과 GitHub 저장소를 Telegram에 던지면 자동으로 요약·인사이트·태그가 생성되고, 학습한 내용을 TIL 블로그와 실용 가이드로 발전시켜 외부에 공개하는 **1인 지식 관리 도구**.

## 왜 만드는가

- 흥미로운 영상/저장소를 모바일로 만나는 순간이 많은데, 다시 찾아 읽지 않으면 휘발됨.
- 단순 북마크는 의미 추출이 0이고, 수동 노트는 부담이 큼.
- LLM이 충분히 발전한 시점에서 "캡처→자동 요약→선택적 발전→공개"의 흐름을 자동화하면, 학습 깊이가 누적적으로 쌓이는 구조가 만들어짐.

## 핵심 사용자 흐름

1. **(캡처)** 모바일에서 YouTube/GitHub URL을 Telegram bot에 던짐.
2. **(자동 처리)** 로컬 Mac 데몬이 수신 → URL 종류 감지 → 추출 → Claude Sonnet 4.6 요약·태그 → 폴더 단위 카드 생성 → 단일 public repo로 git push.
3. **(탐색)** 본인 노트북에서 `pnpm dev` → Next.js 대시보드(localhost) → 카드 리스트 / 필터 / 검색.
4. **(심화)** 흥미로운 카드에서 심화 요약/TIL/가이드 버튼 클릭 → 로컬 API route가 LLM 호출 → vault 업데이트 → git push.
5. **(발행)** 본인 검토 후 `published: true` 토글 → git push → `pnpm deploy`로 수동 트리거 → Cloudflare Pages 빌드 → 공개 정적 사이트에 반영.

## 1단계 범위

- Telegram bot trigger (long polling, whitelist).
- YouTube 자막(또는 +whisper 옵트인) + GitHub B-깊이 추출.
- 자동 요약·인사이트·태그 LLM 호출 (Claude Sonnet 4.6, structured output).
- 폴더 단위 카드 생성, 단일 repo git commit+push (`REPO_LOCAL_PATH`).
- 중복 URL 처리 (slug 폴더 존재 확인), `+force` 재처리.
- 직렬 URL 처리 (동시 git 충돌 방지).
- 에러 폴백 (in-memory 2회 재시도), 상태 표시 (`status` 필드).
- `pnpm deploy` 스크립트 (Cloudflare deploy hook 수동 트리거).

## 2단계 범위

- Next.js 대시보드 (로컬 dev only) — 카드 리스트, 상세, 심화 트리거.
- Astro 정적 블로그 (공개) — published 카드만, Pagefind 검색.
- 산출물 5종 (`index.md`, `transcript.md`/`extract.md`, `deep.md`, `til.md`, `guide.md`).
- Cloudflare Pages 배포.

## 비-목표

- 인증 시스템 (사이트는 무인증 공개, 대시보드는 로컬만).
- 멀티 사용자.
- 모바일 앱.
- PDF/팟캐스트/트위터 입력 (Phase 3 이후).
- 클라우드 기반 LLM 트리거 (전부 로컬).

## 핵심 기술 결정 (요약)

| 영역 | 선택 |
| --- | --- |
| 언어/런타임 | TypeScript / Node 22 / pnpm |
| LLM | Claude Sonnet 4.6 (모든 단계 단일 모델) |
| Whisper | OpenAI `whisper-1` API (옵트인 폴백) |
| 토폴로지 | 로컬 Mac 데몬 + Git Vault |
| Vault 구조 | 플랫폼별 폴더 + 폴더 단위 카드 |
| 저장소 구조 | 단일 public repo (vault 폴더 + Astro 소스 합침) |
| 배포 주기 | 수동 (`pnpm deploy` → Cloudflare deploy hook POST) |
| 번역 정책 | 원본 영어 유지, 산출물만 한국어 |
| 태그 정책 | 하이브리드 학습형 (시드 vocab + LLM 누적) |
| Slug 정책 | YouTube=영어 제목, GitHub=owner-repo (라이브러리 불필요) |
| 토큰 카운팅 | 글자 수 근사치 (`text.length / 4`) |
| URL 처리 | 직렬 (await), in-memory 2회 재시도 |
| 대시보드 | Next.js 15 App Router (로컬 dev only) |
| 공개 사이트 | Astro + Cloudflare Pages |
| 공개 범위 | `published: true` 카드만 |
