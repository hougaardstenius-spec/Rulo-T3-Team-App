import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { AppContext } from '../App'

export default function Stats() {
  const { clubs, selectedClub } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [matchPlayers, setMatchPlayers] = useState([])
  const [clubPlayers, setClubPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('matches_played')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: mp }, { data: cp }] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('match_players').select('*, matches(match_type, club_id, set1_us, set1_them, set2_us, set2_them, set3_us, set3_them, score_us, score_them)'),
        supabase.from('club_players').select('*'),
      ])
      setPlayers(pl || [])
      setMatchPlayers(mp || [])
      setClubPlayers(cp || [])
      setLoading(false)
    }
    load()
  }, [])

  // Spillere der skal vises baseret på valgt hold
  const visiblePlayerIds = selectedClub
    ? clubPlayers.filter(cp => cp.club_id === selectedClub).map(cp => cp.player_id)
    : players.map(p => p.id)

  // Statistik tæller kun officielle holdkampe — ikke træningskampe.
  // Filtreres ikke på club_id: spilleren tæller uanset hvilket hold kampen var mod.
  const filteredByType = matchPlayers.filter(mp => mp.matches?.match_type === 'official')

  // Beregn statistik per spiller
  const stats = visiblePlayerIds.map(pid => {
    const p = players.find(x => x.id === pid)
    if (!p) return null
    const rows = filteredByType.filter(mp => mp.player_id === pid)

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

      sets.forEach(([us, them]) => {
        const playerWonSet = r.won ? us > them : them > us
        const myGames = r.won ? us : them
        const theirGames = r.won ? them : us
        if (playerWonSet) { sets_won++ } else { sets_lost++ }
        games_won += myGames
        games_lost += theirGames
      })

      if (r.won) {
        const setsWon = Number(m.score_us || 0)
        const setsLost = Number(m.score_them || 0)
        if (setsWon === 2 && setsLost === 0) matches_won_to_zero++
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
    if (sortBy !== col) return <span aria-hidden="true" style={{ color: '#ccc', fontSize: 9 }}> ↕</span>
    return <span aria-hidden="true" style={{ color: '#2d9e62', fontSize: 9 }}> {sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const thStyle = (col) => ({
    padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#fff',
    background: sortBy === col ? 'rgba(45,158,98,0.3)' : 'rgba(255,255,255,0.08)',
    cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none'
  })

  const sortableThProps = (col, label) => ({
    style: thStyle(col),
    onClick: () => handleSort(col),
    onKeyDown: e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleSort(col)),
    tabIndex: 0,
    'aria-sort': sortBy === col ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none',
    'aria-label': `Sortér efter ${label}`,
  })

  const diffStyle = (val) => ({
    padding: '8px 6px', fontSize: 12, textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    color: val > 0 ? '#1a7a4a' : val < 0 ? '#e24b4a' : 'var(--color-text-secondary)',
    fontWeight: 600,
  })

  const tdStyle = () => ({
    padding: '8px 6px', fontSize: 12, textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  })

  if (loading) return <div className="loading">Henter statistik...</div>

  const currentClub = clubs.find(c => c.id === selectedClub)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
          Statistik — {currentClub ? currentClub.name : 'Alle hold'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Kun officielle holdkampe tæller med</div>
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
                <th style={{ ...thStyle('name'), textAlign: 'left', paddingLeft: 12, cursor: 'default' }}>Navn</th>
                <th {...sortableThProps('matches_played', 'Kampe')}>Kampe<SortIcon col="matches_played"/></th>
                <th {...sortableThProps('matches_won', 'Sejre')}>Sejre<SortIcon col="matches_won"/></th>
                <th {...sortableThProps('matches_lost', 'Nederlag')}>Neder.<SortIcon col="matches_lost"/></th>
                <th {...sortableThProps('match_diff', 'Kampdifference')}>Diff.<SortIcon col="match_diff"/></th>
                <th {...sortableThProps('sets_won', 'Sæt vundet')}>Sæt +<SortIcon col="sets_won"/></th>
                <th {...sortableThProps('sets_lost', 'Sæt tabt')}>Sæt -<SortIcon col="sets_lost"/></th>
                <th {...sortableThProps('set_diff', 'Sætdifference')}>Diff.<SortIcon col="set_diff"/></th>
                <th {...sortableThProps('games_won', 'Partier vundet')}>Partier +<SortIcon col="games_won"/></th>
                <th {...sortableThProps('games_lost', 'Partier tabt')}>Partier -<SortIcon col="games_lost"/></th>
                <th {...sortableThProps('game_diff', 'Partidifference')}>Diff.<SortIcon col="game_diff"/></th>
                <th {...sortableThProps('matches_won_to_zero', '2-0 sejre')}>2-0<SortIcon col="matches_won_to_zero"/></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.player.id} style={{ background: i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                  <td style={{ ...tdStyle(), textAlign: 'left', paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.player.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {s.player.initials}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.player.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle()}>{s.matches_played}</td>
                  <td style={{ ...tdStyle(), color: '#1a7a4a', fontWeight: 600 }}>{s.matches_won}</td>
                  <td style={{ ...tdStyle(), color: '#e24b4a' }}>{s.matches_lost}</td>
                  <td style={diffStyle(s.match_diff)}>{s.match_diff > 0 ? '+' : ''}{s.match_diff}</td>
                  <td style={tdStyle()}>{s.sets_won}</td>
                  <td style={tdStyle()}>{s.sets_lost}</td>
                  <td style={diffStyle(s.set_diff)}>{s.set_diff > 0 ? '+' : ''}{s.set_diff}</td>
                  <td style={tdStyle()}>{s.games_won}</td>
                  <td style={tdStyle()}>{s.games_lost}</td>
                  <td style={diffStyle(s.game_diff)}>{s.game_diff > 0 ? '+' : ''}{s.game_diff}</td>
                  <td style={{ ...tdStyle(), color: '#c9a227', fontWeight: 600 }}>{s.matches_won_to_zero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 10, textAlign: 'center' }}>
        Tryk på kolonneoverskrift for at sortere · 2-0 = kampe vundet til nul · træningskampe tæller ikke med
      </div>
    </div>
  )
}
