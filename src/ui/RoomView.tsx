import { useState } from 'react'
import { useStore } from '../state/store'
import { hostAddAi, hostRemoveAi, hostStart, destroyRoom } from '../net/host'
import { joinRoom, leaveGuest } from '../net/guest'
import { shareLink, codeFromUrl } from '../net/room'
import type { Seat } from '../core/engine'

export function RoomView() {
  const mode = useStore((s) => s.mode)
  const code = useStore((s) => s.roomCode)
  const seats = useStore((s) => s.roomSeats)
  const joining = useStore((s) => s.joining)
  const lost = useStore((s) => s.guestLost)
  const [codeInput, setCodeInput] = useState(codeFromUrl() ?? '')

  if (mode === 'guest') {
    if (lost)
      return (
        <Centered>
          <div className="text-base font-bold text-ink">连接断开</div>
          <button className="btn btn-primary mt-4" onClick={() => useStore.getState().backToLobby()}>
            返回大厅
          </button>
        </Centered>
      )
    if (joining) return <Centered>正在连接房间…</Centered>
    if (!seats)
      return (
        <Centered>
          <div className="text-base font-bold text-ink">输入房码</div>
          <div className="mt-4 flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              className="w-44 rounded-xl bg-white px-3 py-2 text-center font-mono text-lg tracking-widest shadow-card"
              maxLength={6}
              placeholder="ABC123"
              data-testid="code-input"
            />
            <button className="btn btn-primary" data-testid="join-go" onClick={() => joinRoom(codeInput)}>
              加入
            </button>
          </div>
          <div className="mt-2 text-[11px] text-rose-500">
            {codeInput.length === 6 && !/^[2-9A-HJKMNP-Z]{6}$/.test(codeInput) ? '房码格式不对' : ''}
          </div>
        </Centered>
      )
    return <Centered>已加入，等待房东开局…</Centered>
  }

  return <HostSide code={code} seats={seats} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center text-sm text-ink3">{children}</div>
}

const SEAT_LABEL = ['本座（房东）', '右家', '对家', '左家'] as const

function HostSide({ code, seats }: { code: string | null; seats: ReturnType<typeof useStore.getState>['roomSeats'] }) {
  const link = code ? shareLink(code) : ''
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div
        className="rounded-[28px] bg-white/70 px-6 py-6 backdrop-blur"
        style={{ boxShadow: 'var(--shadow-soft)', border: '1px solid rgba(0,0,0,.04)' }}
      >
        <div className="text-xl font-bold text-ink">房间 {code}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink3">
          <input readOnly value={link} className="w-full rounded-lg bg-paper px-2 py-1 font-mono text-[11px]" data-testid="room-link" />
          <button
            className="btn btn-ghost shrink-0 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(link)
            }}
          >
            复制
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {seats!.map((s) => (
            <div key={s.seat} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-card">
              <div className="text-sm font-semibold text-ink">
                {SEAT_LABEL[s.seat]} ·{' '}
                <span className={s.kind === 'empty' ? 'text-ink3' : s.kind === 'ai' ? 'text-orange' : 'text-blue'}>
                  {s.kind === 'empty' ? '虚位' : s.name}
                </span>
              </div>
              {s.seat !== 0 && (
                <div className="flex gap-1.5">
                  {s.kind === 'empty' && (
                    <button className="btn btn-ghost text-xs" onClick={() => hostAddAi(s.seat as Seat)}>
                      +AI
                    </button>
                  )}
                  {s.kind === 'ai' && (
                    <button className="btn btn-ghost text-xs" onClick={() => hostRemoveAi(s.seat as Seat)}>
                      移除
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          className="btn btn-primary mt-5 w-full py-3"
          disabled={seats!.some((s) => s.kind === 'empty')}
          onClick={() => hostStart()}
          data-testid="host-start"
        >
          开始对局
        </button>
        <button
          className="btn btn-ghost mt-2 w-full py-2 text-sm"
          onClick={() => {
            destroyRoom()
            leaveGuest()
            useStore.getState().backToLobby()
          }}
        >
          取消房间
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-ink3">
          房东固定本座；把链接发给朋友补位，虚位由 AI 代打。中途掉线的玩家由 AI 接手。
        </p>
      </div>
    </div>
  )
}
