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
      conn.send({ t: 'hello', name: localStorage.getItem('gd-nick') || '玩家' } satisfies Msg)
      useStore.setState({ joining: false, intentSink: (a) => conn.send({ t: 'intent', action: a } satisfies Msg), teardown: leaveGuest })
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
    useStore.setState({ mySeat: msg.seat, roomSeats: msg.names.map((n, i) => ({ seat: i as any, name: n ?? '' })) as never })
    return
  }
  if (msg.t === 'state') {
    const st = deserialized(msg.state)
    useStore.setState({ match: st, mySeat: msg.seat, screen: 'table' })
    return
  }
  if (msg.t === 'leave') {
    useStore.setState({ guestLost: true })
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
