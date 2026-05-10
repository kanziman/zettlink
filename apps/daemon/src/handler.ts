// Telegram 메시지를 받아 whitelist 검증 → URL 파싱 → pipeline 호출 → 답장. 처리 전체에 10 분 타임아웃.
import type { Context } from 'telegraf';
import { parseMessage } from './flags.js';
import type { processUrl as ProcessUrl } from './pipeline.js';

const TEN_MIN_MS = 10 * 60 * 1000;
// Telegram sendMessage 본문은 4096 chars 제한. 다른 텍스트와 합쳐도 넘지 않게 사유 메시지를 넉넉하게 자른다.
const MAX_REASON_CHARS = 1500;

function clip(text: string, max = MAX_REASON_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…(이하 ${text.length - max}자 생략)`;
}

async function safeReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch {
    // reply 실패가 데몬을 죽이지 않도록 삼킨다 (예. 메시지 길이 제한 + 추가 가공 실패 등 환경 문제).
  }
}

export async function handleMessage(
  ctx: Context,
  deps: { allowedUserId: number; processUrl: typeof ProcessUrl; pipelineDeps: Parameters<typeof ProcessUrl>[1] },
): Promise<void> {
  const text = (ctx.message as any)?.text ?? '';
  const fromId = (ctx.message as any)?.from?.id;
  if (fromId !== deps.allowedUserId) return;

  await (ctx as any).react?.('👀').catch(() => {});

  const parsed = parseMessage(text);
  if (!parsed.url) {
    await safeReply(ctx, '❌ URL 이 없다. YouTube 또는 GitHub URL 을 보내주세요.');
    return;
  }
  try {
    const result = await Promise.race([
      deps.processUrl(parsed, deps.pipelineDeps),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('10 분 타임아웃')), TEN_MIN_MS)),
    ]);
    if (result.kind === 'ok') {
      await safeReply(ctx, `✅ 카드 생성. \`${result.cardDir}\`. 비공개. Publish 버튼으로 공개.`);
    } else if (result.kind === 'duplicate') {
      await safeReply(ctx, `⚠️ 이미 처리된 URL. \`${result.existingSlug}\`. 재처리하려면 +force 를 붙여 다시 보내주세요.`);
    } else if (result.kind === 'unsupported') {
      await safeReply(ctx, '❌ 지원하지 않는 URL 입니다. YouTube 또는 GitHub URL 을 보내주세요.');
    } else {
      const reason = clip((result as any).reason ?? 'unknown');
      const cardDir = (result as any).cardDir ?? '없음';
      await safeReply(ctx, `❌ 처리 실패. ${reason}\n부분 결과는 \`${cardDir}\` 에 남아 있다.`);
    }
  } catch (e) {
    await safeReply(ctx, `❌ ${clip((e as Error).message)}`);
  }
}
