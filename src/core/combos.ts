import { RANK } from './cards'
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

function groupByRank(cards: Card[]): Group[] {
  const map = new Map<number, Group>()
  for (const c of cards) {
    const g = map.get(c.rank) ?? { rank: c.rank, cards: [] }
    g.cards.push(c)
    map.set(c.rank, g)
  }
  return [...map.values()].sort((a, b) => a.rank - b.rank)
}

export function identify(cards: Card[]): Combo | null {
  const n = cards.length
  if (n === 0 || n > 24) return null
  const groups = groupByRank(cards)

  if (n === 1) return { type: ComboType.SINGLE, rank: groups[0]!.rank, cards }
  if (n === 2) {
    const g = groups[0]!
    if (groups.length === 1 && g.rank < RANK.SJ) return { type: ComboType.PAIR, rank: g.rank, cards }
    return null
  }
  if (n === 3) return groups.length === 1 ? { type: ComboType.TRIPLE, rank: groups[0]!.rank, cards } : null

  const realGroups = groups.filter((g) => g.rank !== RANK.SJ && g.rank !== RANK.BJ)

  // 天炸：恰好 4 王（SJ×2 + BJ×2）
  if (groups.every((g) => g.rank === RANK.SJ || g.rank === RANK.BJ)) {
    const sj = groups.find((g) => g.rank === RANK.SJ)
    const bj = groups.find((g) => g.rank === RANK.BJ)
    if (n === 4 && sj && bj && sj.cards.length === 2 && bj.cards.length === 2) {
      return { type: ComboType.JOKERS, rank: RANK.BJ, count: 4, cards }
    }
    return null
  }
  if (realGroups.length !== groups.length) return null

  // 炸弹：全部同点
  if (groups.length === 1) {
    const g = groups[0]!
    if (n >= 4 && n <= 8) return { type: ComboType.BOMB, rank: g.rank, count: n, cards }
    return null
  }

  // 三带二
  if (n === 5 && groups.length === 2) {
    const triple = groups.find((g) => g.cards.length === 3)
    const pair = groups.find((g) => g.cards.length === 2)
    if (triple && pair) return { type: ComboType.TRIPLE_PAIR, rank: triple.rank, cards }
    return null
  }

  // 顺系：每组数量一致且连续（2 不可入）
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
    if (n === 5 && size === 1) {
      const top = groups[groups.length - 1]!
      const suits = new Set(cards.map((c) => c.suit))
      if (suits.size === 1) {
        return { type: ComboType.SFLUSH, rank: top.rank, count: 1, cards }
      }
      return { type: ComboType.STRAIGHT, rank: top.rank, count: 1, cards }
    }
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
