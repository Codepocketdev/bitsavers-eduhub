// ─── Admin Config ─────────────────────────────────────────────────────────────
export const ADMIN_NPUBS = [
  'npub10w6ssxk09tz8use8nvw9ujfsl2katfzu6e5lnrdyrxq90xts5qtqj3kz4q', // Super Admin
]

// Checks hardcoded list AND localStorage (synced from Nostr by ManageAdmins)
export const isAdmin = (npub) => {
  if (!npub) return false
  if (ADMIN_NPUBS.includes(npub)) return true
  try {
    const stored = JSON.parse(localStorage.getItem('bitsavers_admins') || '[]')
    return stored.includes(npub)
  } catch { return false }
}

export const isSuperAdmin = (npub) => npub === ADMIN_NPUBS[0]

// Called on app boot — syncs admin list from Nostr into localStorage
export const syncAdminsFromNostr = async () => {
  try {
    const { getPool } = await import('../lib/nostr')
    const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
    const pool = getPool()
    let latest = { created_at: 0 }
    await new Promise(resolve => {
      const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': ['bitsavers-admins'], limit: 20 }, {
        onevent(e) {
          if (e.content.startsWith('ADMIN_LIST:') && e.created_at > latest.created_at) {
            try { latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('ADMIN_LIST:'.length)) } } catch {}
          }
        },
        oneose() {
          if (latest.data) {
            const merged = [...new Set([...ADMIN_NPUBS, ...latest.data])]
            localStorage.setItem('bitsavers_admins', JSON.stringify(merged))
          }
          sub.close(); resolve()
        }
      })
      setTimeout(() => { sub.close(); resolve() }, 6000)
    })
  } catch(e) { console.error('syncAdminsFromNostr failed:', e) }
}

