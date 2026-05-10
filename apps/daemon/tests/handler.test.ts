// whitelist 분기 + reaction + reply 호출을 검증. processUrl 은 mock.
import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/handler.js';

const baseCtx = (text: string, userId: number) => ({
  message: { text, from: { id: userId } },
  react: vi.fn().mockResolvedValue(undefined),
  reply: vi.fn().mockResolvedValue(undefined),
});

describe('handleMessage', () => {
  it('whitelist 가 아니면 무시 (reply / react / processUrl 모두 호출 안 함)', async () => {
    const ctx = baseCtx('https://youtu.be/x', 999);
    const processUrl = vi.fn();
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(processUrl).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.react).not.toHaveBeenCalled();
  });

  it('지원하지 않는 URL 이면 안내 답장', async () => {
    const ctx = baseCtx('https://example.com', 1);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'unsupported' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('지원하지 않는 URL'));
  });

  it('성공 시 vault 경로 + 비공개 안내', async () => {
    const ctx = baseCtx('https://youtu.be/x', 1);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'ok', cardDir: '/tmp/vault/sources/youtube/2026-05-09-x', cardSlug: 'x' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(ctx.react).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('카드 생성'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/tmp/vault/sources/youtube/2026-05-09-x'));
  });

  it('중복 시 ⚠️ 메시지', async () => {
    const ctx = baseCtx('https://youtu.be/x', 1);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'duplicate', existingSlug: 'foo' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('이미 처리된 URL'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('foo'));
  });

  it('실패 시 ❌ + 사유', async () => {
    const ctx = baseCtx('https://youtu.be/x', 1);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'failed', reason: '추출 실패', cardDir: '/tmp/x' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('처리 실패'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('추출 실패'));
  });

  it('URL 이 없으면 안내 답장', async () => {
    const ctx = baseCtx('그냥 메모', 1);
    const processUrl = vi.fn();
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('URL'));
    expect(processUrl).not.toHaveBeenCalled();
  });

  it('실패 사유가 매우 길어도 reply 텍스트는 4096 자 이내로 잘린다', async () => {
    const ctx = baseCtx('https://youtu.be/x', 1);
    const huge = 'x'.repeat(50_000);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'failed', reason: huge, cardDir: '/tmp/x' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any });
    const sent = (ctx.reply as any).mock.calls[0][0] as string;
    expect(sent.length).toBeLessThan(4096);
    expect(sent).toContain('처리 실패');
  });

  it('reply 가 throw 해도 데몬은 죽지 않는다 (safeReply 가 삼킨다)', async () => {
    const ctx = baseCtx('https://youtu.be/x', 1);
    ctx.reply = vi.fn().mockRejectedValue(new Error('400: text is too long')) as any;
    const processUrl = vi.fn().mockResolvedValue({ kind: 'failed', reason: 'boom', cardDir: '/tmp/x' });
    await expect(
      handleMessage(ctx as any, { allowedUserId: 1, processUrl, pipelineDeps: {} as any }),
    ).resolves.toBeUndefined();
  });
});
