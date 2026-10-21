// 手机端全屏巡检：390×844 下逐个界面检查横向溢出与「按钮被挤出屏幕」
const { Browser, sleep } = await import('/Users/tianyi/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')

const b = await Browser.launch({ width: 390, height: 844 })
const p = await b.newPage({ width: 390, height: 844, mobile: true })

/** 页面级检查：横向溢出 + 越界的可点元素（可横向滚动的条除外） */
const check = (label) =>
  p.eval(`(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const scrollables = [...document.querySelectorAll('*')].filter(e => {
      const ox = getComputedStyle(e).overflowX
      return ox === 'auto' || ox === 'scroll'
    })
    const inScroller = (el) => scrollables.some(s => s !== el && s.contains(el))
    const wide = [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect()
      if (r.width === 0) return false
      if (r.right <= vw + 1) return false
      return !inScroller(e)
    }).slice(0, 5).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 40))
    const offscreenButtons = [...document.querySelectorAll('button')].filter(e => {
      const r = e.getBoundingClientRect()
      if (r.width === 0) return false
      if (inScroller(e)) return false
      return r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1
    }).slice(0, 5).map(e => e.textContent.trim().slice(0, 8))
    return JSON.stringify({
      label: ${JSON.stringify(label)},
      pageOverflowX: document.documentElement.scrollWidth > vw,
      wide,
      offscreenButtons,
    })
  })()`)

const results = []

await p.goto('http://localhost:5173/')
await sleep(1200)
results.push(JSON.parse(await check('大厅')))

await p.eval('document.querySelector("[data-testid=open-help]").click()')
await sleep(500)
results.push(JSON.parse(await check('玩法说明')))
await p.eval('document.querySelector("[data-testid=help-close]").click()')
await sleep(300)

await p.eval('document.querySelector("[data-testid=solo]").click()')
await sleep(1200)
for (let i = 0; i < 8; i++) {
  await p.eval(`(() => { const s = window.__gdStore.getState(); const st = s.match; if (st.phase === 'playing') s.dispatch(window.__gdAi(st, st.turn)) })()`)
  await sleep(60)
}
results.push(JSON.parse(await check('牌桌')))

// 选一张牌：动作区多一个「选牌预览」，看会不会挤爆
// 注意：这段在模板字符串里，正则别用 \d（会被当成转义），用 [0-9]
const pickCard = `(() => {
  const btn = [...document.querySelectorAll('button[aria-label]')].find(b => b.getAttribute('aria-label')?.match(/^[shcd][0-9]+-[0-9]+$/))
  if (btn) btn.click()
})()`
await p.eval(pickCard)
await sleep(400)
results.push(JSON.parse(await check('选牌预览')))
await p.eval(pickCard)
await sleep(300)

await p.eval('document.querySelector("[data-testid=play-log]").click()')
await sleep(500)
results.push(JSON.parse(await check('牌谱')))
await p.eval('document.querySelector("[data-testid=play-history-close]").click()')
await sleep(300)

// 打到结算
for (let i = 0; i < 900; i++) {
  const done = await p.eval(`(() => {
    const s = window.__gdStore.getState(); const st = s.match
    if (!st) return 'no'
    if (st.phase === 'playing') { s.dispatch(window.__gdAi(st, st.turn)); return 'play' }
    if (st.phase === 'tribute') { s.dispatch(window.__gdTribute(st, st.turn)); return 'tribute' }
    if (st.phase === 'ended') { const btn = document.querySelector('[data-testid=rematch]'); if (btn) btn.click(); return 'ended' }
    return st.phase
  })()`)
  if (done === 'tribute') break
  await sleep(25)
}
await sleep(600)
results.push(JSON.parse(await check('进贡')))
for (let i = 0; i < 900; i++) {
  const done = await p.eval(`(() => {
    const s = window.__gdStore.getState(); const st = s.match
    if (st.phase === 'playing') { s.dispatch(window.__gdAi(st, st.turn)); return 'play' }
    if (st.phase === 'tribute') { s.dispatch(window.__gdTribute(st, st.turn)); return 'tribute' }
    if (st.phase === 'ended') return 'ended'
    return st.phase
  })()`)
  if (done === 'ended') break
  await sleep(25)
}
await sleep(600)
results.push(JSON.parse(await check('结算')))

// 复盘页
const frag = await p.eval(`(async () => {
  const st = window.__gdStore.getState().match
  return await window.__gdReplay.encodeReplay(window.__gdReplay.replayFromState(st))
})()`)
await p.goto('http://localhost:5173/?replay=' + frag)
await sleep(1000)
results.push(JSON.parse(await check('复盘页')))

// 房主房间
await p.goto('http://localhost:5173/')
await sleep(1000)
await p.eval('document.querySelector("[data-testid=create-room]").click()')
await sleep(4000)
results.push(JSON.parse(await check('房主房间')))

console.log(JSON.stringify(results, null, 2))
const bad = results.filter(r => r.pageOverflowX || r.wide.length || r.offscreenButtons.length)
console.log(bad.length === 0 ? 'ALL OK' : 'PROBLEMS: ' + bad.map(r => r.label).join(', '))
console.log('errors:', p.consoleErrors)
await b.close()
if (bad.length > 0) process.exit(1)
