import { RANK, effectiveRank, isWild } from './cards'
import type { Card } from './cards'

export const ComboType = {
  SINGLE: 0,
  PAIR: 1,
  TRIPLE: 2,
  TRIPLE_PAIR: 3,
  STRAIGHT: 4,
  PAIRS: 5,
  PLATE: 6,
  BOMB: 7,
  SFLUSH: 8,
  JOKERS: 9,
} as const
export type ComboType = (typeof ComboType)[keyof typeof ComboType]

export type Combo = {
  type: ComboType
  rank: number
  count?: number
  cards: Card[]
}

type Group = { rank: number; cards: Card[] }

function groupByRank(cards: Card[], key: (c: Card) => number): Group[] {
  const map = new Map<number, Group>()
  for (const c of cards) {
    const r = key(c)
    const g = map.get(r) ?? { rank: r, cards: [] }
    g.cards.push(c)
    map.set(r, g)
  }
  return [...map.values()].sort((a, b) => a.rank - b.rank)
}

/**
 * 顺子的比较值：A 可高可低——最小的顺子是 A-2-3-4-5（算 5），最大的是 10-J-Q-K-A（算 A）。
 * 级牌在顺子里按原点数算（官方口径：级牌只在不成牌型时按级牌算）。
 */
function straightRank(cards: Card[]): number | null {
  if (cards.length !== 5) return null
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b)
  if (new Set(ranks).size !== 5) return null
  const r = ranks[0] === RANK.TWO && ranks[4] === RANK.ACE ? [1, ...ranks.slice(0, 4)] : ranks
  for (let i = 1; i < r.length; i++) if (r[i] !== r[i - 1] + 1) return null
  return r[r.length - 1]!
}

/** 牌型强弱（只用于万能牌多解时挑一个合理解释）。 */
const TYPE_STRENGTH: Record<number, number> = {
  [ComboType.SINGLE]: 0,
  [ComboType.PAIR]: 1,
  [ComboType.TRIPLE]: 1,
  [ComboType.TRIPLE_PAIR]: 1,
  [ComboType.STRAIGHT]: 2,
  [ComboType.PAIRS]: 2,
  [ComboType.PLATE]: 2,
  [ComboType.BOMB]: 3,
  [ComboType.SFLUSH]: 4,
  [ComboType.JOKERS]: 5,
}

/** 五连的窗口（自然点数）：2-6 … 10-A，以及 A 当 1 的 A-2-3-4-5。 */
export function straightWindows(): number[][] {
  const out: number[][] = []
  for (let lo = RANK.TWO; lo <= 10; lo++) out.push([lo, lo + 1, lo + 2, lo + 3, lo + 4])
  out.push([RANK.ACE, RANK.TWO, 3, 4, 5])
  return out
}

/**
 * 识别牌型。level = 本局级数（2..14）：级数对应的点数牌按 RANK.LEVEL 比较（大于 A、小于王），
 * 但在顺子里仍按原点数算。
 *
 * 逢人配（红桃级牌）：可以当任意牌点（除大小王）搭配使用；单出时只算普通级牌。
 */
export function identify(cards: Card[], level: number): Combo | null {
  const wilds = cards.filter((c) => isWild(c, level))
  if (wilds.length === 0) return identifyPlain(cards, level)
  if (cards.length === 1) return identifyPlain(cards, level) // 单出：只算普通级牌

  // 枚举万能牌的替代：点数 2..A（花色沿用自身），同花顺另走特例
  const combos: Combo[] = []
  const rankOptions: number[] = []
  for (let r = RANK.TWO; r <= RANK.ACE; r++) rankOptions.push(r)
  if (wilds.length === 1) {
    const w = wilds[0]!
    for (const r of rankOptions) {
      const sub = cards.map((c) => (c.id === w.id ? { ...c, rank: r } : c))
      const combo = identifyPlain(sub, level)
      // 解释用替代后的牌点，但交出去的仍是原牌
      if (combo) combos.push({ ...combo, cards })
    }
    // 同花顺：万能配补上同花色的那一张
    if (cards.length === 5) {
      const others = cards.filter((c) => c.id !== w.id)
      const suits = new Set(others.map((c) => c.suit))
      if (suits.size === 1) {
        const suit = [...suits][0]!
        for (const win of straightWindows()) {
          const missing = win.find((r) => !others.some((c) => c.rank === r))
          if (missing === undefined) continue
          const sub = cards.map((c) => (c.id === w.id ? { ...c, rank: missing, suit } : c))
          const combo = identifyPlain(sub, level)
          if (combo) combos.push({ ...combo, cards })
        }
      }
    }
  } else {
    // 两张万能配：同点替代（成对子/三张/炸弹）
    for (const r of rankOptions) {
      const sub = cards.map((c) => (isWild(c, level) ? { ...c, rank: r } : c))
      const combo = identifyPlain(sub, level)
      if (combo) combos.push({ ...combo, cards })
    }
    // 分占两格：两张万能配各顶一个点数（顺子/连对/钢板都能这么凑）
    const [w1, w2] = wilds
    for (const r1 of rankOptions) {
      for (const r2 of rankOptions) {
        if (r1 === r2) continue
        const sub = cards.map((c) =>
          c.id === w1.id ? { ...c, rank: r1 } : c.id === w2.id ? { ...c, rank: r2 } : c,
        )
        const combo = identifyPlain(sub, level)
        if (combo) combos.push({ ...combo, cards })
      }
    }
  }
  if (combos.length === 0) return identifyPlain(cards, level)
  // 多解时：牌型强的优先，同型取点数大的
  return combos.reduce((best, c) => {
    const bs = TYPE_STRENGTH[best.type] ?? 0
    const cs = TYPE_STRENGTH[c.type] ?? 0
    if (cs !== bs) return cs > bs ? c : best
    return c.rank > best.rank ? c : best
  })
}

