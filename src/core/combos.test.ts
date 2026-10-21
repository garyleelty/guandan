import { describe, expect, it } from 'vitest'
import { RANK } from './cards'
import { ComboType, beats, identify } from './combos'
import { mk } from './testutil'

/** 默认按「级数为 2」测试：2 是级牌（其余用例不碰 2，只有级牌专用用例换级数）。 */
const L = 2
const id = (cards: string[], level = L) => identify(mk(...cards), level)

describe('identify: 基础牌型', () => {
  it('单张 / 对子 / 三张 / 三带二', () => {
    expect(id(['10'])).toMatchObject({ type: ComboType.SINGLE, rank: 10 })
    expect(id(['K', 'K'])).toMatchObject({ type: ComboType.PAIR, rank: 13 })
    expect(id(['6', '6', '6'])).toMatchObject({ type: ComboType.TRIPLE, rank: 6 })
    expect(id(['8', '8', '8', '3', '3'])).toMatchObject({ type: ComboType.TRIPLE_PAIR, rank: 8 })
  })
  it('單王是单张（小王/大王）', () => {
    expect(id(['SJ'])).toMatchObject({ type: ComboType.SINGLE, rank: RANK.SJ })
    expect(id(['BJ'])).toMatchObject({ type: ComboType.SINGLE, rank: RANK.BJ })
  })
  it('同色的一对王算对子；大小王各一不算', () => {
    expect(id(['SJ0', 'SJ1'])).toMatchObject({ type: ComboType.PAIR, rank: RANK.SJ })
    expect(id(['BJ0', 'BJ1'])).toMatchObject({ type: ComboType.PAIR, rank: RANK.BJ })
    expect(id(['SJ0', 'BJ1'])).toBeNull()
  })
  it('四张 3+1、两对 2+2 不构成牌型', () => {
    expect(id(['5', '5', '5', '4'])).toBeNull()
    expect(id(['5', '5', '6', '6'])).toBeNull()
  })
})

describe('identify: 顺系', () => {
  it('顺子恰 5 张连续', () => {
    expect(id(['3♠', '4♥', '5♣', '6♦', '7♠'])).toMatchObject({ type: ComboType.STRAIGHT, rank: 7 })
    expect(id(['10♠', 'J♥', 'Q♣', 'K♦', 'A♠'])).toMatchObject({ type: ComboType.STRAIGHT, rank: RANK.ACE })
  })
  it('A 可高可低：A-2-3-4-5 是最小的顺子', () => {
    expect(id(['A♠', '2♥', '3♣', '4♦', '5♠'])).toMatchObject({ type: ComboType.STRAIGHT, rank: 5 })
    expect(id(['2♠', '3♥', '4♣', '5♦', '6♠'])).toMatchObject({ type: ComboType.STRAIGHT, rank: 6 })
  })
  it('非法顺子：6 张 / 断档 / J-Q-K-A-2', () => {
    expect(id(['3', '4', '5', '6', '7', '8'])).toBeNull()
    expect(id(['3', '4', '5', '7', '8'])).toBeNull()
    expect(id(['J', 'Q', 'K', 'A', '2'])).toBeNull()
  })
  it('连对 ≥3 组连续', () => {
    expect(id(['5', '5', '6', '6', '7', '7'])).toMatchObject({ type: ComboType.PAIRS, rank: 7, count: 3 })
    expect(id(['9', '9', '10', '10', 'J', 'J', 'Q', 'Q'])).toMatchObject({ type: ComboType.PAIRS, rank: RANK.QUEEN, count: 4 })
    expect(id(['10', '10', 'J', 'J', 'Q', 'Q', 'K', 'K', 'A', 'A'])).toMatchObject({ type: ComboType.PAIRS, count: 5 })
  })
  it('钢板 ≥2 组连续三张', () => {
    expect(id(['7', '7', '7', '8', '8', '8'])).toMatchObject({ type: ComboType.PLATE, rank: 8, count: 2 })
    expect(id(['9', '9', '9', '10', '10', '10', 'J', 'J', 'J'])).toMatchObject({ type: ComboType.PLATE, count: 3 })
  })
  it('连对/钢板不可含王', () => {
    expect(id(['K', 'K', 'A', 'A', 'SJ', 'SJ'])).toBeNull()
  })
})

