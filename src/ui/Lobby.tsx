import { useState } from 'react'
import { useStore } from '../state/store'
import { createRoom } from '../net/host'
import { nick } from '../net/host'
import { codeFromUrl } from '../net/room'


export function Lobby() {
  const startSolo = useStore((s) => s.startSolo)
  const mode = useStore((s) => s.mode)
  const [nick_, setNick] = useState(nick())
  const deep = mode === 'guest' || codeFromUrl()
  if (deep)
    return (
      <div className="grid h-full place-items-center">
        <div className="text-sm text-ink3">正在进入房间…</div>
      </div>
    )
  return (
    <div className="grid h-full place-items-center px-4">
      <div
        className="w-full max-w-md rounded-[28px] px-8 py-9 text-center"
        style={{ background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(14px) saturate(1.4)', border: '1px solid rgba(0,0,0,.04)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="text-4xl font-black tracking-tight text-ink">掼 蛋</div>
        <div className="mt-1 text-sm text-ink3">Apple 浅色 · P2P 联机版</div>
        <div className="mx-auto mt-5 flex max-w-[220px] items-center gap-2">
          <input
            value={nick_}
            onChange={(e) => setNick(e.target.value.slice(0, 8))}
            onBlur={() => localStorage.setItem('gd-nick', nick_)}
            className="w-full rounded-xl bg-white px-3 py-2 text-center text-sm shadow-card"
            placeholder="你的昵称"
            data-testid="nick"
          />
        </div>
        <div className="mt-6 space-y-3">
          <button className="btn btn-primary w-full py-3 text-base" onClick={startSolo} data-testid="solo">
            单机开局（+3 AI）
          </button>
          <button
            className="btn btn-ghost w-full py-3 text-base"
            onClick={() => {
              createRoom()
            }}
            data-testid="create-room"
          >
            创建房间（P2P）
          </button>
          <button
            className="btn btn-ghost w-full py-3 text-base"
            onClick={() => {
              useStore.setState({ mode: 'guest' })
            }}
            data-testid="join-room"
          >
            通过链接加入
          </button>
        </div>
        <div className="mt-8 text-[11px] text-ink3">双人成对 · 对家搭档 · 好 2 不赢 · A 级双下夺局</div>
      </div>
    </div>
  )
}
