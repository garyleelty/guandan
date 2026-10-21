import { describe, expect, it } from 'vitest'
import { RANK } from './cards'
import { ComboType, beats, identify } from './combos'
import { legalMoves, newGame } from './engine'
import { mk } from './testutil'

/** 7 级局：♥7 是逢人配（万能牌），其余 7 是普通级牌。 */
const L = 7

describe('逢人配（红桃级牌）', () => {
  it('单出时只算普通级牌', () => {
    expect(identify(mk('7♥'), L)).toMatchObject({ type: ComboType.SINGLE, rank: RANK.LEVEL })
  })
  it('与三张同点成炸弹（官方例子：7♥ + 三张 8 = 8 炸）', () => {
    expect(identify(mk('7♥', '8', '8', '8'), L)).toMatchObject({
      type: ComboType.BOMB,
      rank: 8,
      count: 4,
    })
  })
  it('与两张同点成三张', () => {
    expect(identify(mk('7♥', '8', '8'), L)).toMatchObject({ type: ComboType.TRIPLE, rank: 8 })
  })
  it('与一张同点成对子', () => {
    expect(identify(mk('7♥', '8'), L)).toMatchObject({ type: ComboType.PAIR, rank: 8 })
  })
  it('补顺子的一格', () => {
    expect(identify(mk('7♥', '3♠', '4♥', '5♣', '6♦'), L)).toMatchObject({
      type: ComboType.STRAIGHT,
      rank: 7,
    })
  })
  it('同花顺：万能配补上同花色那一张', () => {
    expect(identify(mk('7♥', '3♠', '4♠', '5♠', '6♠'), L)).toMatchObject({
      type: ComboType.SFLUSH,
      rank: 7,
    })
  })
  it('三带二：万能配凑成三张', () => {
    expect(identify(mk('7♥', '8', '8', '5', '5'), L)).toMatchObject({ type: ComboType.TRIPLE_PAIR })
  })
  it('万能配压不过同花顺（它只能当普通牌点）', () => {
    // ♠7♠7♠7♠ 是 7 炸；♥7 不能当王
    expect(identify(mk('7♥', 'SJ', 'BJ'), L)).toBeNull()
  })
  it('炸弹大小：8 炸压不过 9 炸（用万能配凑的也算）', () => {
    const wild8 = identify(mk('7♥', '8', '8', '8'), L)!
    const nine = identify(mk('9', '9', '9', '9'), L)!
    expect(beats(nine, wild8)).toBe(true)
    expect(beats(wild8, nine)).toBe(false)
  })
})

describe('逢人配在合法走法里', () => {
  it('手上有万能配时，能列出「万能配 + 三张 8」这个炸弹', () => {
    const cards = mk('7♥', '8', '8', '8', '5', '6', '3', '4')
    const st = newGame({ hands: [cards, mk('9', '9', '9', '9'), mk('K', 'K', 'K', 'K'), mk('Q', 'Q', 'Q', 'Q')] })
    st.handLevel = L
    const moves = legalMoves(st, 0)
    const bomb = moves.find((m) => m.type === ComboType.BOMB && m.cards.length === 4 && m.rank === 8)
    expect(bomb).toBeDefined()
    expect(bomb!.cards.some((c) => c.suit === 1 && c.rank === 7)).toBe(true)
  })

  it('万能配也能补顺子', () => {
    const cards = mk('7♥', '3♠', '4♥', '5♣', '6♦', '9', '9', '9')
    const st = newGame({ hands: [cards, mk('K', 'K', 'K', 'K'), mk('Q', 'Q', 'Q', 'Q'), mk('J', 'J', 'J', 'J')] })
    st.handLevel = L
    const moves = legalMoves(st, 0)
    const straight = moves.find((m) => m.type === ComboType.STRAIGHT && m.cards.length === 5)
    expect(straight).toBeDefined()
  })
})
