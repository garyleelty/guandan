import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import { nextRound, step } from '../core/engine'
import type { Action, GameState, Seat } from '../core/engine'
import { peerIdOf, makeRoomCode, serializeFor, newPeer } from './room'
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
  /** 被房主请出过的人（按 token）：请出去就别再进来 */
  banned: Set<string>
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
  const peer = newPeer(peerIdOf(code))
  room = { code, peer, seats, match: null, usedNames, spectators: [], banned: new Set() }
  ;(window as unknown as Record<string, unknown>).__gdHost = room

  peer.on('open', () => {
    startHeartbeat()
    useStore.setState({ screen: 'room', mode: 'host', roomCode: code, roomSeats: [...room!.seats] })
  })
  wireHostPeer(peer)
  peer.on('error', (err) => {
    console.error('peer error', err)
  })
}

/** 房主心跳：WebRTC 的 close 事件可能迟到几十秒，靠 ping 让客人及时感知房主没了。 */
let heartbeat: ReturnType<typeof setInterval> | null = null

function startHeartbeat(): void {
  stopHeartbeat()
  heartbeat = setInterval(() => {
    const r = room
    if (!r) return
    const all: DataConnection[] = [
      ...r.seats.filter((s) => s.connId).flatMap((s) => (r.peer.connections as Record<string, DataConnection[]>)[s.connId!] ?? []),
      ...r.spectators.flatMap((sp) => (r.peer.connections as Record<string, DataConnection[]>)[sp.connId] ?? []),
    ]
    for (const conn of all) conn?.send({ t: 'ping' } satisfies Msg)
  }, 4000)
}

function stopHeartbeat(): void {
  if (heartbeat !== null) {
    clearInterval(heartbeat)
    heartbeat = null
  }
}

