import { RANK_LABEL, SUIT } from '../core/cards'
import type { Card } from '../core/cards'

const SUIT_CH = ['♠', '♥', '♣', '♦']

export function CardFace({ card, small, selected, dim }: { card: Card; small?: boolean; selected?: boolean; dim?: boolean }) {
  const isJoker = card.suit === -1
  const red = card.suit === SUIT.HEART || card.suit === SUIT.DIAMOND
  const label = RANK_LABEL[card.rank] ?? String(card.rank)
  return (
    <div
      className={[
        'relative flex shrink-0 select-none flex-col items-center justify-center gap-[2px] rounded-[8px] font-extrabold leading-none bg-white',
        'shadow-card transition-all duration-200',
        small ? 'h-12 w-9 text-[12px]' : 'h-[88px] w-[62px] text-[26px]',
        selected ? '-translate-y-4 ring-2 ring-blue ring-offset-1 ring-offset-white' : '',
        dim ? 'opacity-50 saturate-50' : '',
      ].join(' ')}
    >
      {isJoker && card.rank === 17 ? (
        <>
          <span className="text-rose-600" style={{ fontSize: small ? 10 : 15 }}>大王</span>
          <span className="text-ink3" style={{ fontSize: small ? 8 : 10 }}>JOKER</span>
        </>
      ) : isJoker && card.rank === 16 ? (
        <>
          <span className="text-ink" style={{ fontSize: small ? 10 : 15 }}>小王</span>
          <span className="text-ink3" style={{ fontSize: small ? 8 : 10 }}>JOKER</span>
        </>
      ) : (
        <span className={red ? 'text-rose-600' : 'text-ink'}>
          {label}
          <span style={{ fontSize: small ? 9 : 14 }}>{SUIT_CH[card.suit]}</span>
        </span>
      )}
    </div>
  )
}

void SUIT
