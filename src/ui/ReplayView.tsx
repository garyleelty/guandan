import { useState } from 'react'
import { PlayList } from './PlayHistory'
import type { ReplayData, ReplayDataV1, ReplayDataV2 } from '../core/replay'

const COMBO_LABEL: Record<number, string> = {
  0: '单张', 1: '对子', 2: '三张', 3: '三带二', 4: '顺子', 5: '连对', 6: '钢板',
  7: '炸弹', 8: '同花顺', 9: '天炸',
}

/** 复盘页：别人点开分享链接看到的那一局（v1）或整场（v2）。 */
export function ReplayView({ data }: { data: ReplayData }) {
  const v2 = data.v === 2 ? (data as ReplayDataV2) : null
  const rounds = v2
    ? v2.rounds
    : [{ g: (data as { g: ReplayDataV1['g'] }).g, w: null, d: 0 }]
  const [active, setActive] = useState(rounds.length - 1)
  const round = rounds[Math.min(active, rounds.length - 1)]!
  const log = round.g.map((e) => ({
    seat: e.s,
    ids: e.c,
    combo: e.t === null ? null : { type: e.t, rank: e.r },
  }))
  // 队名用两个座位的名字（0/2 一队、1/3 一队），看的人不用猜「我方」是谁
  const teamLabel = (w: 'even' | 'odd') =>
    w === 'even' ? `${data.n[0]}&${data.n[2]}` : `${data.n[1]}&${data.n[3]}`
  const counts = new Map<number, number>()
  for (const e of log) {
    if (!e.combo) continue
    counts.set(e.combo.type, (counts.get(e.combo.type) ?? 0) + 1)
  }
  const breakdown = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${COMBO_LABEL[t] ?? ''} ${n}`)
    .join(' · ')

  return (
    <div className="mx-auto flex h-full w-full max-w-[560px] flex-col px-4 py-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold text-ink">掼蛋 · 牌局复盘</h1>
        <span className="ml-auto text-[13px] text-muted">{log.length} 手</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {data.n.map((name, i) => (
          <span key={i} className="chip">
            {name}
          </span>
        ))}
        <span className="ml-2 text-[13px] text-muted">
          级数 {data.l[0]} : {data.l[1]}
        </span>
      </div>

      {rounds.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="replay-rounds">
          {rounds.map((r, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={[
                'rounded-control border px-3 py-1 text-[13px]',
                i === active ? 'border-accent bg-accent/10 text-ink' : 'border-control bg-surface text-muted',
              ].join(' ')}
              aria-pressed={i === active}
            >
              第 {i + 1} 局
              {r.w ? ` · ${teamLabel(r.w)} +${r.d}` : ' · 进行中'}
            </button>
          ))}
        </div>
      )}

      {breakdown && <p className="mt-2 text-[13px] text-faint">{breakdown}</p>}

      <div className="panel mt-3 flex min-h-0 flex-1 flex-col p-4">
        <PlayList log={log} names={data.n} emptyText="这一局没有记录" />
      </div>

      <p className="mt-3 text-center text-[12px] text-faint">这是别人分享的一局掼蛋</p>
    </div>
  )
}
