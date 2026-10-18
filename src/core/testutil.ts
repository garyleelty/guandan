import { RANK } from './cards'
import type { Card } from './cards'

const RANK_OF_STR: Record<string, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: RANK.JACK, Q: RANK.QUEEN, K: RANK.KING, A: RANK.ACE, '2': RANK.TWO,
  SJ: RANK.SJ, BJ: RANK.BJ,
}

/** 规格语法: "10" | "6♦" | "6♦1" | "SJ0" — 缺省部件在调用内自动分配保唯一 */
export function mk(...specs: string[]): Card[] {
  const used = new Set<string>() // "rank|suit|deckNo"
  const take = (rankStr: string, suit: number, deckNo: number): void => {
    const key = `${rankStr}|${suit}|${deckNo}`
    if (used.has(key)) throw new Error(`mk: duplicate ${key}`)
    used.add(key)
  }
  const findFree = (rankStr: string, suit?: number, deckNo?: number) => {
    // 槽位排布: suit×deck = 0..7 → (s,h,c,d) × (0,1)
    for (let i = 0; i < 8; i++) {
      const s = i % 4
      const d = Math.floor(i / 4)
      if (suit !== undefined && s !== suit) continue
      if (deckNo !== undefined && d !== deckNo) continue
      if (!used.has(`${rankStr}|${s}|${d}`)) return { s, d }
    }
    throw new Error(`mk: no free slot ${rankStr}`)
  }

  return specs.map((spec) => {
    const m = /^(10|[3-9]|J|Q|K|A|2|SJ|BJ)([♠♥♣♦])?([01])?$/u.exec(spec)
    if (!m) throw new Error(`mk: bad spec ${spec}`)
    const rankStr = m[1]!
    const rank = RANK_OF_STR[rankStr]
    if (rank === RANK.SJ || rank === RANK.BJ) {
      const d = m[3] !== undefined ? Number(m[3]) : _autoJoker(rankStr!, used)
      take(rankStr!, -1, d)
      return { id: `${rankStr === 'SJ' ? 'sj' : 'bj'}-${d}`, rank, suit: -1 }
    }
    const suit = m[2] ? '♠♥♣♦'.indexOf(m[2]) : undefined
    const deckNo = m[3] !== undefined ? Number(m[3]) : undefined
    const { s, d } = findFree(rankStr!, suit, deckNo)
    take(rankStr!, s, d)
    return { id: `${'shcd'[s]}${rank}-${d}`, rank, suit: s }
  })
}

function _autoJoker(rankStr: string, used: Set<string>): number {
  for (const d of [0, 1]) {
    if (!used.has(`${rankStr}|-1|${d}`)) return d
  }
  throw new Error(`mk: no free joker ${rankStr}`)
}
