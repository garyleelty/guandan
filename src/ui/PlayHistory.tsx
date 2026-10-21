import { useEffect } from 'react'
import { CardFace } from './CardFace'
import { cardFromId, RANK_LABEL } from '../core/cards'
import type { GameState } from '../core/engine'

const COMBO_LABEL: Record<number, string> = {
  0: '单张', 1: '对子', 2: '三张', 3: '三带二', 4: '顺子', 5: '连对', 6: '钢板',
  7: '炸弹', 8: '同花顺', 9: '天炸',
}

const FINISH_LABEL = ['头游', '二游', '三游', '四游']

/**
 * 牌谱：这一局每一手出的真实牌面。
 * 出牌记录条只写「谁出了什么牌型」，这里能看清是哪几张——复盘、算账、记错牌都靠它。
 */
export function PlayList({
  log,
  names,
  emptyText = '这一局还没有人出牌',
}: {
  log: GameState['log']
  names: string[]
  emptyText?: string
}) {
  const finished = log.length
  return finished === 0 ? (
    <p className="mt-6 text-[13px] text-faint">{emptyText}</p>
  ) : (
    <ol className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
      {log.map((e, i) => {
        const cards = e.ids.map(cardFromId)
        return (
          <li key={i} className="flex shrink-0 items-start gap-2 overflow-hidden border-b border-rule pb-1.5">
            <span className="num w-7 shrink-0 pt-1 text-[12px] text-faint">{i + 1}</span>
            <span className="w-16 shrink-0 pt-1 text-[13px] text-muted">{names[e.seat] ?? ''}</span>
            {e.combo === null ? (
              <span className="pt-1 text-[13px] text-faint">过</span>
            ) : (
              <>
                <span className="w-16 shrink-0 pt-1 text-[13px] text-ink">
                  {COMBO_LABEL[e.combo.type] ?? ''}
                  {e.combo.type !== 9 && (
                    <span className="num text-muted">
                      {' '}
                      {e.combo.rank === 15 ? '级牌' : (RANK_LABEL[e.combo.rank] ?? '')}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-end gap-1">
                  {cards.map((c) => (
                    <CardFace key={c.id} card={c} size="xs" />
                  ))}
                </span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function PlayHistory({ st, onClose }: { st: GameState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const finished = st.players
    .filter((p) => p.finishOrder !== null)
    .sort((a, b) => a.finishOrder! - b.finishOrder!)

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden bg-ground/85 px-4"
      onClick={onClose}
      data-testid="play-history"
    >
      <div
        className="panel flex max-h-[78vh] w-[520px] max-w-full flex-col p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-semibold text-ink">牌谱</h2>
          <span className="text-[13px] text-muted">这一局 {st.log.length} 手</span>
          <button className="btn btn-secondary ml-auto" onClick={onClose} data-testid="play-history-close">
            关闭
          </button>
        </div>

        {finished.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            {finished.map((p) => (
              <span key={p.seat} className="chip">
                {p.name}
                <span className="text-ink">{FINISH_LABEL[p.finishOrder!]}</span>
              </span>
            ))}
          </div>
        )}

        <PlayList log={st.log} names={st.players.map((p) => p.name)} />
      </div>
    </div>
  )
}
