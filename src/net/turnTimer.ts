/**
 * P2P 回合计时：轮到真人限时行动，到点房主托管代打（跟牌自动过 / 领出走 AI）。
 * 单机不限时。?turnMs= 可调短（验收脚本用），下限 1 秒。
 */
const DEFAULT_TURN_MS = 30_000

export function turnMs(): number {
  if (typeof window === 'undefined') return DEFAULT_TURN_MS
  const raw = new URLSearchParams(window.location.search).get('turnMs')
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : DEFAULT_TURN_MS
}
