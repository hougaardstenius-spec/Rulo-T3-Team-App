import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { downloadICS, formatDate } from '../lib/helpers'
import { useToast } from '../hooks/useToast'

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', match_date: '', location: '', match_type: 'training', score_us: '', score_them: '', opponent: '' })
  const { showToast, ToastEl } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })
    setMatches(data || [])
    setLoading(false)
  }

  async function addMatch() {
    if (!form.title || !form.match_date) { showToast('Udfyld titel og dato'); return }
    const { error } = await supabase.from('matches').insert(form)
    if (error) { showToast('Fejl — prøv igen'); return }
    showToast('Kamp tilføjet!')
    setShowModal(false)
    setForm({ title: '', match_date: '', location: '', match_type: 'training', score_us: '', score_them: '', opponent: '' })
    load()
  }

  async function toggleVoting(match) {
    await supabase.from('matches').update({ voting_open: !match.voting_open }).eq('id', match.id)
    showToast(match.voting_open ? 'Afstemning lukket' : 'Afstemning åbnet!')
    load()
  }

  if (loading) return <div className="loading">Henter kampe...</div>

  const now = new Date().toISOString().split('T')[0]
  const upcoming = matches.filter(m => m.match_date >= now)
  const past = matches.filter(m => m.match_date < now)

  const MatchCard = ({ m }) => {
    const { day, mon } = formatDate(m.match_date)
    const isPast = m.match_date < now
    return (
      <div className="match-card">
        <div className="match-date-block">
          <div className="match-date-day">{day}</div>
          <div className="match-date-mon">{mon}</div>
        </div>
        <div className="match-body">
          <div className="match-title">
            {m.title}
            {m.score_us && <span className="match-result"> {m.score_us}–{m.score_them}</span>}
            <span className={`match-type-pill ${m.match_type === 'official' ? 'pill-official' : 'pill-training'}`}>
              {m.match_type === 'official' ? 'Officiel' : 'Træning'}
            </span>
          </div>
          <div className="match-meta">
            {m.location && `${m.location} · `}{m.opponent && `mod ${m.opponent} · `}
            {new Date(m.match_date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {isPast && (
            <button
              onClick={() => toggleVoting(m)}
              style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #ccc', background: m.voting_open ? '#e8f5ee' : 'none', color: m.voting_open ? '#1a7a4a' : '#666', cursor: 'pointer' }}
            >
              {m.voting_open ? '✓ Afstemning åben' : 'Åbn afstemning'}
            </button>
          )}
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
        <button className="btn-primary" style={{ width: 'auto', padding: '7px 14px', fontSize: 13 }} onClick={() => setShowModal(true)}>
          + Tilføj kamp
        </button>
      </div>

      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8 }}>Kommende</div>
          {upcoming.map(m => <MatchCard key={m.id} m={m} />)}
        </>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.5px', textTransform: 'uppercase', margin: '14px 0 8px' }}>Afspillede</div>
          {past.map(m => <MatchCard key={m.id} m={m} />)}
        </>
      )}

      {!upcoming.length && !past.length && (
        <div className="empty">
          <div className="empty-icon">📅</div>
          <div className="empty-text">Ingen kampe endnu — tilføj den første!</div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">
              Tilføj kamp
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="field">
              <label>Titel</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="fx Træningskamp" />
            </div>
            <div className="field">
              <label>Dato</label>
              <input type="date" value={form.match_date} onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Sted</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="fx Odense Padel Club" />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value }))}>
                <option value="training">Træningskamp</option>
                <option value="official">Officiel holdkamp</option>
              </select>
            </div>
            <div className="field">
              <label>Modstander (valgfrit)</label>
              <input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="fx Kerteminde Padel" />
            </div>
            <button className="btn-primary" onClick={addMatch}>Gem kamp</button>
          </div>
        </div>
      )}
      {ToastEl}
    </>
  )
}
