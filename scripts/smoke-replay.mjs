// 真浏览器冒烟：打完两局 → 中途刷新续局 → 分享链接仍能看到整场两局复盘
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

async function waitFor(page, expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await page.eval(expr)) return true
    await sleep(200)
  }
  return false
}

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })
await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

/** 一直用 AI 打到「第 target 局结束」 */
async function driveToRoundEnd(target) {
  for (let i = 0; i < 1500; i++) {
    const done = await p.eval(`(() => {
      const s = window.__gdStore.getState()
      const st = s.match
      if (!st) return 'no-state'
      if (st.phase === 'playing') { s.dispatch(window.__gdAi(st, st.turn)); return 'play' }
      if (st.phase === 'tribute') { s.dispatch(window.__gdTribute(st, st.turn)); return 'tribute' }
      if (st.phase === 'ended') {
        if (st.history.length < ${target}) {
          const btn = document.querySelector('[data-testid=rematch]')
          if (btn) { btn.click(); return 'rematch' }
        }
        return 'ended'
      }
      return st.phase
    })()`)
    if (done === 'ended') return true
    await sleep(20)
  }
  return false
}

// 第一局打完 → 点「再来一局」→ 第二局刚开始时刷新
await driveToRoundEnd(1)
const firstDone = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  return JSON.stringify({ phase: st.phase, history: st.history.length })
})()`)

// 结算页刷新：应该还能回来看到结算（而不是丢档）
await p.goto('http://localhost:5173/?solo=1')
await waitFor(p, 'window.__gdStore.getState().match !== null', 12000)
await sleep(500)
const settlementReload = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  return JSON.stringify({
    phase: st.phase,
    history: st.history.length,
    hasRematch: !!document.querySelector('[data-testid=rematch]'),
    hasSettlement: document.body.innerText.includes('本场战绩'),
  })
})()`)

await p.eval('document.querySelector("[data-testid=rematch]").click()')
await waitFor(p, `window.__gdStore.getState().match.phase !== 'ended'`, 8000)
await sleep(300)
const beforeReload = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  return JSON.stringify({ phase: st.phase, history: st.history.length, log: st.log.length })
})()`)

await p.goto('http://localhost:5173/?solo=1')
await waitFor(p, 'window.__gdStore.getState().match !== null', 12000)
await sleep(500)
const afterReload = await p.eval(`(() => {
  const st = window.__gdStore.getState().match
  const save = JSON.parse(localStorage.getItem('gd-solo-save') || 'null')
  return JSON.stringify({
    phase: st.phase,
    history: st.history.length,
    log: st.log.length,
    archiveRounds: save ? save.archive.length : -1,
  })
})()`)

// 第二局打完 → 分享整场
await driveToRoundEnd(2)
await sleep(600)

const frag = await p.eval(`(async () => {
  const st = window.__gdStore.getState().match
  const data = window.__gdReplay.replayFromState(st)
  return await window.__gdReplay.encodeReplay(data)
})()`)
const url = `http://localhost:5173/?replay=${frag}`

const view = await b.newPage({ width: 1440, height: 900 })
await view.goto(url)
await sleep(1200)
const info = await view.eval(`(() => {
  const txt = document.body.innerText
  const tabs = [...document.querySelectorAll('[data-testid=replay-rounds] button')].map(b => b.textContent.trim())
  return JSON.stringify({
    heading: txt.slice(0, 40),
    hasTitle: txt.includes('牌局复盘'),
    items: document.querySelectorAll('li').length,
    tabs,
  })
})()`)
console.log(
  JSON.stringify(
    {
      firstDone: JSON.parse(firstDone),
      settlementReload: JSON.parse(settlementReload),
      beforeReload: JSON.parse(beforeReload),
      afterReload: JSON.parse(afterReload),
      urlLength: url.length,
      fragLength: frag.length,
      info: JSON.parse(info),
      tabsCount: JSON.parse(info).tabs.length,
      errors: [...p.consoleErrors, ...view.consoleErrors],
    },
    null,
    2,
  ),
)
await view.screenshot({ path: 'docs/screenshots/11-replay.png', format: 'png' })
await b.close()
