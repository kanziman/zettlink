import { describe, it, expect, vi } from 'vitest';
import { commitAndPushWithRetry } from '../src/git.js';

describe('commitAndPushWithRetry', () => {
  it('첫 push 성공 시 1번만 호출한다', async () => {
    const git = { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) };
    await commitAndPushWithRetry(git as any, ['a.md'], 'm');
    expect(git.push).toHaveBeenCalledTimes(1);
  });

  it('push 실패 시 5초 간격(테스트는 0ms)으로 2회 재시도한 후 throw 한다', async () => {
    const git = {
      add: vi.fn().mockResolvedValue({}),
      commit: vi.fn().mockResolvedValue({}),
      push: vi.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(commitAndPushWithRetry(git as any, ['a.md'], 'm', { delayMs: 0 })).rejects.toThrow();
    expect(git.push).toHaveBeenCalledTimes(3);   // 첫 시도 + 재시도 2번
  });

  it('재시도 중 성공하면 throw 하지 않는다', async () => {
    const push = vi.fn().mockRejectedValueOnce(new Error('first')).mockResolvedValue({});
    const git = { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push };
    await commitAndPushWithRetry(git as any, ['a.md'], 'm', { delayMs: 0 });
    expect(push).toHaveBeenCalledTimes(2);
  });
});
