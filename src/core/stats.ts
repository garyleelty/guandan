/** 战绩：打过的每一局留个底，回头能看看打得怎么样。 */

export type RoundRecord = {
  /** 结束时间戳 */
  at: number
  /** 我方这局赢了吗 */
  win: boolean
  /** 我方这局升了几级 */
  delta: number
  /** 这局结束时的级数（我方，对家） */
  levels: [number, number]
  /** 四个座位的名字 */
  names: string[]
}

const KEY = 'gd-stats'
const MAX = 100

export function loadStats(): RoundRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as RoundRecord[]
    return Array.isArray(list) ? list.slice(-MAX) : []
  } catch {
    return []
  }
}

export function saveStats(list: RoundRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {
    /* 存储不可用就算了 */
  }
}

/** 记一局。同一局不会重复记（按时间戳去重）。 */
export function recordRound(record: RoundRecord): RoundRecord[] {
  const list = loadStats().filter((r) => r.at !== record.at)
  list.push(record)
  saveStats(list)
  return list
}

export function clearStats(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** 胜率（0..1），没打过返回 null。 */
export function winRate(list: RoundRecord[]): number | null {
  if (list.length === 0) return null
  return list.filter((r) => r.win).length / list.length
}
