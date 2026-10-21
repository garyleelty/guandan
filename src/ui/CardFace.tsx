import { RANK_LABEL, SUIT } from '../core/cards'
import type { Card } from '../core/cards'
import { Suit } from './Suit'

/** 牌面：白纸 + 索引角标 + 中央花色。桌面是暗的，牌是桌上唯一的亮物。 */
export function CardFace({
  card,
  small,
  selected,
  dim,
}: {
  card: Card
  small?: boolean
  selected?: boolean
  dim?: boolean
}) {
  const isJoker = card.suit === -1
  const red = card.suit === SUIT.HEART || card.suit === SUIT.DIAMOND
  const label = isJoker ? (card.rank === 17 ? '大王' : '小王') : (RANK_LABEL[card.rank] ?? String(card.rank))
  const ink = red ? 'text-suit-red' : 'text-card-ink'

  return (
    <div
      className={[
        'relative flex shrink-0 select-none flex-col rounded-[8px] border border-black/10 bg-card',
        small ? 'h-[60px] w-[42px]' : 'h-[88px] w-[62px]',
        selected ? '-translate-y-2 ring-2 ring-accent' : '',
        dim ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* 角标：手牌重叠时露出的正是这一条 */}
      <div className={`absolute top-1 left-1.5 leading-none ${ink} ${small ? 'text-[12px]' : 'text-[15px]'}`}>
        <div className="font-bold">{isJoker ? (card.rank === 17 ? '大' : '小') : label}</div>
        {!isJoker && (
          <Suit suit={card.suit} className={small ? 'mt-0.5 h-[9px] w-[9px]' : 'mt-0.5 h-[11px] w-[11px]'} />
        )}
      </div>

      {/* 中央：花色（大牌）/ 王字（小牌） */}
      <div className="flex flex-1 items-center justify-center pb-1">
        {isJoker ? (
          <div className="text-center leading-none">
            <div className={`font-bold ${ink} ${small ? 'text-[13px]' : 'text-[19px]'}`}>{label}</div>
            <div className={`text-card-ink/40 ${small ? 'text-[11px]' : 'text-[11px]'}`}>JOKER</div>
          </div>
        ) : (
          <Suit suit={card.suit} className={`${ink} ${small ? 'h-[22px] w-[22px]' : 'h-[34px] w-[34px]'}`} />
        )}
      </div>
    </div>
  )
}
