// 태그 vocabulary 의 시드와 기존 vault 태그 빈도 집계, LLM system prompt 주입용 포맷터.
export const SEED_VOCAB = ['ai', 'agents', 'claude', 'codex', 'productivity'] as const;

export function computeTagFrequency(cards: Array<{ tags: string[] }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) for (const t of c.tags) out[t] = (out[t] ?? 0) + 1;
  return out;
}

export function formatTagHints(frequency: Record<string, number>): string {
  const merged: Record<string, number> = { ...frequency };
  for (const s of SEED_VOCAB) merged[s] ??= 0;
  const sorted = Object.entries(merged).sort((a, b) => b[1] - a[1]);
  const lines = sorted.map(([t, n]) => `- ${t} (${n})`);
  return `기존 vault 에서 사용된 태그 (괄호 안은 빈도)\n${lines.join('\n')}\n\n새 태그가 필요한 경우에만 추가하라.`;
}
