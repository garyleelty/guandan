// 真浏览器 P2P 冒烟：房主建房 → 客人用 ?r= 链接进房 → 双方看到同一桌 → 房主开局 → 双方牌局一致
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-p2p.mjs
// 本机 Chrome 需要 --no-sandbox 才能在沙箱里起：CHROME_PATH 指向带 --no-sandbox 的包装脚本
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guest = await b.newPage({ width: 1440, height: 900 })

const st = (p) => p.eval('JSON.stringify(window.__gdStore.getState().match ? { screen: window.__gdStore.getState().screen, code: window.__gdStore.getState().roomCode, seats: window.__gdStore.getState().roomSeats, phase: window.__gdStore.getState().match.phase, log: window.__gdStore.getState().match.log.length, handLevel: window.__gdStore.getState().match.handLevel, dweller: window.__gdStore.getState().match.dwellerTeam, hand: window.__gdStore.getState().match.players.map(p => p.hand.length) } : { screen: window.__gdStore.getState().screen, code: window.__gdStore.getState().roomCode, seats: window.__gdStore.getState().roomSeats })')

// 1) 房主建房
await host.goto('http://localhost:5173/')
await sleep(600)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const hostState = JSON.parse(await st(host))
const code = hostState.code
console.log('room code:', code)

// 2) 客人用链接进房
await guest.goto(`http://localhost:5173/?r=${code}`)
await sleep(5000)
const guestState = JSON.parse(await st(guest))
console.log('guest screen:', guestState.screen, 'seats:', JSON.stringify(guestState.seats))

// 3) 房主给空位加 AI → 开局
await host.eval(`(() => {
  const s = window.__gdStore.getState()
  for (const seat of s.roomSeats) if (seat.kind === 'empty' && seat.seat !== 0) window.__gdHost && null
})()`)
await host.eval('document.querySelectorAll("button")[Array.from(document.querySelectorAll("button")).findIndex(b => b.textContent.trim() === "+AI")]?.click()')
await sleep(300)
// 其余空位继续加 AI
for (let i = 0; i < 3; i++) {
  await host.eval(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+AI')
    if (btn) btn.click()
  })()`)
  await sleep(300)
}
await host.eval('document.querySelector("[data-testid=host-start]").click()')
await sleep(5000)

const hostGame = JSON.parse(await st(host))
const guestGame = JSON.parse(await st(guest))
console.log('host :', JSON.stringify(hostGame))
console.log('guest:', JSON.stringify(guestGame))

// 4) 房主先出（座位 0 领出）→ 客人应看到同一手；再由客人接牌
const pickAndPlay = async (p) => {
  // 逐张试：点一张，等 React 重渲染，再看「出牌」是否可用
  for (let i = 0; i < 8; i++) {
    const clicked = await p.eval(`(() => {
      const cards = [...document.querySelectorAll('button[aria-label]:not([aria-label="静音"])')]
      const c = cards[${i}]
      if (!c) return false
      c.click()
      return true
    })()`)
    if (!clicked) return false
    await sleep(250)
    const ok = await p.eval('!document.querySelector("[data-testid=btn-play]").disabled')
    if (ok) {
      await p.eval('document.querySelector("[data-testid=btn-play]").click()')
      await sleep(2000)
      return true
    }
  }
  return false
}

const hostPlayed = await pickAndPlay(host)
const guestSawTrick = await guest.eval('!!window.__gdStore.getState().match.trick.table')
const guestTrickSeat = await guest.eval('window.__gdStore.getState().match.trick.table?.seat ?? null')

const guestPlayed = await pickAndPlay(guest)
await sleep(2000)
const hostFinal = JSON.parse(await st(host))
const guestFinal = JSON.parse(await st(guest))

console.log(
  JSON.stringify(
    {
      roomCreated: !!code,
      guestJoined: guestState.screen === 'room' && !!guestState.seats,
      started: hostGame.phase === 'playing' && guestGame.phase === 'playing',
      levelSynced: hostGame.handLevel === guestGame.handLevel,
      guestHandLevel: guestGame.handLevel,
      hostPlayed,
      guestSawTrick,
      guestTrickSeat,
      synced: hostFinal.log === guestFinal.log,
      guestPlayed,
      hostLog: hostFinal.log,
      guestLog: guestFinal.log,
      finalLevelSynced: hostFinal.handLevel === guestFinal.handLevel,
      hostHands: hostFinal.hand,
      guestHands: guestFinal.hand,
      hostErrors: host.consoleErrors,
      guestErrors: guest.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
