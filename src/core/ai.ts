import { teamOf, legalMoves } from './engine'
import type { Action, GameState, Seat } from './engine'

const Special = { BOMB: 7, SFLUSH: 8, JOKERS: 9 } as const

export function aiMove(st: GameState, seat: Seat): Action {
  if (st.phase !== 'playing' || st.turn !== seat) return { kind: 'pass', seat }
  const moves = legalMoves(st, seat)
  const table = st.trick.table
  if (!table) {
    return { kind: 'play', seat, cards: moves[0]!.cards.map((c) => c.id) }
  }
  if (teamOf(table.seat) === teamOf(seat)) {
    return { kind: 'pass', seat }
  }
  const plain = moves.filter((m) => m.type !== Special.BOMB && m.type !== Special.SFLUSH && m.type !== Special.JOKERS)
  const choice = plain[0] ?? moves[0]
  if (!choice) return { kind: 'pass', seat }
  return { kind: 'play', seat, cards: choice.cards.map((c) => c.id) }
}
