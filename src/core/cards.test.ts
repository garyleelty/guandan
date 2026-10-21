import { describe, expect, it } from 'vitest'
import {
  RANK,
  buildDeck,
  cardIdToRank,
  deal,
  levelLabel,
  levelToRank,
  newShuffledDeck,
  sortBySuitGroups,
  sortCards,
  cardFromId,
  cardIndexOf,
  cardIdOf,
} from './cards'
import type { Card } from './cards'

describe('buildDeck', () => {
  it('108 张，唯一 id，4 王 8 张 2', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(108)
    expect(new Set(deck.map((c) => c.id)).size).toBe(108)
    expect(deck.filter((c) => c.rank === RANK.BJ)).toHaveLength(2)
    expect(deck.filter((c) => c.rank === RANK.SJ)).toHaveLength(2)
    expect(deck.filter((c) => c.rank === RANK.TWO)).toHaveLength(8)
    expect(deck.filter((c) => c.rank === RANK.THREE)).toHaveLength(8)
  })
})

describe('newShuffledDeck', () => {
  it('seed 相同则洗牌结果一致', () => {
    const a = newShuffledDeck({ seed: 42 })
    const b = newShuffledDeck({ seed: 42 })
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })
  it('seed 不同则几乎必然不同', () => {
    const a = newShuffledDeck({ seed: 1 })
    const b = newShuffledDeck({ seed: 2 })
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id))
  })
  it('洗牌不丢牌', () => {
    const d = newShuffledDeck({ seed: 9 })
    expect(new Set(d.map((c) => c.id)).size).toBe(108)
  })
})

describe('sortCards', () => {
  it('2 最大在上、王次之，同点黑红梅方相邻', () => {
    const h = sortCards(newShuffledDeck({ seed: 7 }).slice(0, 27))
    for (let i = 1; i < h.length; i++) {
      expect(h[i - 1].rank).toBeGreaterThanOrEqual(h[i].rank)
      if (h[i - 1].rank === h[i].rank) {
        expect(h[i - 1].suit).toBeLessThanOrEqual(h[i].suit)
      }
    }
  })
  it('王无花色排在同主点之上', () => {
    const cards: Card[] = [
      { id: 'bj-0', rank: RANK.BJ, suit: -1 },
      { id: 'sA-0', rank: RANK.ACE, suit: 0 },
      { id: 'sj-0', rank: RANK.SJ, suit: -1 },
    ]
    expect(sortCards(cards).map((c) => c.id)).toEqual(['bj-0', 'sj-0', 'sA-0'])
  })
})

describe('sortBySuitGroups（理牌·花色模式）', () => {
  const hand: Card[] = [
    { id: 'd5-0', rank: 5, suit: 3 },
    { id: 'sK-0', rank: RANK.KING, suit: 0 },
    { id: 'h9-0', rank: 9, suit: 1 },
    { id: 'c5-0', rank: 5, suit: 2 },
    { id: 's5-0', rank: 5, suit: 0 },
    { id: 'bj-0', rank: RANK.BJ, suit: -1 },
    { id: 'sj-0', rank: RANK.SJ, suit: -1 },
  ]

  it('大小王置首（大王在小王之前）', () => {
    const out = sortBySuitGroups(hand)
    expect(out.slice(0, 2).map((c) => c.id)).toEqual(['bj-0', 'sj-0'])
  })

  it('花色顺序 ♠ → ♥ → ♣ → ♦', () => {
    const out = sortBySuitGroups(hand)
    const suits = out.filter((c) => c.suit >= 0).map((c) => c.suit)
    expect(suits).toEqual([...suits].sort((a, b) => a - b))
    expect(suits).toEqual([0, 0, 1, 2, 3])
  })

  it('同花色全部相邻', () => {
    const out = sortBySuitGroups(hand)
    const suits = out.filter((c) => c.suit >= 0).map((c) => c.suit)
    for (let i = 1; i < suits.length; i++) {
      if (suits[i] !== suits[i - 1]) {
        expect(suits.slice(i).includes(suits[i - 1]!)).toBe(false)
      }
    }
  })

  it('组内点数降序', () => {
    const out = sortBySuitGroups(hand)
    const spades = out.filter((c) => c.suit === 0)
    expect(spades.map((c) => c.rank)).toEqual([RANK.KING, 5])
  })

  it('同点同花色（两副牌重复）保持输入相对顺序', () => {
    const dup: Card[] = [
      { id: 's5-0', rank: 5, suit: 0 },
      { id: 's5-1', rank: 5, suit: 0 },
    ]
    expect(sortBySuitGroups(dup).map((c) => c.id)).toEqual(['s5-0', 's5-1'])
    expect(sortBySuitGroups([...dup].reverse()).map((c) => c.id)).toEqual(['s5-1', 's5-0'])
  })

  it('不修改入参，返回新数组', () => {
    const input = [...hand]
    const out = sortBySuitGroups(input)
    expect(input.map((c) => c.id)).toEqual(hand.map((c) => c.id))
    expect(out).not.toBe(input)
  })

  it('空数组 / 单张不崩', () => {
    expect(sortBySuitGroups([])).toEqual([])
    const one: Card = { id: 'sA-0', rank: RANK.ACE, suit: 0 }
    expect(sortBySuitGroups([one])).toEqual([one])
  })

  it('对整副 27 张手牌排序：牌不丢、同花相邻、王在最前', () => {
    const h = sortBySuitGroups(newShuffledDeck({ seed: 21 }).slice(0, 27))
    expect(h).toHaveLength(27)
    expect(new Set(h.map((c) => c.id)).size).toBe(27)
    const jokers = h.filter((c) => c.suit === -1)
    expect(h.slice(0, jokers.length).every((c) => c.suit === -1)).toBe(true)
    const suits = h.filter((c) => c.suit >= 0).map((c) => c.suit)
    for (let i = 1; i < suits.length; i++) {
      if (suits[i] !== suits[i - 1]) expect(suits.slice(i).includes(suits[i - 1]!)).toBe(false)
    }
  })
})

