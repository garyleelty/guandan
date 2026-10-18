import { useMemo, useState } from 'react'
import { CardFace } from './CardFace'
import { Hand } from './Hand'
import { useStore } from '../state/store'
import { identify, beats } from '../core/combos'
import { RANK_LABEL } from '../core/cards'
import type { GameState, Seat } from '../core/engine'
import { teamOf } from '../core/engine'

const COMBO_LABEL: Record<number, string> = {
  0: '单张', 1: '对子', 2: '三张', 3: '三带二', 4: '顺子', 5: '连对', 6: '钢板',
  7: '炸弹', 8: '同花顺', 9: '天炸',
}

function SeatPanel({
  st,
  seat,
  pos,
  levelRank,
  searching,
}: {
  st: GameState
  seat: Seat
  pos: 'top' | 'left' | 'right'
  levelRank: number
  searching?: boolean
}) {
  const p = st.players[seat]!
  const isTurn = st.turn === seat && st.phase === 'playing'
  const low = p.hand.length <= 2 && p.finishOrder === null
  const layout =
    pos === 'top' ? 'flex-row items-center px-4 py-3' : 'flex-col items-center gap-1.5 px-2 py-3 self-center'
  return (
    <div className={`glass flex ${layout} rounded-2xl ${pos === 'top' ? '' : 'min-w-[92px]'}`}>
      <div
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow',
          teamOf(seat) === 'even' ? 'bg-blue' : 'bg-orange',
          isTurn ? 'animate-flash' : '',
        ].join(' ')}
      >
        {p.name.slice(0, 1)}
      </div>
      <div className={pos === 'top' ? 'ml-3' : 'text-center'}>
        <div className="text-xs font-semibold text-ink">{p.name}{searching ? '（AI）' : ''}</div>
        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-ink3">
          <span className="rounded bg-paper px-1 py-[1px] font-semibold text-ink2">{p.hand.length} 张</span>
          <span className="rounded bg-paper px-1 py-[1px]">{RANK_LABEL[levelRank]}级</span>
        </div>
      </div>
      {low && <div className="ml-1 animate-flash text-xs font-bold text-orange">{p.hand.length === 1 ? '单' : '双'}</div>}
      {p.finishOrder !== null && (
        <div className="ml-1 rounded-full bg-gold/20 px-1.5 py-[1px] text-[10px] font-bold text-gold">
          {['头游', '二游', '三游', '四游'][p.finishOrder]}
        </div>
      )}
    </div>
  )
}

