import { create } from 'zustand'
import { newGame, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'

export type Screen = 'lobby' | 'table'

interface Store {
  screen: Screen
  match: GameState | null
  mySeat: Seat
  mode: 'solo' | 'host' | 'guest'
  startSolo: () => void
  dispatch: (a: Action) => void
  rematch: () => void
  backToLobby: () => void
}

export const useStore = create<Store>((set, get) => ({
  screen: 'lobby',
  match: null,
  mySeat: 0,
  mode: 'solo',
  startSolo: () =>
    set({
      screen: 'table',
      mode: 'solo',
      mySeat: 0,
      match: newGame({ seed: Math.floor(Math.random() * 1e9), names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'], isBot: [false, true, true, true] }),
    }),
  dispatch: (a) => {
    const m = get().match
    if (!m) return
    const next = step(m, a)
    if (next === m) return
    set({ match: next })
  },
  rematch: () => {
    const { mode } = get()
    if (mode === 'solo') get().startSolo()
  },
  backToLobby: () => set({ screen: 'lobby', match: null }),
}))

export const dispatchAt = (a: Action): void => useStore.getState().dispatch(a)
