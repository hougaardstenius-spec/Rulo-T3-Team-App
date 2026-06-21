import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Ranking() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: ranking } = await supabase
        .from('ranking')
        .select('*, players(name, initials, color)')
        .eq('season', '2026')
        .order('points', { ascending: false })
      setRows(ranking || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="loading">Henter rangliste...</div>

  if (!rows.length) return (
    <div className="empty">
      <div className="empty-icon">📊</div>
      <div className="empty-text">Ingen data endnu — spil nogle kampe!</div>
    </div>
  )

  const posClass = ['', 'gold', 'silver', 'bronze']

  return (
    <>
      <div className="page-header">
        <span className="page-title">Rangliste · 2026</span>
        <span className="page-sub">Baseret på kampe</span>
      </div>
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
                <div className="rank-pts">
                  {r.points}<span className="rank-pts-lbl"> pts</span>
                </div>
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
    </>
  )
}
