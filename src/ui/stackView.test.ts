import { describe, expect, it } from 'vitest'
import { buildStackView, findFlushRuns } from './stackView'
import { mk } from '../core/testutil'

describe('堆叠视图（点数×花色矩阵）', () => {
  it('行按比较值从高到低：王在最上、级牌置顶、点数降序', () => {
    const hand = mk('3', 'K', '2', 'SJ', 'BJ', '2♥')
    const sv = buildStackView(hand, 2) // 2 级局：2 是级牌、♥2 是逢人配
    expect(sv.rows.map((r) => r.label)).toEqual(['大王', '小王', '2', 'K', '3'])
    // 级牌那行的花色格：mk('2') 落在 ♠，加上 ♥2
    const levelRow = sv.rows[2]!
    expect(levelRow.cells.map((c) => c.suit)).toEqual([0, 1])
  })

  it('同点同花两张（两副牌）堆进同一格', () => {
    const hand = mk('9♠', '9♠1', '9♥')
    const sv = buildStackView(hand, 2)
    const row = sv.rows.find((r) => r.label === '9')!
    expect(row.cells).toHaveLength(2) // ♠ 一格（2 张）+ ♥ 一格（1 张）
    expect(row.cells[0]!.cards).toHaveLength(2)
    expect(row.cells[0]!.cards.map((c) => c.suit)).toEqual([0, 0])
  })

  it('同花顺高亮：♠3-7 连张整段点亮', () => {
    const hand = mk('3♠', '4♠', '5♠', '6♠', '7♠', '3♥', 'K♥')
    const sv = buildStackView(hand, 2)
    for (const r of [3, 4, 5, 6, 7]) expect(sv.flushRun.has(`${r}:0`)).toBe(true)
    expect(sv.flushRun.has('3:1')).toBe(false)
    expect(sv.flushRun.has('13:1')).toBe(false)
  })

  it('不足 5 连不高亮；A 当 1 的 A2345 也算', () => {
    const four = mk('3♠', '4♠', '5♠', '6♠')
    expect(findFlushRuns(four, 2).size).toBe(0)
    const wheel = mk('A♠', '2♠', '3♠', '4♠', '5♠')
    const runs = findFlushRuns(wheel, 2)
    // ♠2 是级牌 → 格 key 按比较值提升为 15
    for (const r of [14, 3, 4, 5]) expect(runs.has(`${r}:0`)).toBe(true)
    expect(runs.has('15:0')).toBe(true)
  })

  it('级牌在顺子里按原点数参与连张（2 级局的 ♠ 连张）', () => {
    // 2 级局：♠2 是级牌，也是顺子里的一点
    const hand = mk('A♠', '2♠', '3♠', 'K♥')
    // A2345 中 ♠ 有 A、2、3 三张——不足以构成顺子，但 A-2-3 连续段存在
    const runs = findFlushRuns(hand, 2)
    expect(runs.has('14:0')).toBe(false) // 不足 5 连
  })
})