export function Table() {
  const st = useStore((s) => s.match)!
  const mySeat = useStore((s) => s.mySeat)
  const dispatch = useStore((s) => s.dispatch)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const me = st.players[mySeat]!
  const partner = st.players[(mySeat + 2) % 4]!
  const left = st.players[(mySeat + 3) % 4]!
  const right = st.players[(mySeat + 1) % 4]!
  const levelRank = Math.max(st.levels.even, st.levels.odd)
  const myTurn = st.turn === mySeat && st.phase === 'playing'
  const table = st.trick.table

  const selCards = useMemo(() => me.hand.filter((c) => selected.has(c.id)), [me.hand, selected])
  const selCombo = selCards.length >= 1 ? identify(selCards) : null
  const canPlay = !!selCombo && (!table || beats(selCombo, table.combo))
  const canPass = myTurn && !!table && st.trick.pending.includes(mySeat)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const play = () => {
    if (!selCombo || !canPlay) return
    dispatch({ kind: 'play', seat: mySeat, cards: selCards.map((c) => c.id) })
    setSelected(new Set())
  }
  const quickLead = (id: string) => {
    if (!myTurn || table) return
    setSelected(new Set([id]))
    dispatch({ kind: 'play', seat: mySeat, cards: [id] })
  }
  const pass = () => {
    if (!canPass) return
    dispatch({ kind: 'pass', seat: mySeat })
    setSelected(new Set())
  }

  const lastLog = st.log[st.log.length - 1]
  const banner = !lastLog
    ? null
    : lastLog.combo === null
      ? `${st.players[lastLog.seat]!.name} 过`
      : `${st.players[lastLog.seat]!.name} 出 ${COMBO_LABEL[lastLog.combo.type] ?? ''}`

  const topSeat = partner.seat
  const centerCards = table?.combo.cards ?? []

  return (
    <div className="flex h-full flex-col items-center px-3 pb-2">
      {/* 顶部 3 列：左对家 / 上方搭档 / 右对家 */}
      <div className="grid w-full max-w-3xl grid-cols-[96px_1fr_96px] items-center gap-2 pt-3">
        <SeatPanel st={st} seat={left.seat} pos="left" levelRank={levelRank} />
        <div className="flex flex-col items-center gap-1">
          <SeatPanel st={st} seat={topSeat} pos="top" levelRank={levelRank} />
          <div className="min-h-[24px] text-xs font-semibold text-ink3">{banner}</div>
        </div>
        <SeatPanel st={st} seat={right.seat} pos="right" levelRank={levelRank} />
      </div>

      {/* 中央牌区 */}
      <div className="relative flex min-h-[150px] w-full max-w-3xl flex-1 items-center justify-center">
        <div className="pointer-events-none absolute inset-2 rounded-[28px] border border-black/5 bg-white/30" />
        {centerCards.length > 0 ? (
          <div className="relative z-10 flex flex-wrap items-end justify-center gap-1.5">
            {centerCards.map((c) => (
              <div key={c.id} className="animate-pop">
                <CardFace card={c} small />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative z-10 text-sm text-ink3">等待 {st.players[st.turn]!.name} 领出</div>
        )}
        {st.phase === 'ended' && (
          <EndOverlay onRematch={useStore.getState().rematch} onLobby={useStore.getState().backToLobby} />
        )}
      </div>

      {/* 我的操作区 */}
      <div className="w-full max-w-3xl">
        <div className="mb-1 flex items-center justify-center gap-2">
          <div
            className="rounded-full bg-paper2 px-3 py-1 text-[11px] font-semibold text-ink2 shadow-soft"
            data-testid="hand-count"
          >
            我的牌 {me.hand.length} 张 · 第 {levelRank} 级
          </div>
          <button className="btn btn-primary" disabled={!myTurn || !canPlay} onClick={play} data-testid="btn-play">
            出牌
          </button>
          <button className="btn btn-ghost" disabled={!canPass} onClick={pass} data-testid="btn-pass">
            过
          </button>
          {myTurn && !table && <span className="text-[11px] text-ink3">轮到你领出</span>}
        </div>
        <Hand
          hand={me.hand}
          selected={selected}
          toggle={toggle}
          quickLead={quickLead}
          levelRank={levelRank}
          dimmed={(c) => {
            if (!myTurn || !table) return false
            const c1 = identify([...selCards, c])
            if (selected.has(c.id)) return false
            return !(c1 && beats(c1, table.combo))
          }}
        />
      </div>
    </div>
  )
}

function EndOverlay({ onRematch, onLobby }: { onRematch: () => void; onLobby: () => void }) {
  const st = useStore((s) => s.match)!
  const winner = st.players.find((p) => p.finishOrder === 0)!
  const isMatch = st.matchWinner !== null
  const title = isMatch ? `${winner.name} 队 拿下整场！` : `${winner.name} 队 升级`
  const sorted = [...st.players].sort((a, b) => a.finishOrder! - b.finishOrder!)
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-white/80 backdrop-blur">
      <div className="glass w-[320px] rounded-2xl px-6 py-5 text-center">
        <div className={`text-xl font-bold ${isMatch ? 'text-gold' : 'text-blue'}`}>{title}</div>
        <div className="mt-3 space-y-1">
          {sorted.map((p) => (
            <div key={p.seat} className="flex items-center justify-between rounded-xl bg-paper px-3 py-1.5 text-sm">
              <span className="font-semibold">{p.name}</span>
              <span className="text-ink2">{['头游', '二游', '三游', '四游'][p.finishOrder!]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-ink2">
          级数 even {st.levels.even} / odd {st.levels.odd}
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={onRematch}>再来一局</button>
          <button className="btn btn-ghost" onClick={onLobby}>返回大厅</button>
        </div>
      </div>
    </div>
  )
}
