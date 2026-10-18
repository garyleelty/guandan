import type { Action, GameState, Seat } from '../core/engine'

export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function makeRoomCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

export const peerIdOf = (code: string): string => `gd-${code}`
export const codeOf = (peerId: string): string => peerId.replace(/^gd-/, '')

export function shareLink(code: string, origin = location.origin, base = location.pathname): string {
  return `${origin}${base}?r=${code}`
}

export function codeFromUrl(): string | null {
  const r = new URLSearchParams(location.search).get('r')
  return r && /^[2-9A-HJKMNP-Z]{6}$/.test(r.toUpperCase()) ? r.toUpperCase() : null
}

export type Msg =
  | { t: 'hello'; name: string }
  | { t: 'welcome'; seat: Seat; names: (string | null)[] }
  | { t: 'state'; state: SerializedState; seat: Seat }
  | { t: 'intent'; action: Action }
  | { t: 'start' }
  | { t: 'leave' }

export interface SerializedState {
  phase: GameState['phase']
  levels: GameState['levels']
  matchWinner: GameState['matchWinner']
  players: { seat: Seat; name: string; hand: { id: string; rank: number; suit: number }[]; finishOrder: number | null }[]
  turn: Seat
  trick: {
    leader: Seat
    table: { seat: Seat; combo: { type: number; rank: number; count?: number; cards: { id: string; rank: number; suit: number }[] } } | null
    pending: Seat[]
    lastPlay: { seat: Seat; combo: { type: number; rank: number; count?: number; cards: { id: string; rank: number; suit: number }[] } } | null
  }
  finishCount: number
  log: GameState['log']
}

const filler = (n: number): { id: string; rank: number; suit: number }[] =>
  Array.from({ length: n }, (_, i) => ({ id: `hidden-${i}`, rank: 0, suit: 0 }))

/** 只向该座 disclose 自己的手牌，他人以等长占位牌替代（数量保持真实） */
export function serializeFor(st: GameState, seat: Seat): SerializedState {
  const players = st.players.map((p) =>
    p.seat === seat
      ? { seat: p.seat, name: p.name, hand: p.hand, finishOrder: p.finishOrder }
      : { seat: p.seat, name: p.name, hand: filler(p.hand.length), finishOrder: p.finishOrder },
  )
  return {
    phase: st.phase,
    levels: st.levels,
    matchWinner: st.matchWinner,
    players: players as SerializedState['players'],
    turn: st.turn,
    trick: st.trick as unknown as SerializedState['trick'],
    finishCount: st.finishCount,
    log: st.log,
  }
}
