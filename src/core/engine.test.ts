import { describe, expect, it } from 'vitest'
import { RANK, sortCards } from './cards'
import type { Card } from './cards'
import { autoplay, newGame, newTributeRound, step, teamOf } from './engine'
import type { GameState, Seat } from './engine'
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

function drive(
  q: Parameters<typeof scenario>[0],
  steps: [Seat, 'play' | 'pass', string?][],
  opts?: Parameters<typeof newGame>[0],
) {
  const { st: s0, fid } = scenario(q, opts)
  let s = s0
  for (const [seat, act, spec] of steps) {
    s = act === 'play' ? step(s, { kind: 'play', seat, cards: [fid(spec!)] }) : step(s, { kind: 'pass', seat })
  }
  return { s0, s }
}

const play = (st: GameState, seat: Seat, ...ids: string[]) => step(st, { kind: 'play', seat, cards: ids })
const pass = (st: GameState, seat: Seat) => step(st, { kind: 'pass', seat })

describe('newGame', () => {
  it('初始状态', () => {
    const st = newGame({ seed: 5, names: ['甲', '乙', '丙', '丁'] })
    expect(st.phase).toBe('playing')
    expect(st.turn).toBe(0)
    expect(st.levels).toMatchObject({ even: 2, odd: 2 })
    expect(st.matchWinner).toBeNull()
    st.players.forEach((p) => {
      expect(p.hand).toHaveLength(27)
      expect(p.finishOrder).toBeNull()
    })
    expect(st.trick.table).toBeNull()
    expect(st.log).toHaveLength(0)
  })
  it('可指定首发领出者', () => {
    expect(newGame({ firstLeader: 3 }).turn).toBe(3)
  })
  it('可注入测试手牌', () => {
    const { st } = scenario({ A: ['3'], B: ['4'], C: ['5'], D: ['6'] })
    expect(st.players.map((p) => p.hand[0]!.rank)).toEqual([3, 4, 5, 6])
  })
})

describe('step 合法性', () => {
  it('领出合法：扣牌、桌面更新、turn 推进', () => {
    const { st, fid } = scenario({ A: ['3', '5'], B: ['4', '6'], C: ['K', '8'], D: ['9', '2'] })
    const s2 = play(st, 0, fid('3'))
    expect(s2.players[0]!.hand).toHaveLength(1)
    expect(s2.trick.table).toMatchObject({ seat: 0 })
    expect(s2.turn).toBe(1)
  })
  it('空桌不可过（原 state 原样返回）', () => {
    const { st } = scenario({ A: ['3', '5'], B: ['4', '6'], C: ['K', '8'], D: ['9', '2'] })
    expect(pass(st, 0)).toBe(st)
  })
  it('压不过桌面非法（原 state 原样返回）', () => {
    const { st, fid } = scenario({ A: ['3', '5'], B: ['9'], C: ['K', '8'], D: ['4'] })
    const s1 = play(st, 0, fid('3'))
    const s2 = play(s1, 1, fid('9'))
    expect(play(s2, 2, fid('8'))).toBe(s2)
  })
  it('轮次不对非法', () => {
    const { st, fid } = scenario({ A: ['3', '5'], B: ['4', '6'], C: ['K', '8'], D: ['9', '2'] })
    expect(play(st, 1, fid('4'))).toBe(st)
  })
  it('出不属于自己手牌的 id 非法', () => {
    const { st, fid } = scenario({ A: ['3', '5'], B: ['4', '6'], C: ['K', '8'], D: ['9', '2'] })
    expect(play(st, 0, fid('4'))).toBe(st)
  })
})

describe('trick 收拢与轮转', () => {
  it('全员过 → 上出一个胜者收招、清桌、胜者领出', () => {
    const { s } = drive(
      { A: ['3', '10'], B: ['9'], C: ['4'], D: ['5'] },
      [
        [0, 'play', '3'],
        [1, 'play', '9'],
        [2, 'pass'],
        [3, 'pass'],
        [0, 'pass'],
      ],
    )
    expect(s.trick.table).toBeNull()
    expect(s.players[1]!.finishOrder).toBe(0)
    expect(s.turn).toBe(2)
  })
  it('领出无人应 → 自己继续领出', () => {
    const { s } = drive(
      { A: ['3', '10'], B: ['4'], C: ['5'], D: ['6'] },
      [
        [0, 'play', '3'],
        [1, 'pass'],
        [2, 'pass'],
        [3, 'pass'],
      ],
    )
    expect(s.trick.table).toBeNull()
    expect(s.turn).toBe(0)
  })
})

