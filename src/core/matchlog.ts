import type { GameState } from './engine'

type LogEntry = GameState['log'][number]

/**
 * 整场的出牌记录。
 * 引擎每局重置 log（一局打完就清空），所以要把打过的那几局攒在这儿——
 * 攒在客户端，不进状态里（不然每次同步都要多带一大坨历史）。
 */
let rounds: LogEntry[][] = []
let lastHistoryLen = 0

/** 跟一次状态变化：历史局数变多，说明刚打完一局，把它的记录归档。 */
export function trackMatchLog(st: GameState | null): void {
  if (!st) {
    resetMatchLog()
    return
  }
  if (st.history.length < lastHistoryLen) {
    // 换了一场新比赛
    rounds = []
    lastHistoryLen = st.history.length
  }
  if (st.history.length > lastHistoryLen) {
    if (st.log.length > 0) rounds.push(st.log)
    lastHistoryLen = st.history.length
  }
}

/** 已经打完的那几局的出牌记录。 */
export function archivedRounds(): LogEntry[][] {
  return rounds
}

/** 清空（回到大厅、换新比赛时）。 */
export function resetMatchLog(): void {
  rounds = []
  lastHistoryLen = 0
}
