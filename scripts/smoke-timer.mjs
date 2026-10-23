// 真浏览器冒烟：P2P 回合计时——?turnMs= 调短时限，真人（房主/客人）不动，
// 到点房主托管代打（log 里带 auto 标记），客人看得到倒计时；单机没有倒计时。
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-timer.mjs
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const TURN_MS = 3000
const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

async function waitFor(page, expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await page.eval(expr)) return true
    await sleep(200)
  }
  return false
}
const store = 'window.__gdStore.getState()'

// 1) 单机没有倒计时（先建一个单机局看一眼）
await host.goto(`http://localhost:5173/?turnMs=${TURN_MS}`)
await waitFor(host, 'document.querySelector("[data-testid=solo]") !== null')
await host.eval('document.querySelector("[data-testid=solo]").click()')
await waitFor(host, `${store}.match !== null`)
await sleep(400)
const soloClock = await host.eval('document.querySelector("[data-testid=turn-clock]") === null')
await host.eval(`${store}.backToLobby()`)
await sleep(300)

// 2) 房主建房（URL 带 turnMs）→ 客人进房 → 补两个 AI → 开局
await host.goto(`http://localhost:5173/?turnMs=${TURN_MS}`)
await waitFor(host, 'document.querySelector("[data-testid=create-room]") !== null')
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await waitFor(host, 'window.__gdStore.getState().roomCode !== null')
const code = await host.eval(`${store}.roomCode`)
console.log('room code:', code)

await guest.goto(`http://localhost:5173/?r=${code}&turnMs=${TURN_MS}`)
const joined = await waitFor(guest, `${store}.roomSeats !== null && !${store}.joining`, 25000)
if (!joined) throw new Error('guest did not join')

// 客人坐了 seat 1；给 2、3 补 AI（+AI 按钮没有 testid，按文字找）
for (let i = 0; i < 2; i++) {
  await host.eval(`
    [...document.querySelectorAll('button')]
      .filter(b => b.textContent.trim() === '+AI')[0]
      ?.click()
  `)
  await sleep(300)
}
await waitFor(host, 'window.__gdHost.seats.filter(s => s.kind === "ai").length === 2')
await waitFor(host, 'document.querySelector("[data-testid=host-start]").disabled === false')
await host.eval('document.querySelector("[data-testid=host-start]").click()')
await waitFor(host, `${store}.match !== null`)
await waitFor(guest, `${store}.match !== null`, 20000)

// 3) 谁都不动：到点房主应该被托管一手，然后客人也被托管一手
//    （seat 0 房主 → seat 1 客人 → AI 两家即刻接手）
const hostAuto = await waitFor(
  host,
  `${store}.match.log.length >= 4 && ${store}.match.log.some(e => e.auto === true && e.seat === 0)`,
  TURN_MS + 15000,
)
const guestAuto = await waitFor(
  host,
  `${store}.match.log.some(e => e.auto === true && e.seat === 1)`,
  TURN_MS + 20000,
)

// 4) 客人端：同一份 log（托管标记同步）、倒计时 chip 在走
const guestSeesAuto = await waitFor(
  guest,
  `${store}.match.log.some(e => e.auto === true && e.seat === 1)`,
  10000,
)
const guestClock = await guest.eval(`document.querySelector("[data-testid=turn-clock]")?.textContent ?? ''`)
const hostClock = await host.eval(`document.querySelector("[data-testid=turn-clock]")?.textContent ?? ''`)

const hostHands = await host.eval(`JSON.stringify(${store}.match.players.map(p => p.hand.length))`)
const guestHands = await guest.eval(`JSON.stringify(${store}.match.players.map(p => p.hand.length))`)

console.log(
  JSON.stringify(
    {
      soloClock,
      hostAuto,
      guestAuto,
      guestSeesAuto,
      guestClock,
      hostClock,
      handsMatch: hostHands === guestHands,
      hostHands: JSON.parse(hostHands),
    },
    null,
    2,
  ),
)

const pass = soloClock && hostAuto && guestAuto && guestSeesAuto && hostHands === guestHands && /⏱ \d+s/.test(hostClock)
console.log(pass ? 'SMOKE OK' : 'SMOKE FAIL')
await b.close()
if (!pass) process.exit(1)
