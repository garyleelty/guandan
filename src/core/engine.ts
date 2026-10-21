import { RANK, deal, newShuffledDeck, sortCards } from './cards'
import type { Card } from './cards'
import { identify, beats } from './combos'
import type { Combo } from './combos'

export type Team = 'even' | 'odd'
export type Seat = 0 | 1 | 2 | 3

export const teamOf = (seat: number): Team => (seat % 2 === 0 ? 'even' : 'odd')

export interface Player {
  seat: Seat
  name: string
  isBot: boolean
  hand: Card[]
  finishOrder: number | null
}

export interface TrickState {
  leader: Seat
  table: { seat: Seat; combo: Combo } | null
  pending: Seat[]
  lastPlay: { seat: Seat; combo: Combo } | null
}

export type LogEntry = { seat: Seat; ids: string[]; combo: { type: number; rank: number; count?: number } | null }

/** 一局的结果：谁赢、升了几级、打完后的级数。 */
export type RoundResult = { winner: Team; delta: number; levels: Record<Team, number> }

/** 进贡阶段：上一局三游、四游向对手队头游进贡。 */
export type TributeState = {
  /** 上一局名次（头游 → 四游） */
  order: Seat[]
  /** 需要进贡的座位（先四游后三游） */
  givers: Seat[]
  /** 进贡者 → 收贡者（对手队头游） */
  to: Record<number, Seat>
  /** 进贡者 → 已交的牌 id；null = 抗贡，undefined = 还没动 */
  given: Record<number, string | null>
  /** 已交的牌（实体，用于发新局） */
  cards: Record<number, Card>
  /** 抗贡的座位 */
  anti: Seat[]
  /** 收贡者 → 收到的贡牌 id（发牌后才有） */
  received: Record<number, string[]>
  /** 交贡 / 还贡 */
  step: 'give' | 'return'
  /** 还要还牌的收贡者 */
  returnees: Seat[]
  /** 收贡者 → 还给哪个进贡者 */
  returnTo: Record<number, Seat>
  /** 收贡者 → 已还的牌 id */
  returned: Record<number, string | null>
  /** 新一局谁领出 */
  leader: Seat
  /** 新局的牌堆种子 */
  seed: number
}

export interface GameState {
  phase: 'playing' | 'tribute' | 'ended'
  levels: Record<Team, number>
  matchWinner: Team | null
  players: Player[]
  turn: Seat
  trick: TrickState
  finishCount: number
  log: LogEntry[]
  /** 本场已打完的各局结果（跨局延续） */
  history: RoundResult[]
  /** 进贡阶段信息（其余阶段为 null） */
  tribute: TributeState | null
}

export type Action =
  | { kind: 'pass'; seat: Seat }
  | { kind: 'play'; seat: Seat; cards?: string[] }
  /** 进贡：给牌 = card；不给 = 抗贡 */
  | { kind: 'give'; seat: Seat; card?: string }

export function newGame(opts?: {
  seed?: number
  levels?: Record<Team, number>
  hands?: Card[][]
  names?: string[]
  isBot?: boolean[]
  firstLeader?: Seat
  history?: RoundResult[]
}): GameState {
  const hands = opts?.hands ?? deal(newShuffledDeck({ seed: opts?.seed }))
  const players = [0, 1, 2, 3].map((i): Player => ({
    seat: i as Seat,
    name: opts?.names?.[i] ?? `玩家 ${i + 1}`,
    isBot: opts?.isBot?.[i] ?? true,
    hand: sortCards(hands[i] ?? []),
    finishOrder: null,
  }))
  const turn = (opts?.firstLeader ?? 0) as Seat
  return {
    phase: 'playing',
    levels: opts?.levels ? { even: opts.levels.even, odd: opts.levels.odd } : { even: 2, odd: 2 },
    matchWinner: null,
    players,
    turn,
    trick: { leader: turn, table: null, pending: [], lastPlay: null },
    finishCount: 0,
    log: [],
    history: opts?.history ? [...opts.history] : [],
    tribute: null,
  }
}

