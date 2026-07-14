import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerCardMini, PlayerCardDetail } from '../components/PlayerCard'
import { AppContext } from '../App'
import { computeScores } from '../lib/helpers'

const POSITIONS = ['Alle', 'HO', 'VN']
const FILTER_PRESETS = [
  { id: 'overall', label: 'Samlet', key: 'overall' },
  { id: 'off', label: 'Offensiv', key: 'off' },
  { id: 'def', label: 'Defensiv', key: 'def' },
]
const STAT_FILTERS = [
  { group: 'Grundslag', items: [{ key: 'forhnd', label: 'Forhånd' }, { key: 'baghnd', label: 'Baghånd' }]},
  { group: 'Overheads', items: [{ key: 'bandeja', label: 'Bandeja' }, { key: 'vibora', label: 'Vibora' }, { key: 'rulo', label: 'Rulo' }, { key: 'gancho', label: 'Gancho' }, { key: 'smash', label: 'Smash' }]},
  { group: 'Volleys', items: [{ key: 'volley_forhnd', label: 'Forhånd volley' }, { key: 'volley_baghnd', label: 'Baghånd volley' }, { key: 'plano', label: 'Plano' }]},
  { group: 'Omstillingsslag', items: [{ key: 'chiquita', label: 'Chiquita' }, { key: 'lob', label: 'Lob' }]},
  { group: 'Generelt', items: [{ key: 'glasspil', label: 'Glasspil' }, { key: 'spilforstaelse', label: 'Spilforståelse' }, { key: 'bevaegelse', label: 'Bevægelse' }, { key: 'kommunikation', label: 'Kommunikation' }]},
]

function getStatValue(stats, key) {
  if (!stats) return 50
  if (key === 'overall') return computeScores(stats).overall
  if (key === 'off') return computeScores(stats).off
  if (key === 'def') return computeScores(stats).def
  return stats[key] || 50
}

