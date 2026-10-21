import { useState, type ReactNode } from 'react'
import { HelpSheet } from './HelpSheet'
import { useStore } from '../state/store'
import { hostAddAi, hostKick, hostRemoveAi, hostStart, destroyRoom } from '../net/host'
import { joinRoom, leaveGuest } from '../net/guest'
import { shareLink, codeFromUrl } from '../net/room'
import type { Seat } from '../core/engine'

type RoomSeats = ReturnType<typeof useStore.getState>['roomSeats']

export function RoomView() {
  const mode = useStore((s) => s.mode)
  const code = useStore((s) => s.roomCode)
  const seats = useStore((s) => s.roomSeats)
  const joining = useStore((s) => s.joining)
  const lost = useStore((s) => s.guestLost)
  const kicked = useStore((s) => s.kicked)
  const [codeInput, setCodeInput] = useState(codeFromUrl() ?? '')
  const [showHelp, setShowHelp] = useState(false)

  if (mode === 'guest') {
    if (lost)
      return (
        <div className="grid h-full place-items-center px-4">
          <div className="panel w-full max-w-[480px] p-6">
            <h2 className="text-base font-semibold text-ink">{kicked || '连接断开'}</h2>
            <button
              className="btn btn-secondary mt-4 w-full"
              onClick={() => useStore.getState().backToLobby()}
            >
              返回大厅
            </button>
            <p className="mt-3 text-xs text-muted">
              {kicked ? '你可以回大厅重新开一局，或等房主再拉你。' : '与房主的连接已断开，牌局由 AI 继续。'}
            </p>
          </div>
        </div>
      )
    if (joining) return <Centered>正在连接房间…</Centered>
    if (!seats)
      return (
        <div className="grid h-full place-items-center px-4">
          <div className="w-full max-w-[480px] text-center">
            <h2 className="text-xl font-semibold text-ink">输入房码</h2>
            <div className="mt-6 flex items-center justify-center gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="h-10 w-48 rounded-control border border-control bg-surface text-center font-mono text-xl tracking-[0.3em] text-ink placeholder:text-faint"
                maxLength={6}
                placeholder="ABC123"
                data-testid="code-input"
              />
              <button
                className="btn btn-primary"
                data-testid="join-go"
                onClick={() => joinRoom(codeInput)}
              >
                加入
              </button>
            </div>
            <p className="mt-2 h-4 text-xs text-negative">
              {codeInput.length === 6 && !/^[2-9A-HJKMNP-Z]{6}$/.test(codeInput) ? '房码格式不对' : ''}
            </p>
          </div>
        </div>
      )
    return (
      <>
        <GuestWaiting code={code} seats={seats} onHelp={() => setShowHelp(true)} />
        {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}
      </>
    )
  }

  return (
    <>
      <HostSide code={code} seats={seats} />
      {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}
    </>
  )
}

