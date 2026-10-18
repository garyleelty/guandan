import { describe, expect, it } from 'vitest'
import { RANK, buildDeck, deal, newShuffledDeck, sortCards } from './cards'
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
