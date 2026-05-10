// yt-dlp 가 받아온 VTT 자막을 transcript.md 에 들어갈 평문으로 변환한다.
const TIMESTAMP_RE = /\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/;
const HEADER_RE = /^(WEBVTT|Kind:|Language:|NOTE\b)/;
const HTML_TAG_RE = /<[^>]+>/g;

export function vttToMarkdown(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (HEADER_RE.test(trimmed)) continue;
    if (TIMESTAMP_RE.test(trimmed)) continue;
    // <c> 같은 인라인 마크업 제거.
    const clean = trimmed.replace(HTML_TAG_RE, '').trim();
    if (!clean) continue;
    // 글로벌 dedup. 자동 자막은 같은 큐가 여러 번 등장해 LLM 토큰을 낭비하므로 한 번만 남긴다.
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out.join('\n');
}
