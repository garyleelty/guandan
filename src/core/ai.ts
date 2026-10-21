import { teamOf, legalMoves, canAntiTribute } from './engine'
import type { Action, GameState, Seat } from './engine'
import { ComboType } from './combos'
import type { Combo } from './combos'
import { RANK, effectiveRank, isWild } from './cards'
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

/** 手牌里每个点数有几张（按比较值分组，级牌算一组）。 */
function handShape(hand: Card[], level: number): Map<number, number> {
  const shape = new Map<number, number>()
  for (const c of hand) {
    const r = effectiveRank(c, level)
    shape.set(r, (shape.get(r) ?? 0) + 1)
  }
  return shape
}

/** 拆牌惩罚：拆炸弹最贵，拆三张次之，拆对子最轻。 */
function breakPenalty(combo: Combo, shape: Map<number, number>, level: number): number {
  const used = new Map<number, number>()
  for (const c of combo.cards) {
    const r = effectiveRank(c, level)
    used.set(r, (used.get(r) ?? 0) + 1)
  }
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

/**
 * 打出的牌值多少点——大牌更贵（按比较值，级牌最贵）。
 * 逢人配（红桃级牌）比普通级牌更灵活，额外加价，AI 不轻易甩掉。
 */
function valueOf(cards: Card[], level: number): number {
  return cards.reduce((sum, c) => sum + effectiveRank(c, level) + (isWild(c, level) ? 30 : 0), 0)
}

function pickCheapest(moves: Combo[], shape: Map<number, number>, lead: boolean, level: number): Combo | null {
  let best: Combo | null = null
  let bestCost = Infinity
  for (const m of moves) {
    const cost =
      valueOf(m.cards, level) +
      (lead ? (LEAD_BONUS[m.type] ?? 0) : SPECIAL.has(m.type) ? SPECIAL_FOLLOW_COST : 0) +
      breakPenalty(m, shape, level)
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
 * - 好牌不赢：级牌留到最后
 */
export function aiMove(st: GameState, seat: Seat): Action {
  if (st.phase !== 'playing' || st.turn !== seat) return { kind: 'pass', seat }
  const moves = legalMoves(st, seat)
  if (moves.length === 0) return { kind: 'pass', seat }

  const table = st.trick.table
  const hand = st.players[seat]!.hand
  const shape = handShape(hand, st.handLevel)
  const mine = teamOf(seat)
  const oppMin = Math.min(
    ...st.players.filter((p) => teamOf(p.seat) !== mine).map((p) => p.hand.length),
  )
  // 紧急：对手只剩 1-2 张（要抢头游），或我只剩一张（必须打完）
  const urgent = oppMin <= 2 || hand.length <= 1

  if (!table) {
    const best = pickCheapest(moves, shape, true, st.handLevel)
    if (!best) return { kind: 'pass', seat }
    return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
  }

  // 队友坐庄 → 让他打
  if (teamOf(table.seat) === mine) return { kind: 'pass', seat }

  const best = pickCheapest(moves, shape, false, st.handLevel)
  if (!best) return { kind: 'pass', seat }

  // 只剩炸弹能压，而对手还早 → 留着当后手
  if (SPECIAL.has(best.type) && !urgent) return { kind: 'pass', seat }

  // 好牌不赢：级牌（比 A 还大）留到最后打，别早早送掉
  if (
    !urgent &&
    best.rank === RANK.LEVEL &&
    (best.type === ComboType.SINGLE || best.type === ComboType.PAIR)
  ) {
    return { kind: 'pass', seat }
  }

  return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
}

/**
 * 进贡阶段的 AI 走法：
 * - 交贡：手里最大的一张；有双王/天王炸就抗贡；
 * - 还牌：手里最小的一张 ≤10 的牌。
 */
export function aiTributeMove(st: GameState, seat: Seat): Action {
  const t = st.tribute
  if (!t || st.phase !== 'tribute' || st.turn !== seat) return { kind: 'give', seat }
  const hand = st.players[seat]!.hand
  if (t.step === 'return') {
    const back = hand.filter((c) => c.rank <= 10).sort((a, b) => a.rank - b.rank)[0]
    return back ? { kind: 'give', seat, card: back.id } : { kind: 'give', seat }
  }
  if (canAntiTribute(hand)) return { kind: 'give', seat } // 抗贡
  const level = st.handLevel
  const biggest = [...hand].sort((a, b) => effectiveRank(b, level) - effectiveRank(a, level))[0]
  return biggest ? { kind: 'give', seat, card: biggest.id } : { kind: 'give', seat }
}
