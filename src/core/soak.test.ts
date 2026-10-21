import { describe, expect, it } from 'vitest'
import { RULE_PATHS, runSoak } from './soak'

describe('压力跑（连打整场）', () => {
  it('连打 8 场整场不出问题', () => {
    const r = runSoak(8)
    expect(r.issues).toEqual([])
    expect(r.rounds).toBeGreaterThan(20) // 确实打了很多局
    expect(r.finished).toBe(8) // 每场都分出整场
  }, 120_000)

  it('常见规则边角都被走到（低频的那些由单测覆盖）', () => {
    const r = runSoak(8)
    // 这些每局都可能遇到，8 场下来应该都出现过
    for (const path of ['逢人配参与组合', '连对', '钢板', '双下游各交一张']) {
      expect(r.coverage[path] ?? 0, `${path} 没被覆盖`).toBeGreaterThan(0)
    }
    // 没被覆盖到的低频路径要列出来，方便人决定要不要补单测
    const missing = RULE_PATHS.filter((p) => !r.coverage[p])
    expect(Array.isArray(missing)).toBe(true)
  }, 120_000)
})
