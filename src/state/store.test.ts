import { describe, expect, it } from 'vitest'
import { newGame } from '../core/engine'
import { useStore } from './store'

/** 造一个「上一局刚打完、整场还没结束」的状态 */
function finishedRound() {
  const st = newGame()
  st.phase = 'ended'
  st.players[0]!.finishOrder = 0
  st.players[2]!.finishOrder = 1
  st.players[1]!.finishOrder = 2
  st.players[3]!.finishOrder = 3
  return st
}

describe('单机开局（startSolo）', () => {
  it('没有上一局 → 直接发牌开打', () => {
    useStore.setState({ match: null, screen: 'lobby' })
    useStore.getState().startSolo()
    const m = useStore.getState().match!
    expect(m.phase).toBe('playing')
    expect(m.players.map((p) => p.hand.length)).toEqual([27, 27, 27, 27])
  })

  it('上一局打完、整场没结束 → 下一局先走进贡', () => {
    useStore.setState({ match: finishedRound(), screen: 'table' })
    useStore.getState().startSolo()
    const m = useStore.getState().match!
    expect(m.phase).toBe('tribute')
    expect(m.tribute).not.toBeNull()
    // 名次：你(0) 头游 · AI乙(2) 二游 · AI甲(1) 三游 · AI丙(3) 四游
    // 三游与四游同队 → 双下游，两人各进贡一张
    expect(m.tribute!.givers).toEqual([3, 1])
  })

  it('整场结束（打过 A）→ 开新的一场，从 2 级重来', () => {
    const prev = finishedRound()
    prev.matchWinner = 'even'
    useStore.setState({ match: prev, screen: 'table' })
    useStore.getState().startSolo()
    const m = useStore.getState().match!
    expect(m.phase).toBe('playing')
    expect(m.levels).toEqual({ even: 2, odd: 2 })
  })
})
