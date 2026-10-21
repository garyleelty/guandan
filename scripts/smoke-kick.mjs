// 真浏览器冒烟：房主把客人请出房间 → 客人看到提示、座位空出来
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

await host.goto('http://localhost:5173/')
await sleep(600)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code = await host.eval('window.__gdStore.getState().roomCode')

await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(5000)
const guestSeatsBefore = await guest.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)

// 房主踢人
await host.eval('document.querySelector("[data-testid=kick-1]").click()')
await sleep(1500)
const hostSeatsAfter = await host.eval(`JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ':' + s.name + ':' + s.kind))`)
const guestKicked = await guest.eval('window.__gdStore.getState().kicked')
const guestLost = await guest.eval('window.__gdStore.getState().guestLost')
const guestText = await guest.eval('document.body.innerText.slice(0, 120)')

console.log(
  JSON.stringify(
    {
      code,
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
