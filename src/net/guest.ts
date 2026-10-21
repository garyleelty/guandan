import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import { peerIdOf, codeFromUrl } from './room'
import type { Msg } from './room'
import { useStore } from '../state/store'
import type { SerializedState } from './room'

/** SerializedState → GameState 形状（为 UI 渲染的同一形状；guest 不做本地 step，仅渲染/发 intent） */
export function deserialized(s: SerializedState): any {
  return s
}

let guestConn: DataConnection | null = null
let guestPeer: Peer | null = null

/** 本机记住的 token：刷新页面后凭它坐回原座。 */
export function guestToken(): string {
  let t = localStorage.getItem('gd-token')
  if (!t) {
    t = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
    localStorage.setItem('gd-token', t)
  }
  return t
}

export function joinRoom(codeOrUrl?: string): 'bad-code' | 'connecting' | 'started' {
  const code = (codeOrUrl ?? codeFromUrl())?.toUpperCase()
  if (!code || !/^[2-9A-HJKMNP-Z]{6}$/.test(code)) {
    return 'bad-code'
  }
  const peer = new Peer()
  guestPeer = peer
  useStore.setState({ screen: 'room', mode: 'guest', roomCode: code, joining: true, roomSeats: null })
  peer.on('open', () => {
    const conn = peer.connect(peerIdOf(code), { reliable: true })
    guestConn = conn
    conn.on('open', () => {
      conn.send({ t: 'hello', name: localStorage.getItem('gd-nick') || '玩家', token: guestToken() } satisfies Msg)
      useStore.setState({ joining: false, intentSink: (a) => conn.send({ t: 'intent', action: a } satisfies Msg), teardown: leaveGuest })
      ;(window as unknown as Record<string, unknown>).__gdGuest = { conn, seat: null }
    })
    conn.on('data', (raw: unknown) => guestHandle(raw as Msg))
    conn.on('close', () => useStore.setState({ joining: false, guestLost: true }))
    conn.on('error', () => useStore.setState({ joining: false, guestLost: true }))
  })
  peer.on('error', () => useStore.setState({ joining: false, guestLost: true }))
  return 'connecting'
}

function guestHandle(msg: Msg): void {
  if (msg.t === 'welcome') {
    useStore.setState({
      mySeat: msg.seat,
      roomSeats: msg.seats.map((s) => ({ seat: s.seat, name: s.name, kind: s.kind })) as never,
      reconnected: msg.reconnected === true,
    })
    return
  }
  if (msg.t === 'state') {
    const g = (window as unknown as Record<string, { conn: unknown; seat?: number } | undefined>).__gdGuest
    if (g) g.seat = msg.seat
    const st = deserialized(msg.state)
    useStore.setState({ match: st, mySeat: msg.seat, screen: 'table' })
    return
  }
  if (msg.t === 'leave') {
    useStore.setState({ guestLost: true })
    return
  }
  if (msg.t === 'kick') {
    useStore.setState({ guestLost: true, kicked: msg.reason ?? '你已被房主请出房间' })
  }
}

export function sendIntent(action: { kind: 'play' | 'pass'; seat: any; cards?: string[] }): void {
  guestConn?.send({ t: 'intent', action } satisfies Msg)
}

export function leaveGuest(): void {
  guestConn?.send({ t: 'leave' } satisfies Msg)
  guestPeer?.destroy()
  guestConn = null
  guestPeer = null
}
