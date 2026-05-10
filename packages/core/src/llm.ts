// OpenRouter 경유로 Claude Sonnet 호출. system block 에 prompt caching 을 적용하고, JSON 출력을 Zod 로 검증한다.
import { z } from 'zod';
import type OpenAI from 'openai';
import { AUTO_SUMMARY_SYSTEM, buildAutoSummaryUser } from './prompts/auto-summary.js';
import { DEEP_SYSTEM, buildDeepUser } from './prompts/deep.js';
import { TIL_SYSTEM, buildTilUser } from './prompts/til.js';
import { GUIDE_SYSTEM, buildGuideUser } from './prompts/guide.js';

export const AutoSummaryResultSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary_one_line: z.string().min(1),
  summary_body: z.string().min(1),
  insights: z.array(z.string()).min(1),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(10),
});
export type AutoSummaryResult = z.infer<typeof AutoSummaryResultSchema>;

interface RunInput {
  transcript: string;
  tagHints: string;
  truncated: boolean;
  modelId: string;
}

// 모델이 가끔 ```json … ``` 코드펜스로 감싸 보내는 경우를 흡수한다.
export function stripJsonFence(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (m?.[1] ?? text).trim();
}

// 응답 전체가 ```markdown … ``` (또는 언어 표시 없는 ```) 으로 감싸 올 때만 안쪽을 꺼낸다.
// 본문 안에 자연스럽게 들어간 코드펜스는 건드리지 않는다.
export function stripWrappingMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return (m?.[1] ?? trimmed).trim();
}

export type ArtifactKind = 'deep' | 'til' | 'guide';

interface ArtifactInput {
  kind: ArtifactKind;
  transcript: string;
  modelId: string;
}

const ARTIFACT_PROMPTS: Record<ArtifactKind, { sys: string; user: (t: string) => string }> = {
  deep: { sys: DEEP_SYSTEM, user: buildDeepUser },
  til: { sys: TIL_SYSTEM, user: buildTilUser },
  guide: { sys: GUIDE_SYSTEM, user: buildGuideUser },
};

// deep / til / guide 산출물 생성. 자유 마크다운 응답을 그대로 돌려주되, 전체를 감싼 코드펜스만 벗긴다.
export async function runArtifact(client: OpenAI, input: ArtifactInput): Promise<string> {
  const cfg = ARTIFACT_PROMPTS[input.kind];
  const messages = [
    {
      role: 'system' as const,
      content: [{ type: 'text', text: cfg.sys, cache_control: { type: 'ephemeral' } }],
    },
    { role: 'user' as const, content: cfg.user(input.transcript) },
  ];
  const resp = await client.chat.completions.create({
    model: input.modelId,
    max_tokens: 8192,
    messages: messages as any,
  });
  const text = resp.choices[0]?.message?.content;
  if (!text || !text.trim()) throw new Error(`${input.kind} 응답에 본문이 없다.`);
  return stripWrappingMarkdownFence(text);
}

export async function runAutoSummary(client: OpenAI, input: RunInput): Promise<AutoSummaryResult> {
  // OpenRouter 의 Anthropic 모델은 system message 를 content 배열 + cache_control 로 캐싱 가능. OpenAI SDK 타입 정의에 cache_control 이 없어 as any 로 통과.
  const messages = [
    {
      role: 'system' as const,
      content: [
        { type: 'text', text: AUTO_SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
    },
    { role: 'user' as const, content: buildAutoSummaryUser(input) },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await client.chat.completions.create({
      model: input.modelId,
      max_tokens: 4096,
      messages: messages as any,
    });
    const text = resp.choices[0]?.message?.content ?? '';
    if (!text) throw new Error('OpenRouter 응답에 본문이 없다');
    try {
      return AutoSummaryResultSchema.parse(JSON.parse(stripJsonFence(text)));
    } catch (e) {
      if (attempt === 1) throw new Error(`자동 요약 LLM 출력 검증 실패. ${(e as Error).message}`);
    }
  }
  throw new Error('unreachable');
}
