// yt-dlp 가 받아온 VTT 자막을 transcript.md 에 들어갈 평문으로 변환한다.
const TIMESTAMP_RE = /\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/;
const HEADER_RE = /^(WEBVTT|Kind:|Language:|NOTE\b)/;

export function vttToMarkdown(vtt: string): string {
  const raw = vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !HEADER_RE.test(l) && !TIMESTAMP_RE.test(l));
  // 인접 dedup. 짧은 단어 반복 패턴(like "Yes", "OK") 은 멀리 떨어지면 살리되, 큐가 그대로 다음 줄에 반복되면 제거.
  const deduped = raw.filter((l, i) => l !== raw[i - 1]);
  return deduped.join('\n');
}