describe('头游与接风', () => {
  it('打空即定座次，游戏至 3 人定座才结束', () => {
    const { st, fid } = scenario({ A: ['3'], B: ['4'], C: ['5'], D: ['9'] })
    let x = play(st, 0, fid('3'))
    expect(x.players[0]!.finishOrder).toBe(0)
    expect(x.phase).toBe('playing')
    x = play(x, 1, fid('4'))
    expect(x.players[1]!.finishOrder).toBe(1)
    x = play(x, 2, fid('5'))
    expect(x.players[2]!.finishOrder).toBe(2)
    expect(x.phase).toBe('ended')
    expect(x.players.map((p) => p.finishOrder)).toEqual([0, 1, 2, 3])
    expect(x.levels).toMatchObject({ even: 4, odd: 2 })
  })
  it('接风：收招胜者已打空 → 领出权顺延到下一活跃座', () => {
    const { st, fid } = scenario({ A: ['3'], B: ['6', '4'], C: ['K', '5'], D: ['7'] })
    let s = play(st, 0, fid('3'))
    expect(s.players[0]!.finishOrder).toBe(0)
    expect(s.turn).toBe(1)
    s = pass(s, 1)
    s = pass(s, 2)
    s = pass(s, 3)
    expect(s.trick.table).toBeNull()
    expect(s.turn).toBe(1)
    s = play(s, 1, fid('4'))
    s = pass(s, 2)
    s = pass(s, 3)
    expect(s.turn).toBe(1)
    s = play(s, 1, fid('6'))
    expect(s.players[1]!.finishOrder).toBe(1)
    s = pass(s, 2)
    s = pass(s, 3)
    expect(s.trick.table).toBeNull()
    expect(s.turn).toBe(2)
    s = play(s, 2, fid('5'))
    s = pass(s, 3)
    s = play(s, 2, fid('K'))
    expect(s.phase).toBe('ended')
    expect(s.players.map((p) => p.finishOrder)).toEqual([0, 1, 2, 3])
    expect(s.levels).toMatchObject({ even: 4, odd: 2 })
  })
})

describe('本场战绩（history）', () => {
  it('一局结束时记下胜方与升的级数', () => {
    const { s } = drive(
      { A: ['3'], B: ['4', '6', '9'], C: ['5'], D: ['7', '2'] },
      [
        [0, 'play', '3'],
        [1, 'pass'],
        [2, 'pass'],
        [3, 'pass'],
        [1, 'play', '4'],
        [2, 'play', '5'],
      ],
    )
    expect(s.phase).toBe('ended')
    expect(s.history).toHaveLength(1)
    expect(s.history[0]).toMatchObject({ winner: 'even', delta: 3 })
    expect(s.history[0]!.levels).toMatchObject({ even: 5, odd: 2 })
  })

  it('新一局可接着上一场的战绩往下记', () => {
    const prev = newGame({
      levels: { even: 5, odd: 2 },
      history: [{ winner: 'even', delta: 3, levels: { even: 5, odd: 2 } }],
    })
    expect(prev.history).toHaveLength(1)
    expect(prev.history[0]!.winner).toBe('even')
  })

  it('A 级非双下：留在 A，本局不计升级', () => {
    const { s } = drive(
      { A: ['3'], B: ['6'], C: ['8', '5'], D: ['4'] },
      [
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
      ],
      { levels: { even: 14, odd: 2 } },
    )
    expect(s.phase).toBe('ended')
    expect(s.matchWinner).toBeNull()
    expect(s.levels).toMatchObject({ even: 14, odd: 2 })
    expect(s.history).toHaveLength(1)
    expect(s.history[0]).toMatchObject({ winner: 'even', delta: 0 })
  })
})

