import { levelLabel } from '../core/cards'

const STEPS = 13 // 2 … A
const STEP_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** 级牌：打几级就画一张那个点的小白牌——掼蛋自己的东西。 */
export function LevelCard({ level }: { level: number }) {
  return (
    <div className="flex h-[30px] w-[22px] items-center justify-center rounded-[4px] border border-black/10 bg-card text-[13px] font-bold text-card-ink">
      {levelLabel(level)}
    </div>
  )
}

/** 一条 2…A 的进度轨：已过的级填满，当前级最实。 */
export function LevelTrack({
  level,
  tone,
  step = 7,
}: {
  level: number
  tone: 'accent' | 'neutral'
  step?: number
}) {
  const idx = Math.max(0, Math.min(STEPS - 1, level - 2))
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: STEPS }, (_, i) => (
        <span
          key={i}
          style={{ width: step }}
          className={[
            'h-[4px] rounded-[1px]',
            i < idx ? (tone === 'accent' ? 'bg-accent' : 'bg-ink/50') : 'bg-control',
            i === idx ? (tone === 'accent' ? 'bg-accent' : 'bg-ink') : '',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

/** 级牌阶梯：两队各一条轨——签名元素，升级进度一眼可见。 */
export function LevelLadder({
  mine,
  theirs,
  withLabels = false,
}: {
  mine: number
  theirs: number
  withLabels?: boolean
}) {
  const step = withLabels ? 15 : 7
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-xs text-muted">我方</span>
        <LevelTrack level={mine} tone="accent" step={step} />
        <span className="num text-xs text-ink">{levelLabel(mine)} 级</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-xs text-muted">对家</span>
        <LevelTrack level={theirs} tone="neutral" step={step} />
        <span className="num text-xs text-ink">{levelLabel(theirs)} 级</span>
      </div>
      {withLabels && (
        <div className="flex items-center gap-3 pt-1">
          <span className="w-8 shrink-0" />
          <div className="flex items-center gap-[2px]">
            {STEP_NAMES.map((n) => (
              <span key={n} style={{ width: step }} className="text-center text-[11px] text-faint">
                {n}
              </span>
            ))}
          </div>
          <span />
        </div>
      )}
    </div>
  )
}
