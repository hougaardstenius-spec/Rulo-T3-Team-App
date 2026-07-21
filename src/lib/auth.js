// PIN-baseret adgangsstyring
// Master PIN giver fuld adgang
// Hold-PIN giver adgang til specifikt hold

const MASTER_PIN = '9999' // Skift dette til dit eget master PIN

export function checkMasterPin(pin) {
  return pin === MASTER_PIN
}

export function checkClubPin(pin, clubs) {
  return clubs.find(c => c.captain_pin === pin) || null
}

export function checkFineMasterPin(pin, clubs) {
  return clubs.find(c => c.fine_master_pin && c.fine_master_pin === pin) || null
}

export function getAuthLevel(pin, clubs) {
  if (checkMasterPin(pin)) return { level: 'master', club: null }
  const captainClub = checkClubPin(pin, clubs)
  if (captainClub) return { level: 'captain', club: captainClub }
  const fineClub = checkFineMasterPin(pin, clubs)
  if (fineClub) return { level: 'fine_master', club: fineClub }
  return { level: 'none', club: null }
}

// Gem auth i sessionStorage så man ikke skal logge ind igen ved sideskift
export function saveAuth(auth) {
  sessionStorage.setItem('padel_auth', JSON.stringify(auth))
}

export function loadAuth() {
  try {
    return JSON.parse(sessionStorage.getItem('padel_auth')) || null
  } catch { return null }
}

export function clearAuth() {
  sessionStorage.removeItem('padel_auth')
}
