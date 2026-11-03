import type { GameState, Seat } from '../core/engine'
import { canAntiTribute } from '../core/engine'
import { RANK_LABEL } from '../core/cards'
import { Suit } from './Suit'

const PLACE = ['头游', '二游', '三游', '四游']

/**
 * 进贡视图：上一局的下游向上游进贡，收贡方还要还一张牌。
 * 面板只讲清楚「现在轮到谁、做什么」，操作按钮在下面的操作条里。
 */
export function TributePanel({ st, mySeat }: { st: GameState; mySeat: Seat }) {
  const t = st.tribute
  if (!t) return null
  const turn = st.players[st.turn]!
  const mine = st.turn === mySeat
  const canAnti =
    t.step === 'give' &&
    mine &&
    ((t as { antiOk?: boolean }).antiOk ?? canAntiTribute(t.givers.map((g) => st.players[g]!.hand)))

  const lines = t.givers.map((g) => {
    const name = st.players[g]!.name
    if (t.anti.includes(g)) return { g, text: `${name} 抗贡`, card: null, to: null, leftover: null }
    const cardId = t.given[g]
    if (!cardId) return { g, text: `${name} 待进贡`, card: null, to: null, leftover: null }
    const card = t.cards[g]
    const to = t.to[g] != null ? st.players[t.to[g]!]!.name : '—'
    // 剩牌张数 = 交贡那一刻手里的牌数（含贡牌）；小牌进贡基本都发生在「就剩一两张」的时候
    const n = (t as { leftover?: Record<number, number> }).leftover?.[g]
    return { g, text: `${name} 交`, card: card ? { rank: card.rank, suit: card.suit } : null, to, leftover: n ?? null }
  })

  const instruction = (() => {
    if (t.step === 'return') {
      const back = t.returnees.map((r) => st.players[r]!.name).join('、')
      return mine
        ? `轮到你还牌：回一张 10 以下的牌给 ${st.players[t.returnTo[mySeat] ?? mySeat]!.name}`
        : `等待 ${back} 还牌`
    }
    return mine
      ? `轮到你进贡：把手里的最大的一张交给 ${st.players[t.to[mySeat] ?? mySeat]!.name}`
      : `等待 ${turn.name} 进贡`
  })()

  return (
    <div className="panel flex w-full max-w-lg flex-col gap-3 p-4" data-testid="tribute-panel">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-ink">进贡</span>
        <span className="chip">{t.step === 'give' ? '交贡' : '还牌'}</span>
      </div>

      <div className="text-[13px] text-muted">
        上局名次 {t.order.map((s, i) => `${st.players[s]!.name}·${PLACE[i]}`).join(' / ')}
      </div>

      <div className="text-[14px] leading-5 text-ink" data-testid="tribute-instruction">
        {instruction}
      </div>

      <div className="flex flex-col gap-1.5">
        {lines.map((l) => (
          <div key={l.g} className="flex items-center gap-2 text-[13px] text-muted">
            <span className="w-16 shrink-0 truncate">{st.players[l.g]!.name}</span>
            <span className="text-ink">
              {l.text.replace(st.players[l.g]!.name, '').trim() || l.text}
              {l.card ? <CardTag rank={l.card.rank} suit={l.card.suit} level={st.handLevel} /> : null}
              {l.to ? ` → ${l.to}` : ''}
              {l.leftover != null && (
                <span className="ml-1 text-faint">（上局剩 {l.leftover} 张）</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="text-[12px] text-faint">贡牌是进贡者上局剩牌中最大的一张——级牌比 A 大，牌面上标「级」；剩得少时，最大的也可能只是张小牌。</div>

      {t.step === 'give' && t.givers.length > 1 && (
        <div className="text-[12px] text-faint">双下游：两人各交一张，大的给头游、小的给二游</div>
      )}
      {canAnti && <div className="text-[12px] text-faint">你们手里合计有两张大王，可以抗贡（全队免贡，头游领出）</div>}
    </div>
  )
}

/** 牌面小字：点数 + 花色（花色用矢量）；级牌带角标——不然级牌 5 看着像张小牌 */
function CardTag({ rank, suit, level }: { rank: number; suit: number; level: number }) {
  if (rank === 16) return <span className="text-ink">小王</span>
  if (rank === 17) return <span className="text-ink">大王</span>
  const isLevel = rank === level
  return (
    <span className="inline-flex items-center gap-1 text-ink">
      {RANK_LABEL[rank] ?? rank}
      <Suit suit={suit} className="h-3 w-3" style={{ color: suit === 1 || suit === 3 ? 'var(--color-suit-red)' : undefined }} />
      {isLevel &&
        (suit === 1 ? (
          // 逢人配：红桃级牌（只在进贡者手里只剩它时才会出现）
          <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-ink text-[10px] font-bold text-black">配</span>
        ) : (
          <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-black">级</span>
        ))}
    </span>
  )
}