describe('identify: 级牌（官方口径）', () => {
  it('级牌大于 A、小于王', () => {
    // 级数为 7：7 是级牌
    expect(id(['7'], 7)).toMatchObject({ type: ComboType.SINGLE, rank: RANK.LEVEL })
    expect(beats(id(['7'], 7)!, id(['A'], 7)!)).toBe(true)
    expect(beats(id(['A'], 7)!, id(['7'], 7)!)).toBe(false)
    expect(beats(id(['BJ'], 7)!, id(['7'], 7)!)).toBe(true)
  })
  it('级牌不能按原点数出牌：2-2-3-3-4-4 不算连对', () => {
    expect(id(['2', '2', '3', '3', '4', '4'], 2)).toBeNull()
    // 不是级牌时就是连对
    expect(id(['2', '2', '3', '3', '4', '4'], 7)).toMatchObject({ type: ComboType.PAIRS, count: 3 })
  })
  it('级牌在顺子里按原点数算：A-2-3-4-5 在 2 级局仍合法', () => {
    expect(id(['A♠', '2♥', '3♣', '4♦', '5♠'], 2)).toMatchObject({ type: ComboType.STRAIGHT, rank: 5 })
  })
  it('级牌的一对/三张/炸弹都按级牌比较', () => {
    expect(id(['7', '7'], 7)).toMatchObject({ type: ComboType.PAIR, rank: RANK.LEVEL })
    expect(id(['7', '7', '7'], 7)).toMatchObject({ type: ComboType.TRIPLE, rank: RANK.LEVEL })
    expect(id(['7', '7', '7', '7'], 7)).toMatchObject({ type: ComboType.BOMB, rank: RANK.LEVEL, count: 4 })
    // 级牌炸弹压 A 炸弹
    expect(beats(id(['7', '7', '7', '7'], 7)!, id(['A', 'A', 'A', 'A'], 7)!)).toBe(true)
  })
})

describe('identify: 炸系', () => {
  it('炸弹 4-8 张同点', () => {
    expect(id(['3', '3', '3', '3'])).toMatchObject({ type: ComboType.BOMB, rank: RANK.THREE, count: 4 })
    // 2 级局里 2 是级牌，2 张炸按级牌算
    expect(id(['2', '2', '2', '2'], 2)).toMatchObject({ type: ComboType.BOMB, rank: RANK.LEVEL, count: 4 })
    expect(id(['2', '2', '2', '2'], 7)).toMatchObject({ type: ComboType.BOMB, rank: RANK.TWO, count: 4 })
    expect(id(['3', '3', '3', '3', '3', '3', '3', '3'])).toMatchObject({ type: ComboType.BOMB, count: 8 })
    expect(id(['K', 'K', 'K', 'K', 'K'])).toMatchObject({ type: ComboType.BOMB, count: 5 })
    expect(id(['5', '5', '5', '5', '5', '5', '5'])).toMatchObject({ type: ComboType.BOMB, count: 7 })
  })
  it('9 张同点不存在（每点至多 8 张）', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `fake${i}`, rank: RANK.THREE, suit: i % 4 }))
    expect(identify(nine, L)).toBeNull()
  })
  it('同花顺：同花 5 连；否则只是顺子', () => {
    expect(id(['5♦', '6♦', '7♦', '8♦', '9♦'])).toMatchObject({ type: ComboType.SFLUSH, rank: 9 })
    expect(id(['5', '6♦', '7♦', '8♦', '9♦'])).toMatchObject({ type: ComboType.STRAIGHT })
    expect(id(['2♦', '3♦', '4♦', '5♦', '6♦'])).toMatchObject({ type: ComboType.SFLUSH, rank: 6 })
  })
  it('天炸：四王同出；一王一王不是天炸', () => {
    expect(id(['BJ0', 'BJ1', 'SJ0', 'SJ1'])).toMatchObject({ type: ComboType.JOKERS })
    expect(id(['SJ0', 'BJ1'])).toBeNull()
  })
})

