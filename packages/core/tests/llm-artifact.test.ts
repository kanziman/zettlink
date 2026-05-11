// runArtifact 가 OpenRouter 응답 본문을 그대로 돌려주고 코드펜스를 흡수하는지 검증한다.
import { describe, it, expect, vi } from 'vitest';
import { runArtifact } from '../src/llm.js';

function fakeClient(content: string | null, calls: ReturnType<typeof vi.fn>) {
  return {
    chat: {
      completions: {
        create: calls.mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  };
}

describe('runArtifact', () => {
  it('deep / til / guide 별 system prompt 로 호출하고 본문을 그대로 돌려준다', async () => {
    for (const kind of ['deep', 'til', 'guide'] as const) {
      const create = vi.fn();
      const client = fakeClient('## 본문\n내용', create);
      const md = await runArtifact(client as any, {
        kind,
        transcript: '원문',
        modelId: 'anthropic/claude-sonnet-4.6',
      });
      expect(md).toBe('## 본문\n내용');
      const args = create.mock.calls[0]?.[0];
      expect(args.model).toBe('anthropic/claude-sonnet-4.6');
      const sys = args.messages[0];
      expect(sys.role).toBe('system');
      expect(sys.content[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(sys.content[0].text).toMatch(/한국어/);
    }
  });

  it('전체 응답이 ```markdown … ``` 코드펜스로 감싸 오면 펜스를 벗긴다', async () => {
    const create = vi.fn();
    const client = fakeClient('```markdown\n## 헤더\n본문\n```', create);
    const md = await runArtifact(client as any, {
      kind: 'deep',
      transcript: '원문',
      modelId: 'm',
    });
    expect(md).toBe('## 헤더\n본문');
  });

  it('빈 응답 본문이면 throw 한다', async () => {
    const create = vi.fn();
    const client = fakeClient('', create);
    await expect(
      runArtifact(client as any, { kind: 'til', transcript: '원문', modelId: 'm' }),
    ).rejects.toThrow();
  });

  it('content 가 null 인 응답도 throw 한다', async () => {
    const create = vi.fn();
    const client = fakeClient(null, create);
    await expect(
      runArtifact(client as any, { kind: 'guide', transcript: '원문', modelId: 'm' }),
    ).rejects.toThrow();
  });
});
