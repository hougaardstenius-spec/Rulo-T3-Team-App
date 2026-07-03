import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import { loadAuth, saveAuth, clearAuth, getAuthLevel } from './lib/auth'
import Cards from './pages/Cards'
import Vote from './pages/Vote'
import Ranking from './pages/Ranking'
import Matches from './pages/Matches'
import Stats from './pages/Stats'
import Admin from './pages/Admin'
import './App.css'

export const AppContext = createContext({})

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
    { id: 'cards',   icon: '🃏', label: 'Kort'       },
    { id: 'vote',    icon: '🏆', label: 'Afstemning' },
    { id: 'ranking', icon: '📊', label: 'Rangliste'  },
    { id: 'matches', icon: '📅', label: 'Kampe'      },
    { id: 'stats',   icon: '📈', label: 'Statistik'  },
    { id: 'admin',   icon: '⚙️', label: 'Admin'      },
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
              Kollektivet x RULO.dk
            </div>
            <div style={{ fontSize: 10, color: '#8fafc4', marginTop: 1 }}>Padelforening</div>
          </div>
          {/* Hold-vælger */}
          <select
            value={selectedClub || ''}
            onChange={e => setSelectedClub(e.target.value || null)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer'
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
          {tab === 'admin'   && <Admin   />}
        </main>
      </div>
    </AppContext.Provider>
  )
}
