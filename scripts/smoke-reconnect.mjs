// 真浏览器冒烟：客人刷新页面后还能坐回原座（凭本机 token 认领）
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

const seats = (p) =>
  p.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)

await host.goto('http://localhost:5173/')
await sleep(600)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code = JSON.parse(await host.eval('JSON.stringify({ code: window.__gdStore.getState().roomCode })')).code

await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(5000)
const guestSeatBefore = await guest.eval('window.__gdStore.getState().mySeat')
const hostSeatsBefore = await seats(host)

// 客人刷新页面
await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(6000)
const guestSeatAfter = await guest.eval('window.__gdStore.getState().mySeat')
const hostSeatsAfter = await seats(host)
const reconnected = await guest.eval('window.__gdStore.getState().reconnected')

// 3) 牌局进行中再刷新一次：座位要保住，AI 不能替着打
for (let i = 0; i < 3; i++) {
  await host.eval(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+AI')
    if (btn) btn.click()
  })()`)
  await sleep(250)
}
await host.eval('document.querySelector("[data-testid=host-start]").click()')
await sleep(4000)
const inGame = await host.eval('window.__gdStore.getState().match.phase')
await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(6000)
const guestSeatInGame = await guest.eval('window.__gdStore.getState().mySeat')
const botFlag = await host.eval(`(() => {
  const m = window.__gdStore.getState().match
  return m ? JSON.stringify(m.players.map(p => p.isBot)) : 'null'
})()`)

console.log(
  JSON.stringify(
    {
      code,
      inGame,
      guestSeatInGame,
      seatKeptInGame: guestSeatInGame === guestSeatBefore,
      botFlag,
      guestSeatBefore,
      guestSeatAfter,
      sameSeat: guestSeatBefore === guestSeatAfter,
      hostSeatsBefore: JSON.parse(hostSeatsBefore),
      hostSeatsAfter: JSON.parse(hostSeatsAfter),
      reconnected,
      hostErrors: host.consoleErrors,
      guestErrors: guest.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
