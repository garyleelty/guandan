import { useEffect, useRef, useState } from 'react'
import { CardFace } from './CardFace'
import type { CardSize } from './CardFace'
import type { Card } from '../core/cards'
import { useMediaQuery } from './useMediaQuery'
import { buildStackView } from './stackView'

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
  /** row = 底部一排（重叠）；grid = 全部摊开；stack = 点数×花色堆叠矩阵，同花顺高亮 */
  view?: 'row' | 'grid' | 'stack'
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

  if (view === 'stack') {
    const sv = buildStackView(hand, levelCardRank)
    const cell = (c: Card, key: string, hot: boolean) => (
      <button
        key={key}
        onClick={() => toggle(c.id)}
        onDoubleClick={() => quickLead?.(c.id)}
        className="cursor-pointer bg-transparent border-0 p-0"
        aria-label={c.id}
        aria-pressed={selected.has(c.id)}
      >
        <div className={['relative rounded-[6px]', hot && !selected.has(c.id) ? 'ring-2 ring-accent' : ''].join(' ')}>
          <CardFace card={c} size="sm" selected={selected.has(c.id)} dim={dimmed?.(c)} />
          {c.rank === levelCardRank &&
            (c.suit === 1 ? (
              <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-ink text-[11px] font-bold text-black">
                配
              </span>
            ) : (
              <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
                级
              </span>
            ))}
        </div>
      </button>
    )
    return (
      <div className="max-h-[52vh] overflow-auto px-2 py-2">
        <div className="mx-auto w-max">
          {sv.rows.map((row) => (
            <div key={row.eff} className="flex items-center gap-1 py-0.5">
              <div className="w-9 shrink-0 text-right text-[12px] font-bold text-faint">{row.label}</div>
              {(row.cells[0]!.suit < 0 ? row.cells : [0, 1, 2, 3].map((suit) => row.cells.find((c) => c.suit === suit))).map(
                (c) => (
                  <div
                    key={c ? c.key : `empty-${row.eff}`}
                    className={[
                      'relative flex justify-center rounded-[8px] px-0.5 py-1',
                      c && sv.flushRun.has(c.key) ? 'bg-accent/10' : '',
                    ].join(' ')}
                    style={{ width: 58, minHeight: 92 }}
                  >
                    {c?.cards.map((cd, i) => (
                      <div
                        key={cd.id}
                        className="absolute"
                        style={{ top: 4 + i * 14, left: 4 + i * 6, zIndex: i }}
                      >
                        {cell(cd, cd.id, sv.flushRun.has(c.key))}
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          ))}
          {hand.length === 0 && <div className="py-4 text-center text-sm text-faint">已出完</div>}
        </div>
      </div>
    )
  }

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
                {c.rank === levelCardRank &&
                  (c.suit === 1 ? (
                    // 逢人配：红桃级牌
                    <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-ink text-[11px] font-bold text-black">
                      配
                    </span>
                  ) : (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
                      级
                    </span>
                  ))}
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
              {c.rank === levelCardRank &&
                (c.suit === 1 ? (
                  // 逢人配：红桃级牌
                  <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-ink text-[11px] font-bold text-black">
                    配
                  </span>
                ) : (
                  <span className="absolute -top-1.5 -right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
                    级
                  </span>
                ))}
            </div>
          </button>
        ))}
        {hand.length === 0 && <div className="text-sm text-faint">已出完</div>}
      </div>
    </div>
  )
}