/**
 * 开新一局的进贡阶段（官方口径）：
 * - 上一局的下游（四游）向上游（头游）进贡手里最大的一张牌；
 * - 双下游（三游与四游同队）时两人各交一张，大的给头游、小的给二游；
 * - 收贡方还要还一张点数不大于 10 的牌；还牌后由下游领出新一局。
 * 手里有双王/天王炸的进贡者可以抗贡，此时改由头游领出。
 * 整场结束（打过 A）时返回 null。
 */
export function newTributeRound(prev: GameState, opts?: { seed?: number }): GameState | null {
  if (prev.matchWinner !== null) return null
  const finished = prev.players.filter((p) => p.finishOrder !== null)
  if (finished.length < 4) return null
  const order = [...finished].sort((a, b) => a.finishOrder! - b.finishOrder!).map((p) => p.seat)
  const [head, , third, fourth] = order as [Seat, Seat, Seat, Seat]
  const doubleDown = teamOf(third) === teamOf(fourth)
  // 普通情况只有下游进贡；双下游时三游与四游各交一张
  const givers: Seat[] = doubleDown ? [fourth, third] : [fourth]
  return {
    phase: 'tribute',
    levels: { ...prev.levels },
    matchWinner: null,
    players: prev.players.map((p) => ({ ...p, hand: [...p.hand] })),
    turn: givers[0]!,
    trick: { leader: head, table: null, pending: [], lastPlay: null },
    finishCount: 0,
    log: [],
    history: [...prev.history],
    tribute: {
      order,
      givers,
      given: {},
      cards: {},
      anti: [],
      received: {},
      step: 'give',
      to: {},
      returnees: [],
      returnTo: {},
      returned: {},
      leader: head,
      seed: opts?.seed ?? Math.floor(Math.random() * 1e9),
    },
  }
}

export const activeSeats = (st: GameState): Seat[] =>
  st.players.filter((p) => p.finishOrder === null).map((p) => p.seat)

export function nextActiveAfter(st: GameState, seat: Seat): Seat {
  const active = new Set(activeSeats(st))
  for (let i = 1; i <= 4; i++) {
    const s = ((seat + i) % 4) as Seat
    if (active.has(s)) return s
  }
  throw new Error('no active seat')
}

export function step(state: GameState, action: Action): GameState {
  if (state.phase === 'tribute') {
    if (action.kind !== 'give') return state
    return doGive(state, action)
  }
  if (state.phase !== 'playing') return state
  if (action.kind === 'pass') return doPass(state, action)
  if (action.kind === 'play') return doPlay(state, action)
  return state
}

/** 手上有双王或四张王才能抗贡。 */
function canAntiTribute(hand: Card[]): boolean {
  const sj = hand.filter((c) => c.rank === RANK.SJ).length
  const bj = hand.filter((c) => c.rank === RANK.BJ).length
  return (sj >= 1 && bj >= 1) || sj + bj >= 4
}

/** 还牌必须是点数不大于 10 的牌；我们牌序里 2 记作 18，所以实际是 3–10。 */
function isReturnable(card: Card): boolean {
  return card.rank <= 10
}

