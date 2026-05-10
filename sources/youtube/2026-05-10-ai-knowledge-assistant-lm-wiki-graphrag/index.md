---
url: 'https://www.youtube.com/watch?v=YxraHvGzWTs'
platform: youtube
slug: ai-knowledge-assistant-lm-wiki-graphrag
captured_at: '2026-05-10T02:14:01.318Z'
title: 'AI 지식 비서 구축하기: LM Wiki와 GraphRAG로 효율적인 정보 관리'
summary_one_line: >-
  Karpathy의 LM Wiki 개념과 GraphRAG를 결합하여 AI가 모든 정보를 기억하고 효율적으로 관리하는 개인 지식 비서를 구축하는
  방법.
tags:
  - ai
  - knowledge-management
  - lm-wiki
  - claude
  - prompt-engineering
  - graphrag
  - agents
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
Karpathy의 LM Wiki 개념과 GraphRAG를 결합하여 AI가 모든 정보를 기억하고 효율적으로 관리하는 개인 지식 비서를 구축하는 방법.

기존 AI 사용 방식의 문제점은 매번 같은 파일을 반복해서 업로드하고 설명해야 하며, AI가 이전 맥락을 기억하지 못한다는 것이다. 또한 자료가 많아질수록 토큰이 낭비되어 비용이 증가하고 응답 속도가 느려진다. 이러한 문제의 근본적인 해결책이 바로 Andrej Karpathy가 제시한 LM Wiki 개념이다.

LM Wiki의 핵심은 도서관 사서의 업무 방식에서 영감을 얻은 것이다. 도서관 사서는 새 책이 들어오면 전체를 다시 읽지 않고 요약 카드를 만들어 보관한다. 마찬가지로 AI도 파일을 한 번 읽고 위키 형태로 정리한 뒤, 다음에 같은 질문이 들어오면 원본 파일 전체를 다시 읽지 않고 정리된 위키만 참조하면 된다. 이를 통해 토큰 사용을 대폭 줄일 수 있다.

GraphRAG는 이러한 LM Wiki 개념을 자동화하는 도구다. 구조 분석과 의미 분석을 통해 파일을 자동으로 분석하고 지식 지도를 생성한다. 구조 분석은 파일의 내용을 빠르고 정확하게 파악하고, 의미 분석은 여러 서브 에이전트가 동시에 개념들 사이의 관계를 추출한다. 이미지도 분석 가능하며, 최종적으로 Graph.json과 위키폴더가 자동으로 생성된다.

GraphRAG의 핵심 성능은 관계 기반 탐색에 있다. 단순히 개념들이 연결되는 것이 아니라 '~을 바탕으로 만들었다', '~을 참조한다', '~이 근거다' 같은 관계 유형을 구분한다. 또한 신뢰도 표시를 통해 원본에 명시된 내용, 합리적으로 도출한 결론, 불확실한 내용을 구분하여 표시한다. 질문이 들어오면 AI는 전체 파일을 다시 읽지 않고 관련 노드 2~3개만 읽어서 답변하므로, 토큰 사용을 최대 71.5배까지 절감할 수 있다.

실제 구축 방식은 매우 단순하다. Raw 폴더에 원본 파일(기사, 논문, 이미지 등)을 넣고, 위키폴더에는 AI가 만든 위키 파일이 들어간다. Claude.md에 새 파일이 들어오면 위키를 이렇게 업데이트하라는 명령을 입력하면 AI가 알아서 10~15개의 위키 페이지를 업데이트한다. GraphRAG를 사용하면 Graph.json과 자동 요약 페이지까지 생성되며, Claude.md에 이를 연결하면 AI가 질문 전에 자동으로 지도부터 탐색한다.

이 시스템의 가장 큰 장점은 자료가 쌓일수록 AI의 답변 품질이 복리로 향상된다는 점이다. 인간은 위키 유지에 지쳐서 포기하지만, AI는 피로를 느끼지 않으므로 지속적으로 지식을 축적하고 통합할 수 있다. 3개월 동안 읽은 자료들이 모두 위키로 정리되고, 새로운 자료가 추가되면 자동으로 업데이트되며, 이를 기반으로 정확한 답변을 제공한다.

## 인사이트
- AI와 인간의 근본적인 차이는 지쳐서 포기하지 않는다는 점이며, 이를 활용하면 자료가 쌓일수록 지식 비서의 품질이 복리로 성장한다.
- 토큰 사용량을 최대 71.5배 절감하려면 전체 파일을 매번 읽지 말고 이미 정리된 지식 지도에서 관련 노드만 추출해야 한다.
- LM Wiki의 핵심은 도서관 사서처럼 새로운 정보를 기존 체계에 통합하되, AI가 무한 반복 작업을 자동화하는 데 있다.
- GraphRAG는 단순한 개념 연결을 넘어 '근거', '참조', '도출' 같은 관계 유형을 구분하여 AI의 답변에 신뢰도와 출처를 제공한다.
- 폴더와 텍스트 파일만으로도 구현 가능한 단순한 구조이지만, Claude.md의 프롬프트 엔지니어링이 전체 시스템 성능을 좌우한다.
- 새로운 정보가 들어올 때마다 전체를 재분석하지 않고 변경된 파일만 처리하면 되므로 효율성이 기하급수적으로 증가한다.
