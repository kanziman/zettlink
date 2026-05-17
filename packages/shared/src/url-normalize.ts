// URL을 플랫폼별 canonical form으로 정규화하는 유틸리티
export type CanonicalUrl =
  | { platform: 'youtube'; externalId: string; canonical: string }
  | { platform: 'github'; externalId: string; canonical: string }

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  const isYouTube =
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com'
  const isShort = host === 'youtu.be'

  if (!isYouTube && !isShort) return null

  let id: string | null = null

  if (isShort) {
    // youtu.be/<id>
    id = url.pathname.slice(1).split('/')[0] as string
  } else {
    const parts = url.pathname.split('/').filter(Boolean)
    // /watch?v=<id>
    if (parts[0] === 'watch') {
      id = url.searchParams.get('v')
    // /shorts/<id>, /live/<id>, /embed/<id>
    } else if (
      parts[0] === 'shorts' ||
      parts[0] === 'live' ||
      parts[0] === 'embed'
    ) {
      id = parts[1] ?? null
    }
  }

  if (!id || !YOUTUBE_ID_RE.test(id)) return null
  return id
}

function extractGitHubOwnerRepo(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  if (host !== 'github.com') return null

  // pathname: /owner/repo[/...]
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const owner = parts[0]!.toLowerCase()
  const repo = parts[1]!.toLowerCase()
  return `${owner}/${repo}`
}

export function canonicalize(rawUrl: string): CanonicalUrl | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const ytId = extractYouTubeId(url)
  if (ytId !== null) {
    return {
      platform: 'youtube',
      externalId: ytId,
      canonical: `https://www.youtube.com/watch?v=${ytId}`,
    }
  }

  const ghId = extractGitHubOwnerRepo(url)
  if (ghId !== null) {
    return {
      platform: 'github',
      externalId: ghId,
      canonical: `https://github.com/${ghId}`,
    }
  }

  return null
}
