// ─── Admin Config ─────────────────────────────────────────────────────────────
// Hardcoded super admins — these always have access regardless of localStorage
export const ADMIN_NPUBS = [
  'npub10w6ssxk09tz8use8nvw9ujfsl2katfzu6e5lnrdyrxq90xts5qtqj3kz4q', // Super Admin
]

// Checks BOTH hardcoded list AND localStorage-added admins
export const isAdmin = (npub) => {
  if (!npub) return false
  if (ADMIN_NPUBS.includes(npub)) return true
  try {
    const stored = JSON.parse(localStorage.getItem('bitsavers_admins') || '[]')
    return stored.includes(npub)
  } catch { return false }
}

export const isSuperAdmin = (npub) => {
  return npub === ADMIN_NPUBS[0]
}

