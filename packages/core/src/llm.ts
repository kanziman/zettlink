// Anthropic Sonnet 4.6 호출 래퍼. system block 에 prompt caching 을 적용하고, JSON 출력을 Zod 로 검증한다.
import { z } from 'zod';
import type { default as Anthropic, Message } from '@anthropic-ai/sdk';
import { AUTO_SUMMARY_SYSTEM, buildAutoSummaryUser } from './prompts/auto-summary.js';

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

function extractText(resp: Message): string {
  for (const block of resp.content) if (block.type === 'text') return block.text;
  throw new Error('Anthropic 응답에 text 블록이 없다');
}

export async function runAutoSummary(client: Anthropic, input: RunInput): Promise<AutoSummaryResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await client.messages.create({
      model: input.modelId,
      max_tokens: 4096,
      system: [{ type: 'text', text: AUTO_SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildAutoSummaryUser(input) }],
    });
    const text = extractText(resp);
    try {
      return AutoSummaryResultSchema.parse(JSON.parse(text));
    } catch (e) {
      if (attempt === 1) throw new Error(`자동 요약 LLM 출력 검증 실패. ${(e as Error).message}`);
    }
  }
  throw new Error('unreachable');
}
