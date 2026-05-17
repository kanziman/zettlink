// 재시도 backoff 시간 계산 (지수 증가 + ±10% jitter)
const BASE_DELAYS = [60_000, 300_000, 1_800_000] // 1분, 5분, 30분

export function backoffMs(attempt: number): number {
  const base = BASE_DELAYS[Math.min(Math.max(attempt - 1, 0), 2)]
  const jitter = 1 + (Math.random() * 0.2 - 0.1) // ±10%
  return Math.round(base * jitter)
}
