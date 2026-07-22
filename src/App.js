import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import { loadAuth, saveAuth, clearAuth, getAuthLevel } from './lib/auth'
import Cards from './pages/Cards'
import Vote from './pages/Vote'
import Ranking from './pages/Ranking'
import Matches from './pages/Matches'
import Stats from './pages/Stats'
import Fines from './pages/Fines'
import Admin from './pages/Admin'
import './App.css'

export const AppContext = createContext({})

// Inline SVG icons (Lucide-style, 24x24, currentColor) — avoids emoji rendering
// inconsistencies across platforms and keeps the nav bar as a real icon system.
const NavIcons = {
  cards: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="13" height="16" rx="2" transform="rotate(-8 3 5)" />
      <rect x="8" y="3" width="13" height="16" rx="2" />
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  ),
  matches: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18M18 9l-5 5-3-3-4 4" />
    </svg>
  ),
  fines: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5a2.5 2.5 0 0 1 2.5-1.5c1.5 0 2.5.8 2.5 2s-1 1.5-2.5 2-2.5.8-2.5 2 1 2 2.5 2a2.5 2.5 0 0 0 2.5-1.5" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
}

export default function App() {
  const [tab, setTab] = useState('cards')
  const [selectedClub, setSelectedClub] = useState(null) // null = alle hold
  const [clubs, setClubs] = useState([])
  const [auth, setAuth] = useState(loadAuth())

  useEffect(() => {
    supabase.from('clubs').select('*').order('sort_order').then(({ data }) => {
      setClubs(data || [])
    })
  }, [])

  const login = (pin) => {
    const result = getAuthLevel(pin, clubs)
    if (result.level !== 'none') {
      saveAuth(result)
      setAuth(result)
      return true
    }
    return false
  }

  const logout = () => {
    clearAuth()
    setAuth(null)
  }

  const tabs = [
    { id: 'cards',   icon: NavIcons.cards,   label: 'Kort'       },
    { id: 'vote',    icon: NavIcons.vote,    label: 'Afstemning' },
    { id: 'ranking', icon: NavIcons.ranking, label: 'Rangliste'  },
    { id: 'matches', icon: NavIcons.matches, label: 'Kampe'      },
    { id: 'stats',   icon: NavIcons.stats,   label: 'Statistik'  },
    { id: 'fines',   icon: NavIcons.fines,   label: 'Bøder'      },
    { id: 'admin',   icon: NavIcons.admin,   label: 'Admin'      },
  ]

  return (
    <AppContext.Provider value={{ clubs, selectedClub, setSelectedClub, auth, login, logout }}>
      <div className="app">
        {/* Association header */}
        <div style={{
          background: '#0d1f2d', padding: '8px 16px 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '.5px' }}>
              Padelværket
            </div>
            <div style={{ fontSize: 10, color: '#8fafc4', marginTop: 1 }}>Padelforening</div>
          </div>
          {/* Hold-vælger */}
          <select
            aria-label="Vælg hold"
            value={selectedClub || ''}
            onChange={e => setSelectedClub(e.target.value || null)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
              minHeight: 36
            }}
          >
            <option value="">Alle hold</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <nav className="nav">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="main">
          {tab === 'cards'   && <Cards   />}
          {tab === 'vote'    && <Vote    />}
          {tab === 'ranking' && <Ranking />}
          {tab === 'matches' && <Matches />}
          {tab === 'stats'   && <Stats   />}
          {tab === 'fines'   && <Fines   />}
          {tab === 'admin'   && <Admin   />}
        </main>
      </div>
    </AppContext.Provider>
  )
}
