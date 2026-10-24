import Peer from 'peerjs'
import { canAntiTribute } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'

export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function makeRoomCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

export const peerIdOf = (code: string): string => `gd-${code}`
export const codeOf = (peerId: string): string => peerId.replace(/^gd-/, '')

/**
 * PeerJS 信令配置：默认走公共云（0.peerjs.com），可用环境变量指向自建服务器。
 * 公共云偶尔抽风，自托管是唯一稳的路子（冒烟脚本与自部署都用这条）。
 */
export function peerOpts(): { host: string; port: number; path: string; secure: boolean } | undefined {
  const host = import.meta.env.VITE_PEER_HOST
  if (!host) return undefined
  return {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT ?? 443),
    path: import.meta.env.VITE_PEER_PATH ?? '/',
    secure: import.meta.env.VITE_PEER_SECURE !== '0',
  }
}

/** PeerJS 的构造签名在类型里写得不全（id 省略 + 自建信令），这里统一封装。 */
export function newPeer(id?: string): Peer {
  const Ctor = Peer as unknown as new (id?: string, opts?: Record<string, unknown>) => Peer
  return new Ctor(id, peerOpts())
}

export function shareLink(code: string, origin = location.origin, base = location.pathname): string {
  return `${origin}${base}?r=${code}`
}

export function codeFromUrl(): string | null {
  const r = new URLSearchParams(location.search).get('r')
  return r && /^[2-9A-HJKMNP-Z]{6}$/.test(r.toUpperCase()) ? r.toUpperCase() : null
}

export type Msg =
  /** 客人打招呼：带一个本机记住的 token，刷新页面后能坐回原座；watch = 只看牌不上桌；
   *  seat = 断线重连时带上自己原来的座（房主转移后新房主不认识 token，靠 座位+名字 认领） */
  | { t: 'hello'; name: string; token?: string; watch?: boolean; seat?: Seat }
  | {
      t: 'welcome'
      /** -1 表示观战（不上桌） */
      seat: Seat | -1
      /** 各座信息（名字 + 身份），客人据此画等候室 */
      seats: { seat: Seat; name: string; kind: 'host' | 'guest' | 'ai' | 'empty' }[]
      reconnected?: boolean
    }
  | { t: 'state'; state: SerializedState; seat: Seat }
  /** 座位表变了（有人进出 / 加 AI / 踢人）：等候室要跟着更新 */
  | {
      t: 'seats'
      seats: { seat: Seat; name: string; kind: 'host' | 'guest' | 'ai' | 'empty' }[]
      /** 房主当前选的 AI 难度（客人等候室要显示同一个） */
      aiLevel: 0 | 1 | 2
    }
  | { t: 'intent'; action: Action }
  | { t: 'start' }
  | { t: 'leave' }
  /** 房主心跳：客人 12 秒收不到就当房主挂了（自动重连 / 触发房主转移） */
  | { t: 'ping' }
  /** 房主把某位客人请出房间 */
  | { t: 'kick'; seat: Seat; reason?: string }

/** 进贡状态多带一个抗贡可用性：客人看不到别人手牌，由房主算好发过来 */
export type SerializedTribute = NonNullable<GameState['tribute']> & { antiOk?: boolean }

export interface SerializedState {
  phase: GameState['phase']
  levels: GameState['levels']
  /** 本局级数：客人也要靠它算级牌、逢人配、手牌排序 */
  handLevel: GameState['handLevel']
  /** 上一局下游那队：结算页要据此说明「本局赢不了整场」 */
  dwellerTeam: GameState['dwellerTeam']
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
  history: GameState['history']
  tribute: SerializedTribute | null
  aiLevel: GameState['aiLevel']
}

const filler = (n: number): { id: string; rank: number; suit: number }[] =>
  Array.from({ length: n }, (_, i) => ({ id: `hidden-${i}`, rank: 0, suit: 0 }))

/**
 * 序列化给某一座：
 * - 默认：只公开自己的手牌，别家用等长占位牌（数量保持真实）；
 * - hideHands：观战用，谁的手牌都不发；
 * - fullHands：玩家客人拿全量状态（房主转移时任何一位客人都要能接管当权威，
 *   P2P 朋友局信任客户端；观战者永远不走这条路）。
 */
export function serializeFor(
  st: GameState,
  seat: Seat,
  opts?: { hideHands?: boolean; fullHands?: boolean },
): SerializedState {
  const disclose = (p: (typeof st.players)[0]): boolean =>
    opts?.hideHands === true ? false : opts?.fullHands === true || p.seat === seat
  const players = st.players.map((p) =>
    disclose(p)
      ? { seat: p.seat, name: p.name, hand: p.hand, finishOrder: p.finishOrder }
      : { seat: p.seat, name: p.name, hand: filler(p.hand.length), finishOrder: p.finishOrder },
  )
  return {
    phase: st.phase,
    levels: st.levels,
    handLevel: st.handLevel,
    dwellerTeam: st.dwellerTeam,
    matchWinner: st.matchWinner,
    players: players as SerializedState['players'],
    turn: st.turn,
    trick: st.trick as unknown as SerializedState['trick'],
    finishCount: st.finishCount,
    log: st.log,
    history: st.history,
    tribute: st.tribute
      ? {
          ...st.tribute,
          antiOk: st.tribute.step === 'give' && canAntiTribute(st.tribute.givers.map((g) => st.players[g]!.hand)),
        }
      : null,
    aiLevel: st.aiLevel,
  }
}
