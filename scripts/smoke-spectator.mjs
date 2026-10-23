// 真浏览器冒烟：观战模式——第五个人用 ?watch=1 进来看牌，不上桌
const { Browser, sleep } = await import('/Users/tianyi/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const watcher = await b.newPage({ width: 1440, height: 900 })

await host.goto('http://localhost:5173/')
await sleep(700)
await host.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code = await host.eval('window.__gdStore.getState().roomCode')

// 房主把空位补上 AI 并开局
for (let i = 0; i < 3; i++) {
  await host.eval(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+AI')
    if (btn) btn.click()
  })()`)
  await sleep(200)
}
await host.eval('document.querySelector("[data-testid=host-start]").click()')
await sleep(3000)

// 观战者进来
await watcher.goto(`http://localhost:5173/?r=${code}&watch=1`)
await sleep(6000)

const watchInfo = await watcher.eval(`(() => {
  const chip = document.querySelector('[data-testid=spectating]')
  const body = document.body.innerText
  return JSON.stringify({
    spectating: !!chip,
    screen: window.__gdStore.getState().screen,
    storeFlag: window.__gdStore.getState().spectating,
    hasHand: body.includes('我的牌'),
    hasPlayButton: !!document.querySelector('[data-testid=btn-play]'),
    hasSeatLabels: body.includes('号位'),
    note: body.includes('正在观战'),
    handsHidden: window.__gdStore.getState().match
      ? window.__gdStore.getState().match.players.every(p => p.hand.every(c => c.id.startsWith('hidden-')))
      : null,
    hostHand: window.__gdStore.getState().match
      ? window.__gdStore.getState().match.players[0].hand.slice(0, 2).map(c => c.id)
      : [],
  })
})()`)

// 桌上打几手，看观战者能不能收到
const before = await watcher.eval('window.__gdStore.getState().match.log.length')
for (let i = 0; i < 6; i++) {
  await host.eval(`(() => { const s = window.__gdStore.getState(); const st = s.match; if (st.phase === 'playing') s.dispatch(window.__gdAi(st, st.turn)) })()`)
  await sleep(120)
}
await sleep(1200)
const after = await watcher.eval('window.__gdStore.getState().match.log.length')

const watchers = await host.eval('JSON.stringify(window.__gdStore.getState().roomWatchers ?? [])')
console.log(
  JSON.stringify(
    {
      code,
      watchers: JSON.parse(watchers),
      watch: JSON.parse(watchInfo),
      logBefore: before,
      logAfter: after,
      receivedUpdates: after > before,
      hostSeats: await host.eval(
        'JSON.stringify((window.__gdStore.getState().roomSeats ?? []).map(s => s.seat + ":" + s.kind))',
      ),
      hostErrors: host.consoleErrors,
      watcherErrors: watcher.consoleErrors,
    },
    null,
    2,
  ),
)
await watcher.screenshot({ path: 'docs/screenshots/14-spectator.png', format: 'png' })

// 客人断线后的提示与「重新连接」按钮（另开一个房间，这边要留个空位）
const host2 = await b.newPage({ width: 1440, height: 900 })
await host2.goto('http://localhost:5173/')
await sleep(700)
await host2.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
const code2 = await host2.eval('window.__gdStore.getState().roomCode')
const guest = await b.newPage({ width: 1440, height: 900 })
await guest.goto(`http://localhost:5173/?r=${code2}`)
await sleep(6000)
await guest.eval('window.__gdStore.setState({ guestLost: true })')
await sleep(400)
const lostUi = await guest.eval(`(() => {
  const txt = document.body.innerText
  return JSON.stringify({
    hasReconnect: !!document.querySelector('[data-testid=reconnect]'),
    mentionsAi: txt.includes('AI 接手'),
    text: txt.slice(0, 120),
  })
})()`)
console.log('guest lost UI:', lostUi)
// 点「重新连接」应该能回到牌桌
await guest.eval('document.querySelector("[data-testid=reconnect]").click()')
await sleep(6000)
const reconnected = await guest.eval(`JSON.stringify({
  screen: window.__gdStore.getState().screen,
  lost: window.__gdStore.getState().guestLost,
  seat: window.__gdStore.getState().mySeat,
  hasChip: !!document.querySelector('[data-testid=reconnected]'),
  storeFlag: window.__gdStore.getState().reconnected,
})`)
console.log('after reconnect:', reconnected, 'guestErrors:', guest.consoleErrors)
const reconnectInfo = JSON.parse(reconnected)
console.log('reconnect ok:', reconnectInfo.lost === false && reconnectInfo.seat >= 0)
console.log('reconnect chip gone:', reconnectInfo.hasChip === false && reconnectInfo.storeFlag === false)
await guest.close()

// 手机上观战也要放得下
const m = await b.newPage({ width: 390, height: 844, mobile: true })
await m.goto(`http://localhost:5173/?r=${code}&watch=1`)
await sleep(6000)
const mobile = JSON.parse(
  await m.eval(`(() => {
    const vw = window.innerWidth
    // 可横向滚动的条里的元素超出是故意的，排除
    const scrollers = [...document.querySelectorAll('*')].filter(e => {
      const ox = getComputedStyle(e).overflowX
      return ox === 'auto' || ox === 'scroll'
    })
    const inScroller = (el) => scrollers.some(sc => sc !== el && sc.contains(el))
    const wide = [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect()
      if (r.width === 0) return false
      if (r.right <= vw + 1) return false
      return !inScroller(e)
    }).length
    return JSON.stringify({ overflowX: document.documentElement.scrollWidth > vw, wide, hasNote: document.body.innerText.includes('正在观战') })
  })()`),
)
console.log('mobile:', JSON.stringify(mobile))
await b.close()
