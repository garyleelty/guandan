import { describe, expect, it } from 'vitest'
import { RANK } from './cards'
import { ComboType, beats, identify } from './combos'
import { mk } from './testutil'

describe('identify: 基础牌型', () => {
  it('单张 / 对子 / 三张 / 三带二', () => {
    expect(identify(mk('10'))).toMatchObject({ type: ComboType.SINGLE, rank: 10 })
    expect(identify(mk('K', 'K'))).toMatchObject({ type: ComboType.PAIR, rank: 13 })
    expect(identify(mk('6', '6', '6'))).toMatchObject({ type: ComboType.TRIPLE, rank: 6 })
    expect(identify(mk('8', '8', '8', '3', '3'))).toMatchObject({ type: ComboType.TRIPLE_PAIR, rank: 8 })
  })
  it('單王是单张（小王/大王）', () => {
    expect(identify(mk('SJ'))).toMatchObject({ type: ComboType.SINGLE, rank: RANK.SJ })
    expect(identify(mk('BJ'))).toMatchObject({ type: ComboType.SINGLE, rank: RANK.BJ })
  })
  it('四张 3+1、两对 2+2 不构成牌型', () => {
    expect(identify(mk('5', '5', '5', '4'))).toBeNull()
    expect(identify(mk('5', '5', '6', '6'))).toBeNull()
  })
})

describe('identify: 顺系', () => {
  it('顺子恰 5 张连续', () => {
    expect(identify(mk('3♠', '4♥', '5♣', '6♦', '7♠'))).toMatchObject({ type: ComboType.STRAIGHT, rank: 7 })
    expect(identify(mk('10♠', 'J♥', 'Q♣', 'K♦', 'A♠'))).toMatchObject({ type: ComboType.STRAIGHT, rank: RANK.ACE })
  })
  it('非法顺子：6 张 / 断档 / 含 2', () => {
    expect(identify(mk('3', '4', '5', '6', '7', '8'))).toBeNull()
    expect(identify(mk('3', '4', '5', '7', '8'))).toBeNull()
    expect(identify(mk('J', 'Q', 'K', 'A', '2'))).toBeNull()
    expect(identify(mk('A', '2', '3', '4', '5'))).toBeNull()
  })
  it('连对 ≥3 组连续', () => {
    expect(identify(mk('5', '5', '6', '6', '7', '7'))).toMatchObject({ type: ComboType.PAIRS, rank: 7, count: 3 })
    expect(identify(mk('9', '9', '10', '10', 'J', 'J', 'Q', 'Q'))).toMatchObject({ type: ComboType.PAIRS, rank: RANK.QUEEN, count: 4 })
    expect(identify(mk('10', '10', 'J', 'J', 'Q', 'Q', 'K', 'K', 'A', 'A'))).toMatchObject({ type: ComboType.PAIRS, count: 5 })
  })
  it('钢板 ≥2 组连续三张', () => {
    expect(identify(mk('7', '7', '7', '8', '8', '8'))).toMatchObject({ type: ComboType.PLATE, rank: 8, count: 2 })
    expect(identify(mk('9', '9', '9', '10', '10', '10', 'J', 'J', 'J'))).toMatchObject({ type: ComboType.PLATE, count: 3 })
  })
  it('连对/钢板不可含 2 或王', () => {
    expect(identify(mk('A', 'A', '2', '2', '2', '2'))).toBeNull()
    expect(identify(mk('K', 'K', 'A', 'A', 'SJ', 'SJ'))).toBeNull()
  })
})

describe('identify: 炸系', () => {
  it('炸弹 4-8 张同点', () => {
    expect(identify(mk('2', '2', '2', '2'))).toMatchObject({ type: ComboType.BOMB, rank: RANK.TWO, count: 4 })
    expect(identify(mk('3', '3', '3', '3', '3', '3', '3', '3'))).toMatchObject({ type: ComboType.BOMB, count: 8 })
    expect(identify(mk('K', 'K', 'K', 'K', 'K'))).toMatchObject({ type: ComboType.BOMB, count: 5 })
    expect(identify(mk('5', '5', '5', '5', '5', '5', '5'))).toMatchObject({ type: ComboType.BOMB, count: 7 })
  })
  it('9 张同点不存在（每点至多 8 张）', () => {
    expect(identify([mk('3', '3'), ...mk('3', '3'), ...mk('3', '3'), ...mk('3', '3'), ...mk('3')])).toBeNull()
  })
  it('同花顺：同花 5 连；否则只是顺子', () => {
    expect(identify(mk('5♦', '6♦', '7♦', '8♦', '9♦'))).toMatchObject({ type: ComboType.SFLUSH, rank: 9 })
    expect(identify(mk('5', '6♦', '7♦', '8♦', '9♦'))).toMatchObject({ type: ComboType.STRAIGHT })
    expect(identify(mk('2♦', '3♦', '4♦', '5♦', '6♦'))).toBeNull()
  })
  it('天炸：四王同出；李代不同王的组合非法', () => {
    expect(identify(mk('BJ0', 'BJ1', 'SJ0', 'SJ1'))).toMatchObject({ type: ComboType.JOKERS })
    expect(identify(mk('SJ0', 'BJ1'))).toBeNull()
    expect(identify(mk('SJ0', 'SJ1'))).toBeNull()
    expect(identify(mk('BJ0', 'BJ1'))).toBeNull()
  })
})

