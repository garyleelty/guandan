import { beforeEach, describe, expect, it } from 'vitest'
import { clearSolo, loadSolo, saveSolo, SOLO_SAVE_KEY } from './soloSave'
import { newGame } from '../core/engine'

function fakeStorage(): {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  mem: Map<string, string>
} {
  const mem = new Map<string, string>()
  return {
    mem,
    storage: {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    },
  }
}

const names = ['你', 'AI 甲', 'AI 乙', 'AI 丙']
const bots = [false, true, true, true]

describe('单机续局存档', () => {
  let f: ReturnType<typeof fakeStorage>
  beforeEach(() => {
    f = fakeStorage()
  })

  it('存进去能原样读回来（手牌、级数、难度）', () => {
    const match = newGame({ seed: 42, names, isBot: bots, aiLevel: 2 })
    expect(saveSolo(match, 2, f.storage)).toBe(true)
    const back = loadSolo(f.storage)
    expect(back).not.toBeNull()
    expect(back!.aiLevel).toBe(2)
    expect(back!.mySeat).toBe(0)
    expect(back!.match.players[0]!.hand).toEqual(match.players[0]!.hand)
    expect(back!.match.levels).toEqual(match.levels)
    expect(back!.match.players.map((p) => p.name)).toEqual(names)
  })

  it('已经结束的局不存', () => {
    const match = newGame({ seed: 1, names, isBot: bots })
    match.phase = 'ended'
    expect(saveSolo(match, 1, f.storage)).toBe(false)
    expect(loadSolo(f.storage)).toBeNull()
  })

  it('没存过就是 null', () => {
    expect(loadSolo(f.storage)).toBeNull()
  })

  it('数据坏了返回 null，并把坏档删掉', () => {
    f.mem.set(SOLO_SAVE_KEY, '{not json')
    expect(loadSolo(f.storage)).toBeNull()
    expect(f.mem.has(SOLO_SAVE_KEY)).toBe(false)
  })

  it('形状不对（少一个玩家 / 手牌不是牌）也拒绝', () => {
    const match = newGame({ seed: 1, names, isBot: bots })
    f.mem.set(SOLO_SAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, aiLevel: 1, mySeat: 0, match: { ...match, players: [] } }))
    expect(loadSolo(f.storage)).toBeNull()

    const badHand = JSON.parse(JSON.stringify(match))
    badHand.players[2].hand = [{ id: 1 }]
    f.mem.set(SOLO_SAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, aiLevel: 1, mySeat: 0, match: badHand }))
    expect(loadSolo(f.storage)).toBeNull()
  })

  it('旧版本号不认', () => {
    const match = newGame({ seed: 1, names, isBot: bots })
    f.mem.set(SOLO_SAVE_KEY, JSON.stringify({ v: 0, savedAt: 1, aiLevel: 1, mySeat: 0, match }))
    expect(loadSolo(f.storage)).toBeNull()
  })

  it('清掉之后读不到', () => {
    saveSolo(newGame({ seed: 1, names, isBot: bots }), 1, f.storage)
    clearSolo(f.storage)
    expect(loadSolo(f.storage)).toBeNull()
  })

  it('存储写不进去也不抛异常', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    }
    expect(saveSolo(newGame(), 1, broken)).toBe(false)
  })
})
