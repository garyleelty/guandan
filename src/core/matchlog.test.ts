import { beforeEach, describe, expect, it } from 'vitest'
import { archivedRounds, resetMatchLog, trackMatchLog } from './matchlog'
import { decodeReplay, encodeReplay, replayFromState } from './replay'
import { newGame } from './engine'
import type { GameState } from './engine'

function stateWith(log: GameState['log'], historyLen: number): GameState {
  const st = newGame()
  st.log = log
  st.history = Array.from({ length: historyLen }, () => ({
    winner: 'even' as const,
    delta: 1,
    levels: { even: 3, odd: 2 },
  }))
  return st
}

const logA: GameState['log'] = [{ seat: 0, ids: ['s3-0'], combo: { type: 0, rank: 3 } }]
const logB: GameState['log'] = [{ seat: 1, ids: ['s4-0'], combo: { type: 0, rank: 4 } }]

describe('整场出牌记录（客户端归档）', () => {
  beforeEach(() => resetMatchLog())

  it('一局打完就把那一局的记录归档', () => {
    trackMatchLog(stateWith(logA, 0)) // 开局，历史 0 局
    expect(archivedRounds()).toHaveLength(0)
    trackMatchLog(stateWith(logA, 1)) // 这局打完了
    expect(archivedRounds()).toHaveLength(1)
    expect(archivedRounds()[0]).toHaveLength(1)
  })

  it('下一局重新计数时不会重复归档', () => {
    trackMatchLog(stateWith(logA, 0))
    trackMatchLog(stateWith(logA, 1))
    trackMatchLog(stateWith(logB, 1)) // 新一局，历史没变
    expect(archivedRounds()).toHaveLength(1)
  })

  it('换新比赛时清空', () => {
    trackMatchLog(stateWith(logA, 1))
    trackMatchLog(stateWith([], 0)) // 新比赛
    expect(archivedRounds()).toHaveLength(0)
  })
})

describe('复盘数据：整场（v2）', () => {
  beforeEach(() => resetMatchLog())

  it('只有当前一局时用短格式 v1', () => {
    const st = stateWith(logA, 0)
    const data = replayFromState(st)
    expect(data.v).toBe(1)
  })

  it('打过一局以上就是 v2，带上每一局', () => {
    trackMatchLog(stateWith(logA, 1))
    const st = stateWith(logB, 1)
    const data = replayFromState(st)
    expect(data.v).toBe(2)
    if (data.v === 2) {
      expect(data.rounds).toHaveLength(2)
      expect(data.rounds[0]!.g).toHaveLength(1)
      expect(data.rounds[0]!.w).toBe('even')
      expect(data.rounds[1]!.w).toBeNull()
    }
  })

  it('v2 也能编码解码', async () => {
    trackMatchLog(stateWith(logA, 1))
    const data = replayFromState(stateWith(logB, 1))
    const frag = await encodeReplay(data)
    expect(await decodeReplay(frag)).toEqual(data)
  })

  it('v1 的老链接仍能打开', async () => {
    const st = stateWith(logA, 0)
    const data = replayFromState(st)
    const frag = await encodeReplay(data)
    const back = await decodeReplay(frag)
    expect(back?.v).toBe(1)
  })
})
