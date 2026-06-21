import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerCardMini, PlayerCardDetail } from '../components/PlayerCard'

export default function Cards() {
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [awardsMap, setAwardsMap] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: st }, { data: aw }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.rpc('award_counts'), // See note below — fallback below
      ])

      setPlayers(pl || [])

      const sm = {}
      ;(st || []).forEach(s => { sm[s.player_id] = s })
      setStatsMap(sm)

      // Award counts: group by player + type
      // If RPC not set up yet, fetch raw and group here
      const { data: rawAwards } = await supabase
        .from('awards')
        .select('player_id, award_type')

      const am = {}
      ;(rawAwards || []).forEach(a => {
        if (!am[a.player_id]) am[a.player_id] = {}
        am[a.player_id][a.award_type] = (am[a.player_id][a.award_type] || 0) + 1
      })
      // Convert to array format
      const amArr = {}
      Object.entries(am).forEach(([pid, types]) => {
        amArr[pid] = Object.entries(types).map(([award_type, count]) => ({ award_type, count }))
      })
      setAwardsMap(amArr)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="loading">Henter spillere...</div>

  if (selected) {
    const p = players.find(x => x.id === selected)
    return (
      <PlayerCardDetail
        player={p}
        stats={statsMap[selected]}
        awards={awardsMap[selected] || []}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Spillerkort</span>
        <span className="page-sub">{players.length} spillere</span>
      </div>
      <div className="card-grid">
        {players.map(p => (
          <PlayerCardMini
            key={p.id}
            player={p}
            stats={statsMap[p.id]}
            onClick={() => setSelected(p.id)}
          />
        ))}
      </div>
    </>
  )
}
