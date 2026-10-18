import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import { newGame, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'
import { peerIdOf, makeRoomCode, serializeFor } from './room'
import type { Msg } from './room'
import { useStore } from '../state/store'

export interface RoomSeat {
  seat: Seat
  name: string
  kind: 'host' | 'guest' | 'ai' | 'empty'
  connId: string | null
}

export interface HostRoom {
  code: string
  peer: Peer
  seats: RoomSeat[]
  match: GameState | null
  usedNames: Set<string>
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
  room = { code, peer, seats, match: null, usedNames }

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
  if (msg.t === 'intent') {
    const seat = r.seats.find((s) => s.connId === conn.peer)
    if (seat && r.match) hostApplyIntent(seat.seat, msg.action)
    return
  }
  if (msg.t !== 'hello') return
  const seat = ([1, 2, 3] as Seat[]).find((s) => r.seats[s]!.kind === 'empty')
  if (seat === undefined) {
    conn.send({ t: 'leave' } satisfies Msg)
    conn.close()
    return
  }
  let name = (msg.name || '玩家').slice(0, 8)
  if (usedName(r, name)) name = `${name}2`
  r.usedNames.add(name)
  r.seats[seat] = { seat, kind: 'guest', name, connId: conn.peer }
  conn.send({ t: 'welcome', seat, names: r.seats.map((s) => (s.kind === 'empty' ? null : s.name)) } satisfies Msg)
  useStore.setState({ roomSeats: [...r.seats] })
  if (r.match) broadcastState()
}

function usedName(r: HostRoom, name: string): boolean {
  return r.usedNames.has(name)
}

function hostDrop(conn: DataConnection): void {
  const r = room
  if (!r) return
  const seat = r.seats.find((s) => s.connId === conn.peer)
  if (!seat) return
  seat.kind = r.match ? 'ai' : 'empty'
  seat.name = r.match ? `${seat.name}(AI)` : ''
  seat.connId = null
  if (r.match) {
    const p = r.match.players[seat.seat]!
    p.isBot = true
  }
  useStore.setState({ roomSeats: [...r.seats] })
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
  r.match = newGame({
    seed: Math.floor(Math.random() * 1e9),
    names: r.seats.map((s) => (s.kind === 'empty' ? '-' : s.name)),
    isBot: r.seats.map((s) => s.kind !== 'host' && s.kind !== 'guest'),
    firstLeader: 0,
  })
  useStore.setState({ screen: 'table', mySeat: 0, match: r.match, mode: 'host', afterDispatch: broadcastState, teardown: destroyRoom })
  broadcastState()
}

export function broadcastState(): void {
  const r = room
  if (!r || !r.match) return
  for (const s of r.seats) {
    if (s.kind !== 'guest' || !s.connId) continue
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
    conn?.send({ t: 'state', state: serializeFor(r.match, s.seat), seat: s.seat } satisfies Msg)
  }
}

export function hostApplyIntent(seat: Seat, action: Action): void {
  const r = room
  if (!r || !r.match || r.match.phase !== 'playing') return
  if (r.match.turn !== seat) return
  const next = step(r.match, action)
  if (next === r.match) return
  r.match = next
  useStore.setState({ match: next })
  broadcastState()
}

export function destroyRoom(): void {
  room?.peer.destroy()
  room = null
}
