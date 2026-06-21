import React, { useState } from 'react'
import Cards from './pages/Cards'
import Vote from './pages/Vote'
import Ranking from './pages/Ranking'
import Matches from './pages/Matches'
import Admin from './pages/Admin'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('cards')

  const tabs = [
    { id: 'cards',   icon: '🃏', label: 'Kort'       },
    { id: 'vote',    icon: '🏆', label: 'Afstemning' },
    { id: 'ranking', icon: '📊', label: 'Rangliste'  },
    { id: 'matches', icon: '📅', label: 'Kampe'      },
    { id: 'admin',   icon: '⚙️', label: 'Admin'      },
  ]

  return (
    <div className="app">
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
        {tab === 'admin'   && <Admin   />}
      </main>
    </div>
  )
}
