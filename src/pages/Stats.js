import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { AppContext } from '../App'

export default function Stats() {
  const { clubs, selectedClub } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [matchPlayers, setMatchPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [clubPlayers, setClubPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchTypeFilter, setMatchTypeFilter] = useState('all') // 'all' | 'official' | 'training'
  const [sortBy, setSortBy] = useState('matches_played')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: mp }, { data: m }, { data: cp }] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('match_players').select('*, matches(match_type, club_id, set1_us, set1_them, set2_us, set2_them, set3_us, set3_them, score_us, score_them)'),
        supabase.from('matches').select('*').not('score_us', 'is', null),
        supabase.from('club_players').select('*'),
      ])
      setPlayers(pl || [])
      setMatchPlayers(mp || [])
      setMatches(m || [])
      setClubPlayers(cp || [])
      setLoading(false)
    }
    load()
  }, [])

  // Filtrer match_players baseret på hold og kamptype
  const filtered = matchPlayers.filter(mp => {
    if (!mp.matches) return false
    if (matchTypeFilter !== 'all' && mp.matches.match_type !== matchTypeFilter) return false
    if (selectedClub && mp.matches.club_id !== selectedClub) return false
    return true
  })

  // Filtrer spillere baseret på valgt hold
  const visiblePlayerIds = selectedClub
    ? clubPlayers.filter(cp => cp.club_id === selectedClub).map(cp => cp.player_id)
    : players.map(p => p.id)

  // Beregn statistik per spiller
  const stats = visiblePlayerIds.map(pid => {
    const p = players.find(x => x.id === pid)
    if (!p) return null
    const rows = filtered.filter(mp => mp.player_id === pid)

    let matches_played = rows.length
    let matches_won = rows.filter(r => r.won).length
    let matches_lost = matches_played - matches_won
    let matches_won_to_zero = 0
    let sets_won = 0, sets_lost = 0
    let games_won = 0, games_lost = 0

    rows.forEach(r => {
      const m = r.matches
      if (!m) return
      const sets = [
        m.set1_us != null ? [Number(m.set1_us), Number(m.set1_them)] : null,
        m.set2_us != null ? [Number(m.set2_us), Number(m.set2_them)] : null,
        m.set3_us != null ? [Number(m.set3_us), Number(m.set3_them)] : null,
      ].filter(Boolean)

      // Sæt vundet/tabt (fra spillerens perspektiv)
      // r.won = true means they were on winning side (us)
      sets.forEach(([us, them]) => {
        const playerWonSet = r.won ? us > them : them > us
        if (playerWonSet) {
          sets_won++
          games_won += r.won ? us : them
          games_lost += r.won ? them : us
        } else {
          sets_lost++
          games_won += r.won ? us : them
          games_lost += r.won ? them : us
        }
      })

      // Kampe vundet til nul (2-0 i sæt)
      if (r.won) {
        const setsWonCount = Number(m.score_us || 0)
        const setsLostCount = Number(m.score_them || 0)
        if (setsWonCount === 2 && setsLostCount === 0) matches_won_to_zero++
      }
    })

    return {
      player: p,
      matches_played,
      matches_won,
      matches_lost,
      match_diff: matches_won - matches_lost,
      sets_won,
      sets_lost,
      set_diff: sets_won - sets_lost,
      games_won,
      games_lost,
      game_diff: games_won - games_lost,
      matches_won_to_zero,
    }
  }).filter(Boolean)

  // Sortering
  const sorted = [...stats].sort((a, b) => {
    const av = a[sortBy] ?? 0
    const bv = b[sortBy] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: '#ccc', fontSize: 9 }}> ↕</span>
    return <span style={{ color: '#2d9e62', fontSize: 9 }}> {sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const thStyle = (col) => ({
    padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#fff',
    background: sortBy === col ? 'rgba(45,158,98,0.3)' : 'rgba(255,255,255,0.08)',
    cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    userSelect: 'none'
  })

  const tdStyle = (highlight) => ({
    padding: '8px 6px', fontSize: 12, textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontWeight: highlight ? 700 : 400,
    color: highlight ? '#1a7a4a' : 'var(--color-text-primary)',
  })

  const diffStyle = (val) => ({
    ...tdStyle(false),
    color: val > 0 ? '#1a7a4a' : val < 0 ? '#e24b4a' : 'var(--color-text-secondary)',
    fontWeight: 600,
  })

  if (loading) return <div className="loading">Henter statistik...</div>

  const currentClub = clubs.find(c => c.id === selectedClub)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
          Statistik — {currentClub ? currentClub.name : 'Alle hold'}
        </div>

        {/* Filtre */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all','Alle kampe'],['official','Officielle'],['training','Træning']].map(([val, label]) => (
            <button key={val} onClick={() => setMatchTypeFilter(val)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                background: matchTypeFilter === val ? '#1a7a4a' : 'var(--color-background-secondary)',
                color: matchTypeFilter === val ? '#fff' : 'var(--color-text-secondary)',
              }}>{label}</button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📈</div>
          <div className="empty-text">Ingen kampdata endnu</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle('name'), textAlign: 'left', paddingLeft: 12 }}>Navn</th>
                <th style={thStyle('matches_played')} onClick={() => handleSort('matches_played')}>Kampe<SortIcon col="matches_played"/></th>
                <th style={thStyle('matches_won')} onClick={() => handleSort('matches_won')}>Sejre<SortIcon col="matches_won"/></th>
                <th style={thStyle('matches_lost')} onClick={() => handleSort('matches_lost')}>Neder.<SortIcon col="matches_lost"/></th>
                <th style={thStyle('match_diff')} onClick={() => handleSort('match_diff')}>Diff.<SortIcon col="match_diff"/></th>
                <th style={thStyle('sets_won')} onClick={() => handleSort('sets_won')}>Sæt +<SortIcon col="sets_won"/></th>
                <th style={thStyle('sets_lost')} onClick={() => handleSort('sets_lost')}>Sæt -<SortIcon col="sets_lost"/></th>
                <th style={thStyle('set_diff')} onClick={() => handleSort('set_diff')}>Diff.<SortIcon col="set_diff"/></th>
                <th style={thStyle('games_won')} onClick={() => handleSort('games_won')}>Partier +<SortIcon col="games_won"/></th>
                <th style={thStyle('games_lost')} onClick={() => handleSort('games_lost')}>Partier -<SortIcon col="games_lost"/></th>
                <th style={thStyle('game_diff')} onClick={() => handleSort('game_diff')}>Diff.<SortIcon col="game_diff"/></th>
                <th style={thStyle('matches_won_to_zero')} onClick={() => handleSort('matches_won_to_zero')}>2-0<SortIcon col="matches_won_to_zero"/></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.player.id} style={{ background: i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                  <td style={{ ...tdStyle(false), textAlign: 'left', paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.player.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {s.player.initials}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.player.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle(false)}>{s.matches_played}</td>
                  <td style={{ ...tdStyle(false), color: '#1a7a4a', fontWeight: 600 }}>{s.matches_won}</td>
                  <td style={{ ...tdStyle(false), color: '#e24b4a' }}>{s.matches_lost}</td>
                  <td style={diffStyle(s.match_diff)}>{s.match_diff > 0 ? '+' : ''}{s.match_diff}</td>
                  <td style={tdStyle(false)}>{s.sets_won}</td>
                  <td style={tdStyle(false)}>{s.sets_lost}</td>
                  <td style={diffStyle(s.set_diff)}>{s.set_diff > 0 ? '+' : ''}{s.set_diff}</td>
                  <td style={tdStyle(false)}>{s.games_won}</td>
                  <td style={tdStyle(false)}>{s.games_lost}</td>
                  <td style={diffStyle(s.game_diff)}>{s.game_diff > 0 ? '+' : ''}{s.game_diff}</td>
                  <td style={{ ...tdStyle(false), color: '#c9a227', fontWeight: 600 }}>{s.matches_won_to_zero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 10, textAlign: 'center' }}>
        Tryk på kolonneoverskrift for at sortere · 2-0 = kampe vundet til nul
      </div>
    </div>
  )
}
