import React, { useState } from 'react'
import { avg, barColor, computeScores, AWARD_META } from '../lib/helpers'

function DrillBar({ label, val }) {
  return (
    <div className="drill-bar-row">
      <div className="drill-bar-lbl">{label}</div>
      <div className="drill-bar-track">
        <div className="drill-bar-fill" style={{ width: `${val}%`, background: barColor(val) }} />
      </div>
      <div className="drill-bar-val">{val}</div>
    </div>
  )
}

function OverviewBar({ label, val, color }) {
  return (
    <div className="overview-bar-row">
      <div className="overview-bar-lbl">{label}</div>
      <div className="overview-bar-track">
        <div className="overview-bar-fill" style={{ width: `${val}%`, background: color }} />
      </div>
      <div className="overview-bar-val">{val}</div>
    </div>
  )
}

function DrillPanel({ type, s }) {
  if (type === 'overall') return (
    <div className="drill-panel overall">
      <div className="drill-title">Samlet oversigt</div>
      <div className="overview-section">
        <div className="overview-section-lbl">Offensiv</div>
        <OverviewBar label="Overheads" val={avg(s.bandeja, s.vibora, s.rulo, s.gancho, s.smash)} color="#c9a227" />
        <OverviewBar label="Volleys"   val={avg(s.volley_forhånd, s.volley_baghånd, s.plano)}   color="#185fa5" />
      </div>
      <div className="overview-section">
        <div className="overview-section-lbl">Defensiv</div>
        <OverviewBar label="Grundslag"  val={avg(s.forhånd, s.baghånd)}   color="#2d9e62" />
        <OverviewBar label="Omstilling" val={avg(s.chiquita, s.lob)}       color="#854f0b" />
        <OverviewBar label="Glas"       val={s.glasspil}                   color="#534ab7" />
      </div>
      <div className="overview-section">
        <div className="overview-section-lbl">Generelt</div>
        <OverviewBar label="Spilforst." val={s.spilforstaelse} color="#2d9e62" />
        <OverviewBar label="Bevæg."     val={s.bevaegelse}     color="#993c1d" />
        <OverviewBar label="Komm."      val={s.kommunikation}  color="#5f5e5a" />
      </div>
    </div>
  )

  if (type === 'off') return (
    <div className="drill-panel off">
      <div className="drill-title">Offensiv detaljer</div>
      <div className="drill-group">
        <div className="drill-group-lbl">Overheads</div>
        <DrillBar label="Bandeja" val={s.bandeja} />
        <DrillBar label="Víbora"  val={s.vibora}  />
        <DrillBar label="Rulo"    val={s.rulo}    />
        <DrillBar label="Gancho"  val={s.gancho}  />
        <DrillBar label="Smash"   val={s.smash}   />
      </div>
      <div className="drill-group">
        <div className="drill-group-lbl">Volleys</div>
        <DrillBar label="Forhånd volley"  val={s.volley_forhånd} />
        <DrillBar label="Baghånd volley"  val={s.volley_baghånd} />
        <DrillBar label="Plano"           val={s.plano}           />
      </div>
    </div>
  )

  if (type === 'def') return (
    <div className="drill-panel def">
      <div className="drill-title">Defensiv detaljer</div>
      <div className="drill-group">
        <div className="drill-group-lbl">Grundslag</div>
        <DrillBar label="Forhånd" val={s.forhånd} />
        <DrillBar label="Baghånd" val={s.baghånd} />
      </div>
      <div className="drill-group">
        <div className="drill-group-lbl">Omstillingsslag</div>
        <DrillBar label="Chiquita" val={s.chiquita} />
        <DrillBar label="Lob"      val={s.lob}      />
      </div>
      <div className="drill-group">
        <div className="drill-group-lbl">Spil efter glas</div>
        <DrillBar label="Glasspil" val={s.glasspil} />
      </div>
    </div>
  )

  return null
}

