import { create } from 'zustand'
import { nextRound, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'

export type Screen = 'lobby' | 'room' | 'table'
export type Mode = 'solo' | 'host' | 'guest'
export type SeatKind = 'host' | 'guest' | 'ai' | 'empty'

export interface RoomSeatLite {
  seat: number
  name: string
  kind: SeatKind
}

/**
 * 下一局的起始条件：级数接着上一局打，下一局由上一局的头游领出；
 * 若上一局已打过 A（整场结束），则从 2 级重新开始一场（战绩也清零）。
 */
interface Store {
  screen: Screen
  mode: Mode
  /** AI 难度：0 简单 / 1 普通 / 2 难 */
  aiLevel: 0 | 1 | 2
  match: GameState | null
  mySeat: Seat
  roomCode: string | null
  roomSeats: RoomSeatLite[] | null
  joining: boolean
  guestLost: boolean
  intentSink: ((a: Action) => void) | null
  afterDispatch: (() => void) | null
  teardown: (() => void) | null
  rematchSink: (() => void) | null
  startSolo: () => void
  dispatch: (a: Action) => void
  rematch: () => void
  backToLobby: () => void
  resetTransient: () => void
}

export const useStore = create<Store>((set, get) => ({
  screen: 'lobby',
  mode: 'solo',
  aiLevel: 1,
  match: null,
  mySeat: 0,
  roomCode: null,
  roomSeats: null,
  joining: false,
  guestLost: false,
  intentSink: null,
  afterDispatch: null,
  teardown: null,
  rematchSink: null,
  startSolo: () => {
    // 整场没结束 → 下一局先走进贡（交贡 → 还牌 → 下游领出）；否则开新的一场
    const match = nextRound(get().match, {
      seed: Math.floor(Math.random() * 1e9),
      names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'],
      isBot: [false, true, true, true],
      aiLevel: get().aiLevel,
    })
    set({ screen: 'table', mode: 'solo', mySeat: 0, match })
  },
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
    else get().rematchSink?.()
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
      rematchSink: null,
      mode: 'solo',
      mySeat: 0,
    })
  },
  resetTransient: () => set({ guestLost: false, joining: false }),
}))

export const dispatchAt = (a: Action): void => useStore.getState().dispatch(a)

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__gdStore = useStore
}
