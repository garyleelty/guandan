// 手机端冒烟：390px 下摊开手牌 → 27 张都能看到；再收回
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 390, height: 844 })
const p = await b.newPage({ width: 390, height: 844, mobile: true })
await p.goto('http://localhost:5173/?solo=1')
await sleep(1500)

const cardCount = await p.eval('document.querySelectorAll("button[aria-label]:not([aria-label=\\"静音\\"])").length')
await p.eval('document.querySelector("[data-testid=hand-view]").click()')
await sleep(600)
const gridCards = await p.eval('document.querySelectorAll("button[aria-label]:not([aria-label=\\"静音\\"])").length')
// 网格里 27 张牌是否都在可视范围内（纵向可滚，但一屏能看到几行）
const visible = await p.eval(`(() => {
  const cards = [...document.querySelectorAll('button[aria-label]:not([aria-label="静音"])')]
  const rows = new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))
  const inView = cards.filter(c => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight }).length
  return JSON.stringify({ rows: rows.size, inView, total: cards.length })
})()`)
await p.screenshot({ path: '.taste-skill/mobile-grid.png', format: 'png' })
await p.eval('document.querySelector("[data-testid=hand-view]").click()')
await sleep(400)
const backToRow = await p.eval('document.querySelectorAll("button[aria-label]:not([aria-label=\\"静音\\"])").length')

// 底部操作区：按钮不能被挤出屏幕（之前「出牌」会被切掉）
const bar = JSON.parse(
  await p.eval(`(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 只看操作区那一行按钮（手牌在可横向滚动的条里，超出是故意的）
    const row = document.querySelector('footer > div')
    const buttons = [...row.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect()
      return { label: b.textContent.trim(), right: Math.round(r.right), bottom: Math.round(r.bottom) }
    })
    return JSON.stringify({
      vw,
      buttons,
      overflowRight: buttons.filter(b => b.right > vw + 1).map(b => b.label),
      overflowBottom: buttons.filter(b => b.bottom > vh + 1).map(b => b.label),
      pageOverflowX: document.documentElement.scrollWidth > vw,
    })
  })()`),
)
const barOk = bar.overflowRight.length === 0 && bar.overflowBottom.length === 0 && !bar.pageOverflowX

console.log(
  JSON.stringify({ cardCount, gridCards, visible: JSON.parse(visible), backToRow, bar, barOk, errors: p.consoleErrors }, null, 2),
)
await b.close()
if (!barOk) process.exit(1)
