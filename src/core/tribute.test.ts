import { describe, expect, it } from 'vitest'
import { sortCards } from './cards'
import type { Card } from './cards'
import { newGame, newTributeRound, step } from './engine'
import type { Seat } from './engine'
import { mk } from './testutil'

function scenario(
  q: { A: string[]; B: string[]; C: string[]; D: string[] },
  opts?: Parameters<typeof newGame>[0],
) {
  const specs = [...q.A, ...q.B, ...q.C, ...q.D]
  const dealt = mk(...specs)
  const off = [0, q.A.length, q.A.length + q.B.length, q.A.length + q.B.length + q.C.length]
  const lens = [q.A.length, q.B.length, q.C.length, q.D.length]
  const hands: Card[][] = lens.map((n, i) => sortCards(dealt.slice(off[i]!, off[i]! + n)))
  const st = newGame({ ...opts, hands })
  const fid = new Map(specs.map((spec, i) => [spec, dealt[i]!.id]))
  return { st, fid: (spec: string) => fid.get(spec)! }
}

/** 打一局到结束：名次 1+4（0 头游、1 二游、2 三游、3 四游） */
function finishedRound(q?: Parameters<typeof scenario>[0]) {
  const hands = q ?? { A: ['3'], B: ['6'], C: ['8', '5'], D: ['9', '4'] }
  const { st, fid } = scenario(hands)
  let s = st
  const steps: [Seat, 'play' | 'pass', string?][] = [
    [0, 'play', '3'],
    [1, 'pass'],
    [2, 'pass'],
    [3, 'pass'],
    [1, 'play', '6'],
    [2, 'pass'],
    [3, 'pass'],
    [2, 'play', '8'],
    [3, 'pass'],
    [2, 'play', '5'],
  ]
  for (const [seat, act, spec] of steps) {
    s = act === 'play' ? step(s, { kind: 'play', seat, cards: [fid(spec!)] }) : step(s, { kind: 'pass', seat })
  }
  return { s, fid }
}

describe('newTributeRound（进贡阶段）', () => {
  it('普通情况：只有下游（四游）进贡，交给头游', () => {
    const { s } = finishedRound()
    expect(s.phase).toBe('ended')
    const t = newTributeRound(s)!
    expect(t.phase).toBe('tribute')
    expect(t.tribute!.order).toEqual([0, 1, 2, 3])
    expect(t.tribute!.givers).toEqual([3]) // 只有四游
    expect(t.turn).toBe(3)
  })

  it('进贡阶段手里还是上一局的手牌（要看到自己最大的一张）', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    expect(t.players[3]!.hand.map((c) => c.rank)).toEqual([9, 4]) // 下游手里还有牌
    expect(t.players[0]!.hand).toHaveLength(0) // 头游已出完
  })

  it('整场结束（打过 A）后不再有进贡', () => {
    const { s } = finishedRound()
    s.matchWinner = 'even'
    expect(newTributeRound(s)).toBeNull()
  })
})

describe('交贡', () => {
  it('下游交出最大的一张 → 进贡者离手，进入还牌阶段', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    const card = t.players[3]!.hand[0]! // 四游手里最大的 9
    const s2 = step(t, { kind: 'give', seat: 3, card: card.id })
    expect(s2).not.toBe(t)
    expect(s2.tribute!.given[3]).toBe(card.id)
    expect(s2.tribute!.to[3]).toBe(0) // 交给头游
    expect(s2.tribute!.step).toBe('return')
    expect(s2.turn).toBe(0) // 头游还牌
    // 新局已发：贡牌进了头游手里（28），进贡者少拿一张等还牌（26）
    expect(s2.players.map((p) => p.hand.length)).toEqual([28, 27, 27, 26])
    expect(s2.players[0]!.hand.some((c) => c.id === card.id)).toBe(true)
  })

  it('不是自己的座 / 不是进贡者 → 非法', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    expect(step(t, { kind: 'give', seat: 0, card: t.players[3]!.hand[0]!.id })).toBe(t)
    expect(step(t, { kind: 'give', seat: 3, card: 'nope' })).toBe(t)
  })

  it('双王可抗贡：抗贡后不交牌，直接发新局并由头游领出', () => {
    const { st: start, fid } = scenario({ A: ['3'], B: ['6'], C: ['8', '5'], D: ['9', '4', 'SJ', 'BJ'] })
    let st = start
    for (const [seat, act, spec] of [
      [0, 'play', '3'],
      [1, 'pass'],
      [2, 'pass'],
      [3, 'pass'],
      [1, 'play', '6'],
      [2, 'pass'],
      [3, 'pass'],
      [2, 'play', '8'],
      [3, 'pass'],
      [2, 'play', '5'],
    ] as [Seat, 'play' | 'pass', string?][]) {
      st = act === 'play' ? step(st, { kind: 'play', seat, cards: [fid(spec!)] }) : step(st, { kind: 'pass', seat })
    }
    const t = newTributeRound(st)!
    const s2 = step(t, { kind: 'give', seat: 3 })
    expect(s2).not.toBe(t)
    expect(s2.tribute!.anti).toEqual([3])
    expect(s2.players[3]!.hand.length).toBe(27) // 抗贡 → 直接发新局，手里是新手牌
    expect(s2.phase).toBe('playing')
    expect(s2.turn).toBe(0) // 抗贡 → 头游领出
    expect(s2.players.map((p) => p.hand.length)).toEqual([27, 27, 27, 27])
  })

  it('没有王却想抗贡 → 非法', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    expect(step(t, { kind: 'give', seat: 3 })).toBe(t)
  })
})

