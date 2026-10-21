import { aiMove, aiTributeMove } from './ai'
import { nextRound, step } from './engine'
import type { GameState } from './engine'

export type SoakIssue = { kind: string; detail: string }

export type SoakResult = {
  /** 打了多少场 */
  matches: number
  /** 一共打了多少局 */
  rounds: number
  /** 分出整场的场次 */
  finished: number
  issues: SoakIssue[]
}

/** 一局打完后的不变量：级数在 2..14、名次不重复、该走完的都走完了。 */
function checkInvariants(st: GameState, round: number, issues: SoakIssue[]): void {
  const note = (kind: string, detail: string) => issues.push({ kind, detail })
  for (const team of ['even', 'odd'] as const) {
    const lv = st.levels[team]
    if (lv < 2 || lv > 14) note('级数越界', `${team}=${lv}（第 ${round} 局）`)
  }
  const orders = st.players.map((p) => p.finishOrder).filter((o) => o !== null) as number[]
  if (new Set(orders).size !== orders.length) note('名次重复', JSON.stringify(orders))
  // 手里不能有同一张牌两次（进贡那类问题最容易在这里露馅）
  for (const p of st.players) {
    const ids = p.hand.map((c) => c.id)
    if (new Set(ids).size !== ids.length) {
      note('手牌有重复', `座位 ${p.seat}：${ids.filter((x, i) => ids.indexOf(x) !== i).join(',')}`)
    }
  }
}

/**
 * 压力跑：连打若干整场。
 * 单局测试覆盖不到「每局必然发生、但爆出来看运气」的问题——进贡重复牌就是这类。
 */
export function runSoak(matches: number, maxRounds = 40): SoakResult {
  const issues: SoakIssue[] = []
  const note = (kind: string, detail: string) => issues.push({ kind, detail })
  let rounds = 0
  let finished = 0

  for (let seed = 1; seed <= matches; seed++) {
    // 难度轮着来：简单/普通/难都跑一遍（难档才有记牌逻辑）
    const aiLevel = ((seed - 1) % 3) as 0 | 1 | 2
    let st = nextRound(null, {
      seed,
      names: ['你', 'AI 甲', 'AI 乙', 'AI 丙'],
      isBot: [false, true, true, true],
      aiLevel,
    })
    let guard = 0
    let broken = false
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
          note(
            '走子后状态没变',
            `seed=${seed} seat=${seat} kind=${mv.kind} ids=${JSON.stringify(mv.kind === 'play' ? mv.cards : [])} hand=${JSON.stringify(before.players[seat]!.hand.map((c) => c.id))}`,
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
        checkInvariants(st, rounds, issues)
        if (st.matchWinner) {
          finished++
          break
        }
        if (rounds >= maxRounds * matches) {
          note('整场没在合理局数内结束', `seed=${seed} rounds=${rounds}`)
          break
        }
        const next = nextRound(st, { seed: seed + rounds * 7919, aiLevel })
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
    if (broken) break
  }
  return { matches, rounds, finished, issues }
}
