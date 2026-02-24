import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

// ─── Pool singleton ───────────────────────────────────────────────────────────
let _pool = null
export const getPool = () => {
  if (!_pool) _pool = new SimplePool()
  return _pool
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const nsecToBytes = (nsec) => {
  const trimmed = nsec.trim()
  if (trimmed.startsWith('nsec1')) {
    const { type, data } = nip19.decode(trimmed)
    if (type !== 'nsec') throw new Error('Not a valid nsec key')
    return data // Uint8Array
  }
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Uint8Array.from(trimmed.match(/.{1,2}/g).map(b => parseInt(b, 16)))
  }
  throw new Error('Invalid key — must be nsec1... or 64-char hex')
}

const hexToNpub = (hex) => nip19.npubEncode(hex)
const hexToNsec = (bytes) => nip19.nsecEncode(bytes)

// ─── Fetch profile from relays ────────────────────────────────────────────────
export const fetchProfile = (pubkeyHex) => {
  return new Promise((resolve) => {
    const pool = getPool()
    let found = false
    const timeout = setTimeout(() => {
      if (!found) resolve({})
    }, 6000)

    const sub = pool.subscribe(
      RELAYS,
      { kinds: [0], authors: [pubkeyHex], limit: 1 },
      {
        onevent(event) {
          try {
            const profile = JSON.parse(event.content)
            found = true
            clearTimeout(timeout)
            sub.close()
            resolve(profile)
          } catch {
            resolve({})
          }
        },
        oneose() {
          if (!found) {
            clearTimeout(timeout)
            resolve({})
          }
        },
      }
    )
  })
}

// ─── Publish profile (kind 0) ─────────────────────────────────────────────────
export const publishProfile = async (nsecInput, profileData) => {
  const skBytes = nsecToBytes(nsecInput)
  const pool = getPool()

  const event = finalizeEvent({
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(profileData),
  }, skBytes)

  await Promise.any(pool.publish(RELAYS, event))
  return event
}

// ─── NDK stub (keep initNDK export so AuthContext doesn't break) ──────────────
export const initNDK = () => ({ signer: null })

// ─── Login with extension (NIP-07) ───────────────────────────────────────────
export const loginWithExtension = async (_ndk) => {
  if (!window.nostr) throw new Error('No Nostr extension found. Please install nos2x or Alby.')
  const pubkeyHex = await window.nostr.getPublicKey()
  const npub = hexToNpub(pubkeyHex)
  const profile = await fetchProfile(pubkeyHex)
  return { pubkey: pubkeyHex, npub, profile }
}

// ─── Login with nsec ──────────────────────────────────────────────────────────
export const loginWithNsec = async (_ndk, nsecInput) => {
  const skBytes = nsecToBytes(nsecInput)
  const pubkeyHex = getPublicKey(skBytes)
  const npub = hexToNpub(pubkeyHex)
  const nsec = nsecInput.trim().startsWith('nsec1') ? nsecInput.trim() : hexToNsec(skBytes)
  const profile = await fetchProfile(pubkeyHex)
  return { pubkey: pubkeyHex, npub, nsec, profile }
}

// ─── Generate new keypair ─────────────────────────────────────────────────────
export const generateKeypair = async (_ndk) => {
  const skBytes = generateSecretKey()
  const pubkeyHex = getPublicKey(skBytes)
  const nsec = hexToNsec(skBytes)
  const npub = hexToNpub(pubkeyHex)
  return { pubkey: pubkeyHex, npub, nsec, profile: {} }
}