function doGive(state: GameState, action: Action & { kind: 'give' }): GameState {
  const t = state.tribute
  if (!t) return state
  if (action.seat !== state.turn) return state

  const st = structuredClone(state)
  const tt = st.tribute!

  if (tt.step === 'give') {
    if (!tt.givers.includes(action.seat)) return state
    if (action.seat in tt.given) return state
    if (action.card === undefined) {
      // 抗贡
      if (!canAntiTribute(st.players[action.seat]!.hand)) return state
      tt.anti.push(action.seat)
      tt.given[action.seat] = null
    } else {
      const card = st.players[action.seat]!.hand.find((c) => c.id === action.card)
      if (!card) return state
      st.players[action.seat]!.hand = st.players[action.seat]!.hand.filter((c) => c.id !== card.id)
      tt.given[action.seat] = card.id
      tt.cards[action.seat] = card
    }
    const next = tt.givers.find((g) => !(g in tt.given))
    if (next !== undefined) {
      st.turn = next
      return st
    }
    return startTributeReturns(st)
  }

  // 还牌阶段
  if (!tt.returnees.includes(action.seat)) return state
  if (action.seat in tt.returned) return state
  if (action.card === undefined) return state
  const card = st.players[action.seat]!.hand.find((c) => c.id === action.card)
  if (!card) return state
  if (!isReturnable(card)) return state
  st.players[action.seat]!.hand = st.players[action.seat]!.hand.filter((c) => c.id !== card.id)
  const to = tt.returnTo[action.seat]!
  st.players[to]!.hand = sortCards([...st.players[to]!.hand, card])
  tt.returned[action.seat] = card.id
  const next = tt.returnees.find((r) => !(r in tt.returned))
  if (next !== undefined) {
    st.turn = next
    return st
  }
  return startPlaying(st)
}

/** 贡牌交完：定收贡人、发新局，然后进入还牌阶段。 */
function startTributeReturns(st: GameState): GameState {
  const tt = st.tribute!
  const head = tt.order[0]!
  const second = tt.order[1]!
  const payers = tt.givers.filter((g) => tt.given[g] != null)

  // 贡牌大的给头游、小的给二游；点数相同按顺时针（从上游起算）先的给上游
  const sorted = [...payers].sort((a, b) => {
    const ra = tt.cards[a]!.rank
    const rb = tt.cards[b]!.rank
    if (ra !== rb) return rb - ra
    return ((a - head + 4) % 4) - ((b - head + 4) % 4)
  })
  const to: Record<number, Seat> = {}
  sorted.forEach((g, i) => {
    to[g] = i === 0 ? head : second
  })
  tt.to = to

  // 领出者：有人抗贡则头游领；否则下游（双下游时贡牌大的那位）领
  const leader = payers.length === 0 ? head : sorted[0]!
  tt.leader = leader

  // 发新局：贡牌不进牌堆，直接进收贡者手牌；进贡者少拿一张（要收回还牌）
  const deck = newShuffledDeck({ seed: tt.seed })
  const players: Player[] = st.players.map((p) => ({ ...p, hand: [] as Card[], finishOrder: null }))
  let i = 0
  for (const p of players) {
    const need = payers.includes(p.seat) ? 26 : 27
    p.hand = deck.slice(i, i + need)
    i += need
  }
  // 贡牌进收贡者手里
  for (const g of payers) {
    const card = tt.cards[g]!
    const recv = to[g]!
    players[recv]!.hand = sortCards([...players[recv]!.hand, card])
  }

  const returnees = payers.map((g) => to[g]!)
  const returnTo: Record<number, Seat> = {}
  for (const g of payers) returnTo[to[g]!] = g
  tt.returnees = returnees
  tt.returnTo = returnTo

  const next: GameState = {
    ...st,
    phase: returnees.length > 0 ? 'tribute' : 'playing',
    players,
    turn: returnees.length > 0 ? returnees[0]! : leader,
    trick: { leader, table: null, pending: [], lastPlay: null },
    finishCount: 0,
    log: [],
    tribute: { ...tt, step: returnees.length > 0 ? 'return' : 'give' },
  }
  return returnees.length > 0 ? next : startPlaying(next)
}

/** 还牌结束：新一局开始，由下游（抗贡时头游）领出。 */
function startPlaying(st: GameState): GameState {
  const tt = st.tribute!
  const leader = tt.leader
  return {
    ...st,
    phase: 'playing',
    turn: leader,
    trick: { leader, table: null, pending: [], lastPlay: null },
    finishCount: 0,
    log: [],
  }
}

