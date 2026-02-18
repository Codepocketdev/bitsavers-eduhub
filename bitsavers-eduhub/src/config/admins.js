// ─── Admin Config ─────────────────────────────────────────────────────────────
// To add an admin: add their npub to the array below
// To remove an admin: delete their npub from the array
// The first npub is the super admin (cannot be removed from the panel)

export const ADMIN_NPUBS = [
  'npub10w6ssxk09tz8use8nvw9ujfsl2katfzu6e5lnrdyrxq90xts5qtqj3kz4q', // Super Admin
]

export const isAdmin = (npub) => {
  if (!npub) return false
  return ADMIN_NPUBS.includes(npub)
}

export const isSuperAdmin = (npub) => {
  return npub === ADMIN_NPUBS[0]
}

