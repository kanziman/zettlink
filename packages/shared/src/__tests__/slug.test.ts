// slug.ts 단위 테스트 — titleToSlug, repoToSlug 전체 케이스 커버
import { describe, it, expect } from 'vitest'
import { titleToSlug, repoToSlug } from '../slug.js'

describe('titleToSlug', () => {
  it('converts English title to kebab-case', () => {
    expect(titleToSlug('How to Build a REST API with Node.js')).toBe(
      'how-to-build-a-rest-api-with-nodejs'
    )
  })

  it('removes Korean and emoji, keeps ASCII', () => {
    expect(titleToSlug('React 18 새로운 기능 정리 🎉')).toBe('react-18')
  })

  it('collapses multiple spaces into single hyphen', () => {
    expect(titleToSlug('  multiple   spaces  ')).toBe('multiple-spaces')
  })

  it('strips leading and trailing hyphens', () => {
    expect(titleToSlug('---leading-trailing---')).toBe('leading-trailing')
  })

  it('returns untitled when only Korean', () => {
    expect(titleToSlug('한국어만 있는 제목')).toBe('untitled')
  })

  it('returns untitled for empty string', () => {
    expect(titleToSlug('')).toBe('untitled')
  })

  it('returns untitled for whitespace-only string', () => {
    expect(titleToSlug('   ')).toBe('untitled')
  })

  it('truncates at 80 chars or fewer', () => {
    const result = titleToSlug('a'.repeat(100))
    expect(result.length).toBeLessThanOrEqual(80)
  })

  it('truncates long slug at word boundary', () => {
    // "word " * 20 = 100 chars → slug will have many hyphens, truncated at word boundary
    const longTitle = 'hello world '.repeat(10).trim()
    const result = titleToSlug(longTitle)
    expect(result.length).toBeLessThanOrEqual(80)
    expect(result).not.toMatch(/-$/)
  })

  it('removes special characters', () => {
    expect(titleToSlug('C++ programming & algorithms!')).toBe(
      'c-programming-algorithms'
    )
  })

  it('collapses consecutive hyphens from special char removal', () => {
    expect(titleToSlug('a -- b')).toBe('a-b')
  })
})

describe('repoToSlug', () => {
  it('converts owner/repo to owner-repo', () => {
    expect(repoToSlug('facebook/react')).toBe('facebook-react')
  })

  it('replaces dots with hyphens', () => {
    expect(repoToSlug('vercel/next.js')).toBe('vercel-next-js')
  })

  it('already kebab-case stays as-is', () => {
    expect(repoToSlug('owner/my-repo')).toBe('owner-my-repo')
  })

  it('handles owner/repo with both slash and dot', () => {
    expect(repoToSlug('owner/my.lib')).toBe('owner-my-lib')
  })
})
