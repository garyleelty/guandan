/**
 * 单机续局：把当前牌局存在本机，刷新页面后还能接着打。
 *
 * 只存单机（P2P 的真相在房主那边，客人存了也没用）。存的是完整 GameState
 * （纯 JSON：手牌、级数、出牌记录、进贡阶段都在里面），外加 AI 难度与座位。
 * 读回来之前先验证形状——旧版本或被手改坏的数据宁可丢掉，也不能让引擎崩。
 */
import type { GameState, Seat } from '../core/engine'

export const SOLO_SAVE_KEY = 'gd-solo-save'
const VERSION = 1

export type SoloSave = {
  v: number
  savedAt: number
  aiLevel: 0 | 1 | 2
  mySeat: Seat
  match: GameState
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 存一局。已结束的局不存（留着也没得续）。 */
export function saveSolo(
  match: GameState,
  aiLevel: 0 | 1 | 2,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage || match.phase === 'ended') return false
  try {
    const data: SoloSave = {
      v: VERSION,
      savedAt: Date.now(),
      aiLevel,
      mySeat: 0,
      match,
    }
    storage.setItem(SOLO_SAVE_KEY, JSON.stringify(data))
    return true
  } catch {
    // 配额满了 / 隐私模式：续局是加分项，不能影响正常打牌
    return false
  }
}

/** 读回上一局；没有或数据不合法返回 null。 */
export function loadSolo(storage: StorageLike | null = defaultStorage()): SoloSave | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(SOLO_SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SoloSave>
    if (data.v !== VERSION || !isAiLevel(data.aiLevel) || !isMatch(data.match)) {
      storage.removeItem(SOLO_SAVE_KEY)
      return null
    }
    return {
      v: VERSION,
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
      aiLevel: data.aiLevel,
      mySeat: 0,
      match: data.match,
    }
  } catch {
    // 坏档留着只会每次启动都解析失败，直接清掉
    clearSolo(storage)
    return null
  }
}

export function clearSolo(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SOLO_SAVE_KEY)
  } catch {
    /* ignore */
  }
}

function isAiLevel(v: unknown): v is 0 | 1 | 2 {
  return v === 0 || v === 1 || v === 2
}

function isCard(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const c = v as { id?: unknown; rank?: unknown; suit?: unknown }
  return typeof c.id === 'string' && Number.isInteger(c.rank) && Number.isInteger(c.suit)
}

function isMatch(v: unknown): v is GameState {
  if (!v || typeof v !== 'object') return false
  const m = v as Partial<GameState>
  if (m.phase !== 'playing' && m.phase !== 'tribute') return false
  if (!m.levels || !Number.isInteger(m.levels.even) || !Number.isInteger(m.levels.odd)) return false
  if (typeof m.handLevel !== 'number' || !Number.isInteger(m.handLevel)) return false
  if (typeof m.turn !== 'number' || !Number.isInteger(m.turn)) return false
  if (m.turn < 0 || m.turn > 3) return false
  if (!Array.isArray(m.players) || m.players.length !== 4) return false
  if (
    !m.players.every(
      (p) =>
        !!p &&
        Number.isInteger(p.seat) &&
        (p.finishOrder === null || Number.isInteger(p.finishOrder)) &&
        Array.isArray(p.hand) &&
        p.hand.every(isCard),
    )
  ) {
    return false
  }
  if (!m.trick || !Array.isArray(m.trick.pending)) return false
  if (!Array.isArray(m.log) || !Array.isArray(m.history)) return false
  if (m.phase === 'tribute' && !m.tribute) return false
  return true
}
