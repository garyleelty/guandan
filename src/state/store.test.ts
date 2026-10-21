import { describe, expect, it } from 'vitest'
import { newGame } from '../core/engine'
import { nextRoundOptions } from './store'

describe('nextRoundOptions（下一局的起始条件）', () => {
  it('没有上一局 → 从 2 级开始，随机（座位 0）领出', () => {
    expect(nextRoundOptions(null)).toEqual({ firstLeader: 0 })
  })

  it('级数接着上一局打', () => {
    const prev = newGame({ levels: { even: 7, odd: 4 } })
    expect(nextRoundOptions(prev).levels).toEqual({ even: 7, odd: 4 })
  })

  it('下一局由上一局的头游领出', () => {
    const prev = newGame()
    // 头游 = finishOrder 0 的座位
    const winner = prev.players[0]!
    winner.finishOrder = 0
    expect(nextRoundOptions(prev).firstLeader).toBe(0)
  })

  it('整场结束（打过 A）后从 2 级重新开始', () => {
    const prev = newGame({ levels: { even: 14, odd: 2 } })
    prev.matchWinner = 'even'
    expect(nextRoundOptions(prev)).toEqual({ firstLeader: 0 })
  })
})
