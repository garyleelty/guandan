// 真浏览器冒烟：单机局跑几手、点「理牌」看排序切换、确认出牌按钮可用
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-ui.mjs
// 本机 Chrome 需要 --no-sandbox 才能在沙箱里起：CHROME_PATH 指向带 --no-sandbox 的包装脚本
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })

await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)

const store = 'window.__gdStore.getState()'

// 1) AI 是否在出牌（牌局日志增长）
const logBefore = await p.eval(`${store}.match.log.length`)
await sleep(4500)
const logAfter = await p.eval(`${store}.match.log.length`)

// 2) 手牌排序：点「理牌」后 DOM 里的牌序是否变化
const domOrder = () =>
  p.eval(
    'JSON.stringify([...document.querySelectorAll("button[aria-label]")].map(b => b.getAttribute("aria-label")).slice(0, 8))',
  )
const before = await domOrder()
await p.eval('document.querySelector("[data-testid=sort-hand]").click()')
await sleep(700)
const after = await domOrder()

// 3) 选一张牌 → 出牌 → AI 应接着出牌
const cardSel = 'button[aria-label]:not([aria-label="静音"])'
await p.eval(`document.querySelector('${cardSel}').click()`)
await sleep(400)
const canPlay = await p.eval('!document.querySelector("[data-testid=btn-play]").disabled')
await p.eval('document.querySelector("[data-testid=btn-play]").click()')
await sleep(3000)
const handCount = await p.eval(`${store}.match.players[0].hand.length`)
const logLen = await p.eval(`${store}.match.log.length`)
const trickSeat = await p.eval(`${store}.match.trick.table ? ${store}.match.trick.table.seat : null`)

console.log(
  JSON.stringify(
    {
      aiPlayed: logAfter > logBefore,
      logBefore,
      logAfter,
      sortChanged: before !== after,
      before: JSON.parse(before),
      after: JSON.parse(after),
      canPlay,
      handCount,
      logLen,
      trickSeat,
      consoleErrors: p.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
