// URL의 플랫폼을 감지하고 중복 검사용 표준 형태로 정규화한다.

export type Platform = 'youtube' | 'github';

export type NormalizedUrl =
  | { platform: 'youtube'; videoId: string; canonical: string }
  | { platform: 'github'; owner: string; repo: string; canonical: string };

const YT_LONG = /^https?:\/\/(www\.)?youtube\.com\/watch\?/;
const YT_SHORT = /^https?:\/\/youtu\.be\//;
const GH = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/;

export function detectPlatform(url: string): Platform | null {
  if (YT_LONG.test(url) || YT_SHORT.test(url)) return 'youtube';
  if (GH.test(url)) return 'github';
  return null;
}

export function normalizeUrl(url: string): NormalizedUrl | null {
  const platform = detectPlatform(url);
  if (platform === 'youtube') {
    let videoId: string | null = null;
    if (YT_LONG.test(url)) {
      videoId = new URL(url).searchParams.get('v');
    } else {
      const m = url.match(/youtu\.be\/([^?#/]+)/);
      videoId = m?.[1] ?? null;
    }
    if (!videoId) return null;
    return { platform: 'youtube', videoId, canonical: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (platform === 'github') {
    const m = url.match(GH);
    if (!m) return null;
    const [, owner, repo] = m;
    return { platform: 'github', owner: owner!, repo: repo!, canonical: `https://github.com/${owner}/${repo}` };
  }
  return null;
}
