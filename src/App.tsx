import { useEffect } from 'react'
import { useStore } from './state/store'
import { Lobby } from './ui/Lobby'
import { Table } from './ui/Table'
import { RoomView } from './ui/RoomView'
import { aiMove } from './core/ai'
import { joinRoom } from './net/guest'
import { codeFromUrl } from './net/room'

export default function App() {
  const screen = useStore((s) => s.screen)
  const match = useStore((s) => s.match)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    const r = codeFromUrl()
    if (r && useStore.getState().screen === 'lobby') {
      useStore.setState({ mode: 'guest', screen: 'room' })
      joinRoom(r)
    }
  }, [])

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

  if (screen === 'room') return <RoomView />
  if (screen === 'table' && match) return <Table />
  return <Lobby />
}
