import type { GameState, Seat, Team } from './engine'
import { archivedRounds } from './matchlog'

/** 一手牌的复盘记录 */
type Play = { s: Seat; c: string[]; t: number | null; r: number }

/** 旧版数据（v1）：只有一局 */
export type ReplayDataV1 = {
  v: 1
  n: string[]
  l: [number, number]
  g: Play[]
}

/** 新版数据（v2）：整场，每一局分开 */
export type ReplayDataV2 = {
  v: 2
  /** 四个座位的名字 */
  n: string[]
  /** 每一局：出牌记录 + 谁赢 + 升了几级 */
  rounds: { g: Play[]; w: Team | null; d: number }[]
  /** 打完时的两队级数 */
  l: [number, number]
}

export type ReplayData = ReplayDataV1 | ReplayDataV2

const toPlays = (log: GameState['log']): Play[] =>
  log.map((e) => ({ s: e.seat, c: e.ids, t: e.combo?.type ?? null, r: e.combo?.rank ?? 0 }))

/**
 * 从当前状态取复盘数据：已经打完的那几局（客户端攒的）+ 当前这一局。
 * 只有当前一局时退化成 v1（短链接），整场就用 v2。
 */
export function replayFromState(st: GameState): ReplayData {
  const n = st.players.map((p) => p.name)
  const l: [number, number] = [st.levels.even, st.levels.odd]
  const done = archivedRounds()
  if (done.length === 0) {
    return { v: 1, n, l, g: toPlays(st.log) }
  }
  const rounds = done.map((log, i) => {
    const h = st.history[i]
    const winner: Team | null = h ? h.winner : null
    return { g: toPlays(log), w: winner, d: h?.delta ?? 0 }
  })
  // 刚打完一局时，状态里的 log 就是这一局（已经归档过了），别再追加一遍
  if (st.phase !== 'ended') {
    rounds.push({ g: toPlays(st.log), w: null, d: 0 })
  }
  return { v: 2, n, rounds, l }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  // 先开始读、再写：只写不读会顶住背压，write 的 promise 一直不 resolve（浏览器会卡住）；
  // 但必须等写完再 close，否则部分运行时（CI 的 Bun）会截断 gzip。
  const reading = new Response(cs.readable).arrayBuffer()
  // 提前挂个处理器：万一流出错，别变成「未处理的 rejection」（Bun 会因此判失败）
  reading.catch(() => {})
  await writer.write(bytes as unknown as BufferSource)
  await writer.close()
  return new Uint8Array(await reading)
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  const reading = new Response(ds.readable).arrayBuffer()
  // 同上：空数据/坏数据会让解压流报错，别让它变成未处理的 rejection
  reading.catch(() => {})
  await writer.write(bytes as unknown as BufferSource)
  await writer.close()
  return new Uint8Array(await reading)
}

/** 复盘数据 → URL 片段（gzip + base64url，尽量短）。 */
export async function encodeReplay(data: ReplayData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(data))
  return toBase64Url(await gzip(json))
}

/** URL 片段 → 复盘数据；不是合法数据就返回 null。 */
export async function decodeReplay(fragment: string): Promise<ReplayData | null> {
  try {
    const json = await gunzip(fromBase64Url(fragment))
    const data = JSON.parse(new TextDecoder().decode(json)) as ReplayData
    if (!Array.isArray(data?.n)) return null
    if (data.v === 1 && Array.isArray(data.g)) return data
    if (data.v === 2 && Array.isArray(data.rounds)) return data
    return null
  } catch {
    return null
  }
}
