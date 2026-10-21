import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import { nextRound, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'
import { peerIdOf, makeRoomCode, serializeFor } from './room'
import type { Msg } from './room'
import { useStore } from '../state/store'

export interface RoomSeat {
  seat: Seat
  name: string
  kind: 'host' | 'guest' | 'ai' | 'empty'
  connId: string | null
  /** 客人本机的 token：刷新页面后凭它认领原座 */
  token?: string
}

export interface HostRoom {
  code: string
  peer: Peer
  seats: RoomSeat[]
  match: GameState | null
  usedNames: Set<string>
  /** 观战的人：只看牌，不上桌 */
  spectators: { connId: string; name: string }[]
}

let room: HostRoom | null = null

export const getRoom = (): HostRoom | null => room

function initialSeats(): RoomSeat[] {
  return [0, 1, 2, 3].map((i) => ({
    seat: i as Seat,
    name: i === 0 ? nick() : '',
    kind: i === 0 ? 'host' : 'empty',
    connId: null,
  }))
}

export const nick = (): string => localStorage.getItem('gd-nick') || '玩家'

export function createRoom(): void {
  const code = makeRoomCode()
  const seats = initialSeats()
  const usedNames = new Set<string>([seats[0]!.name])
  const peer = new Peer(peerIdOf(code))
  room = { code, peer, seats, match: null, usedNames, spectators: [] }
  ;(window as unknown as Record<string, unknown>).__gdHost = room

  peer.on('open', () => {
    useStore.setState({ screen: 'room', mode: 'host', roomCode: code, roomSeats: [...room!.seats] })
  })
  peer.on('connection', (conn) => {
    conn.on('data', (raw: unknown) => hostHandle(conn, raw as Msg))
    conn.on('close', () => hostDrop(conn))
    conn.on('error', () => hostDrop(conn))
  })
  peer.on('error', (err) => {
    console.error('peer error', err)
  })
}

function hostHandle(conn: DataConnection, msg: Msg): void {
  const r = room
  if (!r) return
  if (msg.t === 'leave') {
    // 客人主动离开：把座位空出来
    const seat = r.seats.find((s) => s.connId === conn.peer)
    if (seat) {
      r.seats[seat.seat] = { seat: seat.seat, kind: 'empty', name: '', connId: null }
      if (r.match) r.match.players[seat.seat]!.isBot = true
      useStore.setState({ roomSeats: [...r.seats] })
    }
    return
  }
  if (msg.t === 'intent') {
    const seat = r.seats.find((s) => s.connId === conn.peer)
    if (seat && r.match) hostApplyIntent(seat.seat, msg.action)
    return
  }
  if (msg.t !== 'hello') return
  if (msg.watch) {
    // 观战：不占座位，只收状态
    const watchName = (msg.name || '观众').slice(0, 8)
    r.spectators = r.spectators.filter((sp) => sp.connId !== conn.peer)
    r.spectators.push({ connId: conn.peer, name: watchName })
    conn.send({
      t: 'welcome',
      seat: -1,
      seats: r.seats.map((s) => ({ seat: s.seat, name: s.name, kind: s.kind })),
      reconnected: false,
    } satisfies Msg)
    if (r.match) {
      conn.send({ t: 'state', state: serializeFor(r.match, 0), seat: 0 } satisfies Msg)
    }
    return
  }
  // 认领原座：同一个 token 再来（刷新页面、断线重连）就还是那个座位
  const token = msg.token
  // 房主座位没有 token；客人座位断线后会变空位/AI，但 token 留着，好让重连认领
  const mine = token ? r.seats.find((s) => s.token === token) : undefined
  let name = (msg.name || '玩家').slice(0, 8)
  if (usedName(r, name)) name = `${name}2`
  r.usedNames.add(name)
  let seat: Seat | undefined
  let reconnected = false
  if (mine) {
    seat = mine.seat
    reconnected = true
    r.seats[seat] = { seat, kind: 'guest', name: mine.name || name, connId: conn.peer, token }
    if (r.match) r.match.players[seat]!.isBot = false
  } else {
    seat = ([1, 2, 3] as Seat[]).find((s) => r.seats[s]!.kind === 'empty')
    if (seat === undefined) {
      conn.send({ t: 'leave' } satisfies Msg)
      conn.close()
      return
    }
    r.seats[seat] = { seat, kind: 'guest', name, connId: conn.peer, token }
  }
  conn.send({
    t: 'welcome',
    seat,
    seats: r.seats.map((s) => ({ seat: s.seat, name: s.name, kind: s.kind })),
    reconnected,
  } satisfies Msg)
  useStore.setState({ roomSeats: [...r.seats] })
  if (r.match) broadcastState()
}

function usedName(r: HostRoom, name: string): boolean {
  return r.usedNames.has(name)
}

function hostDrop(conn: DataConnection): void {
  const r = room
  if (!r) return
  if (r.spectators.some((sp) => sp.connId === conn.peer)) {
    r.spectators = r.spectators.filter((sp) => sp.connId !== conn.peer)
    return
  }
  const seat = r.seats.find((s) => s.connId === conn.peer)
  if (!seat) return
  const wasGuest = seat.kind === 'guest'
  seat.kind = r.match ? 'ai' : 'empty'
  seat.name = r.match ? `${seat.name}(AI)` : ''
  seat.connId = null
  if (!wasGuest) seat.token = undefined
  if (r.match) {
    const p = r.match.players[seat.seat]!
    p.isBot = true
  }
  useStore.setState({ roomSeats: [...r.seats] })
}

/** 房主请某位客人出房间。 */
export function hostKick(seat: Seat): void {
  const r = room
  if (!r) return
  const s = r.seats[seat]
  if (!s || s.kind !== 'guest' || !s.connId) return
  const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
  conn?.send({ t: 'kick', seat, reason: '你已被房主请出房间' } satisfies Msg)
  r.seats[seat] = { seat, kind: 'empty', name: '', connId: null }
  if (r.match) r.match.players[seat]!.isBot = true
  useStore.setState({ roomSeats: [...r.seats] })
  setTimeout(() => conn?.close(), 200)
}

export function hostAddAi(seat: Seat): void {
  const r = room
  if (!r || r.seats[seat]!.kind !== 'empty') return
  r.seats[seat] = { seat, name: `AI ${['甲', '乙', '丙'][seat - 1] ?? ''}`, kind: 'ai', connId: null }
  useStore.setState({ roomSeats: [...r.seats] })
}

export function hostRemoveAi(seat: Seat): void {
  const r = room
  if (!r || r.seats[seat]!.kind !== 'ai') return
  r.seats[seat] = { seat, kind: 'empty', name: '', connId: null }
  useStore.setState({ roomSeats: [...r.seats] })
}

export function hostStart(): void {
  const r = room
  if (!r) return
  // 整场没结束 → 下一局先走进贡（交贡 → 还牌 → 下游领出）；否则开新的一场
  r.match = nextRound(r.match, {
    seed: Math.floor(Math.random() * 1e9),
    names: r.seats.map((s) => (s.kind === 'empty' ? '-' : s.name)),
    isBot: r.seats.map((s) => s.kind !== 'host' && s.kind !== 'guest'),
    aiLevel: useStore.getState().aiLevel,
  })
  useStore.setState({
    screen: 'table',
    mySeat: 0,
    match: r.match,
    mode: 'host',
    afterDispatch: broadcastState,
    teardown: destroyRoom,
    rematchSink: hostStart,
  })
  broadcastState()
}

export function broadcastState(): void {
  const r = room
  if (!r) return
  const m = useStore.getState().match ?? r.match
  if (!m) return
  r.match = m
  for (const s of r.seats) {
    if (s.kind !== 'guest' || !s.connId) continue
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
    conn?.send({ t: 'state', state: serializeFor(m, s.seat), seat: s.seat } satisfies Msg)
  }
  for (const sp of r.spectators) {
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[sp.connId]?.[0]
    conn?.send({ t: 'state', state: serializeFor(m, 0), seat: 0 } satisfies Msg)
  }
}

export function hostApplyIntent(seat: Seat, action: Action): void {
  const r = room
  if (!r) return
  const m = useStore.getState().match ?? r.match
  if (!m || (m.phase !== 'playing' && m.phase !== 'tribute')) return
  if (m.turn !== seat) return
  const next = step(m, action)
  if (next === m) return
  r.match = next
  useStore.setState({ match: next })
  broadcastState()
}

export function destroyRoom(): void {
  room?.peer.destroy()
  room = null
}