export default function Cards() {
  const { selectedClub, clubs } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [awardsMap, setAwardsMap] = useState({})
  const [partnerMap, setPartnerMap] = useState({})
  const [clubPlayers, setClubPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [posFilter, setPosFilter] = useState('Alle')
  const [sortKey, setSortKey] = useState('overall')
  const [sortDir, setSortDir] = useState('desc')
  const [minRating, setMinRating] = useState(0)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: st }, { data: rawAwards }, { data: ps }, { data: cp }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.from('awards').select('player_id, award_type'),
        supabase.from('partner_stats').select('*, partner:partner_id(name, initials, color)'),
        supabase.from('club_players').select('*'),
      ])
      setPlayers(pl || [])
      setClubPlayers(cp || [])
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
      const pm = {}
      ;(ps || []).forEach(p => {
        if (!pm[p.player_id]) pm[p.player_id] = []
        pm[p.player_id].push(p)
      })
      Object.keys(pm).forEach(pid => { pm[pid].sort((a, b) => b.points_together - a.points_together) })
      setPartnerMap(pm)
      setLoading(false)
    }
    load()
  }, [])

  const visiblePlayerIds = selectedClub
    ? clubPlayers.filter(cp => cp.club_id === selectedClub).map(cp => cp.player_id)
    : players.map(p => p.id)

  let visiblePlayers = players
    .filter(p => visiblePlayerIds.includes(p.id))
    .filter(p => posFilter === 'Alle' || p.position === posFilter)
    .filter(p => !searchText || p.name.toLowerCase().includes(searchText.toLowerCase()))
    .filter(p => getStatValue(statsMap[p.id], sortKey) >= minRating)

  visiblePlayers = [...visiblePlayers].sort((a, b) => {
    const av = getStatValue(statsMap[a.id], sortKey)
    const bv = getStatValue(statsMap[b.id], sortKey)
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const currentClub = clubs.find(c => c.id === selectedClub)
  const hasActiveFilters = posFilter !== 'Alle' || minRating > 0 || searchText || sortKey !== 'overall'
  const resetFilters = () => { setPosFilter('Alle'); setSortKey('overall'); setSortDir('desc'); setMinRating(0); setSearchText('') }

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
        <span className="page-title">{currentClub ? currentClub.name : 'Alle spillere'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #e24b4a', background: 'none', color: '#e24b4a', cursor: 'pointer' }}>Nulstil</button>
          )}
          <button onClick={() => setShowFilters(f => !f)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: showFilters ? '#0d1f2d' : 'none', color: showFilters ? '#fff' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {showFilters ? 'Skjul filtre' : 'Filtre'}{hasActiveFilters ? ' *' : ''}
          </button>
          <span className="page-sub">{visiblePlayers.length} spillere</span>
        </div>
      </div>

      {showFilters && (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>SOG</div>
            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Navn..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>POSITION</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: posFilter === pos ? '#0d1f2d' : 'var(--color-background-secondary)', color: posFilter === pos ? '#fff' : 'var(--color-text-secondary)' }}>
                  {pos === 'HO' ? 'Højre' : pos === 'VN' ? 'Venstre' : pos}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>SORTER EFTER</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {FILTER_PRESETS.map(p => (
                <button key={p.id} onClick={() => setSortKey(p.key)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: sortKey === p.key ? '#1a7a4a' : 'var(--color-background-secondary)', color: sortKey === p.key ? '#fff' : 'var(--color-text-secondary)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {STAT_FILTERS.map(group => (
              <div key={group.group} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{group.group.toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {group.items.map(item => (
                    <button key={item.key} onClick={() => setSortKey(item.key)} style={{ padding: '4px 10px', borderRadius: 16, border: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer', fontSize: 11, background: sortKey === item.key ? '#185fa5' : 'none', color: sortKey === item.key ? '#fff' : 'var(--color-text-secondary)' }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>RAEKKEFOLGE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['desc','Højest først'],['asc','Lavest først']].map(([d, label]) => (
                <button key={d} onClick={() => setSortDir(d)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: sortDir === d ? '#0d1f2d' : 'var(--color-background-secondary)', color: sortDir === d ? '#fff' : 'var(--color-text-secondary)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              MIN RATING: {minRating > 0 ? minRating : 'Ingen'}
            </div>
            <input type="range" min={0} max={90} step={5} value={minRating} onChange={e => setMinRating(Number(e.target.value))} style={{ width: '100%', accentColor: '#1a7a4a' }} />
          </div>
        </div>
      )}

      {visiblePlayers.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">Ingen spillere matcher filtrene</div>
          <button onClick={resetFilters} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a7a4a', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Nulstil filtre</button>
        </div>
      ) : (
        <div className="card-grid">
          {visiblePlayers.map(p => (
            <PlayerCardMini key={p.id} player={p}

cd ~/Downloads/padel-app
cat > src/pages/Cards.js << 'ENDOFFILE'
import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerCardMini, PlayerCardDetail } from '../components/PlayerCard'
import { AppContext } from '../App'
import { computeScores } from '../lib/helpers'

const POSITIONS = ['Alle', 'HO', 'VN']
const FILTER_PRESETS = [
  { id: 'overall', label: 'Samlet', key: 'overall' },
  { id: 'off', label: 'Offensiv', key: 'off' },
  { id: 'def', label: 'Defensiv', key: 'def' },
]
const STAT_FILTERS = [
  { group: 'Grundslag', items: [{ key: 'forhnd', label: 'Forhånd' }, { key: 'baghnd', label: 'Baghånd' }]},
  { group: 'Overheads', items: [{ key: 'bandeja', label: 'Bandeja' }, { key: 'vibora', label: 'Vibora' }, { key: 'rulo', label: 'Rulo' }, { key: 'gancho', label: 'Gancho' }, { key: 'smash', label: 'Smash' }]},
  { group: 'Volleys', items: [{ key: 'volley_forhnd', label: 'Forhånd volley' }, { key: 'volley_baghnd', label: 'Baghånd volley' }, { key: 'plano', label: 'Plano' }]},
  { group: 'Omstillingsslag', items: [{ key: 'chiquita', label: 'Chiquita' }, { key: 'lob', label: 'Lob' }]},
  { group: 'Generelt', items: [{ key: 'glasspil', label: 'Glasspil' }, { key: 'spilforstaelse', label: 'Spilforståelse' }, { key: 'bevaegelse', label: 'Bevægelse' }, { key: 'kommunikation', label: 'Kommunikation' }]},
]

function getStatValue(stats, key) {
  if (!stats) return 50
  if (key === 'overall') return computeScores(stats).overall
  if (key === 'off') return computeScores(stats).off
  if (key === 'def') return computeScores(stats).def
  return stats[key] || 50
}

export default function Cards() {
  const { selectedClub, clubs } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [awardsMap, setAwardsMap] = useState({})
  const [partnerMap, setPartnerMap] = useState({})
  const [clubPlayers, setClubPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [posFilter, setPosFilter] = useState('Alle')
  const [sortKey, setSortKey] = useState('overall')
  const [sortDir, setSortDir] = useState('desc')
  const [minRating, setMinRating] = useState(0)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: st }, { data: rawAwards }, { data: ps }, { data: cp }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.from('awards').select('player_id, award_type'),
        supabase.from('partner_stats').select('*, partner:partner_id(name, initials, color)'),
        supabase.from('club_players').select('*'),
      ])
      setPlayers(pl || [])
      setClubPlayers(cp || [])
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
      const pm = {}
      ;(ps || []).forEach(p => {
        if (!pm[p.player_id]) pm[p.player_id] = []
        pm[p.player_id].push(p)
      })
      Object.keys(pm).forEach(pid => { pm[pid].sort((a, b) => b.points_together - a.points_together) })
      setPartnerMap(pm)
      setLoading(false)
    }
    load()
  }, [])

  const visiblePlayerIds = selectedClub
    ? clubPlayers.filter(cp => cp.club_id === selectedClub).map(cp => cp.player_id)
    : players.map(p => p.id)

  let visiblePlayers = players
    .filter(p => visiblePlayerIds.includes(p.id))
    .filter(p => posFilter === 'Alle' || p.position === posFilter)
    .filter(p => !searchText || p.name.toLowerCase().includes(searchText.toLowerCase()))
    .filter(p => getStatValue(statsMap[p.id], sortKey) >= minRating)

  visiblePlayers = [...visiblePlayers].sort((a, b) => {
    const av = getStatValue(statsMap[a.id], sortKey)
    const bv = getStatValue(statsMap[b.id], sortKey)
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const currentClub = clubs.find(c => c.id === selectedClub)
  const hasActiveFilters = posFilter !== 'Alle' || minRating > 0 || searchText || sortKey !== 'overall'
  const resetFilters = () => { setPosFilter('Alle'); setSortKey('overall'); setSortDir('desc'); setMinRating(0); setSearchText('') }

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
        <span className="page-title">{currentClub ? currentClub.name : 'Alle spillere'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #e24b4a', background: 'none', color: '#e24b4a', cursor: 'pointer' }}>Nulstil</button>
          )}
          <button onClick={() => setShowFilters(f => !f)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: showFilters ? '#0d1f2d' : 'none', color: showFilters ? '#fff' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {showFilters ? 'Skjul filtre' : 'Filtre'}{hasActiveFilters ? ' *' : ''}
          </button>
          <span className="page-sub">{visiblePlayers.length} spillere</span>
        </div>
      </div>

      {showFilters && (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>SOG</div>
            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Navn..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-secondary)', fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>POSITION</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: posFilter === pos ? '#0d1f2d' : 'var(--color-background-secondary)', color: posFilter === pos ? '#fff' : 'var(--color-text-secondary)' }}>
                  {pos === 'HO' ? 'Højre' : pos === 'VN' ? 'Venstre' : pos}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>SORTER EFTER</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {FILTER_PRESETS.map(p => (
                <button key={p.id} onClick={() => setSortKey(p.key)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: sortKey === p.key ? '#1a7a4a' : 'var(--color-background-secondary)', color: sortKey === p.key ? '#fff' : 'var(--color-text-secondary)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {STAT_FILTERS.map(group => (
              <div key={group.group} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{group.group.toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {group.items.map(item => (
                    <button key={item.key} onClick={() => setSortKey(item.key)} style={{ padding: '4px 10px', borderRadius: 16, border: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer', fontSize: 11, background: sortKey === item.key ? '#185fa5' : 'none', color: sortKey === item.key ? '#fff' : 'var(--color-text-secondary)' }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>RAEKKEFOLGE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['desc','Højest først'],['asc','Lavest først']].map(([d, label]) => (
                <button key={d} onClick={() => setSortDir(d)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: sortDir === d ? '#0d1f2d' : 'var(--color-background-secondary)', color: sortDir === d ? '#fff' : 'var(--color-text-secondary)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              MIN RATING: {minRating > 0 ? minRating : 'Ingen'}
            </div>
            <input type="range" min={0} max={90} step={5} value={minRating} onChange={e => setMinRating(Number(e.target.value))} style={{ width: '100%', accentColor: '#1a7a4a' }} />
          </div>
        </div>
      )}

      {visiblePlayers.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">Ingen spillere matcher filtrene</div>
          <button onClick={resetFilters} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a7a4a', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Nulstil filtre</button>
        </div>
      ) : (
        <div className="card-grid">
          {visiblePlayers.map(p => (
            <PlayerCardMini key={p.id} player={p} stats={statsMap[p.id]} onClick={() => setSelected(p.id)} />
          ))}
        </div>
      )}
    </>
  )
}
