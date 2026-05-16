# PRD: zettlink

## 목표

YouTube 영상과 GitHub 저장소를 Telegram에 던지면 자동으로 요약·인사이트·태그가 생성되고, 학습한 내용을 TIL/가이드로 발전시켜 공개하는 **1인 지식 관리 도구**.

## 사용자

1인 운영자 (개발자 본인). 모바일에서 흥미로운 콘텐츠를 접하는 순간이 잦지만, 다시 찾아 읽지 않으면 휘발되는 문제를 해결하려는 사람.

## 핵심 기능

1. **캡처** — Telegram bot에 YouTube/GitHub URL을 던지면 즉시 큐잉.
2. **자동 처리** — Mac 로컬 worker가 URL 감지 → 자막/저장소 내용 추출 → Claude Sonnet 4.6으로 요약·인사이트·태그 생성 → Supabase 저장 + (옵션) vault/.md export + git push.
3. **탐색·심화** — 모바일/노트북 어디서든 admin-gated 대시보드(Vercel)에서 카드 리스트·필터·검색. 흥미로운 카드는 "심화 요약 / TIL / 실용 가이드" 버튼 클릭 → LLM 호출로 발전.
4. **발행** — 검토 후 `published` 토글 → `pnpm deploy`로 Vercel 공개 사이트 재빌드 → 정적 페이지에 반영.

## MVP 제외 사항

- 멀티 사용자 / 모바일 앱 / PDF·팟캐스트·트위터 등 추가 입력 소스.
- 사이트 인증 (공개 사이트는 anon read, 대시보드만 Supabase Auth + admin user_id whitelist).
- 클라우드 워커 (전부 로컬 Mac).
- Whisper API 기반 음성 변환 (Phase 1은 자막 있는 영상만, Phase 4에서 whisper.cpp 로컬).
- 멀티 LLM (Claude Sonnet 4.6 단일).

## 디자인

- 다크/라이트 자동 (`next-themes`). 본문은 한국어, 원본 인용은 영어 유지.
- Pretendard + Wanted Montage 디자인 시스템 (`docs/DESIGN.md`).
- 대시보드와 공개 사이트가 `packages/ui`로 컴포넌트 100% 공유.

## 비기능 요구사항

- **비용 가드:** 일일 LLM 비용 상한 (`config.budget.daily_usd`) 초과 시 즉시 차단.
- **재해 복구:** Supabase ↔ vault/.md 양방향 sync 스크립트로 어느 쪽 손실에도 복구 가능.
- **관측성:** `events` 테이블 + pino 로그로 모든 단계 추적.
- **인증:** admin 1명 (`ADMIN_USER_IDS`), middleware에서 차단.
