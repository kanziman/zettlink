// yt-dlp 가 받아온 VTT 자막을 transcript.md 에 들어갈 평문으로 변환한다.
const TIMESTAMP_RE = /\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/;
const HEADER_RE = /^(WEBVTT|Kind:|Language:|NOTE\b)/;
const HTML_TAG_RE = /<[^>]+>/g;

export function vttToMarkdown(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const seen = new Set<string>();
  const cues: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (HEADER_RE.test(trimmed)) continue;
    if (TIMESTAMP_RE.test(trimmed)) continue;
    // <c>, <00:00:01.000> 같은 인라인 마크업 제거.
    const clean = trimmed.replace(HTML_TAG_RE, '').trim();
    if (!clean) continue;
    // 글로벌 dedup. 자동 자막은 같은 큐가 여러 번 등장해 LLM 토큰을 낭비하므로 한 번만 남긴다.
    if (seen.has(clean)) continue;
    seen.add(clean);
    cues.push(clean);
  }
  // 큐 사이를 공백으로 이어 한 문단으로 만든다 (cue 단위 줄바꿈은 자동 자막에서 의미 없는 위치에 끊김).
  const merged = cues.join(' ').replace(/\s+/g, ' ').trim();
  // 종결자 직후 공백 없이 다른 글자가 붙은 경우 (예. "말이죠.이 이") 공백 삽입.
  const spaced = merged.replace(/([.!?。！？])([^\s.!?。！？])/g, '$1 $2');
  // 종결자 + 공백 → 종결자 + 줄바꿈. 종결자 없는 텍스트는 한 줄.
  return spaced.replace(/([.!?。！？])\s+/g, '$1\n');
}
