// OpenRouter (OpenAI SDK 호환) 래퍼 runAutoSummary 의 동작을 SDK 모킹으로 검증한다.
import { describe, it, expect, vi } from 'vitest';
import { runAutoSummary, AutoSummaryResultSchema, stripJsonFence } from '../src/llm.js';

describe('runAutoSummary', () => {
  it('OpenRouter 응답을 Zod 로 검증해 정상 객체를 돌려준다', async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({
              title: 'T', slug: 't', summary_one_line: 'S', summary_body: 'B',
              insights: ['i1'], tags: ['ai'],
            }) } }],
          }),
        },
      },
    };
    const r = await runAutoSummary(fakeClient as any, {
      transcript: 'hello',
      tagHints: '',
      truncated: false,
      modelId: 'anthropic/claude-sonnet-4.6',
    });
    expect(AutoSummaryResultSchema.parse(r)).toBeTruthy();
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });

  it('```json 코드펜스로 감싼 응답도 파싱해 정상 객체를 돌려준다', async () => {
    const fenced = '```json\n' + JSON.stringify({
      title: 'T', slug: 't', summary_one_line: 'S', summary_body: 'B',
      insights: ['i1'], tags: ['ai'],
    }) + '\n```';
    const fakeClient = {
      chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: fenced } }] }) } },
    };
    const r = await runAutoSummary(fakeClient as any, {
      transcript: 'hello', tagHints: '', truncated: false, modelId: 'anthropic/claude-sonnet-4.6',
    });
    expect(r.title).toBe('T');
  });

  it('JSON parse 실패 시 1회 재시도한 후 throw 한다', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'still not' } }] });
    const fakeClient = { chat: { completions: { create } } };
    await expect(runAutoSummary(fakeClient as any, {
      transcript: 'hello', tagHints: '', truncated: false, modelId: 'anthropic/claude-sonnet-4.6',
    })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('stripJsonFence', () => {
  it('```json … ``` 으로 감싼 텍스트는 펜스 안쪽만 반환한다', () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('언어 표시 없는 ``` 펜스도 처리한다', () => {
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('펜스가 없으면 원문 trim 만 한다', () => {
    expect(stripJsonFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});
