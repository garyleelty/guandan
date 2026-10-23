import { teamOf, legalMoves, canAntiTribute, tributeCandidates, returnCandidates, step } from './engine'
import type { Action, GameState, Seat } from './engine'
import { ComboType } from './combos'
import type { Combo } from './combos'
import { RANK, cardIdToRank, effectiveRank, isWild } from './cards'
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

/** 一手牌的直接代价（不含局面分与随机抖动）。 */
function costOf(
  m: Combo,
  ctx: { shape: Map<number, number>; lead: boolean; level: number; breakScale: number; blockLead?: boolean; risk?: (m: Combo) => number },
): number {
  return (
    valueOf(m.cards, ctx.level) +
    (ctx.lead ? (LEAD_BONUS[m.type] ?? 0) : SPECIAL.has(m.type) ? SPECIAL_FOLLOW_COST : 0) +
    breakPenalty(m, ctx.shape, ctx.level) * ctx.breakScale +
    (ctx.risk ? ctx.risk(m) * RISK_COST : 0) +
    (ctx.blockLead && m.type === ComboType.SINGLE ? (14 - m.rank) * 20 : 0)
  )
}

function pickCheapest(
  moves: Combo[],
  shape: Map<number, number>,
  lead: boolean,
  level: number,
  risk?: (m: Combo) => number,
  opts?: { breakScale?: number; jitter?: number; blockLead?: boolean },
): Combo | null {
  let best: Combo | null = null
  let bestCost = Infinity
  const breakScale = opts?.breakScale ?? 1
  const ctx = { shape, lead, level, breakScale, blockLead: opts?.blockLead, risk }
  for (const m of moves) {
    const cost = costOf(m, ctx) + (opts?.jitter ? (Math.random() - 0.5) * opts.jitter : 0)
    if (cost < bestCost || (cost === bestCost && best !== null && m.rank < best.rank)) {
      best = m
      bestCost = cost
    }
  }
  return best
}

// ── 打分制评估（普通 / 难档启用）：模拟一手之后的局面值多少分 ──

const LEFT_WEIGHT = 3
const BOMB_ASSET = 30
const CONTROL_BONUS = 12
const EVAL_WEIGHT = 1

/** 模拟「打出这手（null = 过）」之后的局面，供打分用。 */
function simulate(st: GameState, seat: Seat, mv: Combo | null): GameState {
  return mv
    ? step(st, { kind: 'play', seat, cards: mv.cards.map((c) => c.id) })
    : step(st, { kind: 'pass', seat })
}

/**
 * 局面打分（越大越好，站在 seat 的队伍立场）：
 * - 剩牌差：我队（含搭档）剩的越少越好，对面越多越好；
 * - 炸弹资产：手里的炸弹 / 王对是后手潜力，谁的在谁那边记账；
 * - 出牌权：桌面是我队的牌 = 主动权；
 * - 走完名次：自己打完按名次重奖，整场结束直接定胜负。
 */
function evaluate(st: GameState, seat: Seat): number {
  const mine = teamOf(seat)
  if (st.phase === 'ended') {
    const winner = st.players.find((p) => p.finishOrder === 0)!
    if (st.matchWinner !== null) return st.matchWinner === mine ? 5000 : -5000
    return teamOf(winner.seat) === mine ? 500 : -500
  }
  let ourLeft = 0
  let theirLeft = 0
  let bombs = 0
  for (const p of st.players) {
    const sign = teamOf(p.seat) === mine ? 1 : -1
    if (sign > 0) ourLeft += p.hand.length
    else theirLeft += p.hand.length
    const shape = handShape(p.hand, st.handLevel)
    for (const [, n] of shape) if (n >= 4) bombs += sign
    if ((shape.get(RANK.SJ) ?? 0) >= 1 && (shape.get(RANK.BJ) ?? 0) >= 1) bombs += sign
  }
  let score = (theirLeft - ourLeft) * LEFT_WEIGHT + bombs * BOMB_ASSET
  if (st.trick.table) score += teamOf(st.trick.table.seat) === mine ? CONTROL_BONUS : -CONTROL_BONUS
  const meAfter = st.players[seat]!.finishOrder
  if (meAfter !== null) score += 300 - meAfter * 100
  return score
}