describe('还牌与新局', () => {
  it('还一张 ≤10 的牌给下游 → 新局开始，下游领出', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    const card = t.players[3]!.hand[0]! // 9
    let st = step(t, { kind: 'give', seat: 3, card: card.id })
    expect(st.phase).toBe('tribute')
    // 头游还牌：必须是不大于 10 的牌
    const big = st.players[0]!.hand.find((c) => c.rank > 10)!
    if (big) expect(step(st, { kind: 'give', seat: 0, card: big.id })).toBe(st)
    const small = st.players[0]!.hand.filter((c) => c.rank <= 10).sort((a, b) => a.rank - b.rank)[0]!
    st = step(st, { kind: 'give', seat: 0, card: small.id })
    expect(st.phase).toBe('playing')
    expect(st.turn).toBe(3) // 下游领出
    expect(st.players.map((p) => p.hand.length)).toEqual([27, 27, 27, 27])
    // 贡牌在头游手里，还牌在下游手里
    expect(st.players[0]!.hand.some((c) => c.rank === 9)).toBe(true)
    expect(st.players[3]!.hand.some((c) => c.id === small.id)).toBe(true)
  })

  it('还牌不能给大于 10 的牌', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    const card = t.players[3]!.hand[0]!
    const st = step(t, { kind: 'give', seat: 3, card: card.id })
    // 找一个大于 10 的牌（J 及以上）
    const big = st.players[0]!.hand.find((c) => c.rank > 10)
    if (big) expect(step(st, { kind: 'give', seat: 0, card: big.id })).toBe(st)
  })
})

describe('双下游', () => {
  it('三游与四游同队时两人各交一张：大的给头游、小的给二游', () => {
    // 双下游：0 头游、2 二游（同队 even），1 三游、3 四游（同队 odd）
    // 用 1+2 双下结束：0、2 先走完，1、3 手里还有牌
    const { st, fid } = scenario({ A: ['3'], B: ['4', '6'], C: ['5'], D: ['7', '2'] })
    let s = st
    for (const [seat, act, spec] of [
      [0, 'play', '3'],
      [1, 'pass'],
      [2, 'pass'],
      [3, 'pass'],
      [1, 'play', '4'],
      [2, 'play', '5'],
    ] as [Seat, 'play' | 'pass', string?][]) {
      s = act === 'play' ? step(s, { kind: 'play', seat, cards: [fid(spec!)] }) : step(s, { kind: 'pass', seat })
    }
    expect(s.phase).toBe('ended')
    expect(s.players.map((p) => p.finishOrder)).toEqual([0, 2, 1, 3]) // 0 头游、2 二游、1 三游、3 四游
    const t = newTributeRound(s)!
    expect(t.tribute!.givers).toEqual([3, 1]) // 四游与三游都进贡
    // 四游手里最大的是 7，三游手里最大的是 6（2 现在是最小的牌）
    const fromFourth = t.players[3]!.hand.find((c) => c.rank === 7)!
    const fromThird = t.players[1]!.hand.find((c) => c.rank === 6)!
    let g = step(t, { kind: 'give', seat: 3, card: fromFourth.id })
    g = step(g, { kind: 'give', seat: 1, card: fromThird.id })
    expect(g.tribute!.to[3]).toBe(0) // 大的（2）给头游
    expect(g.tribute!.to[1]).toBe(2) // 小的（6）给二游
    expect(g.tribute!.leader).toBe(3) // 贡牌大的那位领出
  })
})

describe('还牌卡死的兜底', () => {
  it('手里一张 10 以下的牌都没有时，允许还任意一张（不卡死牌局）', () => {
    const { s } = finishedRound()
    const t = newTributeRound(s)!
    const card = t.players[3]!.hand[0]! // 9 → 交给头游
    let st = step(t, { kind: 'give', seat: 3, card: card.id })
    // 头游手里只有大牌：还 9 不合法，但也不能卡死
    const low = st.players[0]!.hand.find((c) => c.rank <= 10)
    if (low) {
      const before = st
      st = step(st, { kind: 'give', seat: 0, card: low.id })
      expect(st).not.toBe(before)
    } else {
      const any = st.players[0]!.hand[0]!
      const before = st
      st = step(st, { kind: 'give', seat: 0, card: any.id })
      expect(st).not.toBe(before)
    }
  })
})

describe('进贡新局：牌不能重', () => {
  it('贡牌要从新牌堆里剔掉，同一张牌不能出现在两个人手里', () => {
    // 打一局到结束 → 进贡局 → 交贡 → 还牌
    const { st } = scenario({ A: ['3'], B: ['6'], C: ['8', '5'], D: ['9', '4'] })
    let s = st
    s.phase = 'ended'
    s.players[0]!.finishOrder = 0
    s.players[1]!.finishOrder = 1
    s.players[2]!.finishOrder = 2
    s.players[3]!.finishOrder = 3
    const t = newTributeRound(s)!
    // 下游（3 号位）向上游进贡
    const giver = t.tribute!.givers[0]!
    const card = t.players[giver]!.hand[0]!
    let x = step(t, { kind: 'give', seat: giver, card: card.id })
    // 上游还一张 10 以下的牌
    const returnee = x.tribute!.returnees[0]!
    const back = x.players[returnee]!.hand.find((c) => c.rank <= 10)!
    x = step(x, { kind: 'give', seat: returnee, card: back.id })
    expect(x.phase).toBe('playing')

    // 每个人手里不能有重复的牌
    for (const p of x.players) {
      const ids = p.hand.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
    // 四家加起来正好 108 张
    expect(x.players.reduce((n, p) => n + p.hand.length, 0)).toBe(108)
    // 全场 108 张牌互不相同
    const all = x.players.flatMap((p) => p.hand.map((c) => c.id))
    expect(new Set(all).size).toBe(108)
  })
})
