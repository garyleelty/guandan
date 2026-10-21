import { describe, expect, it } from 'vitest'
import { decodeReplay, encodeReplay, replayFromState } from './replay'
import { newGame, step } from './engine'
import { mk } from './testutil'

describe('牌局复盘（分享链接）', () => {
  it('编码解码能还原同一局', async () => {
    const st = newGame({ hands: [mk('3'), mk('6'), mk('8', '5'), mk('9', '4')] })
    const s1 = step(st, { kind: 'play', seat: 0, cards: [st.players[0]!.hand[0]!.id] })
    const data = replayFromState(s1)
    const frag = await encodeReplay(data)
    const back = await decodeReplay(frag)
    expect(back).toEqual(data)
    expect(frag).not.toContain('=')
  })

  it('真实一局的链接片段比原始 JSON 短（gzip 有效）', async () => {
    const st = newGame()
    // 造一局 100 手的记录
    st.log = Array.from({ length: 100 }, (_, i) => ({
      seat: (i % 4) as 0 | 1 | 2 | 3,
      ids: ['s' + (3 + (i % 10)) + '-0', 'h' + (3 + (i % 10)) + '-1'],
      combo: { type: 1, rank: 3 + (i % 10) },
    }))
    const data = replayFromState(st)
    const frag = await encodeReplay(data)
    expect(frag.length).toBeLessThan(JSON.stringify(data).length)
  })

  it('不是合法数据就返回 null，不炸', async () => {
    expect(await decodeReplay('not-base64!!')).toBeNull()
    expect(await decodeReplay('')).toBeNull()
  })
})
