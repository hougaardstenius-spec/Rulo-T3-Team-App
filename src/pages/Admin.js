import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { avg } from '../lib/helpers'
import { AppContext } from '../App'
import { loadAuth, saveAuth, clearAuth, getAuthLevel } from '../lib/auth'

const STAT_GROUPS = [
  { label: 'Grundslag', color: '#2d9e62', stats: [{ key: 'forhånd', label: 'Forhånd' }, { key: 'baghånd', label: 'Baghånd' }] },
  { label: 'Overheads', color: '#c9a227', stats: [{ key: 'bandeja', label: 'Bandeja' }, { key: 'vibora', label: 'Víbora' }, { key: 'rulo', label: 'Rulo' }, { key: 'gancho', label: 'Gancho' }, { key: 'smash', label: 'Smash' }] },
  { label: 'Volleys', color: '#185fa5', stats: [{ key: 'volley_forhånd', label: 'Forhånd volley' }, { key: 'volley_baghånd', label: 'Baghånd volley' }, { key: 'plano', label: 'Plano' }] },
  { label: 'Omstillingsslag', color: '#854f0b', stats: [{ key: 'chiquita', label: 'Chiquita' }, { key: 'lob', label: 'Lob' }] },
  { label: 'Generelt', color: '#534ab7', stats: [{ key: 'glasspil', label: 'Spil efter glas' }, { key: 'spilforstaelse', label: 'Spilforståelse' }, { key: 'bevaegelse', label: 'Bevægelse' }, { key: 'kommunikation', label: 'Kommunikation' }] },
]
const ALL_STAT_KEYS = STAT_GROUPS.flatMap(g => g.stats.map(s => s.key))
const MASTER_PIN = '9999'

function StatSlider({ id, label, value, onChange }) {
  const barColor = value >= 80 ? '#2d9e62' : value >= 65 ? '#c9a227' : '#e24b4a'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <label htmlFor={id} style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</label>
        <div style={{ background: '#0d1f2d', color: '#f5e642', fontWeight: 700, fontSize: 15, borderRadius: 6, padding: '2px 9px', minWidth: 38, textAlign: 'center' }}>{value}</div>
      </div>
      <div style={{ position: 'relative', height: 8 }}>
        <div style={{ position: 'absolute', inset: '3px 0', background: 'var(--color-border-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .1s' }} />
        </div>
        <input id={id} type="range" min={1} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
      </div>
    </div>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '9px 8px', border: 'none', borderRadius: 8, background: active ? '#0d1f2d' : 'none', color: active ? '#fff' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all .15s' }}>{label}</button>
  )
}

