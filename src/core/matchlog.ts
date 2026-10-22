import { teamOf, type GameState, type Seat } from './engine'
import { recordRound } from './stats'

type LogEntry = GameState['log'][number]

/**
 * 整场的出牌记录。
 * 引擎每局重置 log（一局打完就清空），所以要把打过的那几局攒在这儿——
 * 攒在客户端，不进状态里（不然每次同步都要多带一大坨历史）。
 */
let rounds: LogEntry[][] = []
let lastHistoryLen = 0
let lastRecordedHistory = 0

/** 跟一次状态变化：历史局数变多，说明刚打完一局，把它的记录归档。 */
export function trackMatchLog(st: GameState | null, mySeat: Seat = 0): void {
  if (!st) {
    resetMatchLog()
    return
  }
  if (st.history.length < lastHistoryLen) {
    // 换了一场新比赛
    rounds = []
    lastHistoryLen = st.history.length
  }
  // 一局打完就记一笔战绩
  if (st.history.length > lastRecordedHistory) {
    const h = st.history[st.history.length - 1]
    if (h) {
      const mine = teamOf(mySeat)
      recordRound({
        at: Date.now(),
        win: h.winner === mine,
        delta: h.winner === mine ? h.delta : 0,
        levels: [st.levels.even, st.levels.odd],
        names: st.players.map((p) => p.name),
      })
    }
    lastRecordedHistory = st.history.length
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

/**
 * 从存档续局：把「已经记过账」的水位对齐到当前历史局数，并把存档里的
 * 前几局牌谱接回来（不然刷新后续局，分享链接只剩当前这一局）。
 *
 * 不这么对齐的话，续局后的第一次状态变化会把历史里的每一局都当成刚打完，
 * 战绩会重复记一遍（而且每次刷新续局都会再多记一遍）。
 */
export function primeMatchLog(st: GameState | null, archive: LogEntry[][] = []): void {
  rounds = archive.map((r) => [...r])
  lastHistoryLen = st?.history.length ?? 0
  lastRecordedHistory = st?.history.length ?? 0
}

/** 清空（回到大厅、换新比赛时）。 */
export function resetMatchLog(): void {
  rounds = []
  lastHistoryLen = 0
  lastRecordedHistory = 0
}