/** 客人的等候室：谁来了、还差几个、房号多少，都摆明白。 */
function GuestWaiting({
  code,
  seats,
  onHelp,
}: {
  code: string | null
  seats: RoomSeats
  onHelp: () => void
}) {
  const list = seats ?? []
  const aiLevel = useStore((s) => s.aiLevel)
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8">
      <div className="panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">等候开局</h1>
          <div className="num text-2xl font-semibold tracking-[0.2em] text-accent">{code ?? ''}</div>
        </div>
        <p className="mt-2 text-sm text-muted">已加入，等房主开局…</p>

        <div className="mt-4 divide-y divide-rule border-y border-rule">
          {list.map((s) => (
            <div key={s.seat} className="flex h-11 items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-sm text-ink">{SEAT_LABEL[s.seat]}</span>
                {s.kind === 'empty' ? (
                  <span className="text-sm text-faint">虚位</span>
                ) : (
                  <>
                    <span
                      className={
                        s.kind === 'ai' ? 'truncate text-sm text-muted' : 'truncate text-sm text-accent'
                      }
                    >
                      {s.name}
                    </span>
                    <span className="chip">{s.kind === 'ai' ? 'AI' : '玩家'}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <span>AI 难度</span>
          <span className="chip">{['简单', '普通', '难'][aiLevel]}</span>
          <button
            className="btn btn-ghost btn-sm ml-auto"
            onClick={onHelp}
            data-testid="room-help"
          >
            玩法说明
          </button>
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-4">
      <p className="text-center text-sm text-muted">{children}</p>
    </div>
  )
}

const SEAT_LABEL = ['本座（房东）', '右家', '对家', '左家'] as const

const AI_LEVELS: { v: 0 | 1 | 2; label: string }[] = [
  { v: 0, label: '简单' },
  { v: 1, label: '普通' },
  { v: 2, label: '难' },
]

function HostSide({ code, seats }: { code: string | null; seats: RoomSeats }) {
  const link = code ? shareLink(code) : ''
  const seatList = seats ?? []
  const aiLevel = useStore((s) => s.aiLevel)
  const watchLink = code ? `${shareLink(code)}&watch=1` : ''
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8">
      <div className="panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">房间</h1>
          <div className="num text-2xl font-semibold tracking-[0.2em] text-accent">{code}</div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={link}
            className="h-9 min-w-0 flex-1 rounded-control border border-line bg-raised px-3 text-xs font-mono text-muted"
            data-testid="room-link"
          />
          <button
            className="btn btn-secondary btn-sm shrink-0"
            data-testid="copy-link"
            onClick={() => {
              navigator.clipboard?.writeText(link)
            }}
          >
            复制
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={watchLink}
            className="h-9 min-w-0 flex-1 rounded-control border border-line bg-raised px-3 text-xs font-mono text-muted"
            data-testid="watch-link"
          />
          <button
            className="btn btn-secondary btn-sm shrink-0"
            onClick={() => {
              navigator.clipboard?.writeText(watchLink)
            }}
            data-testid="copy-watch-link"
          >
            复制观战链接
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-faint">发给朋友，他们可以只看牌不上桌</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-muted">AI 难度</span>
          <div className="ml-auto flex gap-1.5" data-testid="room-ai-level">
            {AI_LEVELS.map((l) => (
              <button
                key={l.v}
                onClick={() => useStore.setState({ aiLevel: l.v })}
                className={[
                  'rounded-control border px-3 py-1 text-[13px]',
                  aiLevel === l.v
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-control bg-surface text-muted',
                ].join(' ')}
                aria-pressed={aiLevel === l.v}
                data-testid={`room-ai-level-${l.v}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 divide-y divide-rule border-y border-rule">
          {seatList.map((s) => (
            <div key={s.seat} className="flex h-11 items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-sm text-ink">{SEAT_LABEL[s.seat]}</span>
                {s.kind === 'empty' ? (
                  <span className="text-sm text-faint">虚位</span>
                ) : (
                  <>
                    <span
                      className={
                        s.kind === 'ai' ? 'truncate text-sm text-muted' : 'truncate text-sm text-accent'
                      }
                    >
                      {s.name}
                    </span>
                    <span className="chip">{s.kind === 'ai' ? 'AI' : '玩家'}</span>
                  </>
                )}
              </div>
              {s.seat !== 0 && (
                <div className="shrink-0">
                  {s.kind === 'empty' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => hostAddAi(s.seat as Seat)}
                    >
                      +AI
                    </button>
                  )}
                  {s.kind === 'ai' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => hostRemoveAi(s.seat as Seat)}
                    >
                      移除
                    </button>
                  )}
                  {s.kind === 'guest' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => hostKick(s.seat as Seat)}
                      title="请这位玩家离开房间"
                      data-testid={`kick-${s.seat}`}
                    >
                      移出
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary mt-6 min-h-11 w-full"
          disabled={seatList.some((s) => s.kind === 'empty')}
          onClick={() => hostStart()}
          data-testid="host-start"
        >
          开始对局
        </button>
        <button
          className="btn btn-ghost mt-2 w-full"
          onClick={() => {
            destroyRoom()
            leaveGuest()
            useStore.getState().backToLobby()
          }}
        >
          取消房间
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          房东固定本座；把链接发给朋友补位，虚位由 AI 代打。中途掉线的玩家由 AI 接手。
        </p>
      </div>
    </div>
  )
}