export default function Admin() {
  const { clubs } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [matches, setMatches] = useState([])
  const [clubPlayers, setClubPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [localStats, setLocalStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pin, setPin] = useState('')
  const [auth, setAuth] = useState(null)
  const [adminTab, setAdminTab] = useState('ratings')
  const { showToast, ToastEl } = useToast()

  useEffect(() => {
    if (!auth) return
    async function load() {
      const [{ data: pl }, { data: st }, { data: m }, { data: cp }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.from('matches').select('*').order('match_date', { ascending: false }),
        supabase.from('club_players').select('*'),
      ])
      setAllPlayers(pl || [])
      setClubPlayers(cp || [])

      // Kaptajner kan kun se egne hold-spillere
      if (auth.level === 'captain' && auth.club) {
        const myPlayerIds = (cp || []).filter(c => c.club_id === auth.club.id).map(c => c.player_id)
        setPlayers((pl || []).filter(p => myPlayerIds.includes(p.id)))
        setMatches((m || []).filter(match => match.club_id === auth.club.id))
      } else {
        setPlayers(pl || [])
        setMatches(m || [])
      }

      const sm = {}
      ;(st || []).forEach(s => { sm[s.player_id] = s })
      setStatsMap(sm)
      setLoading(false)
    }
    load()
  }, [auth])

  const handleLogin = () => {
    if (pin === MASTER_PIN) {
      setAuth({ level: 'master', club: null })
      return
    }
    const club = clubs.find(c => c.captain_pin === pin)
    if (club) {
      setAuth({ level: 'captain', club })
      return
    }
    showToast('Forkert PIN')
  }

  const selectPlayer = (player) => {
    setSelected(player)
    const existing = statsMap[player.id] || {}
    const defaults = {}
    ALL_STAT_KEYS.forEach(k => { defaults[k] = existing[k] ?? 50 })
    setLocalStats(defaults)
  }

  const save = async () => {
    setSaving(true)
    const existing = statsMap[selected.id]
    if (existing) {
      await supabase.from('player_stats').update({ ...localStats, updated_at: new Date().toISOString() }).eq('player_id', selected.id)
    } else {
      await supabase.from('player_stats').insert({ player_id: selected.id, ...localStats })
    }
    setStatsMap(prev => ({ ...prev, [selected.id]: { ...existing, ...localStats } }))
    setSaving(false)
    showToast(`${selected.name} — ratings gemt!`)
  }

  const toggleVoting = async (match) => {
    await supabase.from('matches').update({ voting_open: !match.voting_open }).eq('id', match.id)
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, voting_open: !m.voting_open } : m))
    showToast(match.voting_open ? 'Afstemning lukket' : 'Afstemning åbnet!')
  }

  const offScore = avg(localStats.bandeja||50, localStats.vibora||50, localStats.rulo||50, localStats.gancho||50, localStats.smash||50, localStats['volley_forhånd']||50, localStats['volley_baghånd']||50, localStats.plano||50)
  const defScore = avg(localStats['forhånd']||50, localStats['baghånd']||50, localStats.chiquita||50, localStats.lob||50, localStats.glasspil||50)
  const genScore = avg(localStats.spilforstaelse||50, localStats.bevaegelse||50, localStats.kommunikation||50)
  const overall = Math.round((offScore + defScore + genScore) / 3)

  // PIN screen
  if (!auth) return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Admin</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Indtast PIN for at fortsætte
      </div>
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 20, maxWidth: 280 }}>
        <div className="field">
          <label htmlFor="admin-pin">PIN-kode</label>
          <input id="admin-pin" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••" maxLength={8} />
        </div>
        <button className="btn-primary" onClick={handleLogin}>Lås op</button>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 12, textAlign: 'center' }}>
          Master PIN · Hold-PIN for kaptajner
        </div>
      </div>
      {ToastEl}
    </div>
  )

  if (loading) return <div className="loading">Henter data...</div>

  const AdminHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Admin</span>
        <span style={{ fontSize: 11, color: auth.level === 'master' ? '#c9a227' : '#2d9e62', marginLeft: 8, fontWeight: 600 }}>
          {auth.level === 'master' ? '⭐ Master' : `⚽ ${auth.club?.name}`}
        </span>
      </div>
      <button onClick={() => { setAuth(null); setPin(''); setSelected(null) }}
        style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Lås</button>
    </div>
  )

  const AdminTabs = () => (
    <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 }}>
      <TabBtn label="⭐ Ratings" active={adminTab === 'ratings'} onClick={() => { setAdminTab('ratings'); setSelected(null) }} />
      <TabBtn label="🏆 Afstemning" active={adminTab === 'voting'} onClick={() => setAdminTab('voting')} />
      {auth.level === 'master' && (
        <TabBtn label="🏓 Hold" active={adminTab === 'clubs'} onClick={() => setAdminTab('clubs')} />
      )}
    </div>
  )

  // RATINGS — spiller liste
  if (adminTab === 'ratings' && !selected) return (
    <div>
      <AdminHeader />
      <AdminTabs />
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Vælg spiller for at opdatere ratings
        {auth.level === 'captain' && <span style={{ color: '#2d9e62' }}> · {auth.club?.name}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map(p => {
          const s = statsMap[p.id] || {}
          const pOff = avg(s.bandeja||50, s.vibora||50, s.rulo||50, s.gancho||50, s.smash||50, s['volley_forhånd']||50, s['volley_baghånd']||50, s.plano||50)
          const pDef = avg(s['forhånd']||50, s['baghånd']||50, s.chiquita||50, s.lob||50, s.glasspil||50)
          const pGen = avg(s.spilforstaelse||50, s.bevaegelse||50, s.kommunikation||50)
          const pOverall = Math.round((pOff + pDef + pGen) / 3)
          return (
            <div key={p.id} onClick={() => selectPlayer(p)}
              role="button" tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), selectPlayer(p))}
              aria-label={`Rediger ratings for ${p.name}`}
              className="interactive-card"
              style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#2d9e62'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-tertiary)'}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>OFF {pOff} · DEF {pDef} · GEN {pGen}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a7a4a', lineHeight: 1 }}>{pOverall}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>samlet</div>
              </div>
            </div>
          )
        })}
      </div>
      {ToastEl}
    </div>
  )

  // RATINGS — rediger spiller
  if (adminTab === 'ratings' && selected) return (
    <>
      <AdminHeader />
      <AdminTabs />
      <button className="back-btn" onClick={() => setSelected(null)} style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--color-text-secondary)' }}>← Alle spillere</button>
      <div style={{ background: 'linear-gradient(145deg,#1a2e4a 0%,#0d1f2d 100%)', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, color: '#fff' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: selected.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, border: '2px solid rgba(255,255,255,0.2)' }}>{selected.initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: '#8fafc4', marginTop: 2 }}>Træk i bjælkerne for at justere</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#f5e642', lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: 9, color: '#8fafc4', letterSpacing: '.5px' }}>SAMLET</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[['OFF', offScore, '#c9a227'], ['DEF', defScore, '#2d9e62'], ['GEN', genScore, '#534ab7']].map(([lbl, val, col]) => (
          <div key={lbl} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: col }}>{val}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '.5px', marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>
      {STAT_GROUPS.map(group => (
        <div key={group.label} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: group.color, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${group.color}22` }}>{group.label}</div>
          {group.stats.map(({ key, label }) => (
            <StatSlider key={key} id={`stat-${key}`} label={label} value={localStats[key] ?? 50} onChange={val => setLocalStats(prev => ({ ...prev, [key]: val }))} />
          ))}
        </div>
      ))}
      <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 4, marginBottom: 24, opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Gemmer...' : `Gem ratings for ${selected.name.split(' ')[0]}`}
      </button>
      {ToastEl}
    </>
  )

  // AFSTEMNING
  if (adminTab === 'voting') return (
    <>
      <AdminHeader />
      <AdminTabs />
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>Åbn eller luk afstemning</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.slice(0, 15).map(m => {
          const d = new Date(m.match_date)
          const dateStr = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
          return (
            <div key={m.id} style={{ background: 'var(--color-background-primary)', border: `0.5px solid ${m.voting_open ? '#a8d5b5' : 'var(--color-border-tertiary)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#0d1f2d', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{dateStr}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  <span className={`match-type-pill ${m.match_type === 'official' ? 'pill-official' : 'pill-training'}`} style={{ margin: 0 }}>
                    {m.match_type === 'official' ? 'Officiel' : 'Træning'}
                  </span>
                  {m.score_us && <span style={{ color: '#1a7a4a', marginLeft: 6 }}>{m.score_us}–{m.score_them}</span>}
                </div>
              </div>
              <button onClick={() => toggleVoting(m)}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: m.voting_open ? '#1a7a4a' : 'var(--color-background-secondary)', color: m.voting_open ? '#fff' : 'var(--color-text-secondary)', transition: 'all .15s', flexShrink: 0 }}>
                {m.voting_open ? '✓ Åben' : 'Åbn'}
              </button>
            </div>
          )
        })}
      </div>
      {ToastEl}
    </>
  )

  // HOLD MANAGEMENT (kun master)
  if (adminTab === 'clubs') return (
    <ClubManagement
      clubs={clubs}
      allPlayers={allPlayers}
      clubPlayers={clubPlayers}
      setClubPlayers={setClubPlayers}
      setAllPlayers={setAllPlayers}
      AdminHeader={AdminHeader}
      AdminTabs={AdminTabs}
      showToast={showToast}
      ToastEl={ToastEl}
    />
  )

  return null
}

