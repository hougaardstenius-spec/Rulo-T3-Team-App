import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { avg } from '../lib/helpers'

const STAT_GROUPS = [
  { label: 'Grundslag', color: '#2d9e62', stats: [{ key: 'forhånd', label: 'Forhånd' }, { key: 'baghånd', label: 'Baghånd' }] },
  { label: 'Overheads', color: '#c9a227', stats: [{ key: 'bandeja', label: 'Bandeja' }, { key: 'vibora', label: 'Víbora' }, { key: 'rulo', label: 'Rulo' }, { key: 'gancho', label: 'Gancho' }, { key: 'smash', label: 'Smash' }] },
  { label: 'Volleys', color: '#185fa5', stats: [{ key: 'volley_forhånd', label: 'Forhånd volley' }, { key: 'volley_baghånd', label: 'Baghånd volley' }, { key: 'plano', label: 'Plano' }] },
  { label: 'Omstillingsslag', color: '#854f0b', stats: [{ key: 'chiquita', label: 'Chiquita' }, { key: 'lob', label: 'Lob' }] },
  { label: 'Generelt', color: '#534ab7', stats: [{ key: 'glasspil', label: 'Spil efter glas' }, { key: 'spilforstaelse', label: 'Spilforståelse' }, { key: 'bevaegelse', label: 'Bevægelse' }, { key: 'kommunikation', label: 'Kommunikation' }] },
]

const ALL_STAT_KEYS = STAT_GROUPS.flatMap(g => g.stats.map(s => s.key))
const ADMIN_PIN = '1811'

function StatSlider({ label, value, onChange }) {
  const barColor = value >= 80 ? '#2d9e62' : value >= 65 ? '#c9a227' : '#e24b4a'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</label>
        <div style={{ background: '#0d1f2d', color: '#f5e642', fontWeight: 700, fontSize: 15, borderRadius: 6, padding: '2px 9px', minWidth: 38, textAlign: 'center' }}>{value}</div>
      </div>
      <div style={{ position: 'relative', height: 8 }}>
        <div style={{ position: 'absolute', inset: '3px 0', background: 'var(--color-border-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .1s' }} />
        </div>
        <input type="range" min={1} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
      </div>
    </div>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 8px', border: 'none', borderRadius: 8,
      background: active ? '#0d1f2d' : 'none',
      color: active ? '#fff' : 'var(--color-text-secondary)',
      fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all .15s'
    }}>{label}</button>
  )
}

export default function Admin() {
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [matches, setMatches] = useState([])
  const [selected, setSelected] = useState(null)
  const [localStats, setLocalStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [adminTab, setAdminTab] = useState('ratings') // 'ratings' | 'voting'
  const { showToast, ToastEl } = useToast()

  useEffect(() => {
    if (!unlocked) return
    async function load() {
      const [{ data: pl }, { data: st }, { data: m }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('player_stats').select('*'),
        supabase.from('matches').select('*').order('match_date', { ascending: false }),
      ])
      setPlayers(pl || [])
      const sm = {}
      ;(st || []).forEach(s => { sm[s.player_id] = s })
      setStatsMap(sm)
      setMatches(m || [])
      setLoading(false)
    }
    load()
  }, [unlocked])

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
  if (!unlocked) return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Admin</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>Indtast PIN for at fortsætte</div>
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 20, maxWidth: 280 }}>
        <div className="field">
          <label>PIN-kode</label>
          <input type="password" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (pin === ADMIN_PIN ? setUnlocked(true) : showToast('Forkert PIN'))}
            placeholder="••••" maxLength={8} />
        </div>
        <button className="btn-primary" onClick={() => pin === ADMIN_PIN ? setUnlocked(true) : showToast('Forkert PIN')}>
          Lås op
        </button>
      </div>
      {ToastEl}
    </div>
  )

  if (loading) return <div className="loading">Henter data...</div>

  // Tab navigation
  const AdminHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <span style={{ fontSize: 16, fontWeight: 500 }}>Admin</span>
      <button onClick={() => { setUnlocked(false); setSelected(null) }} style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Lås</button>
    </div>
  )

  const AdminTabs = () => (
    <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 }}>
      <TabBtn label="⭐ Ratings" active={adminTab === 'ratings'} onClick={() => { setAdminTab('ratings'); setSelected(null) }} />
      <TabBtn label="🏆 Afstemning" active={adminTab === 'voting'} onClick={() => setAdminTab('voting')} />
    </div>
  )

  // RATINGS — spiller valg
  if (adminTab === 'ratings' && !selected) return (
    <div>
      <AdminHeader />
      <AdminTabs />
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Vælg en spiller for at opdatere ratings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map(p => {
          const s = statsMap[p.id] || {}
          const pOff = avg(s.bandeja||50, s.vibora||50, s.rulo||50, s.gancho||50, s.smash||50, s['volley_forhånd']||50, s['volley_baghånd']||50, s.plano||50)
          const pDef = avg(s['forhånd']||50, s['baghånd']||50, s.chiquita||50, s.lob||50, s.glasspil||50)
          const pGen = avg(s.spilforstaelse||50, s.bevaegelse||50, s.kommunikation||50)
          const pOverall = Math.round((pOff + pDef + pGen) / 3)
          return (
            <div key={p.id} onClick={() => selectPlayer(p)}
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
      <button className="back-btn" onClick={() => setSelected(null)} style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--color-text-secondary)' }}>
        ← Alle spillere
      </button>
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
            <StatSlider key={key} label={label} value={localStats[key] ?? 50} onChange={val => setLocalStats(prev => ({ ...prev, [key]: val }))} />
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
  if (adminTab === 'voting') {
    const recentMatches = matches.slice(0, 10)
    return (
      <>
        <AdminHeader />
        <AdminTabs />
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
          Åbn eller luk afstemning for en kamp
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentMatches.map(m => {
            const d = new Date(m.match_date)
            const dateStr = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
            return (
              <div key={m.id} style={{ background: 'var(--color-background-primary)', border: `0.5px solid ${m.voting_open ? '#a8d5b5' : 'var(--color-border-tertiary)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#0d1f2d', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{dateStr}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`match-type-pill ${m.match_type === 'official' ? 'pill-official' : 'pill-training'}`} style={{ margin: 0 }}>
                      {m.match_type === 'official' ? 'Officiel' : 'Træning'}
                    </span>
                    {m.score_us && <span style={{ color: '#1a7a4a' }}>{m.score_us}–{m.score_them} sæt</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleVoting(m)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: m.voting_open ? '#1a7a4a' : 'var(--color-background-secondary)',
                    color: m.voting_open ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'all .15s', flexShrink: 0
                  }}
                >
                  {m.voting_open ? '✓ Åben' : 'Åbn'}
                </button>
              </div>
            )
          })}
          {recentMatches.length === 0 && (
            <div className="empty"><div className="empty-icon">🏆</div><div className="empty-text">Ingen kampe endnu</div></div>
          )}
        </div>
        {ToastEl}
      </>
    )
  }

  return null
}
