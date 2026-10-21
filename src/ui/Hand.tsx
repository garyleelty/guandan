import { useEffect, useRef, useState } from 'react'
import { CardFace } from './CardFace'
import type { Card } from '../core/cards'

const CARD_W = 62
const MAX_STRIP = 36
const MIN_STRIP = 22

export function Hand({
  hand,
  selected,
  toggle,
  quickLead,
  dimmed,
  levelCardRank,
}: {
  hand: Card[]
  selected: Set<string>
  toggle: (id: string) => void
  quickLead?: (id: string) => void
  dimmed?: (c: Card) => boolean
  /** 级牌对应的牌面点数（2 级 = 18），用于角标 */
  levelCardRank?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [strip, setStrip] = useState(MAX_STRIP)

  // 手牌 27 张时按可用宽度收紧重叠，保证整排不撑破页面
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const compute = () => {
      const n = hand.length
      if (n <= 1) {
        setStrip(MAX_STRIP)
        return
      }
      const avail = el.clientWidth - 16 - CARD_W
      setStrip(Math.max(MIN_STRIP, Math.min(MAX_STRIP, Math.floor(avail / (n - 1)))))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hand.length])

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto overflow-y-hidden">
      <div className="mx-auto flex w-max items-end px-2 pt-6 pb-2">
        {hand.map((c, i) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            onDoubleClick={() => quickLead?.(c.id)}
            className="cursor-pointer bg-transparent border-0 p-0 transition-[margin] duration-300 ease-out"
            style={{ marginLeft: i === 0 ? 0 : -(CARD_W - strip), zIndex: i }}
            aria-label={c.id}
            aria-pressed={selected.has(c.id)}
          >
            <div className="animate-deal">
              <CardFace card={c} selected={selected.has(c.id)} dim={dimmed?.(c)} />
              {c.rank === levelCardRank && (
                <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
                  级
                </span>
              )}
            </div>
          </button>
        ))}
        {hand.length === 0 && <div className="text-sm text-faint">已出完</div>}
      </div>
    </div>
  )
}
