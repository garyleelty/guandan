import { RANK, RANK_LABEL } from '../core/cards'
import type { Card } from '../core/cards'

/**
 * 堆叠视图的数据模型：行 = 点数（按比较值从高到低，级牌置顶、王牌最上），
 * 列 = 花色（♠♥♣♦，王单独一行）。同点数纵向堆叠、横向按花色对齐，
 * 一眼能看出顺子/同花顺/连对的骨架。
 */

export type StackCell = {
  /** rank×suit 组合键 */
  key: string
  rank: number
  suit: number
  /** 同点同花的 1–2 张牌（两副牌） */
  cards: Card[]
}

export type StackRow = {
  /** 排序用的比较值 */
  eff: number
  label: string
  cells: StackCell[]
}

export type StackView = {
  rows: StackRow[]
  /** 构成同花顺（≥5 连）的格子 key，渲染时高亮 */
  flushRun: Set<string>
}

export function buildStackView(hand: Card[], levelCardRank?: number): StackView {
  const eff = (c: Card): number => (levelCardRank != null && c.rank === levelCardRank ? RANK.LEVEL : c.rank)

  // 行：按比较值分组（王 → 级牌 → A..2）
  const byEff = new Map<number, Card[]>()
  for (const c of hand) {
    const e = eff(c)
    const arr = byEff.get(e) ?? []
    arr.push(c)
    byEff.set(e, arr)
  }
  const rows: StackRow[] = [...byEff.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([e, cards]) => {
      const bySuit = new Map<number, Card[]>()
      for (const c of cards) {
        const arr = bySuit.get(c.suit) ?? []
        arr.push(c)
        bySuit.set(c.suit, arr)
      }
      const cells = [...bySuit.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([suit, cs]) => ({ key: `${e}:${suit}`, rank: cards[0]!.rank, suit, cards: cs }))
      const rank0 = cards[0]!.rank
      const label = rank0 >= RANK.SJ ? (RANK_LABEL[rank0] ?? '') : (RANK_LABEL[rank0] ?? String(rank0))
      return { eff: e, label, cells }
    })

  return { rows, flushRun: findFlushRuns(hand, levelCardRank) }
}

/** 同点同花格子 key（与 buildStackView 的 key 同构），供高亮用。 */
const cellKey = (rank: number, suit: number, levelCardRank?: number): string =>
  `${levelCardRank != null && rank === levelCardRank ? RANK.LEVEL : rank}:${suit}`

/**
 * 同花顺高亮：每个花色列里点数 ≥5 连的整段算一条（A2345 也算）。
 * 只看天然连张；逢人配补格的情况由出牌提示负责，这里不掺和。
 */
export function findFlushRuns(hand: Card[], levelCardRank?: number): Set<string> {
  const out = new Set<string>()
  const bySuit = new Map<number, Set<number>>()
  for (const c of hand) {
    if (c.suit < 0 || c.rank < RANK.TWO || c.rank > RANK.ACE) continue
    const set = bySuit.get(c.suit) ?? new Set<number>()
    set.add(c.rank)
    bySuit.set(c.suit, set)
  }
  for (const [suit, ranks] of bySuit) {
    const run: number[] = []
    const flush = (): void => {
      if (run.length >= 5) for (const r of run) out.add(cellKey(r, suit, levelCardRank))
    }
    for (let lo = RANK.TWO; lo <= RANK.ACE; lo++) {
      if (ranks.has(lo)) {
        run.push(lo)
      } else {
        flush()
        run.length = 0
      }
    }
    flush()
    // A 当 1：A-2-3-4-5
    if ([RANK.ACE, RANK.TWO, 3, 4, 5].every((r) => ranks.has(r))) {
      for (const r of [RANK.ACE, RANK.TWO, 3, 4, 5]) out.add(cellKey(r, suit, levelCardRank))
    }
  }
  return out
}
