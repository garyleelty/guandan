import { beforeEach, describe, expect, it } from 'vitest'
import { clearStats, loadStats, recordRound, saveStats, winRate } from './stats'

// node 环境没有 localStorage，垫一个
const mem = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  },
})

const rec = (at: number, win: boolean, delta = 1) => ({
  at,
  win,
  delta,
  levels: [3, 2] as [number, number],
  names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'],
})

describe('战绩', () => {
  beforeEach(() => {
    mem.clear()
    clearStats()
  })

  it('记一局后能读回来', () => {
    recordRound(rec(1, true))
    const list = loadStats()
    expect(list).toHaveLength(1)
    expect(list[0]!.win).toBe(true)
  })

  it('同一局不会重复记', () => {
    recordRound(rec(1, true))
    recordRound(rec(1, true))
    expect(loadStats()).toHaveLength(1)
  })

  it('胜率算得对', () => {
    expect(winRate([])).toBeNull()
    recordRound(rec(1, true))
    recordRound(rec(2, false))
    recordRound(rec(3, true))
    expect(winRate(loadStats())).toBeCloseTo(2 / 3)
  })

  it('存坏了也不炸', () => {
    mem.set('gd-stats', 'not json')
    expect(loadStats()).toEqual([])
  })

  it('清空后没了', () => {
    saveStats([rec(1, true)])
    expect(loadStats()).toHaveLength(1)
    clearStats()
    expect(loadStats()).toHaveLength(0)
  })
})
