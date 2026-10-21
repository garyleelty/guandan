export const RANK = {
  /** 2 是最小牌（官方淮安口径：2 最小、A 之上是级牌、级牌之上才是王） */
  TWO: 2,
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
  /** 级牌比较值：大于 A(14)，小于小王(16) */
  LEVEL: 15,
  SJ: 16,
  BJ: 17,
} as const

export type Rank = (typeof RANK)[keyof typeof RANK]

export const SUIT = { SPADE: 0, HEART: 1, CLUB: 2, DIAMOND: 3 } as const

export type Card = { id: string; rank: number; suit: number }

export const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '级', 16: '小王', 17: '大王',
}

const SUIT_ABBR = ['s', 'h', 'c', 'd']

export function cardId(suit: number, rank: number, deckNo = 0): string {
  return `${SUIT_ABBR[suit] ?? 'x'}${rank}-${deckNo}`
}

export function buildDeck(): Card[] {
  const d: Card[] = []
  for (let deckNo = 0; deckNo < 2; deckNo++) {
    for (let s = 0; s < 4; s++) {
      for (let r = RANK.TWO; r <= RANK.ACE; r++) {
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

/**
 * 排序：按比较值降序（给了本局级数时，级牌排在 A 上面）。
 */
export function sortCards(hand: Card[], level?: number): Card[] {
  const val = (c: Card) => (level != null ? effectiveRank(c, level) : c.rank)
  return [...hand].sort((a, b) => val(b) - val(a) || a.suit - b.suit)
}

/** 级数（2..14，14=A）→ 牌面点数编码。 */
export function levelToRank(level: number): number {
  return level
}

/** 本局级牌：点数等于本局级数的牌，比较时算 RANK.LEVEL（大于 A、小于王）。 */
export function isLevelCard(c: Card, level: number): boolean {
  return c.rank === levelToRank(level)
}

/** 牌在本局的比较值：级牌按 15 算，其余按原点数。 */
export function effectiveRank(c: Card, level: number): number {
  return isLevelCard(c, level) ? RANK.LEVEL : c.rank
}

/** 级数的显示名：2 3 … 10 J Q K A。 */
export function levelLabel(level: number): string {
  if (level < 3) return '2'
  return RANK_LABEL[level] ?? String(level)
}

/** 从牌 id 反解点数（"s14-0" → 14，"sj-0" → 16，"bj-0" → 17）。 */
export function cardIdToRank(id: string): number {
  if (id.startsWith('sj-')) return RANK.SJ
  if (id.startsWith('bj-')) return RANK.BJ
  return Number(id.slice(1, id.lastIndexOf('-')))
}

/** 理牌（花色模式）：王置首，随后按 ♠→♥→♣→♦ 分组，组内按比较值降序（级牌在 A 之上）。 */
export function sortBySuitGroups(hand: Card[], level?: number): Card[] {
  const val = (c: Card) => (level != null ? effectiveRank(c, level) : c.rank)
  return [...hand].sort((a, b) => suitGroup(a) - suitGroup(b) || val(b) - val(a))
}

/** 王（suit = -1）单独成组且排最前。 */
function suitGroup(c: Card): number {
  return c.suit < 0 ? -1 : c.suit
}

export function deal(deck: Card[]): Card[][] {
  return [0, 1, 2, 3].map((i) => sortCards(deck.slice(i * 27, i * 27 + 27)))
}
