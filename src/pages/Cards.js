import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerCardMini, PlayerCardDetail } from '../components/PlayerCard'

export default function Cards() {
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [awardsMap, setAwardsMap] = useState({})
  const [partnerMap, setPartnerMap] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: st }, { data: rawAwards }, { data: ps }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.from('awards').select('player_id, award_type'),
        supabase.from('partner_stats').select('*, partner:partner_id(name, initials, color)'),
      ])

      setPlayers(pl || [])

      const sm = {}
      ;(st || []).forEach(s => { sm[s.player_id] = s })
      setStatsMap(sm)

      const am = {}
      ;(rawAwards || []).forEach(a => {
        if (!am[a.player_id]) am[a.player_id] = {}
        am[a.player_id][a.award_type] = (am[a.player_id][a.award_type] || 0) + 1
      })
      const amArr = {}
      Object.entries(am).forEach(([pid, types]) => {
        amArr[pid] = Object.entries(types).map(([award_type, count]) => ({ award_type, count }))
      })
      setAwardsMap(amArr)

      // Gruppér partner stats per spiller
      const pm = {}
      ;(ps || []).forEach(p => {
        if (!pm[p.player_id]) pm[p.player_id] = []
        pm[p.player_id].push(p)
      })
      // Sorter efter point
      Object.keys(pm).forEach(pid => {
        pm[pid].sort((a, b) => b.points_together - a.points_together)
      })
      setPartnerMap(pm)
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
        partnerStats={partnerMap[selected] || []}
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
