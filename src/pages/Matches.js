import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { downloadICS, formatDate } from '../lib/helpers'
import { useToast } from '../hooks/useToast'

const EMPTY_FORM = {
  title: '', match_date: '', location: '', match_type: 'training',
  opponent: '',
  set1_us: '', set1_them: '',
  set2_us: '', set2_them: '',
  set3_us: '', set3_them: '',
}

function SetInput({ label, us, them, onUs, onThem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 36 }}>{label}</span>
      <input type="number" min="0" max="7" value={us} onChange={e => onUs(e.target.value)}
        placeholder="Os" style={{ width: 52, padding: '7px 8px', borderRadius: 7, border: '1px solid #ddd', fontSize: 14, textAlign: 'center' }} />
      <span style={{ color: 'var(--color-text-tertiary)' }}>–</span>
      <input type="number" min="0" max="7" value={them} onChange={e => onThem(e.target.value)}
        placeholder="Dem" style={{ width: 52, padding: '7px 8px', borderRadius: 7, border: '1px solid #ddd', fontSize: 14, textAlign: 'center' }} />
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

  let base = won ? 3 : 0
  let bonus = 0

  if (won) {
    if (setsThem === 0) bonus += 1 // 2-0 sejr
    // sæt til 0
    const setsToZero = sets.filter(([u, t]) => u > t && t === 0).length
    if (setsToZero === 1) bonus += 1
    else if (setsToZero >= 2) bonus += 3
  } else {
    if (setsUs === 1) bonus += 1 // tæt kamp
  }

  const total = (base + bonus) * multiplier
  const scoreStr = sets.map(([u, t]) => `${u}-${t}`).join(' / ')
  return { won, setsUs, setsThem, total, scoreStr, multiplier }
}

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'result'
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // For result registration: 4 players + their pair assignment
  const [winPair, setWinPair] = useState([null, null])
  const [losePair, setLosePair] = useState([null, null])
  const { showToast, ToastEl } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: false }),
      supabase.from('players').select('*').order('name'),
    ])
    setMatches(m || [])
    setPlayers(p || [])
    setLoading(false)
  }

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function addMatch() {
    if (!form.title || !form.match_date) { showToast('Udfyld titel og dato'); return }
    const { error } = await supabase.from('matches').insert({
      title: form.title, match_date: form.match_date,
      location: form.location, match_type: form.match_type,
      opponent: form.opponent, voting_open: false,
    })
    if (error) { showToast('Fejl — prøv igen'); return }
    showToast('Kamp tilføjet!')
    setShowModal(false); setForm(EMPTY_FORM); load()
  }

  async function saveResult() {
    if (!selectedMatch) return
    const preview = computePreview(form)
    if (!preview) { showToast('Udfyld mindst 2 sæt'); return }
    if (winPair.some(x => !x) || losePair.some(x => !x)) {
      showToast('Vælg alle 4 spillere'); return
    }

    // Opdater kampens sætscore
    const { error: mErr } = await supabase.from('matches').update({
      set1_us: form.set1_us || null, set1_them: form.set1_them || null,
      set2_us: form.set2_us || null, set2_them: form.set2_them || null,
      set3_us: form.set3_us || null, set3_them: form.set3_them || null,
      score_us: String(preview.setsUs), score_them: String(preview.setsThem),
    }).eq('id', selectedMatch.id)
    if (mErr) { showToast('Fejl ved gem'); return }

    // Indsæt spillere — vindere
    const matchPlayers = [
      { match_id: selectedMatch.id, player_id: winPair[0], partner_id: winPair[1], won: true },
      { match_id: selectedMatch.id, player_id: winPair[1], partner_id: winPair[0], won: true },
      { match_id: selectedMatch.id, player_id: losePair[0], partner_id: losePair[1], won: false },
      { match_id: selectedMatch.id, player_id: losePair[1], partner_id: losePair[0], won: false },
    ]
    await supabase.from('match_players').delete().eq('match_id', selectedMatch.id)
    await supabase.from('match_players').insert(matchPlayers)

    // Kør pointberegning
    await supabase.rpc('calculate_match_points', { p_match_id: selectedMatch.id })

    showToast('Resultat gemt og point beregnet!')
    setShowModal(false); setSelectedMatch(null)
    setForm(EMPTY_FORM); setWinPair([null, null]); setLosePair([null, null])
    load()
  }

  async function toggleVoting(match) {
    await supabase.from('matches').update({ voting_open: !match.voting_open }).eq('id', match.id)
    showToast(match.voting_open ? 'Afstemning lukket' : 'Afstemning åbnet!')
    load()
  }

  const preview = modalMode === 'result' ? computePreview(form) : null

  const openResult = (match) => {
    setSelectedMatch(match)
    setModalMode('result')
    // Pre-fill sæt hvis allerede registreret
    setForm({
      ...EMPTY_FORM,
      match_type: match.match_type,
      set1_us: match.set1_us ?? '',  set1_them: match.set1_them ?? '',
      set2_us: match.set2_us ?? '',  set2_them: match.set2_them ?? '',
      set3_us: match.set3_us ?? '',  set3_them: match.set3_them ?? '',
    })
    setShowModal(true)
  }

  if (loading) return <div className="loading">Henter kampe...</div>

  const now = new Date().toISOString().split('T')[0]
  const upcoming = matches.filter(m => m.match_date >= now && !m.score_us)
  const past = matches.filter(m => m.match_date < now || m.score_us)

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
    const isPast = true // Vis altid resultat-knap
    const hasResult = m.score_us
    const sets = [
      m.set1_us != null ? `${m.set1_us}-${m.set1_them}` : null,
      m.set2_us != null ? `${m.set2_us}-${m.set2_them}` : null,
      m.set3_us != null ? `${m.set3_us}-${m.set3_them}` : null,
    ].filter(Boolean)

    return (
      <div className="match-card">
        <div className="match-date-block">
          <div className="match-date-day">{day}</div>
          <div className="match-date-mon">{mon}</div>
        </div>
        <div className="match-body">
          <div className="match-title">
            {m.title}
            {hasResult && (
              <span style={{ color: '#1a7a4a', fontSize: 12, marginLeft: 6 }}>
                {m.score_us}–{m.score_them} sæt
              </span>
            )}
            <span className={`match-type-pill ${m.match_type === 'official' ? 'pill-official' : 'pill-training'}`}>
              {m.match_type === 'official' ? 'Officiel' : 'Træning'}
            </span>
          </div>
          {sets.length > 0 && (
            <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 500, marginTop: 2 }}>
              {sets.join(' / ')}
            </div>
          )}
          <div className="match-meta">
            {m.location && `${m.location} · `}
            {m.opponent && `mod ${m.opponent} · `}
            {new Date(m.match_date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {isPast && (
              <button onClick={() => openResult(m)}
                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #ccc', background: hasResult ? '#e8f5ee' : 'none', color: hasResult ? '#1a7a4a' : '#666', cursor: 'pointer' }}>
                {hasResult ? '✓ Resultat registreret' : '+ Registrer resultat'}
              </button>
            )}
            {isPast && (
              <button onClick={() => toggleVoting(m)}
                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #ccc', background: m.voting_open ? '#e8f5ee' : 'none', color: m.voting_open ? '#1a7a4a' : '#666', cursor: 'pointer' }}>
                {m.voting_open ? '✓ Afstemning åben' : 'Åbn afstemning'}
              </button>
            )}
          </div>
        </div>
        {!isPast && (
          <button className="match-cal-btn" onClick={() => { downloadICS(m); showToast('Tilføjet til kalender!') }}>
            📅 Kalender
          </button>
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

      {upcoming.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8 }}>Kommende</div>
        {upcoming.map(m => <MatchCard key={m.id} m={m} />)}
      </>}

      {past.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', margin: '14px 0 8px' }}>Afspillede</div>
        {past.map(m => <MatchCard key={m.id} m={m} />)}
      </>}

      {!upcoming.length && !past.length && (
        <div className="empty"><div className="empty-icon">📅</div><div className="empty-text">Tilføj den første kamp!</div></div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ paddingBottom: 32 }}>

            {/* TILFØJ KAMP */}
            {modalMode === 'add' && <>
              <div className="modal-title">
                Tilføj kamp
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="field"><label>Titel</label>
                <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="fx Træningskamp" /></div>
              <div className="field"><label>Dato</label>
                <input type="date" value={form.match_date} onChange={e => setF('match_date', e.target.value)} /></div>
              <div className="field"><label>Sted</label>
                <input value={form.location} onChange={e => setF('location', e.target.value)} placeholder="fx Odense Padel Club" /></div>
              <div className="field"><label>Type</label>
                <select value={form.match_type} onChange={e => setF('match_type', e.target.value)}>
                  <option value="training">Træningskamp</option>
                  <option value="official">Officiel holdkamp</option>
                </select></div>
              <div className="field"><label>Modstander</label>
                <input value={form.opponent} onChange={e => setF('opponent', e.target.value)} placeholder="fx Kerteminde Padel" /></div>
              <button className="btn-primary" onClick={addMatch}>Gem kamp</button>
            </>}

            {/* REGISTRER RESULTAT */}
            {modalMode === 'result' && <>
              <div className="modal-title">
                Registrer resultat
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{selectedMatch?.title}</div>

              {/* Sætscore */}
              <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Sætscore</div>
                <div style={{ display: 'flex', gap: 40, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#666', width: 36 }}></span>
                  <span style={{ fontSize: 11, color: '#666', width: 52, textAlign: 'center' }}>Os</span>
                  <span style={{ fontSize: 11, color: '#666', width: 52, textAlign: 'center' }}>Dem</span>
                </div>
                <SetInput label="Sæt 1" us={form.set1_us} them={form.set1_them}
                  onUs={v => setF('set1_us', v)} onThem={v => setF('set1_them', v)} />
                <SetInput label="Sæt 2" us={form.set2_us} them={form.set2_them}
                  onUs={v => setF('set2_us', v)} onThem={v => setF('set2_them', v)} />
                <SetInput label="Sæt 3 (valgfrit)" us={form.set3_us} them={form.set3_them}
                  onUs={v => setF('set3_us', v)} onThem={v => setF('set3_them', v)} />
              </div>

              {/* Point preview */}
              {preview && (
                <div style={{
                  background: preview.won ? '#e8f5ee' : '#fce8e8',
                  border: `1px solid ${preview.won ? '#a8d5b5' : '#f5b5b5'}`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: preview.won ? '#1a7a4a' : '#a32d2d' }}>
                      {preview.won ? `Sejr ${preview.setsUs}-${preview.setsThem}` : `Tab ${preview.setsUs}-${preview.setsThem}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                      {preview.scoreStr} {form.match_type === 'official' ? '· Officiel ×2' : '· Træning ×1'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: preview.won ? '#1a7a4a' : '#a32d2d' }}>
                      +{preview.total}
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>point per spiller</div>
                  </div>
                </div>
              )}

              {/* Spillervalg */}
              <div style={{ background: '#e8f5ee', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1a7a4a', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>
                  Vinderpar
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <PlayerSelect value={winPair[0]} onChange={v => setWinPair([v, winPair[1]])}
                    exclude={[winPair[1], losePair[0], losePair[1]].filter(Boolean)} />
                  <PlayerSelect value={winPair[1]} onChange={v => setWinPair([winPair[0], v])}
                    exclude={[winPair[0], losePair[0], losePair[1]].filter(Boolean)} />
                </div>
              </div>

              <div style={{ background: '#fce8e8', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a32d2d', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>
                  Taberpar
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PlayerSelect value={losePair[0]} onChange={v => setLosePair([v, losePair[1]])}
                    exclude={[winPair[0], winPair[1], losePair[1]].filter(Boolean)} />
                  <PlayerSelect value={losePair[1]} onChange={v => setLosePair([losePair[0], v])}
                    exclude={[winPair[0], winPair[1], losePair[0]].filter(Boolean)} />
                </div>
              </div>

              <button className="btn-primary" onClick={saveResult}>
                Gem resultat og beregn point
              </button>
            </>}
          </div>
        </div>
      )}
      {ToastEl}
    </>
  )
}
