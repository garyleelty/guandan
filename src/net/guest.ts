import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import { peerIdOf, codeFromUrl, newPeer } from './room'
import type { Msg } from './room'
import { useStore } from '../state/store'
import type { SerializedState } from './room'
import type { Seat } from '../core/engine'
import { migrateToHost } from './host'

/** SerializedState → GameState 形状（为 UI 渲染的同一形状；guest 不做本地 step，仅渲染/发 intent） */
export function deserialized(s: SerializedState): any {
  return s
}

let guestConn: DataConnection | null = null
let guestPeer: Peer | null = null
/** 最近一次收到房主消息的时间：心跳断供 12 秒就当房主没了。 */
let lastSeen = 0
let watchdog: ReturnType<typeof setInterval> | null = null

function markSeen(): void {
  lastSeen = Date.now()
}

function startWatchdog(): void {
  stopWatchdog()
  lastSeen = Date.now()
  watchdog = setInterval(() => {
    const s = useStore.getState()
    if (s.mode !== 'guest') {
      stopWatchdog()
      return
    }
    if (Date.now() - lastSeen > 12_000) {
      onGuestDisconnected()
    }
  }, 3000)
}

function stopWatchdog(): void {
  if (watchdog !== null) {
    clearInterval(watchdog)
    watchdog = null
  }
}

/** 本机记住的 token：刷新页面后凭它坐回原座。 */
export function guestToken(): string {
  let t = localStorage.getItem('gd-token')
  if (!t) {
    t = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
    localStorage.setItem('gd-token', t)
  }
  return t
}

export function joinRoom(codeOrUrl?: string, opts?: { watch?: boolean }): 'bad-code' | 'connecting' | 'started' {
  const code = (codeOrUrl ?? codeFromUrl())?.toUpperCase()
  if (!code || !/^[2-9A-HJKMNP-Z]{6}$/.test(code)) {
    return 'bad-code'
  }
  // 重连可能反复进来：先拆掉上一条 Peer，别把连接漏着
  guestPeer?.destroy()
  const peer = newPeer()
  guestPeer = peer
  useStore.setState({
    screen: 'room',
    mode: 'guest',
    roomCode: code,
    joining: true,
    roomSeats: null,
    roomAiLevel: null,
    spectating: opts?.watch === true,
    // 重新连接：把「断开 / 被请出」的状态清掉，不然界面还停在断线页
    guestLost: false,
    kicked: '',
  })
  peer.on('open', () => {
    const conn = peer.connect(peerIdOf(code), { reliable: true })
    guestConn = conn
    conn.on('open', () => {
      conn.send({
        t: 'hello',
        name: localStorage.getItem('gd-nick') || '玩家',
        token: guestToken(),
        watch: opts?.watch === true,
        // 断线重连带上原来的座：房主转移后新房主靠「座位+名字」认领
        seat: useStore.getState().mySeat,
      } satisfies Msg)
      useStore.setState({ joining: false, intentSink: (a) => conn.send({ t: 'intent', action: a } satisfies Msg), teardown: leaveGuest })
      ;(window as unknown as Record<string, unknown>).__gdGuest = { conn, seat: null }
    })
    conn.on('data', (raw: unknown) => {
      markSeen()
      guestHandle(raw as Msg)
    })
    conn.on('close', () => onGuestDisconnected())
    conn.on('error', () => onGuestDisconnected())
  })
  peer.on('error', () => onGuestDisconnected())
  startWatchdog()
  return 'connecting'
}

/**
 * 与房主失联：正打着牌时别干等——
 * - 我是最低座位的人类客人 → 接管当房主（本地已有全量状态）；
 * - 不然几秒后自动重连（新/旧房主都行），重连不上再停在断线页让人手动点。
 */
function onGuestDisconnected(): void {
  const s = useStore.getState()
  useStore.setState({ joining: false, guestLost: true })
  if (s.mode !== 'guest') {
    stopWatchdog()
    return
  }
  // 正打着牌、我又是最靠前的人类客人 → 接管当房主，别让整场牌局陪葬
  if (s.match && !s.spectating && isMigrationCandidate()) {
    stopWatchdog()
    migrateToHost()
    return
  }
  // 观战 / 普通客人 / 等候室：自动重连（新房主或旧房主都行），连不上再停在断线页
  scheduleGuestRetry()
}

function isMigrationCandidate(): boolean {
  const s = useStore.getState()
  if (!s.roomSeats || !s.roomCode || s.mySeat === 0) return false
  const humans = s.roomSeats
    .filter((r) => r.kind === 'guest')
    .map((r) => r.seat)
    .sort((a, b) => a - b)
  return humans.length > 0 && humans[0] === s.mySeat
}

let retryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleGuestRetry(): void {
  const code = codeFromUrl()
  if (!code) return
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(
    () => {
      retryTimer = null
      const s = useStore.getState()
      if (s.mode !== 'guest' || !s.guestLost) return
      joinRoom(code, { watch: s.spectating })
    },
    2000 + Math.random() * 1500,
  )
}

function guestHandle(msg: Msg): void {
  if (msg.t === 'welcome') {
    const seat = msg.seat
    const spectating = seat === -1
    useStore.setState({
      mySeat: spectating ? 0 : (seat as Seat),
      spectating,
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
  if (msg.t === 'seats') {
    useStore.setState({ roomSeats: msg.seats, roomAiLevel: msg.aiLevel })
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
  stopWatchdog()
  guestConn?.send({ t: 'leave' } satisfies Msg)
  guestPeer?.destroy()
  guestConn = null
  guestPeer = null
}
