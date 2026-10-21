// 验收截图：大厅 / 牌局开局 / 中局 / 炸弹特效 / 结算
// 验收截图生成器（真浏览器）
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/capture-shots.mjs
// 本机 Chrome 需要 --no-sandbox 才能在沙箱里起：CHROME_PATH 指向带 --no-sandbox 的包装脚本
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)
import { mkdirSync } from 'node:fs'

const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const b = await Browser.launch({ width: 1440, height: 900 })
const p = await b.newPage({ width: 1440, height: 900 })
const shot = (name) => p.screenshot({ path: `${OUT}/${name}.png`, format: 'png' })

// 1) 大厅
await p.goto('http://localhost:5173/')
await sleep(800)
await shot('01-lobby')

// 2) 开局
await p.goto('http://localhost:5173/?solo=1')
await sleep(1200)
await shot('02-table-start')

// 3) 中局：让 AI 打若干手（四个座都用 AI 走法）
const step = async () =>
  p.eval(`(() => {
    const s = window.__gdStore.getState()
    const st = s.match
    if (!st) return 'ended'
    if (st.phase === 'tribute') {
      // 进贡阶段：用 AI 的交贡/还牌走法
      s.dispatch(window.__gdTribute(st, st.turn))
      return 'tribute'
    }
    if (st.phase !== 'playing') return 'ended'
    const seat = st.turn
    s.dispatch(window.__gdAi(st, seat))
    return 'played'
  })()`)

for (let i = 0; i < 16; i++) {
  await step()
  await sleep(60)
}
await sleep(600)
await shot('03-midgame')

// 4) 炸弹特效：把桌面塞进一手炸弹
await p.eval(`(() => {
  const s = window.__gdStore.getState()
  const st = s.match
  const seat = st.turn
  const pl = st.players[seat]
  const byRank = {}
  for (const c of pl.hand) { (byRank[c.rank] ||= []).push(c) }
  const bomb = Object.values(byRank).find((g) => g.length >= 4)
  if (bomb) s.dispatch({ kind: 'play', seat, cards: bomb.slice(0, 4).map((c) => c.id) })
})()`)
await sleep(500)
await shot('04-bomb-fx')

// 5) 结算：把这一局打完
const playRound = async (maxSteps = 900) => {
  for (let i = 0; i < maxSteps; i++) {
    const r = await step()
    if (r === 'ended') break
    await sleep(25)
  }
}
await playRound()
await sleep(700)

// 6) 再来一局 → 再打一局，结算里能看到本场战绩（跨局延续）
await p.eval('document.querySelector("[data-testid=rematch]").click()')
await sleep(900)
await playRound()
await sleep(900)
console.log('after round2:', await p.eval('JSON.stringify({phase: window.__gdStore.getState().match.phase, turn: window.__gdStore.getState().match.turn, hist: window.__gdStore.getState().match.history.length, log: window.__gdStore.getState().match.log.length})'))
await shot('05-settlement')

console.log(
  JSON.stringify(
    {
      phase: await p.eval('window.__gdStore.getState().match.phase'),
      log: await p.eval('window.__gdStore.getState().match.log.length'),
      history: await p.eval('JSON.stringify(window.__gdStore.getState().match.history)'),
      errors: p.consoleErrors,
    },
    null,
    2,
  ),
)

await b.close()
