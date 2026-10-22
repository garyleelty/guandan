import { describe, expect, it } from 'vitest'
import { newGame } from '../core/engine'
import { serializeFor } from './room'

describe('联机状态序列化', () => {
  it('带上本局级数（客人算级牌/逢人配要用）', () => {
    const st = newGame({ seed: 1, levels: { even: 7, odd: 3 } })
    const wire = serializeFor(st, 0)
    expect(wire.handLevel).toBe(7)
    expect(JSON.parse(JSON.stringify(wire)).handLevel).toBe(7)
  })

  it('带上上一局下游那队（结算页要用）', () => {
    const st = newGame({ seed: 1 })
    st.dwellerTeam = 'odd'
    expect(serializeFor(st, 0).dwellerTeam).toBe('odd')
  })

  it('观战状态不透任何人的手牌（包括房主）', () => {
    const st = newGame({ seed: 3 })
    const wire = serializeFor(st, 0, { hideHands: true })
    expect(wire.players.every((p) => p.hand.every((c) => c.id.startsWith('hidden-')))).toBe(true)
    expect(wire.players.map((p) => p.hand.length)).toEqual(st.players.map((p) => p.hand.length))
  })

  it('只公开自己的手牌，别家只给数量', () => {
    const st = newGame({ seed: 2 })
    for (const seat of [0, 1, 2, 3] as const) {
      const wire = serializeFor(st, seat)
      expect(wire.players[seat]!.hand).toEqual(st.players[seat]!.hand)
      for (const other of [0, 1, 2, 3] as const) {
        if (other === seat) continue
        expect(wire.players[other]!.hand).toHaveLength(st.players[other]!.hand.length)
        expect(wire.players[other]!.hand.every((c) => c.id.startsWith('hidden-'))).toBe(true)
      }
    }
  })
})