// ── HOLD MANAGEMENT KOMPONENT ──
function ClubManagement({ clubs, allPlayers, clubPlayers, setClubPlayers, setAllPlayers, AdminHeader, AdminTabs, showToast, ToastEl }) {
  const COLORS = ['#1a7a4a','#185fa5','#854f0b','#722439','#534ab7','#0f6e56','#993c1d','#1a5c8a','#5f5e5a','#7a3f7a','#c9a227','#2d6a8a']
  const EMPTY_PLAYER = { name: '', initials: '', color: '#1a7a4a', position: 'HØ', club_id: '' }

  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [form, setForm] = useState(EMPTY_PLAYER)
  const [saving, setSaving] = useState(false)
  const [expandedClub, setExpandedClub] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [finePinOverrides, setFinePinOverrides] = useState({})

  const saveFineMasterPin = async (clubId, value) => {
    const pin = value.trim()
    await supabase.from('clubs').update({ fine_master_pin: pin || null }).eq('id', clubId)
    setFinePinOverrides(prev => ({ ...prev, [clubId]: pin }))
    showToast('Bødemester-PIN gemt!')
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = (clubId) => {
    setForm({ ...EMPTY_PLAYER, club_id: clubId })
    setEditPlayer(null)
    setShowAddPlayer(true)
  }

  const openEdit = (player) => {
    const cp = clubPlayers.find(c => c.player_id === player.id)
    setForm({ name: player.name, initials: player.initials, color: player.color, position: player.position, club_id: cp?.club_id || '' })
    setEditPlayer(player)
    setShowAddPlayer(true)
  }

  const savePlayer = async () => {
    if (!form.name || !form.initials) { showToast('Udfyld navn og initialer'); return }
    setSaving(true)

    if (editPlayer) {
      // Opdater eksisterende spiller
      await supabase.from('players').update({
        name: form.name, initials: form.initials.toUpperCase(),
        color: form.color, position: form.position
      }).eq('id', editPlayer.id)

      // Opdater hold-tilknytning hvis ændret
      const currentCp = clubPlayers.find(c => c.player_id === editPlayer.id)
      if (form.club_id && currentCp?.club_id !== form.club_id) {
        if (currentCp) {
          await supabase.from('club_players').update({ club_id: form.club_id }).eq('id', currentCp.id)
        } else {
          await supabase.from('club_players').insert({ player_id: editPlayer.id, club_id: form.club_id })
        }
      }

      setAllPlayers(prev => prev.map(p => p.id === editPlayer.id
        ? { ...p, name: form.name, initials: form.initials.toUpperCase(), color: form.color, position: form.position }
        : p))
      if (form.club_id && currentCp?.club_id !== form.club_id) {
        setClubPlayers(prev => prev.map(cp => cp.player_id === editPlayer.id ? { ...cp, club_id: form.club_id } : cp))
      }
      showToast('Spiller opdateret!')
    } else {
      // Opret ny spiller
      const { data: newPlayer } = await supabase.from('players').insert({
        name: form.name, initials: form.initials.toUpperCase(),
        color: form.color, position: form.position
      }).select().single()

      if (newPlayer) {
        // Tilknyt til hold
        if (form.club_id) {
          await supabase.from('club_players').insert({ player_id: newPlayer.id, club_id: form.club_id })
          setClubPlayers(prev => [...prev, { player_id: newPlayer.id, club_id: form.club_id }])
        }
        // Opret tom stats-række
        await supabase.from('player_stats').insert({ player_id: newPlayer.id })
        setAllPlayers(prev => [...prev, newPlayer])
        showToast(`${form.name} tilføjet!`)
      }
    }

    setSaving(false)
    setShowAddPlayer(false)
    setForm(EMPTY_PLAYER)
    setEditPlayer(null)
  }

  const removeFromClub = async (playerId, clubId) => {
    await supabase.from('club_players').delete().eq('player_id', playerId).eq('club_id', clubId)
    setClubPlayers(prev => prev.filter(cp => !(cp.player_id === playerId && cp.club_id === clubId)))
    setConfirmDelete(null)
    showToast('Spiller fjernet fra hold')
  }

  const addToClub = async (playerId, clubId) => {
    const exists = clubPlayers.find(cp => cp.player_id === playerId && cp.club_id === clubId)
    if (exists) { showToast('Spilleren er allerede på dette hold'); return }
    await supabase.from('club_players').insert({ player_id: playerId, club_id: clubId })
    setClubPlayers(prev => [...prev, { player_id: playerId, club_id: clubId }])
    showToast('Spiller tilføjet til hold!')
  }

  // Spillere uden hold
  const unassigned = allPlayers.filter(p => !clubPlayers.some(cp => cp.player_id === p.id))

  return (
    <>
      <AdminHeader />
      <AdminTabs />

      {/* Hold-oversigt */}
      {clubs.map(club => {
        const clubPids = clubPlayers.filter(cp => cp.club_id === club.id).map(cp => cp.player_id)
        const clubPs = allPlayers.filter(p => clubPids.includes(p.id))
        const isExpanded = expandedClub === club.id

        return (
          <div key={club.id} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
            {/* Hold header */}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => setExpandedClub(isExpanded ? null : club.id)}
              role="button" tabIndex={0}
              aria-expanded={isExpanded}
              className="interactive-card"
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpandedClub(isExpanded ? null : club.id))}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{club.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {clubPs.length} spillere · Kaptajn-PIN: {club.captain_pin}
                </div>
              </div>
              <div style={{ display: 'flex', gap: -4 }}>
                {clubPs.slice(0, 5).map(p => (
                  <div key={p.id} style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', border: '2px solid var(--color-background-primary)', marginLeft: -6 }}>{p.initials}</div>
                ))}
                {clubPs.length > 5 && <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', border: '2px solid var(--color-background-primary)', marginLeft: -6 }}>+{clubPs.length - 5}</div>}
              </div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }} aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded spillerliste */}
            {isExpanded && (
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: 14, background: 'var(--color-background-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--color-background-primary)', borderRadius: 10, padding: '8px 12px' }}>
                  <label htmlFor={`fine-pin-${club.id}`} style={{ fontSize: 12, color: 'var(--color-text-secondary)', flex: 1 }}>Bødemester-PIN (2-3 personer deler denne)</label>
                  <input id={`fine-pin-${club.id}`} defaultValue={finePinOverrides[club.id] ?? club.fine_master_pin ?? ''}
                    onBlur={e => saveFineMasterPin(club.id, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    placeholder="fx 4321" maxLength={8}
                    style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {clubPs.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-background-primary)', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : p.initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.position}</div>
                      </div>
                      <button onClick={() => openEdit(p)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                        Rediger
                      </button>
                      <button onClick={() => setConfirmDelete({ playerId: p.id, clubId: club.id, name: p.name })}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #f5b5b5', background: 'none', color: '#e24b4a', cursor: 'pointer' }}>
                        Fjern
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => openAdd(club.id)}
                  style={{ width: '100%', marginTop: 10, padding: '10px', border: '1.5px dashed var(--color-border-secondary)', borderRadius: 10, background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                  + Tilføj spiller til {club.name}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Spillere uden hold */}
      {unassigned.length > 0 && (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid #f5a623', borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f5a623', marginBottom: 10 }}>⚠️ Spillere uden hold ({unassigned.length})</div>
          {unassigned.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{p.initials}</div>
              <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
              <select onChange={e => e.target.value && addToClub(p.id, e.target.value)} defaultValue=""
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)' }}>
                <option value="">Tilknyt hold...</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Tilføj helt ny spiller knap */}
      <button onClick={() => openAdd('')}
        className="btn-primary" style={{ marginTop: 8 }}>
        + Opret ny spiller
      </button>

      {/* Modal: Opret / rediger spiller */}
      {showAddPlayer && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddPlayer(false)}>
          <div className="modal">
            <div className="modal-title">
              {editPlayer ? `Rediger ${editPlayer.name}` : 'Opret ny spiller'}
              <button className="modal-close" onClick={() => setShowAddPlayer(false)} aria-label="Luk">✕</button>
            </div>

            <div className="field">
              <label htmlFor="player-name">Fuldt navn</label>
              <input id="player-name" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="fx Marcus Karlsen" />
            </div>

            <div className="field">
              <label htmlFor="player-initials">Initialer (2-3 bogstaver)</label>
              <input id="player-initials" value={form.initials} onChange={e => setF('initials', e.target.value.toUpperCase())} placeholder="fx MK" maxLength={3} />
            </div>

            <div className="field">
              <label htmlFor="player-position">Position</label>
              <select id="player-position" value={form.position} onChange={e => setF('position', e.target.value)}>
                <option value="HØ">Højre side (HØ)</option>
                <option value="VN">Venstre side (VN)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="player-club">Hold</label>
              <select id="player-club" value={form.club_id} onChange={e => setF('club_id', e.target.value)}>
                <option value="">Vælg hold</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label id="player-color-label">Farve på spillerkort</label>
              <div role="group" aria-labelledby="player-color-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORS.map(col => (
                  <button type="button" key={col} onClick={() => setF('color', col)}
                    aria-label={`Vælg farve ${col}`} aria-pressed={form.color === col}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: col, cursor: 'pointer', border: form.color === col ? '3px solid #fff' : '3px solid transparent', boxShadow: form.color === col ? '0 0 0 2px #2d9e62' : 'none', transition: 'all .15s', padding: 0 }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: form.color, border: '2px solid rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Initialer vil vises med denne baggrund</span>
              </div>
            </div>

            <button className="btn-primary" onClick={savePlayer} disabled={saving}>
              {saving ? 'Gemmer...' : editPlayer ? 'Gem ændringer' : 'Opret spiller'}
            </button>
          </div>
        </div>
      )}

      {/* Bekræft fjernelse */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Fjern spiller fra hold</div>
            <p style={{ fontSize: 14, marginBottom: 20, color: 'var(--color-text-secondary)' }}>
              Er du sikker på at du vil fjerne <strong>{confirmDelete.name}</strong> fra dette hold? Spilleren og deres data slettes ikke — kun holdtilknytningen.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 12, border: '0.5px solid var(--color-border-secondary)', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 14 }}>Annuller</button>
              <button onClick={() => removeFromClub(confirmDelete.playerId, confirmDelete.clubId)}
                style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#e24b4a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Fjern</button>
            </div>
          </div>
        </div>
      )}

      {ToastEl}
    </>
  )
}
