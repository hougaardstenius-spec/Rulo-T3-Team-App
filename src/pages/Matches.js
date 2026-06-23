import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { downloadICS, formatDate } from '../lib/helpers'
import { useToast } from '../hooks/useToast'

const EMPTY_FORM = {
  title: '', match_date: '', location: '', match_type: 'training', opponent: '',
  set1_us: '', set1_them: '', set2_us: '', set2_them: '', set3_us: '', set3_them: '',
}
const MIN_PLAYERS = 6

function SetInput({ label, us, them, onUs, onThem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 44 }}>{label}</span>
      <input type="number" min="0" max="7" value={us} onChange={e => onUs(e.target.value)} placeholder="Os"
        style={{ width: 52, padding: '7px 8px', borderRadius: 7, border: '1px solid #ddd', fontSize: 14, textAlign: 'center' }} />
      <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 700 }}>–</span>
      <input type="number" min="0" max="7" value={them} onChange={e => onThem(e.target.value)} placeholder="Dem"
        style={{ width: 52, padding: '7px 8px', borderRadius: 7, border: '1px solid #ddd', fontSize: 14, textAlign: 'center' }} />
    </div>
  )
}

function computePreview(form) {
  const sets = [
    [Number(form.set1_us), Number(form.set1_them)],
    [Number(form.set2_us), Number(form.set2_them)],
    [Number(form.set3_us), Number(form.set3_them)],
  ].filter(([u, t]) => form.set1_us !== '' && !isNaN(u) && !isNaN(t) && (u > 0 || t > 0))
  if (sets.length < 2) return null
  let setsUs = 0, setsThem = 0
  sets.forEach(([u, t]) => { if (u > t) setsUs++; else setsThem++ })
  const won = setsUs > setsThem
  const multiplier = form.match_type === 'official' ? 2 : 1
  let base = won ? 3 : 0, bonus = 0
  if (won) {
    if (setsThem === 0) bonus += 1
    const setsToZero = sets.filter(([u, t]) => u > t && t === 0).length
    if (setsToZero === 1) bonus += 1
    else if (setsToZero >= 2) bonus += 3
  } else { if (setsUs === 1) bonus += 1 }
  return { won, setsUs, setsThem, total: (base + bonus) * multiplier, scoreStr: sets.map(([u, t]) => `${u}-${t}`).join(' / '), multiplier }
}

