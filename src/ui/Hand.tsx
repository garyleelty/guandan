import { useEffect, useRef, useState } from 'react'
import { CardFace } from './CardFace'
import type { CardSize } from './CardFace'
import type { Card } from '../core/cards'
import { useMediaQuery } from './useMediaQuery'

/** 手牌档位：桌面大牌 / 平板中牌 / 手机小牌；每档给出牌宽与最大露出宽度。 */
const TIERS: Record<string, { size: CardSize; w: number; maxStrip: number; minStrip: number }> = {
  lg: { size: 'lg', w: 76, maxStrip: 40, minStrip: 26 },
  md: { size: 'md', w: 62, maxStrip: 34, minStrip: 24 },
  sm: { size: 'sm', w: 50, maxStrip: 28, minStrip: 24 },
}

export function Hand({
  hand,
  selected,
  toggle,
  quickLead,
  dimmed,
  levelCardRank,
  view = 'row',
}: {
  hand: Card[]
  selected: Set<string>
  toggle: (id: string) => void
  quickLead?: (id: string) => void
  dimmed?: (c: Card) => boolean
  /** 级牌对应的牌面点数（2 级 = 18），用于角标 */
  levelCardRank?: number
  /** row = 底部一排（重叠）；grid = 全部摊开，手机上才看得清 27 张 */
  view?: 'row' | 'grid'
}) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const mid = useMediaQuery('(min-width: 640px)')
  const tier = TIERS[wide ? 'lg' : mid ? 'md' : 'sm']!

  const wrapRef = useRef<HTMLDivElement>(null)
  const [strip, setStrip] = useState(tier.maxStrip)

  // 手牌 27 张时按可用宽度收紧重叠，保证整排不撑破页面
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const compute = () => {
      const n = hand.length
      if (n <= 1) {
        setStrip(tier.maxStrip)
        return
      }
      const avail = el.clientWidth - 16 - tier.w
      setStrip(Math.max(tier.minStrip, Math.min(tier.maxStrip, Math.floor(avail / (n - 1)))))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hand.length, tier])

  if (view === 'grid') {
    return (
      <div className="max-h-[46vh] overflow-y-auto px-2 pt-4 pb-2">
        <div className="mx-auto grid w-full grid-cols-[repeat(auto-fill,52px)] justify-center gap-1.5">
          {hand.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className="cursor-pointer bg-transparent border-0 p-0"
              aria-label={c.id}
              aria-pressed={selected.has(c.id)}
            >
              <div className="relative">
                <CardFace card={c} size="sm" selected={selected.has(c.id)} dim={dimmed?.(c)} />
                {c.rank === levelCardRank && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
                    级
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto overflow-y-hidden">
      <div className="mx-auto flex w-max items-end px-2 pt-6 pb-2">
        {hand.map((c, i) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            onDoubleClick={() => quickLead?.(c.id)}
            className="cursor-pointer bg-transparent border-0 p-0 transition-[margin] duration-300 ease-out"
            style={{ marginLeft: i === 0 ? 0 : -(tier.w - strip), zIndex: i }}
            aria-label={c.id}
            aria-pressed={selected.has(c.id)}
          >
            <div className="animate-deal">
              <CardFace card={c} size={tier.size} selected={selected.has(c.id)} dim={dimmed?.(c)} />
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
