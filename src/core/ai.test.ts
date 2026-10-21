import { describe, expect, it } from 'vitest'
import { sortCards } from './cards'
import type { Card } from './cards'
import { newGame, step, autoplay, legalMoves } from './engine'
import type { GameState, Seat } from './engine'
import { aiMove, aiTributeMove } from './ai'
import { mk } from './testutil'

function scenario(q: { A: string[]; B: string[]; C: string[]; D: string[] }, opts?: Parameters<typeof newGame>[0]) {
  const specs = [...q.A, ...q.B, ...q.C, ...q.D]
  const dealt = mk(...specs)
  const off = [0, q.A.length, q.A.length + q.B.length, q.A.length + q.B.length + q.C.length]
  const lens = [q.A.length, q.B.length, q.C.length, q.D.length]
  const hands: Card[][] = lens.map((n, i) => sortCards(dealt.slice(off[i]!, off[i]! + n)))
  const st = newGame({ ...opts, hands })
  const fid = new Map(specs.map((spec, i) => [spec, dealt[i]!.id]))
  return { st, fid: (spec: string) => fid.get(spec)! }
}

describe('aiMove 策略', () => {
  const ranksOf = (st: ReturnType<typeof scenario>['st'], move: ReturnType<typeof aiMove>) =>
    move.kind === 'play'
      ? st.players[move.seat]!
          .hand.filter((c) => move.cards!.includes(c.id))
          .map((c) => c.rank)
          .sort((a, b) => a - b)
      : []

  it('领桌时：出最小的单张', () => {
    const { st, fid } = scenario({ A: ['5', '3'], B: ['7'], C: ['6'], D: ['8'] })
    const move = aiMove(st, 0)
    expect(move.kind).toBe('play')
    if (move.kind === 'play') expect(move.cards).toEqual([fid('3')])
  })

  it('领出优先出对子，而不是打散的单张', () => {
    const { st } = scenario({ A: ['5', '5', '3'], B: ['7'], C: ['6'], D: ['8'] })
    expect(ranksOf(st, aiMove(st, 0))).toEqual([5, 5])
  })

  it('领出优先出顺子（5 张一手，代价最低）', () => {
    const { st } = scenario({ A: ['3♠', '4♥', '5♣', '6♦', '7♠', '2♠'], B: ['9'], C: ['6'], D: ['8'] })
    expect(ranksOf(st, aiMove(st, 0))).toEqual([3, 4, 5, 6, 7])
  })

  it('领出不拆炸弹', () => {
    const { st } = scenario({ A: ['7', '7', '7', '7', '3'], B: ['9'], C: ['6'], D: ['8'] })
    expect(ranksOf(st, aiMove(st, 0))).toEqual([3])
  })

  it('跟牌也不拆炸弹：只留炸弹能压时改出单张', () => {
    // 对手出了 9，我有 4 张 7 与一张 3：拆炸弹的代价高于过牌
    const { st, fid } = scenario(
      { A: ['3'], B: ['4', '4', '4', '4'], C: ['7', '7', '7', '7', '3'], D: ['9', '9', '9', '9'] },
      { firstLeader: 3 },
    )
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('9')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('pass')
  })

  it('对手只剩 1-2 张 → 果断用炸弹', () => {
    const { st, fid } = scenario({ A: ['3'], B: ['4'], C: ['8', '8', '8', '8', '7'], D: ['K', '9'] }, { firstLeader: 3 })
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('K')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('play')
    if (move.kind === 'play') expect(move.cards!.length).toBe(4)
  })

  it('好 2 不赢：单张 2 留着不打（对手还远时过牌）', () => {
    const { st, fid } = scenario(
      { A: ['3'], B: ['4', '4', '4', '4'], C: ['2', '5'], D: ['K', '9', '9', '9'] },
      { firstLeader: 3 },
    )
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('K')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('pass')
  })

  it('队友坐庄 → 主动过，不压队友', () => {
    const { st, fid } = scenario({ A: ['3'], B: ['4'], C: ['5'], D: ['6'] })
    // A 头游领出 3 后，B 过、C 的回合：桌面庄家是队友 A → C 应过
    let s = step(st, { kind: 'play', seat: 0, cards: [fid('3')] })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('pass')
  })
  it('对手坐庄 → 用最小可压牌应牌，不跳过更小的合法牌', () => {
    const { st, fid } = scenario({ A: ['5', '3'], B: ['6'], C: ['Q', '5'], D: ['9'] }, { firstLeader: 3 })
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('9')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('play')
    if (move.kind === 'play') expect(move.cards).toEqual([fid('Q')])
  })
  it('仅炸弹能压 → 必要时仍会出炸弹', () => {
    const { st, fid } = scenario({ A: ['3'], B: ['4'], C: ['8', '8', '8', '8', '7'], D: ['K'] }, { firstLeader: 3 })
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('K')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('play')
    if (move.kind === 'play') expect(move.cards!.length).toBe(4)
  })
  it('无任何可压牌 → 过', () => {
    const { st, fid } = scenario({ A: ['5', '3'], B: ['4'], C: ['7', '6'], D: ['K'] }, { firstLeader: 3 })
    let s = step(st, { kind: 'play', seat: 3, cards: [fid('K')] })
    s = step(s, { kind: 'pass', seat: 0 })
    s = step(s, { kind: 'pass', seat: 1 })
    const move = aiMove(s, 2)
    expect(move.kind).toBe('pass')
  })
})

