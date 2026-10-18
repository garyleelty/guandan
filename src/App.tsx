import { useEffect } from 'react'
import { useStore } from './state/store'
import { Lobby } from './ui/Lobby'
import { Table } from './ui/Table'
import { aiMove } from './core/ai'

export default function App() {
  const screen = useStore((s) => s.screen)
  const match = useStore((s) => s.match)

  useEffect(() => {
    if (!match || match.phase !== 'playing') return
    const turn = match.turn
    if (!match.players[turn]!.isBot) return
    const delay = match.trick.table ? 350 : 750
    const t = setTimeout(() => {
      const cur = useStore.getState().match
      if (!cur || cur.phase !== 'playing' || cur.turn !== turn) return
      const mv = aiMove(cur, turn)
      useStore.getState().dispatch(mv)
    }, delay)
    return () => clearTimeout(t)
  }, [match])

  return screen === 'lobby' || !match ? <Lobby /> : <Table />
}
