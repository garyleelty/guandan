import type { GameState, Seat } from './engine'

/** 一局的复盘数据：够重现「谁在什么时候出了什么牌」。 */
export type ReplayData = {
  /** 数据版本 */
  v: 1
  /** 四个座位的名字 */
  n: string[]
  /** 打完时的两队级数 */
  l: [number, number]
  /** 每一手：座位、牌 id、牌型 */
  g: { s: Seat; c: string[]; t: number | null; r: number }[]
}

/** 从当前状态取「刚打完的这一局」作为复盘数据。 */
export function replayFromState(st: GameState): ReplayData {
  return {
    v: 1,
    n: st.players.map((p) => p.name),
    l: [st.levels.even, st.levels.odd],
    g: st.log.map((e) => ({ s: e.seat, c: e.ids, t: e.combo?.type ?? null, r: e.combo?.rank ?? 0 })),
  }
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
  void writer.write(bytes as unknown as BufferSource)
  void writer.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  void writer.write(bytes as unknown as BufferSource)
  void writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new Uint8Array(buf)
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
    if (data?.v !== 1 || !Array.isArray(data.g) || !Array.isArray(data.n)) return null
    return data
  } catch {
    return null
  }
}