/** 房主节点的连接事件：建房与房主转移共用。 */
function wireHostPeer(peer: Peer): void {
  peer.on('connection', (conn) => {
    conn.on('data', (raw: unknown) => hostHandle(conn, raw as Msg))
    conn.on('close', () => hostDrop(conn))
    conn.on('error', () => hostDrop(conn))
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
      hostSeatsChanged(r)
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
    useStore.setState({ roomWatchers: r.spectators.map((sp) => sp.name) })
    conn.send({
      t: 'welcome',
      seat: -1,
      seats: r.seats.map((s) => ({ seat: s.seat, name: s.name, kind: s.kind })),
      reconnected: false,
    } satisfies Msg)
    if (r.match) {
      // 观战者不需要任何人的手牌：连房主的也不发，别把看牌变成偷看
      conn.send({ t: 'state', state: serializeFor(r.match, 0, { hideHands: true }), seat: 0 } satisfies Msg)
    }
    return
  }
  // 认领原座：同一个 token 再来（刷新页面、断线重连）就还是那个座位；
  // 房主转移后新房主不认识旧 token，退而按「座位 + 名字」认领断线客人的空座
  const token = msg.token
  // 被房主请出过的人就别再进来了：说清楚原因，别让他以为只是掉线
  if (token && r.banned.has(token)) {
    conn.send({ t: 'kick', seat: 1, reason: '房主已把你请出这个房间' } satisfies Msg)
    conn.close()
    return
  }
  // 房主座位没有 token；客人座位断线后会变空位/AI，但 token 留着，好让重连认领
  let name = (msg.name || '玩家').slice(0, 8)
  const mine =
    (token ? r.seats.find((s) => s.token === token) : undefined) ??
    (msg.watch
      ? undefined
      : r.seats.find(
          (s) => s.kind === 'guest' && !s.connId && s.name === name && (msg.seat === undefined || msg.seat === s.seat),
        ))
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
  hostSeatsChanged(r)
  if (r.match) broadcastState()
}

/** 房主侧刷新座位表，并把新座位表发给所有客人（否则客人的等候室一直停在进房那一刻）。 */
function hostSeatsChanged(r: HostRoom): void {
  useStore.setState({ roomSeats: [...r.seats] })
  const seats = r.seats.map((s) => ({ seat: s.seat, name: s.name, kind: s.kind }))
  for (const s of r.seats) {
    if (s.kind !== 'guest' || !s.connId) continue
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
    conn?.send({ t: 'seats', seats, aiLevel: useStore.getState().aiLevel } satisfies Msg)
  }
}

function usedName(r: HostRoom, name: string): boolean {
  return r.usedNames.has(name)
}

function hostDrop(conn: DataConnection): void {
  const r = room
  if (!r) return
  if (r.spectators.some((sp) => sp.connId === conn.peer)) {
    r.spectators = r.spectators.filter((sp) => sp.connId !== conn.peer)
    useStore.setState({ roomWatchers: r.spectators.map((sp) => sp.name) })
    return
  }
  const seat = r.seats.find((s) => s.connId === conn.peer)
  if (!seat) return
  const wasGuest = seat.kind === 'guest'
  seat.kind = r.match ? 'ai' : 'empty'
  // 名字保持原样：座位类型变了由房间列表里的「AI」标记说明，
  // 之前在名字后面加「(AI)」，重连的人会带着这个后缀回来，名字越滚越长
  if (!r.match) seat.name = ''
  seat.connId = null
  if (!wasGuest) seat.token = undefined
  if (r.match) {
    const p = r.match.players[seat.seat]!
    p.isBot = true
  }
  hostSeatsChanged(r)
}

/** 房主请某位客人出房间。 */
export function hostKick(seat: Seat): void {
  const r = room
  if (!r) return
  const s = r.seats[seat]
  if (!s || s.kind !== 'guest' || !s.connId) return
  const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
  conn?.send({ t: 'kick', seat, reason: '你已被房主请出房间' } satisfies Msg)
  // 请出去了就别再进来：记下这个人的本机 token
  if (s.token) r.banned.add(s.token)
  r.seats[seat] = { seat, kind: 'empty', name: '', connId: null }
  if (r.match) r.match.players[seat]!.isBot = true
  useStore.setState({ roomSeats: [...r.seats] })
  setTimeout(() => conn?.close(), 200)
}

/** 房主改 AI 难度：立刻同步给所有客人，别让他们看着旧的难度等开局。 */
export function hostSetAiLevel(level: 0 | 1 | 2): void {
  useStore.setState({ aiLevel: level })
  const r = room
  if (r) hostSeatsChanged(r)
}

export function hostAddAi(seat: Seat): void {
  const r = room
  if (!r || r.seats[seat]!.kind !== 'empty') return
  r.seats[seat] = { seat, name: `AI ${['甲', '乙', '丙'][seat - 1] ?? ''}`, kind: 'ai', connId: null }
  hostSeatsChanged(r)
}

export function hostRemoveAi(seat: Seat): void {
  const r = room
  if (!r || r.seats[seat]!.kind !== 'ai') return
  r.seats[seat] = { seat, kind: 'empty', name: '', connId: null }
  hostSeatsChanged(r)
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
  // 玩家客人拿全量状态（手牌在 UI 层隔离渲染）：房主转移时任何一位客人都要能接管当权威
  for (const s of r.seats) {
    if (s.kind !== 'guest' || !s.connId) continue
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[s.connId]?.[0]
    conn?.send({ t: 'state', state: serializeFor(m, s.seat, { fullHands: true }), seat: s.seat } satisfies Msg)
  }
  for (const sp of r.spectators) {
    const conn = (r.peer.connections as Record<string, DataConnection[]>)[sp.connId]?.[0]
    conn?.send({ t: 'state', state: serializeFor(m, 0, { hideHands: true }), seat: 0 } satisfies Msg)
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
  stopHeartbeat()
  room?.peer.destroy()
  room = null
}

/**
 * 房主转移：房主掉线后，最低座位的人类客人用本地全量状态接管当权威节点。
 * - 绑定原房间 peer id（gd-<房码>），其他客人自动重连进来（token / 座位+名字 认领原座）；
 * - 断线客人的座先交给 AI 打，重连后收回；
 * - 旧房主的座在牌局里也交给 AI（他回来只能通过邀请链接当客人进）；
 * - peer id 被占（旧房主僵尸/转移竞速）就退避重试，几次不行就放弃。
 */
export function migrateToHost(): void {
  const s = useStore.getState()
  const code = s.roomCode
  const match = s.match
  const seats = s.roomSeats
  const mySeat = s.mySeat
  if (!code || !match || !seats || s.spectating || room) return

  const taken: RoomSeat[] = seats.map((rs) => {
    const seat = rs.seat as Seat
    if (seat === mySeat) return { seat, name: rs.name || nick(), kind: 'host', connId: null }
    // 旧房主走了：牌局还在就把他的座给 AI 接管，不然空出来
    if (rs.kind === 'host') return { seat, name: match ? rs.name : '', kind: match ? 'ai' : 'empty', connId: null }
    return { seat, name: rs.name, kind: rs.kind, connId: null }
  })
  // 断线的人先由 AI 代打，重连后 hostHandle 会把 isBot 收回来
  for (const rs of taken) {
    if (rs.seat !== mySeat && rs.kind !== 'empty') match.players[rs.seat]!.isBot = true
  }

  let attempts = 0
  const boot = (): void => {
    const peer = newPeer(peerIdOf(code))
    room = {
      code,
      peer,
      seats: taken,
      match,
      usedNames: new Set(taken.filter((x) => x.name).map((x) => x.name)),
      spectators: [],
      banned: new Set(),
    }
    ;(window as unknown as Record<string, unknown>).__gdHost = room
    wireHostPeer(peer)
    peer.on('open', () => {
      startHeartbeat()
      useStore.setState({
        mode: 'host',
        screen: 'table',
        roomSeats: [...taken],
        guestLost: false,
        joining: false,
        intentSink: null,
        afterDispatch: broadcastState,
        teardown: destroyRoom,
        rematchSink: hostStart,
      })
      hostSeatsChanged(room!)
      broadcastState()
    })
    peer.on('error', (err) => {
      const type = (err as { type?: string }).type
      if (type === 'unavailable-id' && attempts < 3) {
        attempts++
        destroyRoom()
        setTimeout(boot, 2000)
        return
      }
      console.error('migrated host peer error', err)
    })
  }
  boot()
}
