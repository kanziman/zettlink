// 공개 사이트 Supabase 조회 회귀 테스트
import { describe, expect, it, vi, beforeEach } from 'vitest'

const queryResult = vi.fn()
const selectMock = vi.fn(() => queryBuilder)
const eqMock = vi.fn(() => queryBuilder)
const singleMock = vi.fn(() => queryResult())

const queryBuilder = {
  select: selectMock,
  eq: eqMock,
  single: singleMock,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
  })),
}))

describe('getCardBySlug', () => {
  beforeEach(() => {
    vi.resetModules()
    queryResult.mockReset()
    selectMock.mockClear()
    eqMock.mockClear()
    singleMock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
  })

  it('throws Supabase query errors instead of returning a misleading 404 null', async () => {
    queryResult.mockResolvedValue({
      data: null,
      error: {
        message: 'column cards.deep_content does not exist',
        code: '42703',
      },
    })

    const { getCardBySlug } = await import('../cards')

    await expect(getCardBySlug('youtube', 'anthropic-5-karpathy-ai')).rejects.toThrow(
      'getCardBySlug failed: column cards.deep_content does not exist',
    )
  })

  it('returns null when Supabase reports no matching published card', async () => {
    queryResult.mockResolvedValue({
      data: null,
      error: {
        message: 'JSON object requested, multiple (or no) rows returned',
        code: 'PGRST116',
      },
    })

    const { getCardBySlug } = await import('../cards')

    await expect(getCardBySlug('youtube', 'missing-slug')).resolves.toBeNull()
  })
})
