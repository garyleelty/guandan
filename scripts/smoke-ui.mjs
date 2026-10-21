// 真浏览器冒烟：理牌切换排序 → 出牌 → AI 接牌 → 提示按钮替我选牌
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-ui.mjs
// 本机 Chrome 需要 --no-sandbox 才能在沙箱里起：CHROME_PATH 指向带 --no-sandbox 的包装脚本
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })

await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

const store = 'window.__gdStore.getState()'
const cardSel = 'button[aria-label]:not([aria-label="静音"])'

// 1) 手牌排序：点「理牌」后 DOM 里的牌序应变化
const domOrder = () =>
  p.eval(
    'JSON.stringify([...document.querySelectorAll("button[aria-label]")].map(b => b.getAttribute("aria-label")).slice(0, 8))',
  )
const before = await domOrder()
await p.eval('document.querySelector("[data-testid=sort-hand]").click()')
await sleep(700)
const after = await domOrder()

// 2) 选一张牌 → 出牌 → AI 应接着出牌
await p.eval(`document.querySelector('${cardSel}').click()`)
await sleep(400)
const canPlay = await p.eval('!document.querySelector("[data-testid=btn-play]").disabled')
await p.eval('document.querySelector("[data-testid=btn-play]").click()')
await sleep(3000)
const handCount = await p.eval(`${store}.match.players[0].hand.length`)
const logLen = await p.eval(`${store}.match.log.length`)
const trickSeat = await p.eval(`${store}.match.trick.table ? ${store}.match.trick.table.seat : null`)

// 3) 等轮到我，点「提示」：应替我选好牌，出牌按钮随之可用
let myTurn = false
for (let i = 0; i < 120 && !myTurn; i++) {
  myTurn = await p.eval(`${store}.match.turn === ${store}.mySeat`)
  if (!myTurn) await sleep(100)
}
let hintSelected = 0
let hintCanPlay = false
let hintText = ''
if (myTurn) {
  await p.eval('document.querySelector("[data-testid=hint]").click()')
  await sleep(500)
  hintSelected = await p.eval('document.querySelectorAll("button[aria-label][aria-pressed=true]").length')
  hintCanPlay = await p.eval('!document.querySelector("[data-testid=btn-play]").disabled')
  hintText = await p.eval(
    '[...document.querySelectorAll("span")].map(s => s.textContent).find(t => t.startsWith("建议")) ?? ""',
  )
}

// 4) 打完一局 → 「再来一局」：级数应延续到下一局
for (let i = 0; i < 800; i++) {
  const ended = await p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    if (!st || st.phase !== 'playing') return true
    s.dispatch(window.__gdAi(st, st.turn))
    return false
  })()`)
  if (ended) break
  await sleep(15)
}
const levelsBefore = await p.eval('JSON.stringify(window.__gdStore.getState().match.levels)')
const phaseEnded = await p.eval('window.__gdStore.getState().match.phase')
await p.eval('document.querySelector("[data-testid=rematch]").click()')
await sleep(900)
const levelsAfter = await p.eval('JSON.stringify(window.__gdStore.getState().match.levels)')
const phaseAfter = await p.eval('window.__gdStore.getState().match.phase')
const leaderAfter = await p.eval('window.__gdStore.getState().match.trick.leader')

console.log(
  JSON.stringify(
    {
      sortChanged: before !== after,
      canPlay,
      handCount,
      logLen,
      trickSeat,
      myTurn,
      hintSelected,
      hintCanPlay,
      hintText,
      phaseEnded,
      levelsBefore,
      levelsAfter,
      levelsCarried: levelsBefore === levelsAfter,
      phaseAfter,
      leaderAfter,
      consoleErrors: p.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
