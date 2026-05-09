// Telegram 메시지를 받아 whitelist 검증 → URL 파싱 → pipeline 호출 → 답장. 처리 전체에 10 분 타임아웃.
import type { Context } from 'telegraf';
import { parseMessage } from './flags.js';
import type { processUrl as ProcessUrl } from './pipeline.js';

const TEN_MIN_MS = 10 * 60 * 1000;

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
    await ctx.reply('❌ URL 이 없다. YouTube 또는 GitHub URL 을 보내주세요.');
    return;
  }
  try {
    const result = await Promise.race([
      deps.processUrl(parsed, deps.pipelineDeps),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('10 분 타임아웃')), TEN_MIN_MS)),
    ]);
    if (result.kind === 'ok') await ctx.reply(`✅ 카드 생성. \`${result.cardDir}\`. 비공개. Publish 버튼으로 공개.`);
    else if (result.kind === 'duplicate') await ctx.reply(`⚠️ 이미 처리된 URL. \`${result.existingSlug}\`. 재처리하려면 +force 를 붙여 다시 보내주세요.`);
    else if (result.kind === 'unsupported') await ctx.reply('❌ 지원하지 않는 URL 입니다. YouTube 또는 GitHub URL 을 보내주세요.');
    else await ctx.reply(`❌ 처리 실패. ${(result as any).reason}. 부분 결과는 \`${(result as any).cardDir ?? '없음'}\` 에 남아 있다.`);
  } catch (e) {
    await ctx.reply(`❌ ${(e as Error).message}`);
  }
}
