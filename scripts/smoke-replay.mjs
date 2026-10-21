// 真浏览器冒烟：打完一局 → 生成分享链接 → 另开一页打开链接能看到复盘
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })
await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

// 打完两局：进贡 → 打 → 再打一局
for (let i = 0; i < 1200; i++) {
  const done = await p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    if (!st) return 'no-state'
    if (st.phase === 'playing') { s.dispatch(window.__gdAi(st, st.turn)); return 'play' }
    if (st.phase === 'tribute') { s.dispatch(window.__gdTribute(st, st.turn)); return 'tribute' }
    if (st.phase === 'ended') {
      const btn = document.querySelector('[data-testid=rematch]')
      if (btn && st.history.length < 2) { btn.click(); return 'rematch' }
      return 'ended'
    }
    return st.phase
  })()`)
  if (done === 'ended') break
  await sleep(20)
}
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
      urlLength: url.length,
      fragLength: frag.length,
      info: JSON.parse(info),
      errors: [...p.consoleErrors, ...view.consoleErrors],
    },
    null,
    2,
  ),
)
await view.screenshot({ path: 'docs/screenshots/11-replay.png', format: 'png' })
await b.close()
