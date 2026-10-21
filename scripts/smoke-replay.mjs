// 真浏览器冒烟：打完一局 → 生成分享链接 → 另开一页打开链接能看到复盘
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })
await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

// 打到本局结束
for (let i = 0; i < 200; i++) {
  const done = await p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    if (!st) return 'no-state'
    if (st.phase === 'playing') { s.dispatch(window.__gdAi(st, st.turn)); return 'play' }
    if (st.phase === 'tribute') { s.dispatch(window.__gdTribute(st, st.turn)); return 'tribute' }
    return st.phase
  })()`)
  if (done === 'ended') break
  await sleep(25)
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
  return JSON.stringify({
    heading: txt.slice(0, 40),
    hasTitle: txt.includes('牌局复盘'),
    items: document.querySelectorAll('li').length,
    cards: document.querySelectorAll('main li svg, main li canvas').length,
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