// Beregn bedste makkerpar baseret på partner_stats
function suggestPairs(confirmedPlayers, partnerStatsAll) {
  if (confirmedPlayers.length < 4) return []
  // Byg en win-rate matrix
  const matrix = {}
  confirmedPlayers.forEach(p => { matrix[p.id] = {} })
  partnerStatsAll.forEach(ps => {
    if (matrix[ps.player_id] && matrix[ps.player_id][ps.partner_id] !== undefined) return
    if (confirmedPlayers.find(p => p.id === ps.player_id) && confirmedPlayers.find(p => p.id === ps.partner_id)) {
      const winRate = ps.matches_played >= 3 ? ps.matches_won / ps.matches_played : 0.5
      if (!matrix[ps.player_id]) matrix[ps.player_id] = {}
      matrix[ps.player_id][ps.partner_id] = { winRate, matches: ps.matches_played, wins: ps.matches_won }
      if (!matrix[ps.partner_id]) matrix[ps.partner_id] = {}
      matrix[ps.partner_id][ps.player_id] = { winRate, matches: ps.matches_played, wins: ps.matches_won }
    }
  })

  // Generer alle mulige par-kombinationer for de første 4 spillere (til kampe)
  const players4 = confirmedPlayers.slice(0, 4)
  const combos = []
  for (let i = 0; i < players4.length - 1; i++) {
    for (let j = i + 1; j < players4.length; j++) {
      const p1 = players4[i], p2 = players4[j]
      const stat = matrix[p1.id]?.[p2.id]
      combos.push({ p1, p2, winRate: stat?.winRate ?? 0.5, matches: stat?.matches ?? 0 })
    }
  }
  combos.sort((a, b) => b.winRate - a.winRate)
  return combos.slice(0, 3)
}

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [lineups, setLineups] = useState({}) // { match_id: [{player_id, status}] }
  const [partnerStats, setPartnerStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [winPair, setWinPair] = useState([null, null])
  const [losePair, setLosePair] = useState([null, null])
  const [expandedMatch, setExpandedMatch] = useState(null)
  const { showToast, ToastEl } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: p }, { data: lu }, { data: ps }] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: false }),
      supabase.from('players').select('*').order('name'),
      supabase.from('match_lineup').select('*'),
      supabase.from('partner_stats').select('*'),
    ])
    setMatches(m || [])
    setPlayers(p || [])
    setPartnerStats(ps || [])
    // Gruppér lineups per kamp
    const grouped = {}
    ;(lu || []).forEach(l => {
      if (!grouped[l.match_id]) grouped[l.match_id] = []
      grouped[l.match_id].push(l)
    })
    setLineups(grouped)
    setLoading(false)
  }

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function addMatch() {
    if (!form.title || !form.match_date) { showToast('Udfyld titel og dato'); return }
    const { data: newMatch, error } = await supabase.from('matches').insert({
      title: form.title, match_date: form.match_date, location: form.location,
      match_type: form.match_type, opponent: form.opponent, voting_open: false,
    }).select().single()
    if (error) { showToast('Fejl — prøv igen'); return }
    // Opret pending lineup for alle spillere
    await supabase.from('match_lineup').insert(
      players.map(p => ({ match_id: newMatch.id, player_id: p.id, status: 'pending' }))
    )
    showToast('Kamp tilføjet!')
    setShowModal(false); setForm(EMPTY_FORM); load()
  }

  async function updateLineupStatus(matchId, playerId, status) {
    await supabase.from('match_lineup')
      .upsert({ match_id: matchId, player_id: playerId, status }, { onConflict: 'match_id,player_id' })
    setLineups(prev => {
      const existing = prev[matchId] || []
      const updated = existing.some(l => l.player_id === playerId)
        ? existing.map(l => l.player_id === playerId ? { ...l, status } : l)
        : [...existing, { match_id: matchId, player_id: playerId, status }]
      return { ...prev, [matchId]: updated }
    })
  }

  async function saveResult() {
    if (!selectedMatch) return
    const preview = computePreview(form)
    if (!preview) { showToast('Udfyld mindst 2 sæt'); return }
    if (winPair.some(x => !x) || losePair.some(x => !x)) { showToast('Vælg alle 4 spillere'); return }
    await supabase.from('matches').update({
      set1_us: form.set1_us || null, set1_them: form.set1_them || null,
      set2_us: form.set2_us || null, set2_them: form.set2_them || null,
      set3_us: form.set3_us || null, set3_them: form.set3_them || null,
      score_us: String(preview.setsUs), score_them: String(preview.setsThem),
    }).eq('id', selectedMatch.id)
    const matchPlayers = [
      { match_id: selectedMatch.id, player_id: winPair[0], partner_id: winPair[1], won: true },
      { match_id: selectedMatch.id, player_id: winPair[1], partner_id: winPair[0], won: true },
      { match_id: selectedMatch.id, player_id: losePair[0], partner_id: losePair[1], won: false },
      { match_id: selectedMatch.id, player_id: losePair[1], partner_id: losePair[0], won: false },
    ]
    await supabase.from('match_players').delete().eq('match_id', selectedMatch.id)
    await supabase.from('match_players').insert(matchPlayers)
    await supabase.rpc('calculate_match_points', { p_match_id: selectedMatch.id })
    showToast('Resultat gemt og point beregnet!')
    setShowModal(false); setSelectedMatch(null)
    setForm(EMPTY_FORM); setWinPair([null, null]); setLosePair([null, null]); load()
  }

  async function toggleVoting(match) {
    await supabase.from('matches').update({ voting_open: !match.voting_open }).eq('id', match.id)
    showToast(match.voting_open ? 'Afstemning lukket' : 'Afstemning åbnet!')
    load()
  }

  const copyMatchMessage = (m) => {
    const date = new Date(m.match_date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
    const time = m.location ? `📍 ${m.location}` : ''
    const opponent = m.opponent ? `mod ${m.opponent}` : ''
    const type = m.match_type === 'official' ? '🏆 Officiel holdkamp' : '🏓 Træningskamp'
    const msg = [
      `${type} tilføjet!`,
      ``,
      `📅 ${date}`,
      m.location ? `📍 ${m.location}` : null,
      m.opponent ? `🆚 ${m.opponent}` : null,
      ``,
      `Meld dig klar i appen:`,
      `https://hougaardsstenius-spec.github.io/Rulo-T3-Team-App`,
    ].filter(l => l !== null).join('
')
    navigator.clipboard.writeText(msg)
    showToast('Besked kopieret — klar til Messenger! 📋')
  }

  const copyRankingMessage = () => {
    const msg = [
      '📊 Ranglisten er opdateret!',
      '',
      'Se den nye rangliste i appen:',
      'https://hougaardsstenius-spec.github.io/Rulo-T3-Team-App',
    ].join('
')
    navigator.clipboard.writeText(msg)
    showToast('Besked kopieret — klar til Messenger! 📋')
  }

  const preview = modalMode === 'result' ? computePreview(form) : null
  const now = new Date().toISOString().split('T')[0]

  const PlayerSelect = ({ value, onChange, exclude = [] }) => (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)}
      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
      <option value="">Vælg spiller</option>
      {players.filter(p => !exclude.includes(p.id)).map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )

  const MatchCard = ({ m }) => {
    const { day, mon } = formatDate(m.match_date)
    const hasResult = m.score_us
    const lu = lineups[m.id] || []
    const confirmed = lu.filter(l => l.status === 'confirmed').map(l => players.find(p => p.id === l.player_id)).filter(Boolean)
    const declined = lu.filter(l => l.status === 'declined').map(l => players.find(p => p.id === l.player_id)).filter(Boolean)
    const pending = lu.filter(l => l.status === 'pending').map(l => players.find(p => p.id === l.player_id)).filter(Boolean)
    const isExpanded = expandedMatch === m.id
    const sets = [m.set1_us != null ? `${m.set1_us}-${m.set1_them}` : null, m.set2_us != null ? `${m.set2_us}-${m.set2_them}` : null, m.set3_us != null ? `${m.set3_us}-${m.set3_them}` : null].filter(Boolean)
    const suggestions = isExpanded && confirmed.length >= 4 ? suggestPairs(confirmed, partnerStats) : []
    const enoughPlayers = confirmed.length >= MIN_PLAYERS

    return (
      <div style={{ background: 'var(--color-background-primary)', border: `0.5px solid ${enoughPlayers ? '#a8d5b5' : 'var(--color-border-tertiary)'}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
        {/* Top row */}
        <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: '#0d1f2d', borderRadius: 8, padding: '8px 10px', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{day}</div>
            <div style={{ fontSize: 9, color: '#8fafc4', fontWeight: 600, letterSpacing: '.5px' }}>{mon}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
              {m.title}
              {hasResult && <span style={{ color: '#1a7a4a', fontSize: 12, marginLeft: 6 }}>{m.score_us}–{m.score_them}</span>}
              <span className={`match-type-pill ${m.match_type === 'official' ? 'pill-official' : 'pill-training'}`}>{m.match_type === 'official' ? 'Officiel' : 'Træning'}</span>
            </div>
            {sets.length > 0 && <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 500, marginBottom: 2 }}>{sets.join(' / ')}</div>}
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {m.location && `${m.location} · `}{m.opponent && `mod ${m.opponent} · `}
              {new Date(m.match_date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          {!hasResult && (
            <button className="match-cal-btn" onClick={() => { downloadICS(m); showToast('Tilføjet til kalender!') }}>📅</button>
          )}
        </div>

        {/* Spiller-status badges — kun officielle kampe */}
        {m.match_type === 'official' && <div style={{ padding: '0 14px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 600 }}>✓ {confirmed.length}</div>
          {confirmed.map(p => (
            <div key={p.id} title={p.name} style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', border: '2px solid #a8d5b5' }}>{p.initials}</div>
          ))}
          {declined.length > 0 && <>
            <div style={{ width: 1, height: 20, background: 'var(--color-border-tertiary)' }} />
            <div style={{ fontSize: 11, color: '#e24b4a', fontWeight: 600 }}>✗ {declined.length}</div>
            {declined.map(p => (
              <div key={p.id} title={p.name} style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', opacity: 0.5, border: '2px solid #f5b5b5' }}>{p.initials}</div>
            ))}
          </>}
          {pending.length > 0 && <>
            <div style={{ width: 1, height: 20, background: 'var(--color-border-tertiary)' }} />
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>? {pending.length}</div>
          </>}
        </div>}

        {/* Action buttons */}
        <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {m.match_type === 'official' && (
            <button onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: isExpanded ? '#0d1f2d' : 'none', color: isExpanded ? '#fff' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
              {isExpanded ? '▲ Skjul' : '▼ Holdudtagelse'}
            </button>
          )}
          <button onClick={() => { setSelectedMatch(m); setModalMode('result'); setForm({ ...EMPTY_FORM, match_type: m.match_type, set1_us: m.set1_us??'', set1_them: m.set1_them??'', set2_us: m.set2_us??'', set2_them: m.set2_them??'', set3_us: m.set3_us??'', set3_them: m.set3_them??'' }); setShowModal(true) }}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: hasResult ? '#e8f5ee' : 'none', color: hasResult ? '#1a7a4a' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {hasResult ? '✓ Resultat' : '+ Resultat'}
          </button>
          <button onClick={() => copyMatchMessage(m)}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            📋 Del
          </button>
        </div>

        {/* Holdudtagelse panel */}
        {isExpanded && (
          <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: 14, background: 'var(--color-background-secondary)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: enoughPlayers ? '#1a7a4a' : '#e24b4a' }}>
              {enoughPlayers ? `✓ ${confirmed.length} spillere klar` : `⚠️ ${confirmed.length}/${MIN_PLAYERS} spillere bekræftet — mangler ${MIN_PLAYERS - confirmed.length}`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {players.map(p => {
                const entry = lu.find(l => l.player_id === p.id)
                const status = entry?.status || 'pending'
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.initials}</div>
                    <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['confirmed','✓','#1a7a4a','#e8f5ee'],['pending','?','#888','#f5f5f5'],['declined','✗','#e24b4a','#fce8e8']].map(([s, label, col, bg]) => (
                        <button key={s} onClick={() => updateLineupStatus(m.id, p.id, s)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: status === s ? bg : 'var(--color-background-primary)', color: status === s ? col : 'var(--color-text-tertiary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Makkerforslag */}
            {confirmed.length >= 4 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: '#185fa5' }}>
                  🤝 Forslag til makkerpar (baseret på kampdata)
                </div>
                {suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'var(--color-background-primary)', borderRadius: 8, padding: '8px 10px' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', width: 16 }}>{i + 1}</span>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.p1.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.p1.initials}</div>
                      <div style={{ flex: 1, fontSize: 12 }}>{s.p1.name.split(' ')[0]} & {s.p2.name.split(' ')[0]}</div>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.p2.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.p2.initials}</div>
                      <div style={{ fontSize: 11, color: s.matches >= 3 ? '#1a7a4a' : '#888', fontWeight: 600 }}>
                        {s.matches >= 3 ? `${Math.round(s.winRate * 100)}%` : 'Ny'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    Ikke nok kampdata endnu — spil mindst 3 kampe sammen for at få forslag
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Kampprogram</span>
        <button className="btn-primary" style={{ width: 'auto', padding: '7px 14px', fontSize: 13 }}
          onClick={() => { setModalMode('add'); setForm(EMPTY_FORM); setShowModal(true) }}>
          + Tilføj kamp
        </button>
      </div>

      {matches.map(m => <MatchCard key={m.id} m={m} />)}
      {matches.length === 0 && <div className="empty"><div className="empty-icon">📅</div><div className="empty-text">Tilføj den første kamp!</div></div>}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ paddingBottom: 32 }}>
            {modalMode === 'add' && <>
              <div className="modal-title">Tilføj kamp<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
              <div className="field"><label>Titel</label><input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="fx Træningskamp" /></div>
              <div className="field"><label>Dato</label><input type="date" value={form.match_date} onChange={e => setF('match_date', e.target.value)} /></div>
              <div className="field"><label>Sted</label><input value={form.location} onChange={e => setF('location', e.target.value)} placeholder="fx Odense Padel Club" /></div>
              <div className="field"><label>Type</label>
                <select value={form.match_type} onChange={e => setF('match_type', e.target.value)}>
                  <option value="training">Træningskamp</option>
                  <option value="official">Officiel holdkamp</option>
                </select>
              </div>
              <div className="field"><label>Modstander</label><input value={form.opponent} onChange={e => setF('opponent', e.target.value)} placeholder="fx Kerteminde Padel" /></div>
              <button className="btn-primary" onClick={addMatch}>Gem kamp</button>
            </>}

            {modalMode === 'result' && <>
              <div className="modal-title">Registrer resultat<button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{selectedMatch?.title}</div>
              <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Sætscore</div>
                <div style={{ display: 'flex', gap: 32, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#666', width: 44 }}></span>
                  <span style={{ fontSize: 11, color: '#666', width: 52, textAlign: 'center' }}>Os</span>
                  <span style={{ fontSize: 11, color: '#666', width: 52, textAlign: 'center' }}>Dem</span>
                </div>
                <SetInput label="Sæt 1" us={form.set1_us} them={form.set1_them} onUs={v => setF('set1_us', v)} onThem={v => setF('set1_them', v)} />
                <SetInput label="Sæt 2" us={form.set2_us} them={form.set2_them} onUs={v => setF('set2_us', v)} onThem={v => setF('set2_them', v)} />
                <SetInput label="Sæt 3 (valgfrit)" us={form.set3_us} them={form.set3_them} onUs={v => setF('set3_us', v)} onThem={v => setF('set3_them', v)} />
              </div>
              {preview && (
                <div style={{ background: preview.won ? '#e8f5ee' : '#fce8e8', border: `1px solid ${preview.won ? '#a8d5b5' : '#f5b5b5'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: preview.won ? '#1a7a4a' : '#a32d2d' }}>{preview.won ? `Sejr ${preview.setsUs}-${preview.setsThem}` : `Tab ${preview.setsUs}-${preview.setsThem}`}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{preview.scoreStr} · {form.match_type === 'official' ? 'Officiel ×2' : 'Træning ×1'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: preview.won ? '#1a7a4a' : '#a32d2d' }}>+{preview.total}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>point per spiller</div>
                  </div>
                </div>
              )}
              <div style={{ background: '#e8f5ee', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1a7a4a', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Vinderpar</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PlayerSelect value={winPair[0]} onChange={v => setWinPair([v, winPair[1]])} exclude={[winPair[1], losePair[0], losePair[1]].filter(Boolean)} />
                  <PlayerSelect value={winPair[1]} onChange={v => setWinPair([winPair[0], v])} exclude={[winPair[0], losePair[0], losePair[1]].filter(Boolean)} />
                </div>
              </div>
              <div style={{ background: '#fce8e8', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a32d2d', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Taberpar</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PlayerSelect value={losePair[0]} onChange={v => setLosePair([v, losePair[1]])} exclude={[winPair[0], winPair[1], losePair[1]].filter(Boolean)} />
                  <PlayerSelect value={losePair[1]} onChange={v => setLosePair([losePair[0], v])} exclude={[winPair[0], winPair[1], losePair[0]].filter(Boolean)} />
                </div>
              </div>
              <button className="btn-primary" onClick={saveResult}>Gem resultat og beregn point</button>
            </>}
          </div>
        </div>
      )}
      {ToastEl}
    </>
  )
}
