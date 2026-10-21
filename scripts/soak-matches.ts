// 压力跑整场：连打多场，查规则边角（级数、进贡、整场结束条件）
import { aiMove, aiTributeMove } from '../src/core/ai.ts'
import { nextRound, step, type GameState } from '../src/core/engine.ts'

const issues: { kind: string; detail: string }[] = []
const note = (kind: string, detail: string) => issues.push({ kind, detail })

function checkInvariants(st: GameState, round: number) {
  for (const team of ['even', 'odd'] as const) {
    const lv = st.levels[team]
    if (lv < 2 || lv > 14) note('级数越界', `${team}=${lv}（第 ${round} 局）`)
  }
  const finished = st.players.filter((p) => p.finishOrder !== null)
  if (finished.length > 0 && finished.length < 4 && st.phase === 'ended') {
    note('结算时有人没走完', `finished=${finished.length}`)
  }
  const orders = st.players.map((p) => p.finishOrder).filter((o) => o !== null) as number[]
  if (new Set(orders).size !== orders.length) note('名次重复', JSON.stringify(orders))
}

function playMatch(seed: number, maxRounds = 40): { rounds: number; winner: string | null } {
  let st = nextRound(null, { seed, names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'], isBot: [false, true, true, true] })
  let rounds = 0
  let guard = 0
  while (guard++ < 200000) {
    if (st.phase === 'playing') {
      const seat = st.turn
      const mv = aiMove(st, seat)
      if (!mv) {
        note('AI 无棋可走', `seed=${seed} seat=${seat}`)
        break
      }
      const before = st
      st = step(st, mv)
      if (st === before) {
        const table = before.trick.table
        note(
          '走子后状态没变',
          `seed=${seed} step=${guard} seat=${seat} kind=${mv.kind} ids=${JSON.stringify(mv.cards)} table=${table ? table.combo.type + '/' + table.combo.rank : 'none'} level=${before.handLevel} hand=${JSON.stringify(before.players[seat]!.hand.map(c => c.id))}`,
        )
        break
      }
      continue
    }
    if (st.phase === 'tribute') {
      const before = st
      const mv = aiTributeMove(st, st.turn)
      if (!mv) {
        note('进贡阶段 AI 没动作', `seed=${seed} turn=${st.turn} step=${st.tribute?.step}`)
        break
      }
      st = step(st, mv)
      if (st === before) {
        note(
          '进贡后状态没变',
          `seed=${seed} turn=${st.turn} step=${st.tribute?.step} givers=${JSON.stringify(st.tribute?.givers)} returnees=${JSON.stringify(st.tribute?.returnees)}`,
        )
        break
      }
      continue
    }
    if (st.phase === 'ended') {
      rounds++
      checkInvariants(st, rounds)
      if (st.matchWinner) return { rounds, winner: st.matchWinner }
      if (rounds >= maxRounds) {
        note('整场没在合理局数内结束', `seed=${seed} rounds=${rounds} levels=${st.levels.even}/${st.levels.odd}`)
        return { rounds, winner: null }
      }
      const next = nextRound(st, { seed: seed + rounds * 7919 })
      if (!next) {
        note('拿不到下一局', `seed=${seed}`)
        break
      }
      st = next
      continue
    }
    note('未知阶段', `seed=${seed} phase=${st.phase}`)
    break
  }
  return { rounds, winner: null }
}

const N = Number(process.argv[2] ?? 30)
let totalRounds = 0
let winners = 0
for (let seed = 1; seed <= N; seed++) {
  const r = playMatch(seed)
  totalRounds += r.rounds
  if (r.winner) winners++
}
console.log(`打了 ${N} 场，共 ${totalRounds} 局，${winners} 场分出整场`)
console.log(`问题 ${issues.length} 条`)
for (const i of issues.slice(0, 20)) console.log(' -', i.kind, i.detail)
if (issues.length > 0) process.exit(1)
