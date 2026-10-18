import { useStore } from '../state/store'

export function Lobby() {
  const startSolo = useStore((s) => s.startSolo)
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="w-full max-w-md rounded-[28px] px-8 py-9 text-center" style={{ background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(14px) saturate(1.4)', border: '1px solid rgba(0,0,0,.04)', boxShadow: 'var(--shadow-soft)' }}>
        <div className="text-4xl font-black tracking-tight text-ink">掼 蛋</div>
        <div className="mt-1 text-sm text-ink3">Apple 浅色 · P2P 联机版</div>
        <div className="mt-8 space-y-3">
          <button className="btn btn-primary w-full py-3 text-base" onClick={startSolo} data-testid="solo">
            单机开局（+3 AI）
          </button>
          <button className="btn btn-ghost w-full py-3 text-base pointer-events-none opacity-60">
            创建房间（P2P · 即将上线）
          </button>
          <button className="btn btn-ghost w-full py-3 text-base pointer-events-none opacity-60">
            通过链接加入（P2P · 即将上线）
          </button>
        </div>
        <div className="mt-8 text-[11px] text-ink3">双人成对 · 对家搭档 · 好 2 不赢 · A 级双下夺局</div>
      </div>
    </div>
  )
}
