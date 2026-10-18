import { describe, expect, it } from 'vitest'
import { sortCards } from './cards'
import type { Card } from './cards'
import { newGame, step, autoplay, legalMoves } from './engine'
import { aiMove } from './ai'
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
  it('领桌时：出最小的单张', () => {
    const { st, fid } = scenario({ A: ['5', '3'], B: ['7'], C: ['6'], D: ['8'] })
    const move = aiMove(st, 0)
    expect(move.kind).toBe('play')
    if (move.kind === 'play') expect(move.cards).toEqual([fid('3')])
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
        if (move.kind === 'pass') {
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
  })
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
