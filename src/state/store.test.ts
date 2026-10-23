import { beforeEach, describe, expect, it } from 'vitest'
import { newGame } from '../core/engine'
import { loadSolo } from './soloSave'
import { useStore } from './store'

// node 环境没有 localStorage，垫一个（续局存档要用）
const mem = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  },
})

beforeEach(() => {
  mem.clear()
  useStore.setState({ match: null, screen: 'lobby', mode: 'solo', aiLevel: 1 })
})

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

describe('单机续局', () => {
  it('开局即存档，回大厅就清掉', () => {
    useStore.getState().startSolo()
    const save = loadSolo()
    expect(save).not.toBeNull()
    expect(save!.match.players[0]!.hand).toEqual(useStore.getState().match!.players[0]!.hand)

    useStore.getState().backToLobby()
    expect(loadSolo()).toBeNull()
  })

  it('resumeSolo 恢复牌局、难度和牌桌界面', () => {
    const match = newGame({ seed: 7, names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'], isBot: [false, true, true, true] })
    useStore.getState().resumeSolo(match, 2)
    const s = useStore.getState()
    expect(s.screen).toBe('table')
    expect(s.mode).toBe('solo')
    expect(s.match).toBe(match)
    expect(s.aiLevel).toBe(2)
  })
})

describe('离开牌桌的状态清理', () => {
  it('回大厅清掉「已重新连接 / 观战 / 被请出」标记', () => {
    useStore.setState({ reconnected: true, spectating: true, kicked: '你已被房主请出房间', roomAiLevel: 2 })
    useStore.getState().backToLobby()
    const s = useStore.getState()
    expect(s.reconnected).toBe(false)
    expect(s.spectating).toBe(false)
    expect(s.kicked).toBe('')
    expect(s.roomAiLevel).toBeNull()
  })

  it('开单机局不会把联机标记带进牌桌', () => {
    // 直接调 startSolo 也应该是干净的（不只依赖 backToLobby）
    useStore.setState({ reconnected: true, spectating: true, kicked: '你已被房主请出房间' })
    useStore.getState().startSolo()
    const s = useStore.getState()
    expect(s.reconnected).toBe(false)
    expect(s.spectating).toBe(false)
    expect(s.kicked).toBe('')
  })
})
