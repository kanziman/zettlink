// url-normalize.ts 단위 테스트 — YouTube/GitHub 모든 URL 변형 커버
import { describe, it, expect } from 'vitest'
import { canonicalize } from '../url-normalize.js'

const YT_ID = 'dQw4w9WgXcQ'
const YT_CANONICAL = `https://www.youtube.com/watch?v=${YT_ID}`

describe('canonicalize — YouTube', () => {
  it('standard watch URL', () => {
    const result = canonicalize(`https://www.youtube.com/watch?v=${YT_ID}`)
    expect(result).toEqual({
      platform: 'youtube',
      externalId: YT_ID,
      canonical: YT_CANONICAL,
    })
  })

  it('youtu.be short URL', () => {
    const result = canonicalize(`https://youtu.be/${YT_ID}`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('shorts URL', () => {
    const result = canonicalize(`https://www.youtube.com/shorts/${YT_ID}`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('live URL', () => {
    const result = canonicalize(`https://www.youtube.com/live/${YT_ID}`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('embed URL', () => {
    const result = canonicalize(`https://www.youtube.com/embed/${YT_ID}`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('mobile URL with extra query params', () => {
    const result = canonicalize(`https://m.youtube.com/watch?v=${YT_ID}&t=30`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('watch URL with playlist param', () => {
    const result = canonicalize(`https://www.youtube.com/watch?v=${YT_ID}&list=PLxxx`)
    expect(result?.externalId).toBe(YT_ID)
    expect(result?.canonical).toBe(YT_CANONICAL)
  })

  it('returns null for invalid YouTube ID (wrong length)', () => {
    expect(canonicalize('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(canonicalize('https://youtu.be/toolong12345678')).toBeNull()
  })

  it('returns null for YouTube URL with no ID', () => {
    expect(canonicalize('https://www.youtube.com/feed/subscriptions')).toBeNull()
  })

  it('returns null for watch URL with no v param', () => {
    expect(canonicalize('https://www.youtube.com/watch')).toBeNull()
  })

  it('returns null for shorts URL with no ID segment', () => {
    expect(canonicalize('https://www.youtube.com/shorts')).toBeNull()
  })
})

describe('canonicalize — GitHub', () => {
  it('basic repo URL', () => {
    const result = canonicalize('https://github.com/facebook/react')
    expect(result).toEqual({
      platform: 'github',
      externalId: 'facebook/react',
      canonical: 'https://github.com/facebook/react',
    })
  })

  it('trailing slash is removed', () => {
    const result = canonicalize('https://github.com/facebook/react/')
    expect(result?.externalId).toBe('facebook/react')
    expect(result?.canonical).toBe('https://github.com/facebook/react')
  })

  it('tree/branch path is stripped', () => {
    const result = canonicalize('https://github.com/Facebook/React/tree/main')
    expect(result?.externalId).toBe('facebook/react')
    expect(result?.canonical).toBe('https://github.com/facebook/react')
  })

  it('blob file path is stripped', () => {
    const result = canonicalize('https://github.com/facebook/react/blob/main/README.md')
    expect(result?.externalId).toBe('facebook/react')
  })

  it('PR list path is stripped', () => {
    const result = canonicalize('https://github.com/facebook/react/pulls')
    expect(result?.externalId).toBe('facebook/react')
  })

  it('issues list path is stripped', () => {
    const result = canonicalize('https://github.com/facebook/react/issues')
    expect(result?.externalId).toBe('facebook/react')
  })

  it('individual issue path is stripped', () => {
    const result = canonicalize('https://github.com/facebook/react/issues/123')
    expect(result?.externalId).toBe('facebook/react')
  })

  it('uppercased domain and owner/repo are lowercased', () => {
    const result = canonicalize('https://GITHUB.COM/Owner/Repo/pulls')
    expect(result?.externalId).toBe('owner/repo')
    expect(result?.canonical).toBe('https://github.com/owner/repo')
  })
})

describe('canonicalize — unsupported / invalid', () => {
  it('returns null for unsupported domain', () => {
    expect(canonicalize('https://twitter.com/someone')).toBeNull()
  })

  it('returns null for non-URL string', () => {
    expect(canonicalize('not-a-url')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(canonicalize('')).toBeNull()
  })

  it('returns null for GitHub URL with no repo segment', () => {
    expect(canonicalize('https://github.com/facebook')).toBeNull()
  })
})