function doPass(state: GameState, action: Action & { kind: 'pass' }): GameState {
  if (!state.trick.table || !state.trick.lastPlay) return state
  if (!state.trick.pending.includes(action.seat)) return state
  const st = structuredClone(state)
  st.log.push({ seat: action.seat, ids: [], combo: null })
  st.trick.pending = st.trick.pending.filter((s) => s !== action.seat)
  if (st.trick.pending.length === 0) {
    const winner = st.trick.lastPlay!.seat
    st.trick = { leader: winner, table: null, pending: [], lastPlay: null }
    if (st.players[winner]!.finishOrder !== null) {
      st.trick.leader = nextActiveAfter(st, winner)
    }
    st.turn = st.trick.leader
  } else {
    st.turn = nextActiveAfter(st, action.seat)
  }
  return st
}

function doPlay(state: GameState, action: Action & { kind: 'play' }): GameState {
  if (action.seat !== state.turn) return state
  const ids = action.cards ?? []
  if (!new Set(ids).size || ids.length !== new Set(ids).size) return state
  const me = state.players[action.seat]!
  const cards = me.hand.filter((c) => ids.includes(c.id))
  if (cards.length !== ids.length) return state
  const combo = identify(cards)
  if (!combo) return state
  if (state.trick.table && !beats(combo, state.trick.table.combo)) return state

  const st = structuredClone(state)
  const player = st.players[action.seat]!
  player.hand = player.hand.filter((c) => !ids.includes(c.id))
  st.log.push({ seat: action.seat, ids, combo: { type: combo.type, rank: combo.rank, count: combo.count } })
  st.trick = {
    leader: action.seat,
    table: { seat: action.seat, combo },
    pending: activeSeats(st).filter((s) => s !== action.seat),
    lastPlay: { seat: action.seat, combo },
  }

  if (player.hand.length === 0) {
    player.finishOrder = st.finishCount++
    maybeEnd(st)
    if (st.phase === 'ended') return st
  }
  st.turn = nextActiveAfter(st, action.seat)
  return st
}

function maybeEnd(st: GameState): void {
  const finished = st.players.filter((p) => p.finishOrder !== null).sort((a, b) => a.finishOrder! - b.finishOrder!)
  const first = finished[0]!
  const second = finished[1]
  const doubleDown = second && teamOf(first.seat) === teamOf(second.seat)
  if (!(st.finishCount >= 3 || doubleDown)) return

  st.players
    .filter((p) => p.finishOrder === null)
    .sort((a, b) => a.seat - b.seat)
    .forEach((p, i) => {
      p.finishOrder = st.finishCount + i
    })
  const winnerTeam = teamOf(first.seat)
  const partnerRank = Math.min(
    ...st.players.filter((p) => teamOf(p.seat) === winnerTeam && p.finishOrder !== 0).map((p) => p.finishOrder!),
  )
  const delta = partnerRank === 1 ? 3 : partnerRank === 2 ? 2 : 1
  const atA = st.levels[winnerTeam] === 14
  if (atA) {
    if (delta === 3) st.matchWinner = winnerTeam
  } else {
    st.levels[winnerTeam] = Math.min(14, st.levels[winnerTeam] + delta)
  }
  // 本场战绩：升了几级（A 级非双下则原地不动，记 0）
  st.history.push({
    winner: winnerTeam,
    delta: atA ? (delta === 3 ? 3 : 0) : delta,
    levels: { even: st.levels.even, odd: st.levels.odd },
  })
  st.phase = 'ended'
}

function canonPick(cards: Card[], n: number): Card[] {
  return [...cards].sort((a, b) => a.suit - b.suit || a.id.localeCompare(b.id)).slice(0, n)
}

