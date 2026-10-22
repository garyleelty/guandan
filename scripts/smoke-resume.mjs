// 真浏览器冒烟：单机打到一半刷新 → 大厅出现「继续上一局」→ 点进去牌局原样回来
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })
const store = 'window.__gdStore.getState()'

async function waitFor(expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await p.eval(expr)) return true
    await sleep(250)
  }
  return false
}

await p.goto('http://localhost:5173/')
await waitFor('document.querySelector("[data-testid=solo]") !== null')
await p.eval('document.querySelector("[data-testid=solo]").click()')
await waitFor(`${store}.match !== null`)

// 自己先出一张牌（领出单张一定合法），等 AI 接完、轮回到自己
await p.eval('document.querySelector("button[aria-pressed]").click()')
await sleep(400)
const canPlay = await p.eval('!document.querySelector("[data-testid=btn-play]").disabled')
await p.eval('document.querySelector("[data-testid=btn-play]").click()')
await waitFor(`${store}.match.turn === 0 && ${store}.match.log.length >= 2`, 12000)

const before = await p.eval(`JSON.stringify({
  log: ${store}.match.log.length,
  hands: ${store}.match.players.map(pl => pl.hand.length),
  levels: ${store}.match.levels,
  handLevel: ${store}.match.handLevel,
  history: ${store}.match.history.length,
  phase: ${store}.match.phase,
  aiLevel: ${store}.aiLevel,
})`)
const savedRaw = await p.eval(`localStorage.getItem('gd-solo-save') !== null`)

// 刷新：不该直接开新局，而是大厅给「继续上一局」
await p.goto('http://localhost:5173/')
const hasResume = await waitFor('document.querySelector("[data-testid=resume-solo]") !== null')
const resumeText = hasResume
  ? await p.eval('document.querySelector("[data-testid=resume-solo]").textContent')
  : ''
const startedNew = await p.eval(`${store}.match !== null`)

if (hasResume) await p.eval('document.querySelector("[data-testid=resume-solo]").click()')
await waitFor(`${store}.match !== null`)
await sleep(300)

const after = await p.eval(`JSON.stringify({
  log: ${store}.match.log.length,
  hands: ${store}.match.players.map(pl => pl.hand.length),
  levels: ${store}.match.levels,
  handLevel: ${store}.match.handLevel,
  history: ${store}.match.history.length,
  phase: ${store}.match.phase,
  aiLevel: ${store}.aiLevel,
  screen: ${store}.screen,
  turn: ${store}.match.turn,
})`)

// ?solo=1 直达牌桌：有存档时应优先续档，而不是开新局
await p.goto('http://localhost:5173/?solo=1')
await waitFor(`${store}.match !== null`)
await sleep(300)
const soloDirectLog = await p.eval(`${store}.match.log.length`)
const soloDirectSame = soloDirectLog === JSON.parse(after).log

// 返回大厅：续局档应被清掉，不再出现「继续上一局」
await p.eval(`${store}.backToLobby()`)
await sleep(500)
const resumeGone = await p.eval('document.querySelector("[data-testid=resume-solo]") === null')
const saveCleared = await p.eval(`localStorage.getItem('gd-solo-save') === null`)

const b1 = JSON.parse(before)
const a1 = JSON.parse(after)
const core = ({ log, hands, levels, handLevel, history, phase, aiLevel }) => ({
  log,
  hands,
  levels,
  handLevel,
  history,
  phase,
  aiLevel,
})
console.log(
  JSON.stringify(
    {
      canPlay,
      savedRaw,
      hasResume,
      resumeText,
      startedNew,
      before: b1,
      after: a1,
      same: JSON.stringify(core(b1)) === JSON.stringify(core(a1)),
      soloDirectLog,
      soloDirectSame,
      resumeGone,
      saveCleared,
      errors: p.consoleErrors,
    },
    null,
    2,
  ),
)
await b.close()
