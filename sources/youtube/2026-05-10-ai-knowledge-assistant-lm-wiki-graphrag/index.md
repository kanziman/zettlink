---
url: 'https://www.youtube.com/watch?v=YxraHvGzWTs'
platform: youtube
slug: ai-knowledge-assistant-lm-wiki-graphrag
captured_at: '2026-05-10T03:04:33.487Z'
title: 'AI 지식 비서 만들기: LM Wiki와 GraphRAG로 토큰 71.5배 절감하기'
summary_one_line: >-
  LM Wiki 개념과 GraphRAG 도구를 활용하여 AI가 문맥을 기억하고 토큰 소비를 대폭 줄이면서 지속적으로 성장하는 지식 비서를
  구축하는 방법.
tags:
  - knowledge-management
  - graph-rag
  - ai-memory
  - token-optimization
  - prompt-engineering
  - semantic-analysis
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
  upload_date: '2026-04-09'
  duration_sec: 373
  thumbnail: 'https://i.ytimg.com/vi/YxraHvGzWTs/maxresdefault.jpg'
  subtitle_source: auto
---
LM Wiki 개념과 GraphRAG 도구를 활용하여 AI가 문맥을 기억하고 토큰 소비를 대폭 줄이면서 지속적으로 성장하는 지식 비서를 구축하는 방법.

## AI의 문맥 상실 문제

AI는 매번 새로운 질문을 받을 때마다 과거 정보를 잃어버린다. 같은 질문을 반복하면 파일을 처음부터 다시 읽어야 하므로 토큰 낭비와 속도 저하가 발생한다. 이러한 비효율적인 방식은 자료가 증가할수록 악화되며, 실제로 대규모 문서를 다룰 때 큰 비용 부담이 된다.

## LM Wiki 개념: 도서관 사서 비유

테슬라 AI 팀 출신의 카파시가 제안한 LM Wiki는 간단한 원리에 기반한다. 도서관 사서가 책을 읽고 요약 카드를 만들어 두듯이, AI도 한 번 읽은 파일을 위키 형태로 정리한다. 새로운 파일이 추가되면 기존 위키 페이지를 업데이트하며, 나중에 질문받을 때는 원본 파일이 아닌 위키만 참조한다. AI는 지치지 않으므로 유지보수 비용이 거의 제로에 가까워진다.

## 구현 구조: 세 가지 요소

LM Wiki 구현은 매우 간단하다. 첫째, 원본 파일을 저장하는 폴더, 둘째, AI가 생성한 위키 파일들, 셋째, 위키 관리 방식을 지시하는 Claude.md 파일이 필요하다. Claude.md에 명령을 입력하면 AI가 자동으로 위키를 업데이트하고, 다음 질문 시에는 인덱스.md를 먼저 확인한 후 관련 페이지만 읽는다.

## GraphRAG: 지식 지도의 자동화

GraphRAG는 카파시 방식의 문제점을 해결한다. 기존 방식에서는 질문할 때마다 원본 파일 전체를 뒤져야 하지만, GraphRAG는 파일을 자동 분석하여 지식 지도를 생성한다. 구조 분석과 의미 분석을 통해 graph.json과 위키폴더, 그리고 전체 요약 페이지가 자동으로 생성된다.

## 토큰 절감과 성능 향상

GraphRAG 사용 시 원본 파일 7개를 직접 읽을 때와 비교하면 최대 71.5배의 토큰을 절감할 수 있다. AI는 요약 페이지에서 핵심 개념을 파악한 후 관련 노드 2~3개만 읽으면 된다. 자료가 쌓일수록 개념 간 연결이 풍부해져 답변 품질이 복리로 성장한다.

## 관계 기반 지식 표현과 신뢰도

GraphRAG의 핵심은 개념 간의 관계를 명확히 표현하는 것이다. "만들었다", "참조한다", "근거다" 같은 관계 유형을 구분하므로 AI가 답변의 근거를 명시할 수 있다. 신뢰도 표시(확실함·추론·불확신)를 통해 원본 기반 정보와 추론 정보를 구분하여 답변한다. 비슷한 개념들이 자동으로 그룹화되어 관련 그룹만 선택적으로 처리된다.

## 실제 구축 방법과 프롬프팅

GraphRAG를 사용할 때는 Claude.md에서 graph.json 파일을 읽고 관련 노드만 참조하도록 상세한 프롬프팅을 지시해야 한다. 이러한 세부 지시사항을 입력하면 그 이후 프로세스는 자동으로 작동한다. 최종적으로 이를 통해 3개월간의 자료를 모두 정리한 위키 기반으로, 자동 업데이트되는 나만의 기억하는 AI 지식 비서를 구축할 수 있다.

## 인사이트
- AI의 문맥 상실 문제는 단순히 재업로드의 불편함을 넘어 토큰 낭비로 인한 직접적인 비용 손실을 야기한다.
- LM Wiki는 인간이 포기하기 쉬운 반복적인 정보 관리 작업을 AI가 대신함으로써 비로소 현실화된다.
- GraphRAG의 구조·의미 분석을 통한 지식 지도는 쿼리 시 최대 71.5배의 토큰 절감을 가능하게 한다.
- 관계 기반 그래프 표현은 단순 연결을 넘어 AI의 추론 근거를 명시하고 신뢰도를 구분하게 한다.
- 자료가 축적될수록 개념 간 연결이 강화되어 답변 품질이 복리로 성장하는 선순환 구조가 형성된다.
- 폴더와 텍스트 파일만으로 구현 가능한 단순한 구조는 기술적 진입장벽을 극도로 낮춘다.
