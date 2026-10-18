export const RANK = {
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
  ACE: 14,
  SJ: 16,
  BJ: 17,
  TWO: 18,
} as const

export type Rank = (typeof RANK)[keyof typeof RANK]

export const SUIT = { SPADE: 0, HEART: 1, CLUB: 2, DIAMOND: 3 } as const

export type Card = { id: string; rank: number; suit: number }

export const RANK_LABEL: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 16: '小王', 17: '大王', 18: '2',
}

const SUIT_ABBR = ['s', 'h', 'c', 'd']

export function cardId(suit: number, rank: number, deckNo = 0): string {
  return `${SUIT_ABBR[suit] ?? 'x'}${rank}-${deckNo}`
}

const isFaceRank = (r: number) => (r >= RANK.THREE && r <= RANK.ACE) || r === RANK.TWO

export function buildDeck(): Card[] {
  const d: Card[] = []
  for (let deckNo = 0; deckNo < 2; deckNo++) {
    for (let s = 0; s < 4; s++) {
      for (let r = RANK.THREE; r <= RANK.TWO; r++) {
        if (!isFaceRank(r)) continue
        d.push({ id: cardId(s, r, deckNo), rank: r, suit: s })
      }
    }
    d.push({ id: `sj-${deckNo}`, rank: RANK.SJ, suit: -1 })
    d.push({ id: `bj-${deckNo}`, rank: RANK.BJ, suit: -1 })
  }
  return d
}

export function newShuffledDeck(opts?: { seed?: number }): Card[] {
  const cards = buildDeck()
  let x = (opts?.seed ?? (Date.now() >>> 0)) | 1
  const rand = () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = cards[i]
    cards[i] = cards[j]
    cards[j] = t
  }
  return cards
}

export function sortCards(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => b.rank - a.rank || a.suit - b.suit)
}

export function deal(deck: Card[]): Card[][] {
  return [0, 1, 2, 3].map((i) => sortCards(deck.slice(i * 27, i * 27 + 27)))
}