// Mini card shown in the grid
export function PlayerCardMini({ player, stats, onClick }) {
  const s = stats || {}
  const grl = avg(s.forhånd || 50, s.baghånd || 50)
  const ovh = avg(s.bandeja || 50, s.vibora || 50, s.smash || 50)
  const vol = avg(s.volley_forhånd || 50, s.volley_baghånd || 50)
  const { overall, off, def } = computeScores(s)

  return (
    <div className="pcard" onClick={onClick}>
      <div className="pcard-top">
        <div>
          <div className="pcard-rating">{overall}</div>
          <div className="pcard-pos">{player.position}</div>
        </div>
        <div className="pcard-name-block">
          <div className="pcard-name">{player.name}</div>
          <div className="pcard-sub">OFF {off} · DEF {def}</div>
        </div>
        <div className="pcard-avatar" style={{ background: player.color }}>{player.initials}</div>
      </div>
      <div className="pcard-stats">
        {[['GRL', grl], ['OVH', ovh], ['VOL', vol]].map(([l, v]) => (
          <div className="stat-item" key={l}>
            <div className="stat-val">{v}</div>
            <div className="stat-lbl">{l}</div>
          </div>
        ))}
      </div>
      <div className="pcard-bars">
        {[
          ['Grundslag',  avg(s.forhånd || 50, s.baghånd || 50),     '#2d9e62'],
          ['Overheads',  avg(s.bandeja || 50, s.vibora || 50, s.smash || 50), '#c9a227'],
          ['Volleys',    avg(s.volley_forhånd || 50, s.volley_baghånd || 50), '#185fa5'],
          ['Omstilling', avg(s.chiquita || 50, s.lob || 50),         '#854f0b'],
        ].map(([l, v, c]) => (
          <div className="bar-row" key={l}>
            <div className="bar-lbl">{l}</div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${v}%`, background: c }} /></div>
            <div className="bar-val">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Full expanded card with drill-down
export function PlayerCardDetail({ player, stats, awards, onBack }) {
  const [openDrill, setOpenDrill] = useState(null)
  const s = stats || {}
  const { overall, off, def } = computeScores(s)

  const toggleDrill = (type) => setOpenDrill(p => p === type ? null : type)

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Alle spillere</button>
      <div className="card-expanded">
        <div className="card-exp-header">
          <div className="card-exp-avatar" style={{ background: player.color }}>{player.initials}</div>
          <div style={{ flex: 1 }}>
            <div className="card-exp-name">{player.name}</div>
            <div className="card-exp-sub">Position: {player.position}</div>
          </div>
          <div className="card-exp-rating">{overall}</div>
        </div>

        <div className="awards-row">
          {awards && awards.length > 0
            ? awards.map((a, i) => {
                const m = AWARD_META[a.award_type]
                return m ? (
                  <span key={i} className={`award-badge ${m.cls}`}>
                    {m.emoji} {m.label} ×{a.count}
                  </span>
                ) : null
              })
            : <span style={{ fontSize: 12, color: '#6fafc4' }}>Ingen hæder endnu</span>
          }
        </div>

        <div style={{ fontSize: 10, color: '#5fafc4', marginBottom: 8, letterSpacing: '.3px' }}>
          Tryk på en blok for at se detaljer
        </div>

        <div className="score-blocks">
          {[
            { type: 'overall', val: overall, lbl: 'SAMLET',    hint: 'Alle kategorier' },
            { type: 'off',     val: off,     lbl: 'OFFENSIV',  hint: 'Overheads · Volleys' },
            { type: 'def',     val: def,     lbl: 'DEFENSIV',  hint: 'Grundslag · Omstilling' },
          ].map(({ type, val, lbl, hint }) => (
            <div
              key={type}
              className={`score-block${openDrill === type ? ' open' : ''}`}
              onClick={() => toggleDrill(type)}
            >
              <div className="score-block-val">{val}</div>
              <div className="score-block-lbl">{lbl}</div>
              <div className="score-block-hint">{hint}</div>
            </div>
          ))}
        </div>

        {openDrill && <DrillPanel type={openDrill} s={s} />}
      </div>
    </>
  )
}
