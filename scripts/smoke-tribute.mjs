// 真浏览器冒烟：打完一局 → 再来一局 → 走一遍进贡（交贡 → 还牌）→ 下游领出新一局
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-tribute.mjs
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })

await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

const store = 'window.__gdStore.getState()'

// 1) 把这一局打完（我方也交给 AI 走，省得随机）
for (let i = 0; i < 900; i++) {
  const ended = await p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    if (!st || st.phase !== 'playing') return true
    s.dispatch(window.__gdAi(st, st.turn))
    return false
  })()`)
  if (ended) break
  await sleep(15)
}
const phaseEnded = await p.eval(`${store}.match.phase`)

// 2) 再来一局 → 应该进入进贡阶段
await p.eval('document.querySelector("[data-testid=rematch]").click()')
await sleep(900)
const phaseTribute = await p.eval(`${store}.match.phase`)
const givers = await p.eval(`JSON.stringify(${store}.match.tribute?.givers ?? [])`)
const panelVisible = await p.eval('!!document.querySelector("[data-testid=tribute-panel]")')
const instruction = await p.eval(
  'document.querySelector("[data-testid=tribute-instruction]")?.textContent ?? ""',
)
await p.screenshot({ path: 'docs/screenshots/07-tribute.png', format: 'png' })

// 3) 走完进贡：我轮到自己时选牌交/还，其余交给 AI
//    若轮到的是 AI，强制把我设成还牌者，验证「还牌」按钮这条路
let myGave = false
let myReturned = false
for (let i = 0; i < 200; i++) {
  const st = await p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    return JSON.stringify({ phase: st.phase, turn: st.turn, mySeat: s.mySeat, step: st.tribute?.step ?? null, givers: st.tribute?.givers ?? [] })
  })()`)
  const s = JSON.parse(st)
  if (s.phase !== 'tribute') break
  if (s.turn === s.mySeat) {
    // 还牌要 10 以下的牌，交贡随便一张
    await p.eval(`(() => {
      const s = window.__gdStore.getState()
      const want = s.match.tribute?.step === 'return'
      const hand = s.match.players[s.mySeat].hand
      const target = want
        ? hand.filter(c => c.rank <= 10).sort((a, b) => a.rank - b.rank)[0]
        : hand[0]
      if (!target) return null
      const el = document.querySelector('button[aria-label="' + target.id + '"]')
      if (!el) return null
      el.click()
      return target.id
    })()`)
    await sleep(250)
    const btn = await p.eval(
      'document.querySelector("[data-testid=btn-give]") ? "[data-testid=btn-give]" : null',
    )
    if (btn) {
      await p.eval('document.querySelector("[data-testid=btn-give]").click()')
      await sleep(500)
      if (s.step === 'give') myGave = true
      else myReturned = true
    }
    continue
  }
  await sleep(200)
}

// 4) 新一局应该已经开始：下游领出，每家 27 张
const atStart = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  return JSON.stringify({ phase: st.phase, turn: st.turn, leader: st.trick.leader, hands: st.players.map(p => p.hand.length) })
})()`)
await sleep(1200)
const after = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  return JSON.stringify({
    phase: st.phase,
    turn: st.turn,
    leader: st.trick.leader,
    hands: st.players.map(p => p.hand.length),
    levels: st.levels,
  })
})()`)

console.log(
  JSON.stringify(
    {
      phaseEnded,
      phaseTribute,
      givers: JSON.parse(givers),
      panelVisible,
      instruction,
      myGave,
      myReturned,
      atStart: JSON.parse(atStart),
      after: JSON.parse(after),
      consoleErrors: p.consoleErrors,
    },
    null,
    2,
  ),
)

await p.screenshot({ path: '.taste-skill/tribute.png', format: 'png' })
await b.close()
