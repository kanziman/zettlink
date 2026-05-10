---
url: 'https://www.youtube.com/watch?v=YxraHvGzWTs'
platform: youtube
slug: lm-wiki-ai-knowledge-assistant
captured_at: '2026-05-10T02:06:50.017Z'
title: LM Wiki를 활용한 AI 지식 어시스턴트 구축하기
summary_one_line: AI가 문서를 반복해서 읽지 않도록 LM Wiki 개념으로 지식을 체계적으로 구성하여 토큰 비용을 줄이고 응답 속도를 높이는 방법.
tags:
  - ai
  - knowledge-management
  - claude
  - productivity
  - lm-wiki
  - prompt-engineering
status: summarized
reviewed: false
published: false
note: ''
generated:
  deep: false
  til: false
  guide: false
llm:
  model: anthropic/claude-haiku-4.5
  truncated: true
youtube:
  video_id: YxraHvGzWTs
  channel: 메이커 에반 | Maker Evan
  title: 카파시가 공개한 wiki 구축법
  duration_sec: 373
  thumbnail: 'https://i.ytimg.com/vi_webp/YxraHvGzWTs/maxresdefault.webp'
  subtitle_source: auto
---
AI가 문서를 반복해서 읽지 않도록 LM Wiki 개념으로 지식을 체계적으로 구성하여 토큰 비용을 줄이고 응답 속도를 높이는 방법.

현재 대부분의 사람들은 AI를 비효율적으로 사용하고 있습니다. 파일을 업로드하고 질문하고 답변을 받은 후 채팅 창을 닫으면, 다음 날 같은 질문을 할 때 AI는 처음부터 모든 파일을 다시 읽어야 합니다. 이는 토큰 낭비, 비용 증가, 처리 속도 저하를 초래합니다.

이 문제의 해결책은 테슬라 AI팀의 카팟시가 제시한 'LM Wiki' 개념입니다. 마치 도서관 사서가 책을 읽고 요약 카드를 만들어 나중에 카드만 참고하듯이, AI도 문서를 한 번 읽고 그 내용을 위키 형식으로 정리한 후 재사용하는 방식입니다. 각 개념은 별도 페이지를 가지며 페이지들이 상호 링크되어 있고, 새로운 데이터가 들어오면 기존 위키 페이지를 업데이트합니다.

Graphi라는 도구는 이 LM Wiki 개념을 자동화합니다. 파일들을 분석하여 그래프 형태의 지식 맵을 생성하고 JSON 형식으로 저장합니다. Claude에 간단한 한 줄 명령어만 추가하면 AI가 먼저 요약 페이지(index.md)의 목차를 확인한 후 관련 페이지만 읽고 답변하도록 설정할 수 있습니다.

이 방식의 장점은 놀랍습니다. 토큰 사용량이 최대 71.5배 감소하고 응답 속도는 5배 향상됩니다. 데이터가 쌓일수록 AI의 답변 품질이 자동으로 개선되는 '복리' 효과도 얻을 수 있습니다. 회사 문서, 개인 학습 노트, 책 등 다양한 자료를 조직화하여 진정한 의미의 기억하는 AI 어시스턴트를 만들 수 있습니다.

## 인사이트
- 현재의 AI 사용 방식은 매번 전체 문서를 다시 읽게 해서 토큰 낭비와 느린 속도를 초래한다.
- LM Wiki는 AI가 한 번 읽은 내용을 체계적으로 정리해 재사용하는 방식으로, 사서의 요약 카드 개념과 동일하다.
- 지식이 축적될수록 AI의 응답 품질이 자동으로 향상되는 복리 효과를 얻을 수 있다.
- Graphi를 사용하면 토큰 비용을 최대 71.5배 절감하고 응답 속도를 5배 향상시킬 수 있다.
- index.md의 목차만 먼저 읽도록 설정하면 AI가 자동으로 관련 페이지만 참고하여 답변한다.
- 폴더와 텍스트 파일만으로도 구현 가능하므로 별도의 복잡한 시스템이 필요 없다.
