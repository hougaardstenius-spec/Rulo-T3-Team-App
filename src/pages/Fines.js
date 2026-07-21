import React, { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { AppContext } from '../App'
import { getAuthLevel } from '../lib/auth'

export default function Fines() {
  const { selectedClub, clubs } = useContext(AppContext)
  const [players, setPlayers] = useState([])
  const [clubPlayers, setClubPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [fines, setFines] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPlayer, setExpandedPlayer] = useState(null)

  const [auth, setAuth] = useState(null)
  const [showUnlock, setShowUnlock] = useState(false)
  const [pin, setPin] = useState('')

  const [showAddFine, setShowAddFine] = useState(false)
  const [addForm, setAddForm] = useState({ player_id: '', category_id: '', custom_label: '', amount: '', note: '' })
  const [saving, setSaving] = useState(false)

  const [showCategories, setShowCategories] = useState(false)
  const [newCat, setNewCat] = useState({ label: '', amount: '' })

  const { showToast, ToastEl } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: pl }, { data: cp }, { data: cats }, { data: fs }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('club_players').select('*'),
      supabase.from('fine_categories').select('*').order('sort_order'),
      supabase.from('fines').select('*').order('created_at', { ascending: false }),
    ])
    setPlayers(pl || [])
    setClubPlayers(cp || [])
    setCategories(cats || [])
    setFines(fs || [])
    setLoading(false)
  }

  const visiblePlayerIds = selectedClub
    ? clubPlayers.filter(cp => cp.club_id === selectedClub).map(cp => cp.player_id)
    : players.map(p => p.id)

  const clubIdForPlayer = (playerId) => clubPlayers.find(cp => cp.player_id === playerId)?.club_id || null

  const visibleFines = fines.filter(f => visiblePlayerIds.includes(f.player_id))

  const totalsByPlayer = {}
  visibleFines.forEach(f => {
    if (!totalsByPlayer[f.player_id]) totalsByPlayer[f.player_id] = { owed: 0, paidSum: 0, count: 0 }
    if (f.paid) totalsByPlayer[f.player_id].paidSum += Number(f.amount)
    else totalsByPlayer[f.player_id].owed += Number(f.amount)
    totalsByPlayer[f.player_id].count++
  })

  const leaderboard = Object.entries(totalsByPlayer)
    .map(([pid, t]) => ({ player: players.find(p => p.id === pid), ...t }))
    .filter(e => e.player)
    .sort((a, b) => b.owed - a.owed || b.paidSum - a.paidSum)

  const potTotal = visibleFines.reduce((sum, f) => sum + Number(f.amount), 0)
  const potOwed = visibleFines.filter(f => !f.paid).reduce((sum, f) => sum + Number(f.amount), 0)
  const currentClub = clubs.find(c => c.id === selectedClub)

  // ── Auth ──
  const handleUnlock = () => {
    const result = getAuthLevel(pin, clubs)
    if (result.level === 'master' || result.level === 'fine_master') {
      setAuth(result)
      setShowUnlock(false)
      setPin('')
      showToast(result.level === 'master' ? 'Låst op som Master' : `Låst op — ${result.club.name}`)
    } else {
      showToast('Forkert PIN')
    }
  }

  const lock = () => { setAuth(null); setPin('') }

  const canManageClub = (clubId) => {
    if (!auth) return false
    if (auth.level === 'master') return true
    return auth.level === 'fine_master' && auth.club?.id === clubId
  }
  const canManageAny = auth && (auth.level === 'master' || auth.level === 'fine_master')
  const isMaster = auth?.level === 'master'

  // Spillere den nuværende bruger må registrere bøder for
  const manageablePlayerIds = isMaster
    ? players.map(p => p.id)
    : players.filter(p => clubIdForPlayer(p.id) === auth?.club?.id).map(p => p.id)

  // ── Registrér bøde ──
  const openAddFine = (playerId) => {
    setAddForm({ player_id: playerId || '', category_id: categories.find(c => c.active)?.id || '', custom_label: '', amount: '', note: '' })
    setShowAddFine(true)
  }

  const setAddF = (k, v) => setAddForm(f => ({ ...f, [k]: v }))

  const selectedCategory = categories.find(c => c.id === addForm.category_id)
  const isFritekst = addForm.category_id === 'fritekst'

  const submitFine = async () => {
    if (!addForm.player_id) { showToast('Vælg en spiller'); return }
    const amount = Number(isFritekst ? addForm.amount : (addForm.amount || selectedCategory?.amount))
    if (!amount || amount <= 0) { showToast('Angiv et gyldigt beløb'); return }
    if (isFritekst && !addForm.custom_label.trim()) { showToast('Skriv en beskrivelse'); return }
    setSaving(true)
    const { error } = await supabase.from('fines').insert({
      player_id: addForm.player_id,
      club_id: clubIdForPlayer(addForm.player_id),
      category_id: isFritekst ? null : (addForm.category_id || null),
      custom_label: isFritekst ? addForm.custom_label.trim() : null,
      amount,
      note: addForm.note.trim() || null,
    })
    setSaving(false)
    if (error) { showToast('Fejl — prøv igen'); return }
    showToast('Bøde registreret!')
    setShowAddFine(false)
    load()
  }

  const togglePaid = async (fine) => {
    const paid = !fine.paid
    await supabase.from('fines').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', fine.id)
    setFines(prev => prev.map(f => f.id === fine.id ? { ...f, paid, paid_at: paid ? new Date().toISOString() : null } : f))
    showToast(paid ? 'Markeret som betalt' : 'Markeret som ikke betalt')
  }

  // ── Kategorier (kun Master) ──
  const addCategory = async () => {
    if (!newCat.label.trim() || !Number(newCat.amount)) { showToast('Udfyld navn og beløb'); return }
    const sort_order = categories.length ? Math.max(...categories.map(c => c.sort_order)) + 1 : 1
    const { data, error } = await supabase.from('fine_categories')
      .insert({ label: newCat.label.trim(), amount: Number(newCat.amount), sort_order })
      .select().single()
    if (error) { showToast('Fejl — prøv igen'); return }
    setCategories(prev => [...prev, data])
    setNewCat({ label: '', amount: '' })
    showToast('Kategori tilføjet!')
  }

  const updateCategory = async (cat, changes) => {
    await supabase.from('fine_categories').update(changes).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, ...changes } : c))
  }

  const fineLabel = (f) => {
    if (f.custom_label) return f.custom_label
    return categories.find(c => c.id === f.category_id)?.label || 'Ukendt kategori'
  }

  if (loading) return <div className="loading">Henter bødekasse...</div>

  return (
    <>
      <div className="page-header">
        <span className="page-title">Bødekasse{currentClub ? ` — ${currentClub.name}` : ''}</span>
        {!auth ? (
          <button onClick={() => setShowUnlock(v => !v)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            Lås op
          </button>
        ) : (
          <button onClick={lock}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            Lås ({isMaster ? 'Master' : auth.club?.name})
          </button>
        )}
      </div>

      {showUnlock && !auth && (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="fines-pin">Bødemester/Master-PIN</label>
            <input id="fines-pin" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()} placeholder="••••" maxLength={8} />
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={handleUnlock}>Lås op</button>
        </div>
      )}

      <div style={{ background: 'linear-gradient(145deg,#1a2e4a 0%,#0d1f2d 100%)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#8fafc4', letterSpacing: '.5px', textTransform: 'uppercase' }}>Udestående</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f5e642' }}>{potOwed} kr</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#8fafc4', letterSpacing: '.5px', textTransform: 'uppercase' }}>I alt registreret</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{potTotal} kr</div>
        </div>
      </div>

      {canManageAny && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={() => openAddFine('')}>
            + Registrér bøde
          </button>
          {isMaster && (
            <button onClick={() => setShowCategories(true)}
              style={{ fontSize: 13, padding: '8px 14px', borderRadius: 10, border: '0.5px solid var(--color-border-secondary)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Bødekategorier
            </button>
          )}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💰</div>
          <div className="empty-text">Ingen bøder registreret endnu</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaderboard.map((entry, i) => {
            const isExpanded = expandedPlayer === entry.player.id
            const playerFines = visibleFines.filter(f => f.player_id === entry.player.id)
            const clubId = clubIdForPlayer(entry.player.id)
            return (
              <div key={entry.player.id} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden' }}>
                <div
                  role="button" tabIndex={0} className="interactive-card"
                  onClick={() => setExpandedPlayer(isExpanded ? null : entry.player.id)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpandedPlayer(isExpanded ? null : entry.player.id))}
                  aria-expanded={isExpanded}
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 && entry.owed > 0 ? '#e24b4a' : 'var(--color-text-tertiary)', width: 24, textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: entry.player.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{entry.player.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{entry.player.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{entry.count} bøde{entry.count === 1 ? '' : 'r'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: entry.owed > 0 ? '#e24b4a' : '#1a7a4a' }}>{entry.owed > 0 ? `${entry.owed} kr` : 'Betalt'}</div>
                    {entry.paidSum > 0 && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{entry.paidSum} kr betalt</div>}
                  </div>
                  <span aria-hidden="true" style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: 12, background: 'var(--color-background-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {playerFines.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-background-primary)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{fineLabel(f)}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{new Date(f.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}{f.note ? ` · ${f.note}` : ''}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: f.paid ? '#1a7a4a' : '#e24b4a' }}>{f.amount} kr</div>
                        {canManageClub(clubId) ? (
                          <button onClick={() => togglePaid(f)} aria-pressed={f.paid}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: f.paid ? '#e8f5ee' : '#fce8e8', color: f.paid ? '#1a7a4a' : '#a32d2d' }}>
                            {f.paid ? '✓ Betalt' : 'Marker betalt'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: f.paid ? '#1a7a4a' : '#e24b4a' }}>{f.paid ? 'Betalt' : 'Skyldig'}</span>
                        )}
                      </div>
                    ))}
                    {canManageClub(clubId) && (
                      <button onClick={() => openAddFine(entry.player.id)}
                        style={{ marginTop: 4, padding: '8px', border: '1.5px dashed var(--color-border-secondary)', borderRadius: 8, background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                        + Ny bøde til {entry.player.name.split(' ')[0]}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Registrér bøde */}
      {showAddFine && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddFine(false)}>
          <div className="modal">
            <div className="modal-title">Registrér bøde<button className="modal-close" onClick={() => setShowAddFine(false)} aria-label="Luk">✕</button></div>

            <div className="field">
              <label htmlFor="fine-player">Spiller</label>
              <select id="fine-player" value={addForm.player_id} onChange={e => setAddF('player_id', e.target.value)}>
                <option value="">Vælg spiller</option>
                {players.filter(p => manageablePlayerIds.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="fine-category">Kategori</label>
              <select id="fine-category" value={addForm.category_id} onChange={e => setAddF('category_id', e.target.value)}>
                {categories.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.id}>{c.label} — {c.amount} kr</option>
                ))}
                <option value="fritekst">Andet (fritekst)</option>
              </select>
            </div>

            {isFritekst && (
              <div className="field">
                <label htmlFor="fine-custom-label">Beskrivelse</label>
                <input id="fine-custom-label" value={addForm.custom_label} onChange={e => setAddF('custom_label', e.target.value)} placeholder="fx Tabte på straffe" />
              </div>
            )}

            <div className="field">
              <label htmlFor="fine-amount">Beløb (kr)</label>
              <input id="fine-amount" type="number" inputMode="numeric" min="0"
                value={addForm.amount || (isFritekst ? '' : selectedCategory?.amount ?? '')}
                onChange={e => setAddF('amount', e.target.value)} placeholder="fx 20" />
            </div>

            <div className="field">
              <label htmlFor="fine-note">Note (valgfri)</label>
              <input id="fine-note" value={addForm.note} onChange={e => setAddF('note', e.target.value)} placeholder="fx efter kampen mod Kerteminde" />
            </div>

            <button className="btn-primary" onClick={submitFine} disabled={saving}>
              {saving ? 'Gemmer...' : 'Registrér bøde'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Bødekategorier (kun Master) */}
      {showCategories && isMaster && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCategories(false)}>
          <div className="modal">
            <div className="modal-title">Bødekategorier<button className="modal-close" onClick={() => setShowCategories(false)} aria-label="Luk">✕</button></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-background-secondary)', borderRadius: 8, padding: '8px 10px', opacity: cat.active ? 1 : 0.5 }}>
                  <input aria-label={`Navn på kategori ${cat.label}`} value={cat.label} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, label: e.target.value } : c))}
                    onBlur={e => updateCategory(cat, { label: e.target.value })}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                  <input aria-label={`Beløb for ${cat.label}`} type="number" value={cat.amount} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, amount: e.target.value } : c))}
                    onBlur={e => updateCategory(cat, { amount: Number(e.target.value) })}
                    style={{ width: 64, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, textAlign: 'center' }} />
                  <button onClick={() => updateCategory(cat, { active: !cat.active })} aria-pressed={cat.active}
                    style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: cat.active ? '#e8f5ee' : '#fce8e8', color: cat.active ? '#1a7a4a' : '#a32d2d', whiteSpace: 'nowrap' }}>
                    {cat.active ? 'Aktiv' : 'Skjult'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '0.5px solid #eee', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Ny kategori</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input aria-label="Navn på ny kategori" value={newCat.label} onChange={e => setNewCat(c => ({ ...c, label: e.target.value }))} placeholder="fx Sent til kamp"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <input aria-label="Beløb for ny kategori" type="number" value={newCat.amount} onChange={e => setNewCat(c => ({ ...c, amount: e.target.value }))} placeholder="kr"
                  style={{ width: 72, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, textAlign: 'center' }} />
                <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px' }} onClick={addCategory}>Tilføj</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ToastEl}
    </>
  )
}
