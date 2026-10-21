import { teamOf, legalMoves } from './engine'
import type { Action, GameState, Seat } from './engine'
import { ComboType } from './combos'
import type { Combo } from './combos'
import type { Card } from './cards'

const SPECIAL = new Set<number>([ComboType.BOMB, ComboType.SFLUSH, ComboType.JOKERS])

/** 领出时各牌型的偏好：越负越愿意出这张牌。 */
const LEAD_BONUS: Record<number, number> = {
  [ComboType.SINGLE]: 40,
  [ComboType.PAIR]: 10,
  [ComboType.TRIPLE]: 0,
  [ComboType.TRIPLE_PAIR]: 5,
  [ComboType.STRAIGHT]: -10,
  [ComboType.PAIRS]: 0,
  [ComboType.PLATE]: 0,
  [ComboType.BOMB]: 2000,
  [ComboType.SFLUSH]: 2000,
  [ComboType.JOKERS]: 5000,
}

/** 炸弹 / 同花顺 / 天炸在跟牌时的额外代价：默认留着当后手。 */
const SPECIAL_FOLLOW_COST = 300

/** 手牌里每个点数有几张。 */
function handShape(hand: Card[]): Map<number, number> {
  const shape = new Map<number, number>()
  for (const c of hand) shape.set(c.rank, (shape.get(c.rank) ?? 0) + 1)
  return shape
}

/** 拆牌惩罚：拆炸弹最贵，拆三张次之，拆对子最轻。 */
function breakPenalty(combo: Combo, shape: Map<number, number>): number {
  const used = new Map<number, number>()
  for (const c of combo.cards) used.set(c.rank, (used.get(c.rank) ?? 0) + 1)
  let penalty = 0
  for (const [rank, n] of used) {
    const total = shape.get(rank) ?? n
    if (n >= total) continue
    if (total >= 4) penalty += 150
    else if (total === 3) penalty += 30
    else if (total === 2) penalty += 10
  }
  return penalty
}

/** 打出的牌值多少点——大牌更贵。 */
function valueOf(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.rank, 0)
}

function pickCheapest(moves: Combo[], shape: Map<number, number>, lead: boolean): Combo | null {
  let best: Combo | null = null
  let bestCost = Infinity
  for (const m of moves) {
    const cost =
      valueOf(m.cards) +
      (lead ? (LEAD_BONUS[m.type] ?? 0) : SPECIAL.has(m.type) ? SPECIAL_FOLLOW_COST : 0) +
      breakPenalty(m, shape)
    if (cost < bestCost || (cost === bestCost && best !== null && m.rank < best.rank)) {
      best = m
      bestCost = cost
    }
  }
  return best
}

/**
 * AI 走子：
 * - 领出：代价最小的组合（顺子/对子优先，保留炸弹与三张结构）
 * - 跟牌：能小压就小压；拆牌代价过高就过
 * - 炸弹：对手只剩 1-2 张时才动
 * - 好 2 不赢：单张 2 留到最后
 */
export function aiMove(st: GameState, seat: Seat): Action {
  if (st.phase !== 'playing' || st.turn !== seat) return { kind: 'pass', seat }
  const moves = legalMoves(st, seat)
  if (moves.length === 0) return { kind: 'pass', seat }

  const table = st.trick.table
  const hand = st.players[seat]!.hand
  const shape = handShape(hand)
  const mine = teamOf(seat)
  const oppMin = Math.min(
    ...st.players.filter((p) => teamOf(p.seat) !== mine).map((p) => p.hand.length),
  )
  // 紧急：对手只剩 1-2 张（要抢头游），或我只剩一张（必须打完）
  const urgent = oppMin <= 2 || hand.length <= 1

  if (!table) {
    const best = pickCheapest(moves, shape, true)
    if (!best) return { kind: 'pass', seat }
    return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
  }

  // 队友坐庄 → 让他打
  if (teamOf(table.seat) === mine) return { kind: 'pass', seat }

  const best = pickCheapest(moves, shape, false)
  if (!best) return { kind: 'pass', seat }

  // 只剩炸弹能压，而对手还早 → 留着当后手
  if (SPECIAL.has(best.type) && !urgent) return { kind: 'pass', seat }

  // 好 2 不赢：单张 / 一对 2 留到最后打
  if (!urgent && best.rank === 18 && (best.type === ComboType.SINGLE || best.type === ComboType.PAIR)) {
    return { kind: 'pass', seat }
  }

  return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
}