/** 跟牌那一手的直接代价：牌面价值 +（炸系后手成本）+ 拆牌。 */
function followCost(m: Combo, shape: Map<number, number>, level: number): number {
  return valueOf(m.cards, level) + (SPECIAL.has(m.type) ? SPECIAL_FOLLOW_COST : 0) + breakPenalty(m, shape, level)
}

/** 牌 id → 点数：牌就那么 108 张，缓存一下省得反复解字符串。 */
const rankOfId = new Map<string, number>()
function rankCached(id: string): number {
  let r = rankOfId.get(id)
  if (r === undefined) {
    r = cardIdToRank(id)
    rankOfId.set(id, r)
  }
  return r
}

/** 每个点数现在还剩多少张（两副牌每点 8 张，王 2 张）。 */
function remainingCounts(st: GameState): Map<number, number> {
  const played = new Map<number, number>()
  for (const e of st.log) {
    for (const id of e.ids) {
      const r = rankCached(id)
      played.set(r, (played.get(r) ?? 0) + 1)
    }
  }
  const out = new Map<number, number>()
  for (let r = 2; r <= 14; r++) out.set(r, 8 - (played.get(r) ?? 0))
  out.set(RANK.SJ, 2 - (played.get(RANK.SJ) ?? 0))
  out.set(RANK.BJ, 2 - (played.get(RANK.BJ) ?? 0))
  return out
}

/**
 * 记牌：对手手里**可能**还有的张数（把我自己手里的排掉；搭档的手牌是暗的，算不准）。
 * 这是上界估计——宁可高估对手的牌，也不能低估。
 */
function possibleCounts(st: GameState, seat: Seat): Map<number, number> {
  const remaining = remainingCounts(st)
  const mine = new Map<number, number>()
  for (const c of st.players[seat]!.hand) mine.set(c.rank, (mine.get(c.rank) ?? 0) + 1)
  const out = new Map<number, number>()
  for (const [r, n] of remaining) out.set(r, n - (mine.get(r) ?? 0))
  return out
}

/** 对手能凑出的、比 rank 大的同型组数上界（size 张一组）。 */
function possibleHigher(possible: Map<number, number>, rank: number, size: number): number {
  let n = 0
  for (const [r, c] of possible) {
    if (r <= rank || r >= RANK.SJ) continue
    n += Math.floor(c / size)
  }
  return n
}

/**
 * 这手牌被压掉的估计：对手可能凑出的更大同型组数（按对手剩牌数封顶）。
 * 记牌的用处就在这儿——算得出对手压得动，就别急着出对子。
 */
function beatRisk(combo: Combo, possible: Map<number, number>, st: GameState, seat: Seat): number {
  const size =
    combo.type === ComboType.PAIR ? 2 : combo.type === ComboType.TRIPLE ? 3 : combo.type === ComboType.BOMB ? 4 : 0
  if (size === 0) return 0
  const groups = possibleHigher(possible, combo.rank, size)
  if (groups === 0) return 0
  let cap = 0
  for (const opp of st.players) {
    if (teamOf(opp.seat) === teamOf(seat)) continue
    cap = Math.max(cap, Math.floor(opp.hand.length / size))
  }
  return Math.min(groups, cap)
}

/** 被压风险的代价：每多一种可能压法，这一手就贵一分。 */
const RISK_COST = 12

/**
 * AI 走子：
 * - 领出：候选逐个模拟一步打分（牌面代价 + 局面分），炸弹与级牌默认留着
 * - 跟牌：能小压就小压；拆牌代价过高就过；普通/难档用局面分决定「压还是过」
 * - 炸弹：对手只剩 1-2 张时才动（紧急）
 * - 好牌不赢：级牌（比 A 还大）留到最后
 */
