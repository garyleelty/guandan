import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { Lobby } from './ui/Lobby'
import { Table } from './ui/Table'
import { RoomView } from './ui/RoomView'
import { aiMove, aiTributeMove } from './core/ai'
import { joinRoom } from './net/guest'
import { decodeReplay, encodeReplay, replayFromState, type ReplayData } from './core/replay'
import { ReplayView } from './ui/ReplayView'
import { codeFromUrl } from './net/room'

export default function App() {
  const screen = useStore((s) => s.screen)
  const match = useStore((s) => s.match)
  const mode = useStore((s) => s.mode)
  const [replay, setReplay] = useState<ReplayData | null>(null)

  // 分享出来的复盘链接：?replay=xxx
  useEffect(() => {
    const frag = new URLSearchParams(window.location.search).get('replay')
    if (!frag) return
    let alive = true
    void decodeReplay(frag).then((d) => {
      if (alive && d) setReplay(d)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const r = codeFromUrl()
    if (r && useStore.getState().screen === 'lobby') {
      useStore.setState({ mode: 'guest', screen: 'room' })
      // ?watch=1 只看牌不上桌（观战）
      const watch = new URLSearchParams(window.location.search).get('watch') === '1'
      joinRoom(r, { watch })
      return
    }
    // ?solo=1 直达牌桌（分享单机局 / 验收截图用）
    if (new URLSearchParams(window.location.search).get('solo') === '1' && useStore.getState().screen === 'lobby') {
      useStore.getState().startSolo()
    }
  }, [])

  // 进贡阶段：AI 交贡 / 抗贡 / 还牌
  useEffect(() => {
    if (!match || match.phase !== 'tribute') return
    if (mode === 'guest') return
    const turn = match.turn
    const p = match.players[turn]!
    if (!p.isBot) return
    const t = setTimeout(() => {
      const cur = useStore.getState().match
      if (!cur || cur.phase !== 'tribute' || cur.turn !== turn) return
      useStore.getState().dispatch(aiTributeMove(cur, turn))
    }, 700)
    return () => clearTimeout(t)
  }, [match, mode])

  useEffect(() => {
    if (!match || match.phase !== 'playing') return
    if (mode === 'guest') return
    const turn = match.turn
    const p = match.players[turn]!
    if (!p.isBot) return
    const delay = match.trick.table ? 350 : 750
    const t = setTimeout(() => {
      const cur = useStore.getState().match
      if (!cur || cur.phase !== 'playing' || cur.turn !== turn) return
      const mv = aiMove(cur, turn)
      useStore.getState().dispatch(mv)
    }, delay)
    return () => clearTimeout(t)
  }, [match, mode])

  // 调试钩子：验收脚本可驱动 AI 打完整局（含进贡）
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__gdAi = aiMove
    ;(window as unknown as Record<string, unknown>).__gdTribute = aiTributeMove
    ;(window as unknown as Record<string, unknown>).__gdReplay = { encodeReplay, replayFromState }
  }, [])

  if (replay) return <ReplayView data={replay} />
  if (screen === 'room') return <RoomView />
  if (screen === 'table' && match) return <Table />
  return <Lobby />
}
