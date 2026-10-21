// 真浏览器 P2P 冒烟（进贡）：建房 → 客人进房 → 打完一局 → 再来一局走进贡 → 双方状态一致
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

const st = (p) =>
  p.eval(`(() => {
    const s = window.__gdStore.getState()
    const m = s.match
    if (!m) return JSON.stringify({ screen: s.screen, code: s.roomCode, seats: s.roomSeats })
    return JSON.stringify({
      screen: s.screen,
      code: s.roomCode,
      phase: m.phase,
      turn: m.turn,
      mySeat: s.mySeat,
      hands: m.players.map(p => p.hand.length),
      tribute: m.tribute
        ? { step: m.tribute.step, givers: m.tribute.givers, to: m.tribute.to, given: m.tribute.given, anti: m.tribute.anti, returnees: m.tribute.returnees }
        : null,
      log: m.log.length,
    })
  })()`)

await host.goto('http://localhost:5173/')
await sleep(600)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code = JSON.parse(await st(host)).code

await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(5000)


// 空位补 AI，然后开局
for (let i = 0; i < 3; i++) {
  await host.eval(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+AI')
    if (btn) btn.click()
  })()`)
  await sleep(250)
}
await host.eval('document.querySelector("[data-testid=host-start]").click()')
await sleep(4000)

/** 让当前该谁动谁动：主机页与客人页都驱动 AI 走，直到这一局结束 */
const driveRound = async () => {
  for (let i = 0; i < 400; i++) {
    const h = JSON.parse(await st(host))
    if (h.phase !== 'playing') return h.phase
    if (h.turn === 0) {
      await host.eval('(() => { const s = window.__gdStore.getState(); s.dispatch(window.__gdAi(s.match, s.match.turn)) })()')
    } else if (h.turn === 1) {
      await guest.eval('(() => { const s = window.__gdStore.getState(); s.dispatch(window.__gdAi(s.match, s.match.turn)) })()')
    }
    await sleep(120)
  }
  return 'timeout'
}
const roundEnd = await driveRound()

// 房主点「再来一局」→ 进入进贡阶段
await host.eval('document.querySelector("[data-testid=rematch]").click()')
await sleep(1500)
const hTribute = JSON.parse(await st(host))
const gTribute = JSON.parse(await st(guest))

// 走完进贡：轮到真人（房主 0 / 客人 1）就用真实 UI 路径：选牌 → 点「交贡/还牌」
let hostActed = false
let guestActed = false
for (let i = 0; i < 160; i++) {
  const h = JSON.parse(await st(host))
  if (h.phase !== 'tribute') break
  const page = h.turn === 0 ? host : h.turn === 1 ? guest : null
  if (page) {
    const picked = await page.eval(`(() => {
      const s = window.__gdStore.getState()
      const want = s.match.tribute?.step === 'return'
      const hand = s.match.players[s.mySeat].hand
      const target = want ? hand.filter(c => c.rank <= 10).sort((a, b) => a.rank - b.rank)[0] : hand[0]
      if (!target) return null
      const el = document.querySelector('button[aria-label="' + target.id + '"]')
      if (!el) return null
      el.click()
      return target.id
    })()`)
    if (picked) {
      await sleep(300)
      await page.eval('document.querySelector("[data-testid=btn-give]")?.click()')
      if (h.turn === 0) hostActed = true
      else guestActed = true
      await sleep(700)
    }
  }
  await sleep(250)
}
await sleep(1500)

const hAfter = JSON.parse(await st(host))
const gAfter = JSON.parse(await st(guest))

console.log(
  JSON.stringify(
    {
      roundEnd,
      hostTribute: hTribute.tribute,
      guestTribute: gTribute.tribute,
      tributeSynced: JSON.stringify(hTribute.tribute) === JSON.stringify(gTribute.tribute),
      hostPanel: await host.eval('!!document.querySelector("[data-testid=tribute-panel]")'),
      guestPanel: await guest.eval('!!document.querySelector("[data-testid=tribute-panel]")'),
      guestActed,
      hostActed,
      hostAfter: { phase: hAfter.phase, turn: hAfter.turn, hands: hAfter.hands },
      guestAfter: { phase: gAfter.phase, turn: gAfter.turn, hands: gAfter.hands },
      afterSynced: hAfter.phase === gAfter.phase && JSON.stringify(hAfter.hands) === JSON.stringify(gAfter.hands),
      hostErrors: host.consoleErrors,
      guestErrors: guest.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
