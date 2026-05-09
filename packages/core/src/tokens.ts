// 토큰을 글자 수로 근사하고, transcript 가 너무 길 때 head + tail 만 남기는 유틸.
const SEP = '\n\n...[truncated]...\n\n';
const TOKENS_PER_CHAR = 1 / 4;

export function approxTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

export function headTailTruncate(text: string, tokenLimit: number): { text: string; truncated: boolean } {
  if (approxTokens(text) <= tokenLimit) return { text, truncated: false };
  const halfTokens = Math.floor((tokenLimit - approxTokens(SEP)) / 2);
  const halfChars = halfTokens * 4;
  const head = text.slice(0, halfChars);
  const tail = text.slice(-halfChars);
  return { text: head + SEP + tail, truncated: true };
}