describe('升级计分', () => {
  it('双下 1+2 同队 → 立即结束 +3', () => {
    const { s } = drive(
      { A: ['3'], B: ['4', '6', '9'], C: ['5'], D: ['7', '2'] },
      [
        [0, 'play', '3'],
        [1, 'pass'],
        [2, 'pass'],
        [3, 'pass'],
        [1, 'play', '4'],
        [2, 'play', '5'],
      ],
    )
    expect(s.phase).toBe('ended')
    expect(s.matchWinner).toBeNull()
    expect(s.levels).toMatchObject({ even: 5, odd: 2 })
    expect(s.players.map((p) => p.finishOrder)).toEqual([0, 2, 1, 3])
  })
  it('1+3 → +2', () => {
    const { s } = drive(
      { A: ['3'], B: ['6'], C: ['8', '5'], D: ['4'] },
      [
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
      ],
    )
    expect(s.phase).toBe('ended')
    expect(s.levels).toMatchObject({ even: 4, odd: 2 })
    expect(s.players.map((p) => p.finishOrder)).toEqual([0, 1, 2, 3])
  })
  it('1+4 → +1', () => {
    const { s } = drive(
      { A: ['3'], B: ['6'], C: ['8', '5'], D: ['9', '4'] },
      [
        [0, 'play', '3'],
        [1, 'pass'],
        [2, 'pass'],
        [3, 'pass'],
        [1, 'play', '6'],
        [2, 'pass'],
        [3, 'play', '9'],
        [2, 'pass'],
        [3, 'play', '4'],
      ],
    )
    expect(s.phase).toBe('ended')
    expect(s.levels).toMatchObject({ even: 3, odd: 2 })
  })
  it('奇数队赢 1+3 → odd +2', () => {
    const { s } = drive(
      { A: ['3'], B: ['4'], C: ['J', '5'], D: ['9', '2'] },
      [
        [1, 'play', '4'],
        [2, 'play', 'J'],
        [3, 'pass'],
        [0, 'pass'],
        [2, 'play', '5'],
        [3, 'play', '9'],
        [0, 'pass'],
        [3, 'play', '2'],
      ],
      { firstLeader: 1 },
    )
    expect(s.phase).toBe('ended')
    expect(s.levels).toMatchObject({ even: 2, odd: 4 })
  })
  it('A 级双下 → 拿下整场；A 级非双下留在 A', () => {
    const winA = drive(
      { A: ['3'], B: ['4', '6', '9'], C: ['5'], D: ['7', '2'] },
      [
        [0, 'play', '3'],
        [1, 'pass'],
        [2, 'pass'],
        [3, 'pass'],
        [1, 'play', '4'],
        [2, 'play', '5'],
      ],
      { levels: { even: 14, odd: 2 } },
    )
    expect(winA.s.matchWinner).toBe('even')
    expect(winA.s.levels).toMatchObject({ even: 14, odd: 2 })

    const holdA = drive(
      { A: ['3'], B: ['6'], C: ['8', '5'], D: ['4'] },
      [
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
      ],
      { levels: { even: 14, odd: 4 } },
    )
    expect(holdA.s.matchWinner).toBeNull()
    expect(holdA.s.levels).toMatchObject({ even: 14, odd: 4 })
  })
})

describe('autoplay 终止性', () => {
  it('20 局随机种子均能收尾且座次 0..3 唯一', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const end = autoplay(newGame({ seed }))
      expect(end.phase).toBe('ended')
      const orders = end.players.map((p) => p.finishOrder)
      expect(new Set(orders)).toEqual(new Set([0, 1, 2, 3]))
      const winner = end.players.find((p) => p.finishOrder === 0)!
      const partner = end.players.find((p) => teamOf(p.seat) === teamOf(winner.seat) && p.seat !== winner.seat)!
      expect(partner.finishOrder).not.toBeNull()
    }
  })
})

describe('牌序：官方淮安口径', () => {
  it('本局级数进状态：新局默认 2 级；给了级数就按两队里高的那档', () => {
    expect(newGame().handLevel).toBe(2)
    expect(newGame({ levels: { even: 7, odd: 4 } }).handLevel).toBe(7)
  })

  it('进贡局沿用上一局上游那队的级数（官方：本局级数 = 头游那队的级数）', () => {
    const st = newGame({ levels: { even: 6, odd: 9 } })
    // 造一局结束：0 头游、2 二游、1 三游、3 四游
    st.phase = 'ended'
    st.players[0]!.finishOrder = 0
    st.players[2]!.finishOrder = 1
    st.players[1]!.finishOrder = 2
    st.players[3]!.finishOrder = 3
    const t = newTributeRound(st)!
    expect(t.handLevel).toBe(6) // 头游是 0（even 队），级数 6
  })

  it('级牌压 A，2 最小', () => {
    const { st, fid } = scenario({ A: ['7', '2', '5'], B: ['3', '4', '6'], C: ['8'], D: ['9'] })
    const s0 = newGame({ hands: st.players.map((p) => p.hand), levels: { even: 7, odd: 2 } })
    void st
    // 0 先出 7（级牌），1 跟不出更大的单张
    const s1 = step(s0, { kind: 'play', seat: 0, cards: [fid('7')] })
    expect(s1.trick.table?.combo.rank).toBe(RANK.LEVEL)
    const s2 = step(s1, { kind: 'pass', seat: 1 })
    const s3 = step(s2, { kind: 'pass', seat: 2 })
    const s4 = step(s3, { kind: 'pass', seat: 3 })
    // 桌面是级牌，2 压不过
    const withTwo = step(s4, { kind: 'play', seat: 1, cards: [fid('2')] })
    expect(withTwo).toBe(s4)
  })
})
