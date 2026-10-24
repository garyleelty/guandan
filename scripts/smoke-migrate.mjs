// 真浏览器冒烟：房主转移——房主页面直接关掉 → 最低座位的人类客人接管当房主，
// 其他客人自动重连回来，牌局从断点继续；新房主收得到 intent、能续局。
// 依赖 design-taste-frontend 技能的 CDP 库：TASTE_SKILL=/path/to/skill node scripts/smoke-migrate.mjs
const skill = process.env.TASTE_SKILL ?? '/Users/tianyi/.agents/skills/design-taste-frontend'
const { Browser, sleep } = await import(`${skill}/scripts/lib/cdp.mjs`)

const b = await Browser.launch({ width: 1440, height: 900 })
const host = await b.newPage({ width: 1440, height: 900 })
const guestA = await b.newPage({ width: 1440, height: 900 })
const guestB = await b.newPage({ width: 1440, height: 900 })

async function waitFor(page, expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      if (await page.eval(expr)) return true
    } catch {
      // 页面还没把模块加载完（__gdStore 不存在）：当没等到处理
    }
    await sleep(200)
  }
  return false
}
const store = 'window.__gdStore.getState()'
const snap = (p) =>
  p.eval(`JSON.stringify({
    mode: ${store}.mode,
    seat: ${store}.mySeat,
    phase: ${store}.match?.phase,
    log: ${store}.match?.log.length,
    hand: ${store}.match?.players.map(x => x.hand.length),
    names: ${store}.match?.players.map(x => x.name),
    seats: ${store}.roomSeats?.map(x => x.kind),
    screen: ${store}.screen,
  })`)

// 1) 房主建房（?turnMs=3000：真人座超时托管，脚本不替客人打牌）→ 两位客人进房 → 补一个 AI（seat 3）→ 开局
let code = null
for (let attempt = 0; attempt < 3 && !code; attempt++) {
  await host.goto('http://localhost:5173/?turnMs=3000')
  await waitFor(host, 'document.querySelector("[data-testid=create-room]") !== null')
  await host.eval('document.querySelector("[data-testid=create-room]").click()')
  await waitFor(host, `${store}.roomCode !== null`, 20000)
  code = await host.eval(`${store}.roomCode`)
}
if (!code) throw new Error('room code never arrived (PeerJS signaling?)')
console.log('room code:', code)

// 两位客人用不同身份（同一浏览器 profile 默认共用 token/昵称，会互相顶座）
async function withIdentity(page, token, nickName) {
  await page.goto('http://localhost:5173/')
  await waitFor(page, 'document.querySelector("[data-testid=create-room]") !== null', 20000)
  await page.eval(`localStorage.setItem('gd-token', '${token}'); localStorage.setItem('gd-nick', '${nickName}')`)
}
async function joinRoom(page, code) {
  await page.goto(`http://localhost:5173/?r=${code}&turnMs=3000`)
  if (!(await waitFor(page, `${store}.roomSeats !== null && !${store}.joining`, 25000))) {
    await page.goto(`http://localhost:5173/?r=${code}&turnMs=3000`)
    if (!(await waitFor(page, `${store}.roomSeats !== null && !${store}.joining`, 25000))) throw new Error('guest not joined')
  }
}
await withIdentity(guestA, 'smoke-guest-a', '客人A')
await joinRoom(guestA, code)
await withIdentity(guestB, 'smoke-guest-b', '客人B')
await joinRoom(guestB, code)

// guestA 应坐 seat 1、guestB 坐 seat 2（最低空位优先）
const seatA = await guestA.eval(`${store}.mySeat`)
const seatB = await guestB.eval(`${store}.mySeat`)
console.log('guestA seat:', seatA, 'guestB seat:', seatB)

