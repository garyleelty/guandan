import { create } from 'zustand'
import { archivedRounds, primeMatchLog, trackMatchLog } from '../core/matchlog'
import { nextRound, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'
import { clearSolo, saveSolo } from './soloSave'

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
  /** 客人等候室看到的房主难度（null = 还没从房主那儿收到） */
  roomAiLevel: 0 | 1 | 2 | null
  match: GameState | null
  mySeat: Seat
  roomCode: string | null
  roomSeats: RoomSeatLite[] | null
  /** 观战的人（房主侧可见） */
  roomWatchers: string[]
  joining: boolean
  guestLost: boolean
  /** 断线重连后回到牌桌：给玩家一句提示 */
  reconnected: boolean
  /** 被房主请出房间时的说明（空串 = 普通掉线） */
  kicked: string
  /** 观战：只看牌，不上桌 */
  spectating: boolean
  intentSink: ((a: Action) => void) | null
  afterDispatch: (() => void) | null
  teardown: (() => void) | null
  rematchSink: (() => void) | null
  startSolo: () => void
  /** 从本机存档恢复单机牌局（连带续局前的整场牌谱） */
  resumeSolo: (match: GameState, aiLevel: 0 | 1 | 2, archive?: GameState['log'][]) => void
  dispatch: (a: Action) => void
  rematch: () => void
  backToLobby: () => void
  resetTransient: () => void
}

export const useStore = create<Store>((set, get) => ({
  screen: 'lobby',
  mode: 'solo',
  aiLevel: 1,
  roomAiLevel: null,
  match: null,
  mySeat: 0,
  roomCode: null,
  roomSeats: null,
  roomWatchers: [],
  joining: false,
  guestLost: false,
  reconnected: false,
  kicked: '',
  spectating: false,
  intentSink: null,
  afterDispatch: null,
  teardown: null,
  rematchSink: null,
  startSolo: () => {
    // 整场没结束 → 下一局先走进贡（交贡 → 还牌 → 下游领出）；否则开新的一场
    const aiLevel = get().aiLevel
    const match = nextRound(get().match, {
      seed: Math.floor(Math.random() * 1e9),
      names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'],
      isBot: [false, true, true, true],
      aiLevel,
    })
    set({
      screen: 'table',
      mode: 'solo',
      mySeat: 0,
      match,
      // 别把上一段联机经历留下的「已重新连接 / 观战 / 被请出」带进单机局
      reconnected: false,
      spectating: false,
      kicked: '',
    })
    saveSolo(match, aiLevel, archivedRounds())
  },
  resumeSolo: (match, aiLevel, archive = []) => {
    // 续局：接回已打完的牌谱，并把归档水位对齐，避免把历史里的局再记一遍战绩
    primeMatchLog(match, archive)
    set({
      screen: 'table',
      mode: 'solo',
      mySeat: 0,
      match,
      aiLevel,
      reconnected: false,
      spectating: false,
      kicked: '',
    })
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
    if (mode === 'solo') {
      // 结算页也存：刷新不该把刚打完的一局连同整场一起弄丢
      saveSolo(next, get().aiLevel, archivedRounds())
    }
    get().afterDispatch?.()
  },
  rematch: () => {
    const { mode } = get()
    if (mode === 'solo') get().startSolo()
    else get().rematchSink?.()
  },
  backToLobby: () => {
    get().teardown?.()
    clearSolo()
    set({
      screen: 'lobby',
      match: null,
      roomCode: null,
      roomSeats: null,
      roomAiLevel: null,
      roomWatchers: [],
      joining: false,
      guestLost: false,
      reconnected: false,
      spectating: false,
      kicked: '',
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

// 整场出牌记录在客户端攒：引擎每局重置 log，攒起来才能分享整场
useStore.subscribe((state) => {
  trackMatchLog(state.match, state.mySeat)
})


export const dispatchAt = (a: Action): void => useStore.getState().dispatch(a)

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__gdStore = useStore
}
