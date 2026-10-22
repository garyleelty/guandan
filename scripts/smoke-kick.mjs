// 真浏览器冒烟：房主把客人请出房间 → 客人看到提示、座位空出来
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

/** 等到条件成立（PeerJS 握手有时要好几秒，别用固定 sleep 赌） */
async function waitFor(page, expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await page.eval(expr)) return true
    await sleep(250)
  }
  return false
}

await host.goto('http://localhost:5173/')
await sleep(600)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code = await host.eval('window.__gdStore.getState().roomCode')

await guest.goto(`http://localhost:5173/?r=${code}`)
await waitFor(guest, 'window.__gdStore.getState().roomSeats !== null')
await sleep(500)
const guestSeatsBefore = await guest.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)

// 房主踢人
await waitFor(host, 'document.querySelector("[data-testid=kick-1]") !== null')
await host.eval('document.querySelector("[data-testid=kick-1]").click()')
await waitFor(guest, 'window.__gdStore.getState().kicked !== ""', 8000)
await sleep(400)
const hostSeatsAfter = await host.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)
const guestKicked = await guest.eval('window.__gdStore.getState().kicked')
const guestLost = await guest.eval('window.__gdStore.getState().guestLost')
const guestText = await guest.eval('document.body.innerText.slice(0, 120)')

// 被请出去的人不该能再进来：重新打开链接，还是进不来
await guest.goto(`http://localhost:5173/?r=${code}`)
await waitFor(guest, 'window.__gdStore.getState().guestLost === true || window.__gdStore.getState().kicked !== ""')
const rejoinLost = await guest.eval('window.__gdStore.getState().guestLost')
const rejoinKicked = await guest.eval('window.__gdStore.getState().kicked')
const rejoinText = await guest.eval('document.body.innerText.slice(0, 120)')
const rejoinSeats = await guest.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)
const hostSeatsFinal = await host.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)

console.log(
  JSON.stringify(
    {
      code,
      rejoinBlocked: rejoinLost === true,
      rejoinKicked,
      rejoinText,
      rejoinSeats: JSON.parse(rejoinSeats),
      hostSeatsFinal: JSON.parse(hostSeatsFinal),
      guestSeatsBefore: JSON.parse(guestSeatsBefore),
      hostSeatsAfter: JSON.parse(hostSeatsAfter),
      seatFreed: JSON.parse(hostSeatsAfter)[1].includes('empty'),
      guestKicked,
      guestLost,
      guestText,
      hostErrors: host.consoleErrors,
      guestErrors: guest.consoleErrors,
    },
    null,
    2,
  ),
)
await b.close()
