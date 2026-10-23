import { useEffect, useMemo, useState } from 'react'
import { CardFace } from './CardFace'
import { Hand } from './Hand'
import { Mark, SoundIcon } from './Mark'
import { LevelCard, LevelLadder } from './LevelLadder'
import { useStore } from '../state/store'
import { identify, beats } from '../core/combos'
import { RANK_LABEL, cardIdToRank, levelToRank, sortBySuitGroups } from '../core/cards'
import type { GameState, Seat } from '../core/engine'
import { teamOf } from '../core/engine'
import { aiMove } from '../core/ai'
import { isMuted, playSound, toggleMute } from './sound'
import { TributePanel } from './TributePanel'
import { PlayHistory } from './PlayHistory'
import { encodeReplay, replayFromState } from '../core/replay'
import { canAntiTribute } from '../core/engine'

const COMBO_LABEL: Record<number, string> = {
  0: '单张', 1: '对子', 2: '三张', 3: '三带二', 4: '顺子', 5: '连对', 6: '钢板',
  7: '炸弹', 8: '同花顺', 9: '天炸',
}

const FINISH_LABEL = ['头游', '二游', '三游', '四游']

/** 掼蛋的座次：我 → 下家 → 搭档 → 上家。 */
function roleOf(seat: Seat, mySeat: Seat, spectating?: boolean): string {
  if (spectating) return `${seat + 1} 号位`
  if (seat === mySeat) return '我'
  if (seat === (mySeat + 1) % 4) return '下家'
  if (seat === (mySeat + 2) % 4) return '搭档'
  return '上家'
}

/** 对手手里的牌：牌背一排，张数就是数据。 */
function CardBacks({ n }: { n: number }) {
  const show = Math.min(n, 10)
  return (
    <div className="mt-2 flex items-center">
      {Array.from({ length: show }, (_, i) => (
        <span key={i} className="card-back h-[20px] w-[14px]" style={{ marginLeft: i === 0 ? 0 : -7 }} />
      ))}
      {n > show && <span className="num ml-1.5 text-[12px] text-faint">+{n - show}</span>}
    </div>
  )
}

function SeatPanel({
  st,
  seat,
  mySeat,
  spectating,
}: {
  st: GameState
  seat: Seat
  mySeat: Seat
  spectating?: boolean
}) {
  const p = st.players[seat]!
  const isTurn = st.turn === seat && st.phase === 'playing'
  const mine = teamOf(seat) === teamOf(mySeat)
  // 官方规则：手中剩余 ≤10 张要报数
  const low = p.hand.length <= 10 && p.finishOrder === null
  return (
    <div className={['panel min-w-0 px-2.5 py-2', isTurn ? 'border-accent' : ''].join(' ')}>
      <div className="flex items-center gap-2">
        <span className={['h-2 w-2 shrink-0 rounded-full', mine ? 'bg-accent' : 'bg-control'].join(' ')} />
        <span className="truncate text-sm text-ink">{p.name}</span>
        {p.isBot && <span className="text-[13px] text-faint">AI</span>}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[13px] text-muted">
          {roleOf(seat, mySeat, spectating)} · <span className="num">{p.hand.length}</span> 张
        </span>
        {low && <span className="chip bg-accent/15 text-accent">报牌</span>}
        {p.finishOrder !== null && <span className="chip">{FINISH_LABEL[p.finishOrder]}</span>}
      </div>
      {(spectating || seat !== mySeat) && <CardBacks n={p.hand.length} />}
    </div>
  )
}