describe('beats', () => {
  const beatsOf = (a: string[], b: string[], level = L) => beats(identify(mk(...a), level)!, identify(mk(...b), level)!)
  it('同型比点', () => {
    expect(beatsOf(['A'], ['K'])).toBe(true)
    expect(beatsOf(['K'], ['A'])).toBe(false)
    expect(beatsOf(['Q', 'Q'], ['9', '9'])).toBe(true)
    expect(beatsOf(['K', 'K'], ['A', 'A'])).toBe(false)
    expect(beatsOf(['7', '7', '7', '5', '5'], ['6', '6', '6', 'K', 'K'])).toBe(true)
    expect(beatsOf(['5', '5', '6', '6', '7', '7'], ['4', '4', '5', '5', '6', '6'])).toBe(true)
    expect(beatsOf(['9', '9', '10', '10', 'J', 'J'], ['5', '5', '6', '6', '7', '7'])).toBe(true)
    expect(beatsOf(['5', '5', '5', '6', '6', '6'], ['4', '4', '4', '5', '5', '5'])).toBe(true)
  })
  it('2 最小：一对 2 压不过一对 A（2 级局除外——那时 2 是级牌）', () => {
    expect(beatsOf(['2', '2'], ['A', 'A'], 7)).toBe(false)
    expect(beatsOf(['A', 'A'], ['2', '2'], 7)).toBe(true)
    expect(beatsOf(['2', '2'], ['A', 'A'], 2)).toBe(true)
  })
  it('长度/组数不同的同型不能互压', () => {
    expect(beatsOf(['5', '5', '6', '6', '7', '7'], ['9', '9', '10', '10', 'J', 'J', 'Q', 'Q'])).toBe(false) // 组数不同
    expect(beatsOf(['9', '9', '10', '10', 'J', 'J', 'Q', 'Q'], ['5', '5', '6', '6', '7', '7'])).toBe(false) // 组数不同不可压
    expect(beatsOf(['J', 'J', 'Q', 'Q', 'K', 'K'], ['3', '3', '4', '4', '5', '5'])).toBe(true) // 同组数 3
    expect(id(['5', '5', '6', '6'])).toBeNull() // 2 组连对根本非法
  })
  it('炸弹打通杀', () => {
    expect(beatsOf(['3', '3', '3', '3'], ['A', 'A', 'A', '2', '2'])).toBe(true)
    expect(beatsOf(['K', 'K'], ['K', 'K', 'K', 'K'])).toBe(false)
    expect(beatsOf(['K', 'K', 'K', 'K'], ['2', '2', '2', '2', '2'])).toBe(false)
    expect(beatsOf(['2', '2', '2', '2', '2', '2', '2', '2'], ['A', 'A', 'A', 'A'])).toBe(true)
  })
  it('同花顺压炸弹；同花顺之间比大小', () => {
    const sf = ['5♦', '6♦', '7♦', '8♦', '9♦']
    expect(beatsOf(sf, ['3', '3', '3', '3', '3', '3', '3', '3'])).toBe(true)
    expect(beatsOf(['3', '3', '3', '3', '3', '3', '3', '3'], sf)).toBe(false)
    expect(beatsOf(sf, ['6♦', '7♦', '8♦', '9♦', '10♦'])).toBe(false)
    expect(beatsOf(['6♦', '7♦', '8♦', '9♦', '10♦'], sf)).toBe(true)
  })
  it('天炸 > 同花顺和 8 张炸', () => {
    const rocket = ['BJ0', 'BJ1', 'SJ0', 'SJ1']
    expect(beatsOf(rocket, ['5♦', '6♦', '7♦', '8♦', '9♦'])).toBe(true)
    expect(beatsOf(rocket, ['2', '2', '2', '2', '2', '2', '2', '2'])).toBe(true)
    expect(beatsOf(['2', '2', '2', '2', '2', '2', '2', '2'], rocket)).toBe(false)
  })
})