export function legalMoves(st: GameState, seat: Seat): Combo[] {
  const hand = st.players[seat]!.hand
  const byRank = new Map<number, Card[]>()
  for (const c of hand) {
    const arr = byRank.get(c.rank) ?? []
    arr.push(c)
    byRank.set(c.rank, arr)
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b)
  const out: Card[][] = []

  const has = (r: number): boolean => byRank.has(r)

  // 单张 / 对子 / 三张
  for (const r of ranks) out.push(canonPick(byRank.get(r)!, 1))
  for (const r of ranks) {
    if (byRank.get(r)!.length >= 2 && r < 16) out.push(canonPick(byRank.get(r)!, 2))
  }
  for (const r of ranks) {
    if (byRank.get(r)!.length >= 3) out.push(canonPick(byRank.get(r)!, 3))
  }
  // 炸弹
  for (const r of ranks) {
    const c = byRank.get(r)!.length
    if (c >= 4 && r < 16) for (let n = 4; n <= Math.min(8, c); n++) out.push(canonPick(byRank.get(r)!, n))
  }
  // 天炸
  const sj = byRank.get(16) ?? []
  const bj = byRank.get(17) ?? []
  if (sj.length === 2 && bj.length === 2) {
    out.push([...canonPick(sj, 2), ...canonPick(bj, 2)])
  }
  // 三带二
  for (const r3 of ranks) {
    if (byRank.get(r3)!.length < 3 || r3 >= 16) continue
    for (const r2 of ranks) {
      if (r2 === r3 || byRank.get(r2)!.length < 2 || r2 >= 16) continue
      out.push([...canonPick(byRank.get(r3)!, 3), ...canonPick(byRank.get(r2)!, 2)])
    }
  }
  // 顺子 / 同花顺
  for (let lo = 3; lo <= 10; lo++) {
    if (![0, 1, 2, 3, 4].every((i) => has(lo + i))) continue
    const seq = [0, 1, 2, 3, 4].map((i) => canonPick(byRank.get(lo + i)!, 1)[0]!)
    out.push(seq)
    for (const suit of [0, 1, 2, 3]) {
      const flushSeq: Card[] = []
      let ok = true
      for (let i = 0; i < 5; i++) {
        const copy = byRank.get(lo + i)!.find((c) => c.suit === suit)
        if (!copy) { ok = false; break }
        flushSeq.push(copy)
      }
      if (ok) out.push(flushSeq)
    }
  }
  // 连对
  for (let lo = 3; lo <= 9; lo++) {
    for (let count = 3; lo + count - 1 <= 14; count++) {
      const seqRanks = Array.from({ length: count }, (_, i) => lo + i)
      if (!seqRanks.every((r) => (byRank.get(r)?.length ?? 0) >= 2)) continue
      out.push(seqRanks.flatMap((r) => canonPick(byRank.get(r)!, 2)))
    }
  }
  // 钢板
  for (let lo = 3; lo <= 13; lo++) {
    for (let count = 2; lo + count - 1 <= 14; count++) {
      const seqRanks = Array.from({ length: count }, (_, i) => lo + i)
      if (!seqRanks.every((r) => (byRank.get(r)?.length ?? 0) >= 3)) continue
      out.push(seqRanks.flatMap((r) => canonPick(byRank.get(r)!, 3)))
    }
  }

  const combos: Combo[] = []
  for (const cards of out) {
    const combo = identify(cards)
    if (combo) combos.push(combo)
  }
  const table = st.trick.table
  if (!table) return combos
  return combos.filter((c) => beats(c, table.combo))
}

export function autoplay(state: GameState, maxSteps = 2000): GameState {
  let st = state
  for (let i = 0; i < maxSteps && st.phase === 'playing'; i++) {
    const seat = st.turn
    const moves = legalMoves(st, seat)
    if ((st.trick.table || moves.length > 0) && moves.length > 0) {
      st = step(st, { kind: 'play', seat, cards: moves[0]!.cards.map((c) => c.id) })
      continue
    }
    st = step(st, { kind: 'pass', seat })
  }
  return st
}
