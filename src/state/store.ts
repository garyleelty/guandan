import { create } from 'zustand'
import { newGame, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'

export type Screen = 'lobby' | 'room' | 'table'
export type Mode = 'solo' | 'host' | 'guest'
export type SeatKind = 'host' | 'guest' | 'ai' | 'empty'

export interface RoomSeatLite {
  seat: number
  name: string
  kind: SeatKind
}

interface Store {
  screen: Screen
  mode: Mode
  match: GameState | null
  mySeat: Seat
  roomCode: string | null
  roomSeats: RoomSeatLite[] | null
  joining: boolean
  guestLost: boolean
  intentSink: ((a: Action) => void) | null
  afterDispatch: (() => void) | null
  teardown: (() => void) | null
  startSolo: () => void
  dispatch: (a: Action) => void
  rematch: () => void
  backToLobby: () => void
  resetTransient: () => void
}

export const useStore = create<Store>((set, get) => ({
  screen: 'lobby',
  mode: 'solo',
  match: null,
  mySeat: 0,
  roomCode: null,
  roomSeats: null,
  joining: false,
  guestLost: false,
  intentSink: null,
  afterDispatch: null,
  teardown: null,
  startSolo: () =>
    set({
      screen: 'table',
      mode: 'solo',
      mySeat: 0,
      match: newGame({ seed: Math.floor(Math.random() * 1e9), names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'], isBot: [false, true, true, true] }),
    }),
  dispatch: (a) => {
    const { mode, match } = get()
    if (!match) return
    if (mode === 'guest') {
      get().intentSink?.(a)
      return
    }
    const next = step(match, a)
    if (next === match) return
    set({ match: next })
    get().afterDispatch?.()
  },
  rematch: () => {
    const { mode } = get()
    if (mode === 'solo') get().startSolo()
  },
  backToLobby: () => {
    get().teardown?.()
    set({
      screen: 'lobby',
      match: null,
      roomCode: null,
      roomSeats: null,
      joining: false,
      guestLost: false,
      intentSink: null,
      afterDispatch: null,
      teardown: null,
      mode: 'solo',
      mySeat: 0,
    })
  },
  resetTransient: () => set({ guestLost: false, joining: false }),
}))

export const dispatchAt = (a: Action): void => useStore.getState().dispatch(a)
