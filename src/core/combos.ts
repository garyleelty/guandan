import { RANK, effectiveRank } from './cards'
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

/**
 * 识别牌型。level = 本局级数（2..14）：级数对应的点数牌按 RANK.LEVEL 比较（大于 A、小于王），
 * 但在顺子里仍按原点数算。
 */
export function identify(cards: Card[], level: number): Combo | null {
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
  const per = groups.map((g) => g.cards.length)
  const allSame = per.every((c) => c === per[0])
  const consecutive = (gs: Group[]) => {
    for (let i = 1; i < gs.length; i++) {
      if (gs[i]!.rank !== gs[i - 1]!.rank + 1) return false
    }
    return true
  }

  if (allSame && consecutive(groups)) {
    const size = per[0]!
    if (size === 2 && groups.length >= 3) {
      return { type: ComboType.PAIRS, rank: groups[groups.length - 1]!.rank, count: groups.length, cards }
    }
    if (size === 3 && groups.length >= 2) {
      return { type: ComboType.PLATE, rank: groups[groups.length - 1]!.rank, count: groups.length, cards }
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

  if (aIsSf) return !bIsSf || (bIsSf && a.rank > b.rank)
  if (aIsBomb) {
    if (bIsSf) return false
    if (bIsBomb) return a.count! > b.count! || (a.count === b.count && a.rank > b.rank)
    return true
  }
  // a 是基础型
  if (aIsSf || aIsBomb || bIsSf || bIsBomb) return false
  if (a.type !== b.type) return false
  if ((a.count ?? 1) !== (b.count ?? 1)) return false
  return a.rank > b.rank
}
