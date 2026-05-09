// Telegram 메시지에서 첫 URL · 플래그 · 부가 메모를 분리한다.
const URL_RE = /https?:\/\/[^\s]+/;

export interface ParsedMessage {
  url: string | null;
  flags: { force: boolean; whisper: boolean };
  note: string;
}

export function parseMessage(text: string): ParsedMessage {
  const urlMatch = text.match(URL_RE);
  const url = urlMatch?.[0] ?? null;
  const force = /\+force\b/.test(text);
  const whisper = /\+whisper\b/.test(text);
  let note = text;
  if (url) note = note.replace(url, '');
  note = note.replace(/\+force\b/g, '').replace(/\+whisper\b/g, '').trim().replace(/\s+/g, ' ');
  return { url, flags: { force, whisper }, note };
}
