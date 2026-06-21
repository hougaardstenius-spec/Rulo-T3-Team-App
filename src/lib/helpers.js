export const avg = (...vals) =>
  Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)

export const barColor = (v) =>
  v >= 80 ? '#2d9e62' : v >= 65 ? '#c9a227' : '#e24b4a'

export const AWARD_META = {
  spiller: { cls: 'award-spiller', emoji: '⭐', label: 'Dagens spiller' },
  detalje: { cls: 'award-detalje', emoji: '✨', label: 'Dagens detalje' },
  bommert: { cls: 'award-bommert', emoji: '🤦', label: 'Dagens bommert' },
  flop:    { cls: 'award-flop',    emoji: '😞', label: 'Dagens flop' },
}

// Computed scores from raw stats
export const computeScores = (s) => {
  if (!s) return { overall: 0, off: 0, def: 0 }
  const off = avg(s.bandeja, s.vibora, s.rulo, s.gancho, s.smash,
                  s.volley_forhånd, s.volley_baghånd, s.plano)
  const def = avg(s.forhånd, s.baghånd, s.chiquita, s.lob, s.glasspil)
  const gen = avg(s.spilforstaelse, s.bevaegelse, s.kommunikation)
  const overall = Math.round((off + def + gen) / 3)
  return { overall, off, def }
}

// Generate .ics calendar file and trigger download
export const downloadICS = (match) => {
  const dateStr = match.match_date.replace(/-/g, '')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelHold//DA',
    'BEGIN:VEVENT',
    `DTSTART:${dateStr}T170000`,
    `DTEND:${dateStr}T190000`,
    `SUMMARY:${match.title}`,
    `LOCATION:${match.location || ''}`,
    `DESCRIPTION:${match.match_type === 'official' ? 'Officiel holdkamp' : 'Træningskamp'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `padel-${dateStr}.ics`
  a.click()
}

export const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  const day = d.getDate()
  const mon = d.toLocaleString('da-DK', { month: 'short' }).toUpperCase().replace('.', '')
  return { day, mon }
}