describe('beats', () => {
  it('同型比点', () => {
    const beatsOf = (a: string[], b: string[]) => beats(identify(mk(...a))!, identify(mk(...b))!)
    expect(beatsOf(['A'], ['K'])).toBe(true)
    expect(beatsOf(['K'], ['A'])).toBe(false)
    expect(beatsOf(['Q', 'Q'], ['9', '9'])).toBe(true)
    expect(beatsOf(['K', 'K'], ['A', 'A'])).toBe(false)
    expect(beatsOf(['7', '7', '7', '5', '5'], ['6', '6', '6', 'K', 'K'])).toBe(true)
    expect(beatsOf(['A', 'A', 'A', '2', '2'], ['K', 'K', 'K', '2', '2'])).toBe(true)
    expect(beatsOf(['5', '5', '6', '6', '7', '7'], ['4', '4', '5', '5', '6', '6'])).toBe(true)
    expect(beatsOf(['9', '9', '10', '10', 'J', 'J'], ['5', '5', '6', '6', '7', '7'])).toBe(true)
    expect(beatsOf(['5', '5', '5', '6', '6', '6'], ['4', '4', '4', '5', '5', '5'])).toBe(true)
  })
  it('长度/组数不同的同型不能互压', () => {
    const beatsOf = (a: string[], b: string[]) => beats(identify(mk(...a))!, identify(mk(...b))!)
    expect(beatsOf(['5', '5', '6', '6', '7', '7'], ['9', '9', '10', '10', 'J', 'J', 'Q', 'Q'])).toBe(false) // 组数不同
    expect(beatsOf(['9', '9', '10', '10', 'J', 'J', 'Q', 'Q'], ['5', '5', '6', '6', '7', '7'])).toBe(false) // 组数不同不可压
    expect(beatsOf(['J', 'J', 'Q', 'Q', 'K', 'K'], ['3', '3', '4', '4', '5', '5'])).toBe(true) // 同组数 3
    expect(identify(mk('5', '5', '6', '6'))).toBeNull() // 2 组连对根本非法
  })
  it('炸弹打通杀', () => {
    const beatsOf = (a: string[], b: string[]) => beats(identify(mk(...a))!, identify(mk(...b))!)
    expect(beatsOf(['3', '3', '3', '3'], ['A', 'A', 'A', '2', '2'])).toBe(true)
    expect(beatsOf(['K', 'K'], ['K', 'K', 'K', 'K'])).toBe(false)
    expect(beatsOf(['K', 'K', 'K', 'K'], ['2', '2', '2', '2', '2'])).toBe(false)
    expect(beatsOf(['2', '2', '2', '2', '2', '2', '2', '2'], ['A', 'A', 'A', 'A'])).toBe(true)
  })
  it('同花顺压炸弹；超大炸弹压同花顺？不 — 同花顺>一切炸弹', () => {
    const beatsOf = (a: string[], b: string[]) => beats(identify(mk(...a))!, identify(mk(...b))!)
    const sf = ['5♦', '6♦', '7♦', '8♦', '9♦']
    expect(beatsOf(sf, ['3', '3', '3', '3', '3', '3', '3', '3'])).toBe(true)
    expect(beatsOf(['3', '3', '3', '3', '3', '3', '3', '3'], sf)).toBe(false)
    expect(beatsOf(sf, ['6♦', '7♦', '8♦', '9♦', '10♦'])).toBe(false)
    expect(beatsOf(['6♦', '7♦', '8♦', '9♦', '10♦'], sf)).toBe(true)
  })
  it('天炸 > 同花顺和 8 张炸', () => {
    const beatsOf = (a: string[], b: string[]) => beats(identify(mk(...a))!, identify(mk(...b))!)
    const rocket = ['BJ0', 'BJ1', 'SJ0', 'SJ1']
    expect(beatsOf(rocket, ['5♦', '6♦', '7♦', '8♦', '9♦'])).toBe(true)
    expect(beatsOf(rocket, ['2', '2', '2', '2', '2', '2', '2', '2'])).toBe(true)
    expect(beatsOf(['2', '2', '2', '2', '2', '2', '2', '2'], rocket)).toBe(false)
  })
})