describe('级牌（level）', () => {
  it('2 级对应牌面点数 2，3..14 保持不变', () => {
    expect(levelToRank(2)).toBe(RANK.TWO)
    expect(levelToRank(3)).toBe(3)
    expect(levelToRank(14)).toBe(RANK.ACE)
  })

  it('级数显示名：2 3 … 10 J Q K A', () => {
    expect(levelLabel(2)).toBe('2')
    expect(levelLabel(10)).toBe('10')
    expect(levelLabel(11)).toBe('J')
    expect(levelLabel(12)).toBe('Q')
    expect(levelLabel(13)).toBe('K')
    expect(levelLabel(14)).toBe('A')
  })

  it('2 级在手上能找到对应的 2', () => {
    const hand = newShuffledDeck({ seed: 5 }).filter((c) => c.rank === levelToRank(2))
    expect(hand.length).toBeGreaterThan(0)
  })
})

describe('cardIdToRank', () => {
  it('普通牌 id 反解点数', () => {
    expect(cardIdToRank('s14-0')).toBe(RANK.ACE)
    expect(cardIdToRank('d2-1')).toBe(RANK.TWO)
    expect(cardIdToRank('c3-0')).toBe(RANK.THREE)
  })
  it('王 id 反解点数', () => {
    expect(cardIdToRank('sj-0')).toBe(RANK.SJ)
    expect(cardIdToRank('bj-1')).toBe(RANK.BJ)
  })
  it('整副牌反解后与原牌一致', () => {
    const deck = buildDeck()
    expect(deck.every((c) => cardIdToRank(c.id) === c.rank)).toBe(true)
  })
})

describe('deal', () => {
  it('27×4 张、无重叠、覆盖全牌', () => {
    const hands = deal(newShuffledDeck({ seed: 3 }))
    hands.forEach((h) => expect(h).toHaveLength(27))
    const ids = hands.flat().map((c) => c.id)
    expect(new Set(ids).size).toBe(108)
  })
  it('每人手牌已排序', () => {
    const hands = deal(newShuffledDeck({ seed: 11 }))
    for (const h of hands) {
      for (let i = 1; i < h.length; i++) {
        expect(h[i - 1].rank).toBeGreaterThanOrEqual(h[i].rank)
      }
    }
  })
})

describe('cardFromId（牌 id 还原整张牌）', () => {
  it('普通牌、王都能从 id 还原', () => {
    expect(cardFromId('s14-0')).toEqual({ id: 's14-0', rank: 14, suit: 0 })
    expect(cardFromId('h9-1')).toEqual({ id: 'h9-1', rank: 9, suit: 1 })
    expect(cardFromId('sj-0')).toEqual({ id: 'sj-0', rank: RANK.SJ, suit: -1 })
    expect(cardFromId('bj-1')).toEqual({ id: 'bj-1', rank: RANK.BJ, suit: -1 })
  })
  it('和 cardIdToRank 一致', () => {
    for (const id of ['s3-0', 'd10-1', 'c13-0', 'h2-1']) {
      expect(cardFromId(id).rank).toBe(cardIdToRank(id))
    }
  })
})

describe('牌序号（复盘链接的紧凑编码）', () => {
  it('108 张牌的序号与 id 互转一致', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(108)
    deck.forEach((c, i) => {
      expect(cardIndexOf(c.id)).toBe(i)
      expect(cardIdOf(i)).toBe(c.id)
    })
  })
  it('序号落在 0..107', () => {
    for (const c of buildDeck()) {
      const i = cardIndexOf(c.id)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(108)
    }
  })
})