// 补 AI：点 +AI（seat 3 的空位）
await host.eval(`
  [...document.querySelectorAll('button')]
    .filter(b => b.textContent.trim() === '+AI')[0]
    ?.click()
`)
await sleep(300)
await waitFor(host, 'document.querySelector("[data-testid=host-start]").disabled === false')
await host.eval('document.querySelector("[data-testid=host-start]").click()')
if (!(await waitFor(host, `${store}.match !== null`, 15000))) {
  console.log('host body:', await host.eval('document.body.innerText.slice(0, 300)'))
  throw new Error('game did not start')
}
await waitFor(guestA, `${store}.match !== null`, 20000)
await waitFor(guestB, `${store}.match !== null`, 20000)

// 2) 打几手：房主（真人）先出一张，AI 座位接上，log 起来后再转移
await host.eval(`
  (() => {
    const s = window.__gdStore.getState()
    const mv = window.__gdAi(s.match, s.mySeat)
    s.dispatch(mv)
  })()
`)
if (!(await waitFor(host, `${store}.match.log.length >= 4`, 25000))) {
  console.log(
    'host diag:',
    await host.eval(
      `JSON.stringify({ turn: ${store}.match?.turn, log: ${store}.match?.log.length, phase: ${store}.match?.phase, mode: ${store}.mode, gdAi: typeof window.__gdAi, hand0: ${store}.match?.players[0].hand.length, isBot: ${store}.match?.players.map(p => p.isBot), clock: document.querySelector('[data-testid=turn-clock]')?.textContent ?? null })`,
    ),
  )
  throw new Error('game did not progress before migration')
}
const beforeLog = await host.eval(`${store}.match.log.length`)
console.log('log before migration:', beforeLog)

// 3) 房主页面直接关掉
await host.close()
await sleep(1500)

// 4) guestA（seat 1，最低人类座）应接管当房主
const aIsHost = await waitFor(guestA, `${store}.mode === 'host' && ${store}.match !== null`, 20000)
const aSnap = JSON.parse(await snap(guestA))
console.log('guestA after migration:', JSON.stringify(aSnap))

// 5) guestB 自动重连到新房主：新座位表里 host 坐 seat 1，log 追平转移前
const bBack = await waitFor(
  guestB,
  `${store}.mode === 'guest' && ${store}.screen === 'table' && ${store}.roomSeats?.[1]?.kind === 'host' && ${store}.match !== null`,
  45000,
)
const bSnap = JSON.parse(await snap(guestB))
console.log('guestB after migration:', JSON.stringify(bSnap))

// 6) 牌局活着：等几手（AI 座在动），log 超过转移前的长度
await waitFor(guestA, `${store}.match.log.length > ${beforeLog}`, 30000)
const afterLogA = await guestA.eval(`${store}.match.log.length`)
const afterLogB = await guestB.eval(`${store}.match.log.length`)

// 7) 客人 intent 仍有效：guestB 若轮到就出一张（否则跳过这条）
let intentOk = 'skipped'
const bTurn = await guestB.eval(`${store}.match.turn === ${store}.mySeat && ${store}.match.phase === 'playing'`)
if (bTurn) {
  await guestB.eval(`
    (() => {
      const s = window.__gdStore.getState()
      const card = s.match.players[s.mySeat].hand[0]
      s.dispatch({ kind: 'play', seat: s.mySeat, cards: [card.id] })
    })()
  `)
  intentOk = await waitFor(guestA, `${store}.match.log.some(e => e.seat === ${seatB})`, 10000) ? 'ok' : 'fail'
}

// 8) 名字没乱：新 host 视角的名字应与开局一致
const namesOk =
  JSON.stringify(aSnap.names) === JSON.stringify(bSnap.names) && aSnap.names.filter(Boolean).length === 4

console.log(
  JSON.stringify(
    {
      aIsHost,
      bBack,
      aModeSeat: `${aSnap.mode}@${aSnap.seat}`,
      beforeLog,
      afterLogA,
      afterLogB,
      intentOk,
      namesOk,
      aSeats: aSnap.seats,
    },
    null,
    2,
  ),
)

const pass = aIsHost && bBack && afterLogA > beforeLog && afterLogA === afterLogB && intentOk !== 'fail' && namesOk
console.log(pass ? 'SMOKE OK' : 'SMOKE FAIL')
await b.close()
if (!pass) process.exit(1)
