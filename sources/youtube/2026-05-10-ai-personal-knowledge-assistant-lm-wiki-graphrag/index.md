---
url: 'https://www.youtube.com/watch?v=YxraHvGzWTs'
platform: youtube
slug: ai-personal-knowledge-assistant-lm-wiki-graphrag
captured_at: '2026-05-10T02:55:34.312Z'
title: 'AI가 기억하는 나만의 지식 비서 만드는 방법: LM Wiki와 GraphRAG'
summary_one_line: 카파시의 LM Wiki 개념과 GraphRAG 도구를 활용하여 AI가 모든 정보를 기억하고 관리하는 개인 지식 비서 시스템을 구축하는 방법.
tags:
  - ai
  - knowledge-management
  - lm-wiki
  - graphrag
  - agents
  - prompt-engineering
  - personal-assistant
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
  truncated: false
youtube:
  video_id: YxraHvGzWTs
  channel: 메이커 에반 | Maker Evan
  title: 카파시가 공개한 wiki 구축법
  duration_sec: 373
  thumbnail: 'https://i.ytimg.com/vi/YxraHvGzWTs/maxresdefault.jpg'
  subtitle_source: auto
---
카파시의 LM Wiki 개념과 GraphRAG 도구를 활용하여 AI가 모든 정보를 기억하고 관리하는 개인 지식 비서 시스템을 구축하는 방법.

기존 AI 사용 방식은 매번 같은 파일을 반복해서 업로드하고 설명해야 하는 비효율성이 있습니다. 이는 토큰 낭비로 이어지고 처리 속도도 느려집니다. 테슬라 AI 팀 출신의 카파시가 제안한 LM Wiki는 도서관 사서가 책을 요약 카드로 정리하는 것처럼, AI가 읽은 내용을 위키 형태로 정리하고 재사용하는 개념입니다.

LM Wiki 시스템은 원본 파일, AI가 생성한 위키, 그리고 관리 방법을 담은 Claude.md 세 가지 요소만으로 구성됩니다. 새로운 자료가 들어오면 AI가 기존 위키를 자동으로 업데이트하며, 질문할 때는 원본 파일 전체가 아닌 위키 페이지만 참조합니다. 카파시는 이 방식의 핵심을 "유지 보수 비용이 거의 제로에 가깝다"고 설명했는데, AI는 지치지 않기 때문에 인간이 포기했던 복잡한 정보 관리를 대신 수행할 수 있기 때문입니다.

GraphRAG는 LM Wiki 개념의 한계를 보완합니다. 질문할 때마다 AI가 원본 파일 전체를 검색해야 하는 비효율성을 해결하기 위해 자동으로 지식 지도를 생성합니다. 구조 분석과 의미 분석이라는 두 가지 방식으로 파일과 이미지를 분석하며, 여러 서브 에이전트가 동시에 개념 간의 관계를 추출합니다. 결과물은 graph.json, 위키폴더, 그리고 전체 요약 페이지입니다.

GraphRAG의 효율성은 숫자로 증명됩니다. 원본 파일 7개를 직접 읽는 대신 전체 지식 지도 한 페이지와 관련 노드 2~3개만 읽으면 되어 토큰 사용을 최대 71.5배 줄일 수 있습니다. 이는 그래프 레포트라는 파일에 전체 지식 지도가 요약되어 있기 때문입니다. GraphRAG는 단순한 연결뿐 아니라 개념 간의 관계 유형도 파악하여 "근거가 무엇인가"에 답할 수 있으며, 신뢰도 표시로 확실한 내용과 추론 내용을 구분할 수 있습니다.

실제 구현은 매우 간단합니다. 카파시 방식은 폴더와 텍스트 파일만으로 충분하며, 원본 파일을 Raw 폴더에, AI가 생성한 위키를 Wiki 폴더에, 관리 지침을 Claude.md에 작성하면 됩니다. GraphRAG를 추가하면 지식 지도가 자동으로 생성되고, Claude.md에 "질문 전에 요약 페이지를 먼저 봐라"는 한 줄의 프롬프트만 추가하면 AI가 자동으로 지도를 탐색한 후 답변합니다. 중요한 것은 Claude.md에서 GraphRAG의 명령어를 사용하지 말고 graph.json 파일만 읽도록 세밀한 프롬프팅을 해야 한다는 점입니다.

이 시스템의 최대 장점은 자료가 쌓일수록 AI 답변 품질이 복리로 성장한다는 것입니다. 개인이 3개월 동안 읽은 모든 자료를 AI가 위키로 정리하고 관리하며, 새로운 자료가 추가되면 자동으로 업데이트됩니다. 결과적으로 "기억하는 개인 비서"가 완성되어 회사 문서, 개인 공부 노트, 책 정리 등 다양한 작업에 활용할 수 있습니다.

## 인사이트
- 기존 AI 사용 방식의 핵심 문제는 매번 같은 파일을 반복 처리하면서 토큰 낭비와 속도 저하가 발생한다는 것입니다.
- LM Wiki는 인간이 지치는 정보 유지 보수 작업을 AI가 대신 수행하도록 설계되어 유지 비용을 거의 제로에 가깝게 만듭니다.
- GraphRAG는 관계 기반 지식 지도를 통해 토큰 사용을 최대 71.5배 절감하면서도 근거 있는 답변을 가능하게 합니다.
- 신뢰도 표시 시스템으로 AI가 명확한 사실과 추론 내용을 구분하여 제시함으로써 답변의 신뢰성을 높입니다.
- 개념 간 관계 유형 분석을 통해 "왜 그렇게 되는가"라는 질문에 대한 원인과 근거를 자동으로 제공합니다.
- 자료가 축적될수록 AI 답변 품질이 복리로 성장하는 구조를 통해 시간이 지날수록 더 강력한 지식 비서가 만들어집니다.
