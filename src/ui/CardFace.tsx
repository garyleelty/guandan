import { RANK_LABEL, SUIT } from '../core/cards'
import type { Card } from '../core/cards'
import { Suit } from './Suit'

/** 牌面尺寸档位：手牌三档 + 中央出的牌一档。 */
export type CardSize = 'lg' | 'md' | 'sm' | 'xs'

const SIZE: Record<
  CardSize,
  { w: number; h: number; rank: number; suit: number; mid: number; joker: number }
> = {
  lg: { w: 76, h: 108, rank: 19, suit: 14, mid: 42, joker: 21 },
  md: { w: 62, h: 88, rank: 15, suit: 11, mid: 34, joker: 18 },
  sm: { w: 50, h: 72, rank: 13, suit: 10, mid: 28, joker: 15 },
  xs: { w: 42, h: 60, rank: 12, suit: 9, mid: 22, joker: 13 },
}

/** 牌面：白纸 + 索引角标 + 中央花色。桌面是暗的，牌是桌上唯一的亮物。 */
export function CardFace({
  card,
  size = 'md',
  selected,
  dim,
}: {
  card: Card
  size?: CardSize
  selected?: boolean
  dim?: boolean
}) {
  const s = SIZE[size]
  const isJoker = card.suit === -1
  const red = card.suit === SUIT.HEART || card.suit === SUIT.DIAMOND
  const label = isJoker ? (card.rank === 17 ? '大王' : '小王') : (RANK_LABEL[card.rank] ?? String(card.rank))
  const ink = red ? 'text-suit-red' : 'text-card-ink'

  return (
    <div
      className={[
        'relative flex shrink-0 select-none flex-col rounded-[8px] border border-black/10 bg-card',
        selected ? '-translate-y-2 ring-2 ring-accent' : '',
        dim ? 'opacity-40' : '',
      ].join(' ')}
      style={{ width: s.w, height: s.h }}
    >
      {/* 角标：手牌重叠时露出的正是这一条 */}
      <div className={`absolute top-1 left-1.5 leading-none ${ink}`} style={{ fontSize: s.rank }}>
        <div className="font-bold">{isJoker ? (card.rank === 17 ? '大' : '小') : label}</div>
        {!isJoker && <Suit suit={card.suit} className="mt-0.5" style={{ width: s.suit, height: s.suit }} />}
      </div>

      {/* 中央：花色（大牌）/ 王字（小牌） */}
      <div className="flex flex-1 items-center justify-center pb-1">
        {isJoker ? (
          <div className="text-center leading-none">
            <div className={`font-bold ${ink}`} style={{ fontSize: s.joker }}>
              {label}
            </div>
            <div className="text-card-ink/40" style={{ fontSize: 11 }}>
              JOKER
            </div>
          </div>
        ) : (
          <Suit suit={card.suit} className={ink} style={{ width: s.mid, height: s.mid }} />
        )}
      </div>
    </div>
  )
}
