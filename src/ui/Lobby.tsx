import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { HelpSheet } from './HelpSheet'
import { loadStats, winRate, type RoundRecord } from '../core/stats'
import { createRoom, nick } from '../net/host'
import { codeFromUrl } from '../net/room'
import { RANK, buildDeck, levelLabel } from '../core/cards'
import { loadSolo, type SoloSave } from '../state/soloSave'
import { CardFace } from './CardFace'
import { Mark } from './Mark'

/** 玩法速览：与引擎实现一致的规则条目，每条一行 */
const RULES = [
  '两副牌，四人两队，对家是搭档',
  '头游那队升级：1+2 同队 +3 级，1+3 +2 级，1+4 +1 级',
  '打到 A 级需双下（1+2 名同队）才拿下整场',
  '炸弹、同花顺、天炸可压常规牌型',
  '红桃级牌是「逢人配」，可当任意牌点搭配使用',
  '每局之间下游向上游进贡，上游还一张 10 以下的牌',
  '房间空位可由 AI 补位，掉线玩家由 AI 接手',
]

/** 门面上的三张牌：掼蛋自己的东西，不是装饰图形。 */
const MOTIF = (() => {
  const deck = buildDeck()
  const pick = (rank: number, suit: number) => deck.find((c) => c.rank === rank && c.suit === suit)!
  return [pick(RANK.TWO, 0), pick(RANK.ACE, 1), deck.find((c) => c.rank === RANK.BJ)!]
})()

const AI_LEVELS: { v: 0 | 1 | 2; label: string; hint: string }[] = [
  { v: 0, label: '简单', hint: '会拆牌、偶尔想不起' },
  { v: 1, label: '普通', hint: '会算牌型，不算剩余牌' },
  { v: 2, label: '难', hint: '算剩余牌，还会封对手' },
]

export function Lobby() {
  const startSolo = useStore((s) => s.startSolo)
  const resumeSolo = useStore((s) => s.resumeSolo)
  const mode = useStore((s) => s.mode)
  const aiLevel = useStore((s) => s.aiLevel)
  const [showHelp, setShowHelp] = useState(false)
  const [stats, setStats] = useState<RoundRecord[]>([])
  const [saved, setSaved] = useState<SoloSave | null>(() => loadSolo())
  const [nick_, setNick] = useState(nick())
  const deep = mode === 'guest' || codeFromUrl()

  // 战绩：从本机存的历史里读（大厅每次挂载都会重跑，回大厅即刷新）
  useEffect(() => {
    setStats(loadStats())
  }, [])

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

          <div className="mt-6">
            <span className="text-sm text-muted">AI 难度</span>
            <div className="mt-2 flex gap-2" data-testid="ai-level">
              {AI_LEVELS.map((l) => (
                <button
                  key={l.v}
                  onClick={() => useStore.setState({ aiLevel: l.v })}
                  className={[
                    'flex-1 rounded-control border px-2 py-2 text-left',
                    aiLevel === l.v ? 'border-accent bg-accent/10' : 'border-control bg-surface',
                  ].join(' ')}
                  aria-pressed={aiLevel === l.v}
                  data-testid={`ai-level-${l.v}`}
                >
                  <span className="block text-sm text-ink">{l.label}</span>
                  <span className="block text-[12px] text-faint">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <button
              className="btn btn-primary min-h-11 w-full"
              onClick={() => {
                if (saved) {
                  resumeSolo(saved.match, saved.aiLevel, saved.archive)
                  setSaved(null)
                } else {
                  startSolo()
                }
              }}
              data-testid={saved ? 'resume-solo' : 'solo'}
            >
              {saved
                ? saved.match.phase === 'ended'
                  ? `查看上一局结算（${saved.match.history.length} 局）`
                  : `继续上一局 · 第 ${saved.match.history.length + 1} 局（打 ${levelLabel(saved.match.handLevel)}）`
                : '单机开局（+3 AI）'}
            </button>
            {saved && (
              <button
                className="btn btn-secondary min-h-11 w-full"
                onClick={startSolo}
                data-testid="solo"
              >
                新开一局（+3 AI）
              </button>
            )}
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
              onClick={() => setShowHelp(true)}
              data-testid="open-help"
            >
              玩法说明
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
              <CardFace key={c.id} card={c} size="sm" />
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

          {stats.length > 0 && (
            <>
              <h2 className="mt-6 border-t border-rule pt-4 text-base text-ink">最近战绩</h2>
              <p className="mt-1 text-[13px] text-muted">
                共 {stats.length} 局 · 胜率 {Math.round((winRate(stats) ?? 0) * 100)}%
              </p>
              <div className="mt-2 space-y-1.5" data-testid="recent-stats">
                {stats
                  .slice(-5)
                  .reverse()
                  .map((r) => (
                    <div key={r.at} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className={r.win ? 'text-accent' : 'text-muted'}>
                        {r.win ? `胜 · +${r.delta} 级` : '负'}
                      </span>
                      <span className="num text-faint">
                        {r.levels[0]} : {r.levels[1]}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
      {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}
    </div>
  )
}
