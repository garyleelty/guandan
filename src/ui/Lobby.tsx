import { useState } from 'react'
import { useStore } from '../state/store'
import { createRoom, nick } from '../net/host'
import { codeFromUrl } from '../net/room'
import { buildDeck } from '../core/cards'
import { CardFace } from './CardFace'
import { Mark } from './Mark'

/** 玩法速览：与引擎实现一致的规则条目，每条一行 */
const RULES = [
  '双人成对，对家是搭档',
  '头游率队升级：1+2 同队 +3 级，1+3 +2 级，1+4 +1 级',
  '打到 A 级需双下（1+2 名同队）才夺整局',
  '炸弹、同花顺、天炸可压常规牌型',
  '房间空位可由 AI 补位，掉线玩家由 AI 接手',
]

/** 门面上的三张牌：掼蛋自己的东西，不是装饰图形。 */
const MOTIF = (() => {
  const deck = buildDeck()
  const pick = (rank: number, suit: number) => deck.find((c) => c.rank === rank && c.suit === suit)!
  return [pick(18, 0), pick(14, 1), deck.find((c) => c.rank === 17)!]
})()

export function Lobby() {
  const startSolo = useStore((s) => s.startSolo)
  const mode = useStore((s) => s.mode)
  const [nick_, setNick] = useState(nick())
  const deep = mode === 'guest' || codeFromUrl()

  if (deep)
    return (
      <div className="grid h-full place-items-center px-4">
        <p className="text-center text-sm text-muted">正在进入房间…</p>
      </div>
    )

  return (
    <div className="grid h-full place-items-center px-4 py-10">
      <div className="grid w-full max-w-[880px] items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* 左：进门的三件事 */}
        <div>
          <div className="flex items-center gap-3">
            <Mark size={30} />
            <div>
              <h1 className="text-xl font-semibold text-ink">掼蛋</h1>
              <p className="mt-0.5 text-sm text-muted">四人两队 · 对家搭档 · 级牌升级 2→A · P2P 联机</p>
            </div>
          </div>

          <label htmlFor="nick-field" className="mt-8 block text-sm text-muted">
            你的昵称
          </label>
          <input
            id="nick-field"
            value={nick_}
            onChange={(e) => setNick(e.target.value.slice(0, 8))}
            onBlur={() => localStorage.setItem('gd-nick', nick_)}
            className="mt-2 h-10 w-full rounded-control border border-control bg-surface px-4 text-sm text-ink placeholder:text-faint"
            placeholder="你的昵称"
            data-testid="nick"
          />

          <div className="mt-6 space-y-2">
            <button className="btn btn-primary min-h-11 w-full" onClick={startSolo} data-testid="solo">
              单机开局（+3 AI）
            </button>
            <button
              className="btn btn-secondary min-h-11 w-full"
              onClick={() => {
                createRoom()
              }}
              data-testid="create-room"
            >
              创建房间（P2P）
            </button>
            <button
              className="btn btn-ghost min-h-11 w-full"
              onClick={() => {
                useStore.setState({ mode: 'guest', screen: 'room' })
              }}
              data-testid="join-room"
            >
              通过链接加入
            </button>
          </div>
        </div>

        {/* 右：掼蛋长什么样 + 怎么算 */}
        <div className="panel p-5">
          <div className="flex items-end gap-1.5">
            {MOTIF.map((c) => (
              <CardFace key={c.id} card={c} size="xs" />
            ))}
          </div>
          <h2 className="mt-5 text-base text-ink">玩法速览</h2>
          <div className="mt-3 space-y-2">
            {RULES.map((r) => (
              <p key={r} className="text-sm text-muted">
                {r}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
