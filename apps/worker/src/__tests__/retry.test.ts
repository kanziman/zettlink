// backoffMs 함수 단위 테스트 (TDD RED phase)
import { describe, it, expect } from 'vitest'
import { backoffMs } from '../retry.js'

describe('backoffMs', () => {
  it('attempt 1 → ~60초', () => {
    const ms = backoffMs(1)
    expect(ms).toBeGreaterThanOrEqual(54_000)   // -10%
    expect(ms).toBeLessThanOrEqual(66_000)       // +10%
  })

  it('attempt 2 → ~5분', () => {
    const ms = backoffMs(2)
    expect(ms).toBeGreaterThanOrEqual(270_000)
    expect(ms).toBeLessThanOrEqual(330_000)
  })

  it('attempt 3 → ~30분', () => {
    const ms = backoffMs(3)
    expect(ms).toBeGreaterThanOrEqual(1_620_000)
    expect(ms).toBeLessThanOrEqual(1_980_000)
  })

  it('attempt 4 이상도 30분 상한', () => {
    const ms = backoffMs(10)
    expect(ms).toBeLessThanOrEqual(1_980_000)
  })

  it('항상 양수', () => {
    expect(backoffMs(1)).toBeGreaterThan(0)
    expect(backoffMs(0)).toBeGreaterThan(0)
  })
})
