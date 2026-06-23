import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AWARD_CATS = [
  { id: 'spiller', label: 'Dagens spiller', emoji: '⭐', color: '#c9a227', bg: '#fdf6e3', textColor: '#7a5c00' },
  { id: 'detalje', label: 'Dagens detalje', emoji: '✨', color: '#185fa5', bg: '#e8f0fe', textColor: '#1a5cb5' },
  { id: 'flop',    label: 'Dagens flop',    emoji: '😞', color: '#e24b4a', bg: '#fce8e8', textColor: '#a32d2d' },
  { id: 'bommert', label: 'Dagens bommert', emoji: '🤦', color: '#f5a623', bg: '#faeeda', textColor: '#7a4500' },
]

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 6px', border: 'none', borderRadius: 8,
      background: active ? '#0d1f2d' : 'none',
      color: active ? '#fff' : 'var(--color-text-secondary)',
      fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all .15s'
    }}>{label}</button>
  )
}

export default function Ranking() {
  const [tab, setTab] = useState('matches') // 'matches' | 'awards'
  const [rows, setRows] = useState([])
  const [players, setPlayers] = useState([])
  const [awardsData, setAwardsData] = useState({})
  const [awardCat, setAwardCat] = useState('spiller')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ranking }, { data: pl }, { data: awards }] = await Promise.all([
        supabase.from('ranking').select('*, players(name, initials, color)').eq('season', '2026').order('points', { ascending: false }),
        supabase.from('players').select('*').order('name'),
        supabase.from('awards').select('player_id, award_type'),
      ])
      setRows(ranking || [])
      setPlayers(pl || [])

      // Gruppér awards: { spiller: [{player_id, count}], detalje: [...], ... }
      const counts = {}
      ;(awards || []).forEach(a => {
        if (!counts[a.award_type]) counts[a.award_type] = {}
        counts[a.award_type][a.player_id] = (counts[a.award_type][a.player_id] || 0) + 1
      })
      // Konverter til sorterede arrays
      const result = {}
      Object.entries(counts).forEach(([type, playerCounts]) => {
        result[type] = Object.entries(playerCounts)
          .map(([player_id, count]) => ({ player_id, count }))
          .sort((a, b) => b.count - a.count)
      })
      setAwardsData(result)
      setLoading(false)
    }
    load()
  }, [])

  const copyRankingMessage = () => {
    const medals = ['1.','2.','3.']
    const top3 = rows.slice(0, 3).map((r, i) => {
      const p = r.players
      return medals[i] + ' ' + (p?.name || '') + ' - ' + r.points + ' pts (' + r.wins + 'V ' + r.losses + 'T)'
    }).join('\n')
    const lines = ['Ranglisten er opdateret! Saeson 2026', '', top3, '', 'Se hele ranglisten:', 'https://hougaardsstenius-spec.github.io/Rulo-T3-Team-App']
    navigator.clipboard.writeText(lines.join('\n'))
  }

  if (loading) return <div className="loading">Henter rangliste...</div>

  const posClass = ['', 'gold', 'silver', 'bronze']

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Rangliste</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Sæson 2026</span>
        {tab === 'matches' && rows.length > 0 && (
          <button onClick={() => { copyRankingMessage(); }}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            📋 Del
          </button>
        )}
      </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 }}>
        <TabBtn label="🏓 Kampe" active={tab === 'matches'} onClick={() => setTab('matches')} />
        <TabBtn label="🏆 Afstemninger" active={tab === 'awards'} onClick={() => setTab('awards')} />
      </div>

      {/* KAMP-RANGLISTE */}
      {tab === 'matches' && (
        <>
          {rows.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">Ingen kampe spillet endnu</div></div>
          ) : (
            <div className="rank-list">
              {rows.map((r, i) => {
                const p = r.players
                const diff = r.points_diff || 0
                const trendUp = diff > 0
                const trendDn = diff < 0
                return (
                  <div className="rank-item" key={r.id}>
                    <div className={`rank-pos ${posClass[i + 1] || ''}`}>{i + 1}</div>
                    <div className="rank-avatar" style={{ background: p?.color }}>{p?.initials}</div>
                    <div className="rank-info">
                      <div className="rank-name">{p?.name}</div>
                      <div className="rank-wl">
                        <span className="wl-pill wl-w">{r.wins}V</span>
                        <span className="wl-pill wl-l">{r.losses}T</span>
                      </div>
                    </div>
                    <div className="rank-score">
                      <div className="rank-pts">{r.points}<span className="rank-pts-lbl"> pts</span></div>
                      {diff !== 0 && (
                        <div className={`rank-trend ${trendUp ? 'trend-up' : trendDn ? 'trend-dn' : ''}`}>
                          {trendUp ? '▲' : '▼'} {Math.abs(diff)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* AFSTEMNINGS-RANGLISTE */}
      {tab === 'awards' && (
        <>
          {/* Kategori-vælger */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {AWARD_CATS.map(cat => (
              <button key={cat.id} onClick={() => setAwardCat(cat.id)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, transition: 'all .15s',
                  background: awardCat === cat.id ? cat.color : 'var(--color-background-secondary)',
                  color: awardCat === cat.id ? '#fff' : 'var(--color-text-secondary)',
                }}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Liste */}
          {(() => {
            const cat = AWARD_CATS.find(c => c.id === awardCat)
            const catData = awardsData[awardCat] || []

            if (catData.length === 0) return (
              <div className="empty">
                <div className="empty-icon">{cat.emoji}</div>
                <div className="empty-text">Ingen stemmer afgivet endnu</div>
              </div>
            )

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Header */}
                <div style={{ background: cat.bg, border: `1px solid ${cat.color}33`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: cat.textColor }}>{cat.label} — alle tider</span>
                </div>

                {catData.map((entry, i) => {
                  const p = players.find(pl => pl.id === entry.player_id)
                  if (!p) return null
                  const maxCount = catData[0]?.count || 1
                  const pct = Math.round((entry.count / maxCount) * 100)
                  return (
                    <div key={entry.player_id} style={{
                      background: 'var(--color-background-primary)', border: `0.5px solid ${i === 0 ? cat.color : 'var(--color-border-tertiary)'}`,
                      borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12
                    }}>
                      {/* Placering */}
                      <div style={{
                        fontSize: 18, fontWeight: 700, width: 28, textAlign: 'center',
                        color: i === 0 ? cat.color : i === 1 ? '#8fa3b1' : i === 2 ? '#a0674a' : 'var(--color-text-tertiary)'
                      }}>{i + 1}</div>

                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {p.initials}
                      </div>

                      {/* Navn + bar */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 5 }}>{p.name}</div>
                        <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 3, transition: 'width .4s ease' }} />
                        </div>
                      </div>

                      {/* Antal */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: cat.color, lineHeight: 1 }}>{entry.count}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{entry.count === 1 ? 'gang' : 'gange'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}
    </>
  )
}
