// Anthropic 래퍼 runAutoSummary 의 동작을 SDK 모킹으로 검증하는 테스트.
import { describe, it, expect, vi } from 'vitest';
import { runAutoSummary, AutoSummaryResultSchema } from '../src/llm.js';

describe('runAutoSummary', () => {
  it('Anthropic 응답을 Zod 로 검증해 정상 객체를 돌려준다', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            title: 'T', slug: 't', summary_one_line: 'S', summary_body: 'B',
            insights: ['i1'], tags: ['ai'],
          }) }],
        }),
      },
    };
    const r = await runAutoSummary(fakeClient as any, {
      transcript: 'hello',
      tagHints: '',
      truncated: false,
      modelId: 'claude-sonnet-4-6',
    });
    expect(AutoSummaryResultSchema.parse(r)).toBeTruthy();
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
  });

  it('JSON parse 실패 시 1회 재시도한 후 throw 한다', async () => {
    const create = vi.fn().mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'still not' }] });
    const fakeClient = { messages: { create } };
    await expect(runAutoSummary(fakeClient as any, {
      transcript: 'hello', tagHints: '', truncated: false, modelId: 'claude-sonnet-4-6',
    })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
