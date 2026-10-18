import { CardFace } from './CardFace'
import type { Card } from '../core/cards'

export function Hand({
  hand,
  selected,
  toggle,
  quickLead,
  dimmed,
  levelRank,
}: {
  hand: Card[]
  selected: Set<string>
  toggle: (id: string) => void
  quickLead?: (id: string) => void
  dimmed?: (c: Card) => boolean
  levelRank?: number
}) {
  return (
    <div className="flex min-h-[104px] items-end justify-center gap-[6px] px-2 pt-6 pb-2">
      {hand.map((c, i) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          onDoubleClick={() => quickLead?.(c.id)}
          className="cursor-pointer bg-transparent border-0 p-0"
          style={{ marginLeft: i === 0 ? 0 : -26, zIndex: i, animationDelay: `${Math.min(i * 18, 500)}ms` }}
          aria-label={c.id}
        >
          <div className="animate-deal">
            <CardFace card={c} selected={selected.has(c.id)} dim={dimmed?.(c)} />
            {c.rank === levelRank && (
              <span className="absolute -top-2 -right-1.5 rounded-full bg-orange px-1.5 py-[1px] text-[9px] font-bold text-white shadow">
                级
              </span>
            )}
          </div>
        </button>
      ))}
      {hand.length === 0 && <div className="text-ink3 text-sm">已出完</div>}
    </div>
  )
}