describe('aiMove 全对局语义', () => {
  it('100 局全自动（AI 移动每步都合法）都能收尾且座次唯一', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = newGame({ seed })
      let guard = 0
      while (s.phase === 'playing' && guard++ < 5000) {
        const seat = s.turn
        const move = aiMove(s, seat)
        if (move.kind !== 'play') {
          expect(s.trick.table).not.toBeNull()
          s = step(s, { kind: 'pass', seat })
        } else {
          const legal = legalMoves(s, seat)
          const cards = move.cards!
          const matching = legal.find((c) => c.cards.length === cards.length && c.cards.every((x, i) => x.id === cards[i]))
          expect(matching, `seat ${seat} played a non-legal move`).toBeDefined()
          const before = s
          s = step(s, { kind: 'play', seat, cards })
          expect(s).not.toBe(before)
        }
      }
      expect(s.phase).toBe('ended')
      expect(new Set(s.players.map((p) => p.finishOrder))).toEqual(new Set([0, 1, 2, 3]))
    }
  }, 30000)
  it('autoplay 20 seeds 依旧收尾（回归）', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(autoplay(newGame({ seed })).phase).toBe('ended')
    }
  })
  it('autoplay 400 局回归：全部 ended、座次 0..3 单调、无崩溃', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const end = autoplay(newGame({ seed }))
      expect(end.phase).toBe('ended')
      const orders = end.players.map((p) => p.finishOrder!)
      expect([...orders].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
      expect(end.log.length).toBeGreaterThan(0)
    }
  }, 30000)
})

function tributeState(st: GameState, turn: Seat, step: 'give' | 'return'): GameState {
  return {
    ...st,
    phase: 'tribute',
    turn,
    tribute: {
      order: [0, 1, 2, 3],
      givers: [3],
      to: {},
      given: {},
      cards: {},
      anti: [],
      received: {},
      step,
      returnees: step === 'return' ? [0] : [],
      returnTo: { 0: 3 },
      returned: {},
      leader: 0,
      seed: 1,
    },
  }
}

describe('aiTributeMove（进贡阶段）', () => {
  it('交贡：交出手里最大的一张', () => {
    const { st, fid } = scenario({ A: ['3', 'K', '9'], B: ['4'], C: ['5'], D: ['6'] })
    const t = tributeState(st, 0, 'give')
    const move = aiTributeMove(t, 0)
    expect(move.kind).toBe('give')
    if (move.kind === 'give') expect(move.card).toBe(fid('K'))
  })

  it('双王时抗贡（不给牌）', () => {
    const { st } = scenario({ A: ['3', 'SJ', 'BJ'], B: ['4'], C: ['5'], D: ['6'] })
    const t = tributeState(st, 0, 'give')
    const move = aiTributeMove(t, 0)
    expect(move.kind).toBe('give')
    if (move.kind === 'give') expect(move.card).toBeUndefined()
  })

  it('还牌：还最小的一张 ≤10 的牌（2 现在是最小的牌）', () => {
    const { st, fid } = scenario({ A: ['3', '5', '2'], B: ['4'], C: ['7'], D: ['8'] })
    const t = tributeState(st, 0, 'return')
    const move = aiTributeMove(t, 0)
    expect(move.kind).toBe('give')
    if (move.kind === 'give') expect(move.card).toBe(fid('2'))
  })
})

describe('记牌（AI 算剩余牌）', () => {
  /** 把某个点数的 8 张都写进记录，表示「这些都出过了」 */
  function played(rank: number, seats: Seat[] = [1, 2, 3]): GameState['log'] {
    const log: GameState['log'] = []
    for (let i = 0; i < 4; i++) {
      log.push({
        seat: seats[i % seats.length]!,
        ids: [`s${rank}-${i}`, `h${rank}-${i}`],
        combo: { type: 1, rank },
      })
    }
    return log
  }

  it('算得出对手压不动时，先甩那手安全牌（对子 9）', () => {
    const st = newGame({ hands: [mk('9♠', '9♥', '3♠'), mk('4', '5'), mk('6', '7'), mk('8', '9')] })
    st.log = [...played(14), ...played(13), ...played(12), ...played(11), ...played(10)]
    const mv = aiMove(st, 0)
    expect(mv.kind).toBe('play')
    if (mv.kind === 'play') {
      expect(mv.cards!.length).toBe(2) // 甩对子，不是单张 3
    }
  })

  it('同样的对子，压不动的那手先出（K 对压不动，9 对压得动）', () => {
    const st = newGame({ hands: [mk('K♠', 'K♥', '9♠', '9♥'), mk('4', '5'), mk('6', '7'), mk('8', '9')] })
    st.log = played(14) // A 全出完了：对 K 对来说没人压得动
    const mv = aiMove(st, 0)
    expect(mv.kind).toBe('play')
    if (mv.kind === 'play') {
      const ranks = mv.cards!.map((id) => Number(id.slice(1, id.lastIndexOf('-'))))
      expect(ranks).toEqual([13, 13]) // 出 K 对，不是 9 对
    }
  })
})