function identifyPlain(cards: Card[], level: number): Combo | null {
  const n = cards.length
  if (n === 0 || n > 24) return null

  // 天炸：恰好 4 王（2 小王 + 2 大王）
  if (n === 4) {
    const sj = cards.filter((c) => c.rank === RANK.SJ)
    const bj = cards.filter((c) => c.rank === RANK.BJ)
    if (sj.length === 2 && bj.length === 2) {
      return { type: ComboType.JOKERS, rank: RANK.BJ, count: 4, cards }
    }
  }

  // 顺子 / 同花顺：按原点数判断（A 可高可低）
  if (n === 5) {
    const top = straightRank(cards)
    if (top != null) {
      const suits = new Set(cards.map((c) => c.suit))
      if (suits.size === 1) return { type: ComboType.SFLUSH, rank: top, count: 1, cards }
      return { type: ComboType.STRAIGHT, rank: top, count: 1, cards }
    }
  }

  const groups = groupByRank(cards, (c) => effectiveRank(c, level))

  if (n === 1) return { type: ComboType.SINGLE, rank: groups[0]!.rank, cards }
  if (n === 2) {
    const g = groups[0]!
    // 一对：同点数即可；王对要同色（大小王各一不算对）
    if (groups.length === 1) return { type: ComboType.PAIR, rank: g.rank, cards }
    return null
  }
  if (n === 3) {
    const g = groups[0]!
    if (groups.length === 1 && g.rank < RANK.SJ) return { type: ComboType.TRIPLE, rank: g.rank, cards }
    return null
  }

  const realGroups = groups.filter((g) => g.rank !== RANK.SJ && g.rank !== RANK.BJ)
  if (realGroups.length !== groups.length) return null

  // 炸弹：全部同点（两副牌最多 8 张）
  if (groups.length === 1) {
    const g = groups[0]!
    if (n >= 4 && n <= 8) return { type: ComboType.BOMB, rank: g.rank, count: n, cards }
    return null
  }

  // 三带二：比较只看三张
  if (n === 5 && groups.length === 2) {
    const triple = groups.find((g) => g.cards.length === 3)
    const pair = groups.find((g) => g.cards.length === 2)
    if (triple && pair) return { type: ComboType.TRIPLE_PAIR, rank: triple.rank, cards }
    return null
  }

  // 顺系：每组数量一致且比较值连续（级牌那一组不与相邻点数连续）
  // A 在连对/钢板里可当 1（最小者），也可当 K+1
  const per = groups.map((g) => g.cards.length)
  const allSame = per.every((c) => c === per[0])
  const lowAce = groups[0]!.rank === RANK.TWO && groups.some((g) => g.rank === RANK.ACE)
  const val = (r: number) => (lowAce && r === RANK.ACE ? 1 : r)
  const consecutive = (gs: Group[]) => {
    for (let i = 1; i < gs.length; i++) {
      if (val(gs[i]!.rank) !== val(gs[i - 1]!.rank) + 1) return false
    }
    return true
  }
  const top = val(groups[groups.length - 1]!.rank)

  if (allSame && consecutive(groups)) {
    const size = per[0]!
    if (size === 2 && groups.length >= 3) {
      return { type: ComboType.PAIRS, rank: top, count: groups.length, cards }
    }
    if (size === 3 && groups.length >= 2) {
      return { type: ComboType.PLATE, rank: top, count: groups.length, cards }
    }
  }
  return null
}

export function beats(a: Combo, b: Combo): boolean {
  if (a.type === ComboType.JOKERS) return b.type !== ComboType.JOKERS
  if (b.type === ComboType.JOKERS) return false

  const aIsSf = a.type === ComboType.SFLUSH
  const bIsSf = b.type === ComboType.SFLUSH
  const aIsBomb = a.type === ComboType.BOMB
  const bIsBomb = b.type === ComboType.BOMB

  if (aIsSf) {
    if (bIsSf) return a.rank > b.rank
    // 同花顺压五张及以下的炸弹，六张及以上的炸弹反压同花顺
    if (bIsBomb) return (b.count ?? 0) <= 5
    return true
  }
  if (aIsBomb) {
    if (bIsSf) return (a.count ?? 0) >= 6
    if (bIsBomb) return a.count! > b.count! || (a.count === b.count && a.rank > b.rank)
    return true
  }
  // a 是基础型
  if (aIsSf || aIsBomb || bIsSf || bIsBomb) return false
  if (a.type !== b.type) return false
  if ((a.count ?? 1) !== (b.count ?? 1)) return false
  return a.rank > b.rank
}
