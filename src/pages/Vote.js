import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { AWARD_META } from '../lib/helpers'

const VOTE_CATS = [
  { id: 'spiller_id', emoji: '⭐', color: '#c9a227', bg: '#3a2800', title: 'Dagens spiller', sub: 'Bedste præstation' },
  { id: 'flop_id',    emoji: '😞', color: '#f56262', bg: '#3a0000', title: 'Dagens flop',    sub: 'Mest skuffende'   },
  { id: 'detalje_id', emoji: '✨', color: '#6ab4f5', bg: '#001a33', title: 'Dagens detalje', sub: 'Bedste enkeltslag' },
  { id: 'bommert_id', emoji: '🤦', color: '#f5a623', bg: '#2d1a00', title: 'Dagens bommert', sub: 'Groveste fejl'     },
]

export default function Vote() {
  const [players, setPlayers] = useState([])
  const [activeMatch, setActiveMatch] = useState(null)
  const [votes, setVotes] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [voterId, setVoterId] = useState(null)
  const [loading, setLoading] = useState(true)
  const { showToast, ToastEl } = useToast()

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: matches }] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('matches').select('*').eq('voting_open', true).limit(1),
      ])
      setPlayers(pl || [])
      setActiveMatch(matches?.[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  // Voter selection — in real app this would be auth
  const selectVoter = (pid) => {
    setVoterId(pid)
    setVotes({})
    setSubmitted(false)
  }

  const selectVote = (catId, pid) => {
    setVotes(v => ({ ...v, [catId]: pid }))
  }

  const submitVotes = async () => {
    if (!voterId || !activeMatch) return
    const payload = {
      match_id: activeMatch.id,
      voter_id: voterId,
      spiller_id: votes['spiller_id'] || null,
      flop_id: votes['flop_id'] || null,
      detalje_id: votes['detalje_id'] || null,
      bommert_id: votes['bommert_id'] || null,
    }
    const { error } = await supabase.from('votes').upsert(payload, { onConflict: 'match_id,voter_id' })
    if (error) { showToast('Fejl ved afstemning — prøv igen'); return }
    setSubmitted(true)
    showToast('Stemmer afgivet!')
  }

  if (loading) return <div className="loading">Henter kamp...</div>

  if (!activeMatch) return (
    <div className="empty">
      <div className="empty-icon">🏓</div>
      <div className="empty-text">Ingen åben afstemning lige nu</div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Afstemning åbnes af admin efter kampen</div>
    </div>
  )

  // Step 1: choose who you are
  if (!voterId) return (
    <>
      <div className="match-header">
        <div>
          <div className="match-info">{activeMatch.match_type === 'official' ? 'Holdkamp' : 'Træningskamp'}</div>
          <div className="match-score">
            {activeMatch.score_us && activeMatch.score_them
              ? `${activeMatch.score_us} – ${activeMatch.score_them}`
              : activeMatch.title}
          </div>
        </div>
        <span className="match-tag">Åben</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Hvem er du?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {players.map(p => (
            <button key={p.id} className="player-vote-btn" onClick={() => selectVoter(p.id)}>
              <div className="pvb-avatar" style={{ background: p.color }}>{p.initials}</div>
              <div className="pvb-name">{p.name.split(' ')[0]}</div>
            </button>
          ))}
        </div>
      </div>
      {ToastEl}
    </>
  )

  // Step 2: submitted
  if (submitted) {
    const voter = players.find(p => p.id === voterId)
    return (
      <>
        <div className="vote-submitted">
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Stemmer afgivet!</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Resultater vises når alle har stemt</div>
        </div>
        <div style={{ marginTop: 16, background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {voter?.name}s stemmer
          </div>
          {VOTE_CATS.map(cat => {
            const p = votes[cat.id] ? players.find(x => x.id === votes[cat.id]) : null
            return (
              <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #eee' }}>
                <span style={{ fontSize: 12, color: '#666' }}>{cat.title}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p ? p.name : '—'}</span>
              </div>
            )
          })}
        </div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setVoterId(null); setSubmitted(false) }}>
          Stem igen som anden spiller
        </button>
        {ToastEl}
      </>
    )
  }

  // Step 3: vote
  const voter = players.find(p => p.id === voterId)
  return (
    <>
      <div className="match-header">
        <div>
          <div className="match-info">{activeMatch.match_type === 'official' ? 'Holdkamp' : 'Træningskamp'}</div>
          <div className="match-score">
            {activeMatch.score_us && activeMatch.score_them
              ? `${activeMatch.score_us} – ${activeMatch.score_them}`
              : activeMatch.title}
          </div>
        </div>
        <button onClick={() => setVoterId(null)} style={{ fontSize: 12, color: '#8fafc4', background: 'none', border: 'none', cursor: 'pointer' }}>
          Skift spiller
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>Du stemmer som: <strong>{voter?.name}</strong></div>

      {VOTE_CATS.map(cat => (
        <div className="vote-category" key={cat.id}>
          <div className="vote-cat-header">
            <div className="vote-cat-icon" style={{ background: cat.bg, color: cat.color }}>
              <span style={{ fontSize: 16 }}>{cat.emoji}</span>
            </div>
            <div>
              <div className="vote-cat-title">{cat.title}</div>
              <div className="vote-cat-sub">{cat.sub}</div>
            </div>
          </div>
          <div className="player-vote-grid">
            {players.filter(p => p.id !== voterId).map(p => (
              <button
                key={p.id}
                className={`player-vote-btn${votes[cat.id] === p.id ? ' selected' : ''}`}
                onClick={() => selectVote(cat.id, p.id)}
              >
                <div className="pvb-avatar" style={{ background: p.color }}>{p.initials}</div>
                <div className="pvb-name">{p.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <button className="vote-submit-btn" onClick={submitVotes}>
        ✓ Afgiv stemmer
      </button>
      {ToastEl}
    </>
  )
}