export function aiMove(st: GameState, seat: Seat): Action {
  if (st.phase !== 'playing' || st.turn !== seat) return { kind: 'pass', seat }
  const moves = legalMoves(st, seat)
  if (moves.length === 0) return { kind: 'pass', seat }

  const table = st.trick.table
  const hand = st.players[seat]!.hand
  const shape = handShape(hand, st.handLevel)
  // 难度：0 简单（纯代价 + 随机）· 1 普通（+局面打分）· 2 难（+记牌风险）
  const level = st.aiLevel ?? 1
  const breakScale = level === 0 ? 0 : 1
  const jitter = level === 0 ? 10 : 0
  const mine = teamOf(seat)
  const oppMin = Math.min(
    ...st.players.filter((p) => teamOf(p.seat) !== mine).map((p) => p.hand.length),
  )
  // 紧急：对手只剩 1-2 张（要抢头游），或我只剩一张（必须打完）
  const urgent = oppMin <= 2 || hand.length <= 1
  // 难档：对手只剩一张时，领出改用大牌——他多半压不动，别把小牌送出去让他走完
  const blockLead = level >= 2 && oppMin <= 1

  if (!table) {
    // 记牌：算得出对手可能压得动，这一手就贵一点
    const hasGroup = moves.some(
      (m) => m.type === ComboType.PAIR || m.type === ComboType.TRIPLE || m.type === ComboType.BOMB,
    )
    const possible = level >= 2 && hasGroup ? possibleCounts(st, seat) : null
    const risk = possible ? (m: Combo) => beatRisk(m, possible, st, seat) : undefined
    const ctx = { shape, lead: true, level: st.handLevel, breakScale, blockLead, risk }

    // 普通 / 难档：先按代价排出前几名，只对它们做模拟打分（每个候选都要克隆局面，省着点用）
    if (level >= 1) {
      const shortlist = moves
        .map((m) => ({ m, cost: costOf(m, ctx) }))
        .sort((a, b) => a.cost - b.cost)
        .slice(0, 12)
      let best = shortlist[0]!.m
      let bestScore = -Infinity
      for (const { m, cost } of shortlist) {
        const score = -cost + EVAL_WEIGHT * evaluate(simulate(st, seat, m), seat)
        if (score > bestScore || (score === bestScore && m.rank < best.rank)) {
          best = m
          bestScore = score
        }
      }
      return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
    }

    const best = pickCheapest(moves, shape, true, st.handLevel, risk, { breakScale, jitter, blockLead })
    if (!best) return { kind: 'pass', seat }
    return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
  }

  // 队友坐庄 → 让他打
  if (teamOf(table.seat) === mine) return { kind: 'pass', seat }

  const best = pickCheapest(moves, shape, false, st.handLevel, undefined, { breakScale, blockLead })
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

  // 紧急 / 简单档：直接压，不犹豫
  if (urgent || level === 0) return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }

  // 普通 / 难档：局面分比较「压这一手」与「过」——模拟一步，看哪个局面更舒展
  const playScore = -followCost(best, shape, st.handLevel) + EVAL_WEIGHT * evaluate(simulate(st, seat, best), seat)
  const passScore = EVAL_WEIGHT * evaluate(simulate(st, seat, null), seat)
  if (playScore < passScore) return { kind: 'pass', seat }
  return { kind: 'play', seat, cards: best.cards.map((c) => c.id) }
}

/**
 * 进贡阶段的 AI 走法：
 * - 交贡：交手里最大的一张（红桃级牌不能交）；进贡方合计有两张大王就抗贡；
 * - 还牌：还一张可还的最小牌（≤10 且非级牌）。
 */
export function aiTributeMove(st: GameState, seat: Seat): Action {
  const t = st.tribute
  if (!t || st.phase !== 'tribute' || st.turn !== seat) return { kind: 'give', seat }
  const hand = st.players[seat]!.hand
  if (t.step === 'return') {
    const back = returnCandidates(hand, st.handLevel).sort((a, b) => a.rank - b.rank)[0]
    return back ? { kind: 'give', seat, card: back.id } : { kind: 'give', seat }
  }
  if (canAntiTribute(t.givers.map((g) => st.players[g]!.hand))) return { kind: 'give', seat } // 抗贡
  const biggest = tributeCandidates(hand, st.handLevel)[0]
  return biggest ? { kind: 'give', seat, card: biggest.id } : { kind: 'give', seat }
}
