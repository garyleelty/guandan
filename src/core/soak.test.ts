import { describe, expect, it } from 'vitest'
import { runSoak } from './soak'

describe('压力跑（连打整场）', () => {
  it('连打 8 场整场不出问题', () => {
    const r = runSoak(8)
    expect(r.issues).toEqual([])
    expect(r.rounds).toBeGreaterThan(20) // 确实打了很多局
    expect(r.finished).toBe(8) // 每场都分出整场
  }, 120_000)
})