/** 出牌记录条：这一局出过什么。 */
function RoundLog({ st }: { st: GameState }) {
  const recent = st.log.slice(-12).reverse()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[13px] text-muted">出牌记录</span>
      {recent.length === 0 ? (
        <span className="text-[13px] text-faint">还没有人出牌</span>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {recent.map((e, i) => (
            <span key={st.log.length - 1 - i} className="chip">
              <span className="text-muted">{st.players[e.seat]!.name}</span>
              {e.combo === null ? (
                <span className="text-faint">过</span>
              ) : (
                <>
                  <span className="text-ink">{COMBO_LABEL[e.combo.type] ?? ''}</span>
                  <span className="num text-muted">{RANK_LABEL[e.combo.rank] ?? ''}</span>
                </>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** 记牌器：对手手里还可能有多少张某个点数。 */
function UnseenCards({ st, myHand }: { st: GameState; myHand: GameState['players'][0]['hand'] }) {
  const { unseen, unknownCount } = useMemo(() => {
    const played = new Map<number, number>()
    for (const e of st.log) {
      for (const id of e.ids) {
        const r = cardIdToRank(id)
        played.set(r, (played.get(r) ?? 0) + 1)
      }
    }
    const mine = new Map<number, number>()
    for (const c of myHand) mine.set(c.rank, (mine.get(c.rank) ?? 0) + 1)
    const rows: { rank: number; n: number }[] = []
    for (const [rank, n] of played) {
      const total = rank >= 16 ? 2 : 8
      rows.push({ rank, n: Math.max(0, total - n - (mine.get(rank) ?? 0)) })
    }
    let unknown = 0
    for (const rank of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17]) {
      if (!played.has(rank)) unknown += 1
    }
    rows.sort((a, b) => b.rank - a.rank)
    return { unseen: rows, unknownCount: unknown }
  }, [st.log, myHand])

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <span className="shrink-0 text-[13px] text-muted">未见牌面</span>
      {unseen.length === 0 ? (
        <span className="text-[13px] text-faint">还没有信息</span>
      ) : (
        <>
          <span className="shrink-0 whitespace-nowrap text-[12px] text-faint">余 {unknownCount} 个点数未现</span>
          <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto">
            {unseen.slice(0, 5).map((r) => (
              <span key={r.rank} className="chip num shrink-0" title={`${RANK_LABEL[r.rank] ?? ''} 还可能有 ${r.n} 张`}>
                {RANK_LABEL[r.rank] ?? ''} ×{r.n}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Table() {
  const st = useStore((s) => s.match)!
  const mySeat = useStore((s) => s.mySeat)
  const dispatch = useStore((s) => s.dispatch)
  const mode = useStore((s) => s.mode)
  const roomCode = useStore((s) => s.roomCode)
  const reconnected = useStore((s) => s.reconnected)
  const spectating = useStore((s) => s.spectating)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [handMode, setHandMode] = useState<'rank' | 'suit'>('rank')
  const [handView, setHandView] = useState<'row' | 'grid'>('row')
  const [showHistory, setShowHistory] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [fx, setFx] = useState<0 | 7 | 9>(0)
  const [mute, setMute] = useState(isMuted())

  const me = st.players[mySeat]!
  const next = st.players[(mySeat + 1) % 4]!
  const partner = st.players[(mySeat + 2) % 4]!
  const prev = st.players[(mySeat + 3) % 4]!
  const levelRank = st.handLevel
  const levelCardRank = levelToRank(levelRank)
  const myLevel = teamOf(mySeat) === 'even' ? st.levels.even : st.levels.odd
  const theirLevel = teamOf(mySeat) === 'even' ? st.levels.odd : st.levels.even
  const myTurn = st.turn === mySeat && st.phase === 'playing'
  const isTribute = st.phase === 'tribute'
  const tributeTurn = isTribute && st.turn === mySeat
  const tribute = st.tribute
  const table = st.trick.table

  const sortedHand = useMemo(
    () => (handMode === 'suit' ? sortBySuitGroups(me.hand, st.handLevel) : me.hand),
    [me.hand, handMode, st.handLevel],
  )
  const selCards = useMemo(() => me.hand.filter((c) => selected.has(c.id)), [me.hand, selected])
  const selCombo = selCards.length >= 1 ? identify(selCards, st.handLevel) : null
  const canPlay = !!selCombo && (!table || beats(selCombo, table.combo))
  // 进贡：只能交一张；还牌：只能还一张不大于 10 的牌
  const canGive = tributeTurn && tribute?.step === 'give' && selCards.length === 1
  const hasLowCard = me.hand.some((c) => c.rank <= 10)
  const canReturn =
    tributeTurn &&
    tribute?.step === 'return' &&
    selCards.length === 1 &&
    (selCards[0]!.rank <= 10 || !hasLowCard)
  const canAnti = tributeTurn && tribute?.step === 'give' && canAntiTribute(me.hand)
  const canPass = myTurn && !!table && st.trick.pending.includes(mySeat)

  const toggle = (id: string) => {
    playSound('select')
    setSelected((prevSet) => {
      const nextSet = new Set(prevSet)
      if (nextSet.has(id)) nextSet.delete(id)
      else nextSet.add(id)
      return nextSet
    })
  }

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
  const give = () => {
    if (!canGive && !canReturn) return
    dispatch({ kind: 'give', seat: mySeat, card: selCards[0]!.id })
    setSelected(new Set())
  }
  const anti = () => {
    if (!canAnti) return
    dispatch({ kind: 'give', seat: mySeat })
    setSelected(new Set())
  }

  /** 提示：用 AI 的走法替我选好牌，直接按「出牌」即可。 */
  const askHint = () => {
    if (!myTurn) return
    const mv = aiMove(st, mySeat)
    if (mv.kind !== 'play') {
      setSelected(new Set())
      setHint('建议过牌')
      return
    }
    const ids = mv.cards ?? []
    const cards = me.hand.filter((c) => ids.includes(c.id))
    const combo = identify(cards, st.handLevel)
    setSelected(new Set(ids))
    setHint(combo ? `建议：${COMBO_LABEL[combo.type] ?? ''} ${RANK_LABEL[combo.rank] ?? ''}`.trim() : '建议出牌')
  }

  // 局面一变，提示就过期
  useEffect(() => {
    setHint(null)
  }, [st.log.length, st.turn])

  // 「已重新连接」只是提醒：4 秒后自己消失，别整局挂在顶栏
  useEffect(() => {
    if (!reconnected) return
    const t = setTimeout(() => useStore.setState({ reconnected: false }), 4000)
    return () => clearTimeout(t)
  }, [reconnected])

  /** 为什么不能出：牌型不合法 / 压不过桌面（说清楚，禁用的按钮不该让人猜）。 */
  const blockReason = (() => {
    if (selCards.length === 0) return null
    if (!selCombo) return '这手不是合法牌型'
    if (table && !beats(selCombo, table.combo)) {
      return `压不过桌面的${COMBO_LABEL[table.combo.type] ?? ''} ${RANK_LABEL[table.combo.rank] ?? ''}`.trim()
    }
    return null
  })()

  const lastLog = st.log[st.log.length - 1]
  useEffect(() => {
    const combo = lastLog?.combo
    if (!combo) return
    if (combo.type === 7 || combo.type === 9) {
      setFx(combo.type as 7 | 9)
      playSound('bomb')
      const t = setTimeout(() => setFx(0), 1100)
      return () => clearTimeout(t)
    }
    playSound(combo === null ? 'pass' : 'play')
  }, [st.log.length])

  useEffect(() => {
    if (st.phase === 'ended') playSound('win')
    // 进贡阶段清掉上一局的特效，别压在贡牌面板上
    if (st.phase === 'tribute') {
      setFx(0)
      playSound('tribute')
    }
  }, [st.phase])

  const centerCards = table?.combo.cards ?? []
  const trickCaption = table
    ? `${st.players[table.seat]!.name} · ${COMBO_LABEL[table.combo.type] ?? ''}`
    : null
  /** 出牌从哪个方向落到桌心：自己 / 搭档 / 左家 / 右家 */
  const landClass = (() => {
    if (!table || spectating) return 'animate-pop'
    const rel = (table.seat - mySeat + 4) % 4
    if (rel === 0) return 'animate-land-bottom'
    if (rel === 2) return 'animate-land-top'
    if (rel === 3) return 'animate-land-left'
    return 'animate-land-right'
  })()

  return (
    <div className="flex h-full flex-col overflow-x-hidden bg-ground">
      {/* 顶栏：产品标记 · 级牌进度 · 范围 */}
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Mark />
        <h1 className="text-[18px] font-semibold text-ink">掼蛋</h1>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-1.5">
              <LevelCard level={levelRank} />
              <span className="text-[13px] text-muted">级牌</span>
            </div>
            {!spectating && <LevelLadder mine={myLevel} theirs={theirLevel} />}
          </div>
          <span className="chip">{mode === 'solo' ? '单机' : `房间 ${roomCode ?? ''}`}</span>
          {spectating && (
            <span className="chip bg-accent/15 text-accent" data-testid="spectating">
              观战
            </span>
          )}
          {reconnected && (
            <span className="chip bg-accent/15 text-accent" data-testid="reconnected">
              已重新连接
            </span>
          )}
          <button
            className="btn btn-ghost !px-2"
            title={mute ? '开启音效' : '静音'}
            aria-label={mute ? '开启音效' : '静音'}
            onClick={() => setMute(toggleMute())}
            data-testid="mute"
          >
            <SoundIcon muted={mute} />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {/* 座位：上家 · 搭档 · 下家（观战时四个座位都摆出来） */}
        {spectating ? (
          <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-4 sm:gap-3">
            {st.players.map((p) => (
              <SeatPanel key={p.seat} st={st} seat={p.seat} mySeat={mySeat} spectating />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 items-start gap-2 sm:gap-3">
            <div className="justify-self-start">
              <SeatPanel st={st} seat={prev.seat} mySeat={mySeat} />
            </div>
            <div className="justify-self-center">
              <SeatPanel st={st} seat={partner.seat} mySeat={mySeat} />
            </div>
            <div className="justify-self-end">
              <SeatPanel st={st} seat={next.seat} mySeat={mySeat} />
            </div>
          </div>
        )}

        {/* 记录条：出过什么 · 对手还可能有什么 */}
        <div className="mt-3 flex flex-col gap-1.5 border-y border-rule py-2 sm:flex-row sm:items-center sm:gap-4">
          <RoundLog st={st} />
          {!spectating && (
            <div className="w-full min-w-0 sm:ml-auto sm:w-auto">
              <UnseenCards st={st} myHand={me.hand} />
            </div>
          )}
        </div>

        {/* 牌桌中央 */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
          {isTribute ? (
            <TributePanel st={st} mySeat={mySeat} />
          ) : centerCards.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-end justify-center gap-1.5">
                {centerCards.map((c) => (
                  <div key={c.id} className={landClass}>
                    <CardFace card={c} size="sm" />
                  </div>
                ))}
              </div>
              <div className="text-[13px] text-muted">{trickCaption}</div>
            </div>
          ) : (
            <div className="text-sm text-faint">{`等待${st.players[st.turn]!.name}领出`}</div>
          )}

            {fx > 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                {fx === 9 ? (
                  <div className="flex w-full items-center justify-center bg-black py-7">
                    <span className="text-4xl font-semibold tracking-[0.3em] text-accent">天 炸</span>
                  </div>
                ) : (
                  <div className="animate-shake flex items-center justify-center bg-black px-10 py-5">
                    <span className="text-3xl font-semibold tracking-[0.2em] text-accent">炸 弹</span>
                  </div>
                )}
              </div>
            )}

            {st.phase === 'ended' && (
              <EndOverlay onRematch={useStore.getState().rematch} onLobby={useStore.getState().backToLobby} />
            )}

            {showHistory && (
              <PlayHistory st={st} onClose={() => setShowHistory(false)} />
            )}
          </div>
      </main>

      {/* 我的操作区 */}
      <footer className="shrink-0 border-t border-line px-4 pt-2">
        {spectating ? (
          <p className="py-3 text-center text-[13px] text-faint">
            正在观战，这一局由桌上的人打
          </p>
        ) : (
          <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip" data-testid="hand-count">
            我的牌 <span className="num">{me.hand.length}</span> 张
          </span>
          {myTurn && (
            <span className="chip bg-accent/15 text-accent">{table ? '轮到你' : '轮到你领出'}</span>
          )}
          {tributeTurn && (
            <span className="chip bg-accent/15 text-accent" data-testid="tribute-turn">
              {tribute?.step === 'return' ? '轮到你还牌' : '轮到你进贡'}
            </span>
          )}
          {selCards.length > 0 && !isTribute && (
            <span
              className={[
                'chip',
                selCombo ? (table && !beats(selCombo, table.combo) ? 'text-faint' : 'text-accent') : 'text-faint',
              ].join(' ')}
              data-testid="sel-preview"
            >
              {selCombo
                ? `${COMBO_LABEL[selCombo.type] ?? ''} ${selCombo.rank === 15 ? '级牌' : (RANK_LABEL[selCombo.rank] ?? '')}`
                : '不成牌型'}
              {selCombo && table
                ? ` · ${beats(selCombo, table.combo) ? '压得住' : '压不住'}`
                : ''}
              {selCombo ? ` · ${selCards.length} 张` : ''}
            </span>
          )}
          {hint ? <span className="text-[13px] text-accent">{hint}</span> : null}
          {!hint && blockReason ? (
            <span className="text-[13px] text-muted" data-testid="block-reason">
              {blockReason}
            </span>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              className="btn btn-ghost btn-sm max-sm:px-2"
              onClick={() => setHandView((v) => (v === 'row' ? 'grid' : 'row'))}
              title={handView === 'row' ? '摊开手牌，看清每一张' : '收回手牌'}
              data-testid="hand-view"
            >
              {handView === 'row' ? '摊牌' : '收牌'}
            </button>
            <button
              className="btn btn-ghost btn-sm max-sm:px-2"
              onClick={() => setShowHistory(true)}
              title="这一局每一手出的真实牌面"
              data-testid="play-log"
            >
              牌谱
            </button>
            <button
              className="btn btn-ghost btn-sm max-sm:px-2"
              onClick={askHint}
              disabled={!myTurn}
              title="按 AI 的走法替你选好牌"
              data-testid="hint"
            >
              提示
            </button>
            <button
              className="btn btn-ghost btn-sm max-sm:px-2"
              onClick={() => setHandMode((m) => (m === 'rank' ? 'suit' : 'rank'))}
              title="点数排序 / 按花色聚拢"
              data-testid="sort-hand"
            >
              理牌 · {handMode === 'rank' ? '花色' : '点数'}
            </button>
            {isTribute ? (
              <>
                {canAnti && (
                  <button className="btn btn-secondary" onClick={anti} data-testid="btn-anti">
                    抗贡
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  disabled={!(canGive || canReturn)}
                  onClick={give}
                  data-testid="btn-give"
                >
                  {tribute?.step === 'return' ? '还牌' : '交贡'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" disabled={!canPass} onClick={pass} data-testid="btn-pass">
                  过
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!myTurn || !canPlay}
                  onClick={play}
                  data-testid="btn-play"
                >
                  出牌
                </button>
              </>
            )}
          </div>
        </div>
        <Hand
          hand={sortedHand}
          selected={selected}
          toggle={toggle}
          quickLead={quickLead}
          levelCardRank={levelCardRank}
          view={handView}
          dimmed={(c) => {
            if (isTribute) return false
            if (!myTurn || !table) return false
            const c1 = identify([...selCards, c], st.handLevel)
            if (selected.has(c.id)) return false
            return !(c1 && beats(c1, table.combo))
          }}
        />
          </>
        )}
      </footer>
    </div>
  )
}

function EndOverlay({ onRematch, onLobby }: { onRematch: () => void; onLobby: () => void }) {
  const st = useStore((s) => s.match)!
  const mySeat = useStore((s) => s.mySeat)
  const mode = useStore((s) => s.mode)
  const winner = st.players.find((p) => p.finishOrder === 0)!
  const isMatch = st.matchWinner !== null
  // 标题用「我方 / 对家」：一队有两个人，只报一个名字会让人以为那是单人队伍
  const winnerIsMine = teamOf(winner.seat) === teamOf(mySeat)
  const title = `${winnerIsMine ? '我方' : '对家'}${isMatch ? '拿下整场' : '升级'}`
  const sorted = [...st.players].sort((a, b) => a.finishOrder! - b.finishOrder!)
  const mine = teamOf(mySeat) === 'even' ? st.levels.even : st.levels.odd
  const theirs = teamOf(mySeat) === 'even' ? st.levels.odd : st.levels.even
  const myTeam = teamOf(mySeat)
  const myWins = st.history.filter((r) => r.winner === myTeam).length
  const [shared, setShared] = useState(false)
  const share = async () => {
    try {
      const frag = await encodeReplay(replayFromState(st))
      const url = `${location.origin}${location.pathname}?replay=${frag}`
      await navigator.clipboard?.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2200)
    } catch {
      setShared(false)
    }
  }
  // A 级双下但上一局下游那队：按官方规则赢不了整场
  const blockedByDweller =
    st.matchWinner === null && st.levels[teamOf(winner.seat)] === 14 && st.dwellerTeam === teamOf(winner.seat)
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ground/85 px-4">
      <div className="panel my-auto w-[380px] max-w-full p-5 sm:p-6">
        <h2 className={`text-xl font-semibold ${isMatch ? 'text-accent' : 'text-ink'}`}>{title}</h2>
        {blockedByDweller && (
          <p className="mt-2 text-[13px] text-muted">上一局的下游那队，本局赢不了整场</p>
        )}
        {st.history.length > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted">本场战绩</span>
              <span className="text-[13px] text-muted">
                {st.history.length} 局 · 我方 {myWins} 胜
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {st.history.map((r, i) => {
                const mineRound = r.winner === myTeam
                return (
                  <span
                    key={i}
                    className={`chip num ${mineRound ? 'bg-accent/15 text-accent' : ''}`}
                    title={`第 ${i + 1} 局`}
                  >
                    {mineRound ? '我方' : '对家'} {r.delta > 0 ? `+${r.delta}` : '±0'}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        <div className="mt-4">
          {sorted.map((p, i) => (
            <div
              key={p.seat}
              className={['flex items-center justify-between py-2 text-sm', i > 0 ? 'border-t border-rule' : ''].join(' ')}
            >
              <span className="text-ink">{p.name}</span>
              <span className="text-muted">{FINISH_LABEL[p.finishOrder!]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-rule pt-4">
          <div className="mb-2 text-[13px] text-muted">级牌阶梯</div>
          <LevelLadder mine={mine} theirs={theirs} withLabels />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="btn btn-ghost flex-1"
            onClick={share}
            data-testid="share-round"
            title="把这局的牌谱做成链接发给朋友"
          >
            {shared ? '链接已复制' : '分享这局'}
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          {mode === 'guest' ? (
            <span className="flex h-9 flex-1 items-center justify-center rounded-control border border-line text-[13px] text-muted">
              等待房主开下一局
            </span>
          ) : (
            <button className="btn btn-primary flex-1" onClick={onRematch} data-testid="rematch">
              再来一局
            </button>
          )}
          <button className="btn btn-secondary flex-1" onClick={onLobby}>
            返回大厅
          </button>
        </div>
      </div>
    </div>
  )
}
