import { useState, useEffect, useRef } from 'react'
import { Video, Users, Clock, ExternalLink, RefreshCw, Loader, Calendar, Radio, ChevronRight, Wifi, WifiOff } from 'lucide-react'

const C = {
  bg: '#080808', card: '#141414', surface: '#0f0f0f',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
  blue: '#3b82f6',
}

const getCredentials = () => {
  try { return JSON.parse(localStorage.getItem('bitsavers_zoom') || '{}') } catch { return {} }
}

const timeUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date()
  if (diff <= 0) return 'Starting now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `in ${Math.floor(h/24)}d ${h%24}h`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${m}m`
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatDuration = (mins) => {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── Participant Avatar ───────────────────────────────────────────────────────
function ParticipantChip({ p }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000', flexShrink: 0 }}>
        {(p.user_name || p.name || '?').slice(0,2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.user_name || p.name || 'Unknown'}
        </div>
        {p.location && <div style={{ fontSize: 10, color: C.muted }}>{p.location}</div>}
      </div>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, flexShrink: 0, boxShadow: `0 0 6px ${C.green}` }} />
    </div>
  )
}

// ─── Live Meeting Card ────────────────────────────────────────────────────────
function LiveMeetingCard({ meeting, onJoin, onExpand, expanded, participants, loadingParticipants }) {
  return (
    <div style={{ background: C.card, border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, overflow: 'hidden', marginBottom: 14, boxShadow: '0 0 20px rgba(34,197,94,0.08)' }}>
      {/* Live banner */}
      <div style={{ background: 'rgba(34,197,94,0.12)', borderBottom: '1px solid rgba(34,197,94,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Radio size={12} color={C.green} style={{ animation: 'livePulse 1.5s ease infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 1.5 }}>LIVE NOW</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{meeting.participants_count || 0} in call</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Meeting info */}
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>{meeting.topic || 'BitSavers Class'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {meeting.host && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <Users size={12} /> Host: {meeting.host}
            </div>
          )}
          {meeting.duration && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <Clock size={12} /> {formatDuration(meeting.duration)}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onJoin(meeting)} style={{ flex: 1, background: C.green, border: 'none', color: '#000', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Video size={16} /> Join Class
          </button>
          <button onClick={() => onExpand(meeting.id)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '12px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> {expanded ? 'Hide' : 'Who\'s in'}
            <ChevronRight size={12} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)', transition: '0.2s' }} />
          </button>
        </div>

        {/* Participants panel */}
        {expanded && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={12} /> Participants in call
            </div>
            {loadingParticipants ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading participants…
              </div>
            ) : participants?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {participants.map((p, i) => <ParticipantChip key={i} p={p} />)}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted }}>No participants data available</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Upcoming Meeting Card ────────────────────────────────────────────────────
function UpcomingCard({ meeting, onJoin }) {
  const [countdown, setCountdown] = useState(timeUntil(meeting.start_time))

  useEffect(() => {
    const t = setInterval(() => setCountdown(timeUntil(meeting.start_time)), 30000)
    return () => clearInterval(t)
  }, [meeting.start_time])

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{meeting.topic || 'BitSavers Class'}</div>
          <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={11} /> {formatTime(meeting.start_time)}
          </div>
          {meeting.duration && (
            <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <Clock size={11} /> Duration: {formatDuration(meeting.duration)}
            </div>
          )}
        </div>
        {/* Countdown badge */}
        <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent }}>{countdown}</div>
        </div>
      </div>

      {meeting.join_url && (
        <button onClick={() => onJoin(meeting)} style={{ width: '100%', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ExternalLink size={13} /> Open Zoom Link
        </button>
      )}
    </div>
  )
}

// ─── No Credentials Screen ────────────────────────────────────────────────────
function NoCredentials() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.dim, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <WifiOff size={28} color={C.muted} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Zoom Not Connected</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Admin can connect Zoom in<br />
        <span style={{ color: C.accent, fontWeight: 600 }}>Admin Panel → Live Classes</span>
      </div>
    </div>
  )
}

// ─── Main Live Classes Page ───────────────────────────────────────────────────
export default function LiveClassesPage() {
  const [live, setLive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [participants, setParticipants] = useState({}) // meetingId → []
  const [loadingParticipants, setLoadingParticipants] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const creds = getCredentials()
  const hasCredentials = creds.accountId && creds.clientId && creds.clientSecret
  const pollRef = useRef(null)

  const callZoom = async (action, extra = {}) => {
    const res = await fetch('/api/zoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: creds.accountId,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        action,
        ...extra,
      })
    })
    const text = await res.text()
    if (!text) throw new Error('Empty response from server — make sure you are on the deployed URL, not localhost')
    let data
    try { data = JSON.parse(text) } catch { throw new Error('Invalid response: ' + text.slice(0, 100)) }
    if (!res.ok) throw new Error(data.error || 'API error')
    return data
  }

  const fetchAll = async () => {
    if (!hasCredentials) return
    setLoading(true)
    setError('')
    try {
      const [liveData, upcomingData] = await Promise.all([
        callZoom('live'),
        callZoom('upcoming', { userId: creds.userId || 'me' }),
      ])
      setLive(liveData.meetings || [])
      setUpcoming(upcomingData.meetings || [])
      setLastFetch(new Date())
    } catch (e) {
      setError(e.message || 'Failed to fetch meetings')
    }
    setLoading(false)
  }

  const fetchParticipants = async (meetingId) => {
    if (participants[meetingId]) return // already loaded
    setLoadingParticipants(meetingId)
    try {
      const data = await callZoom('participants', { meetingId })
      setParticipants(prev => ({ ...prev, [meetingId]: data.participants || [] }))
    } catch {
      setParticipants(prev => ({ ...prev, [meetingId]: [] }))
    }
    setLoadingParticipants(null)
  }

  const handleExpand = (meetingId) => {
    if (expandedId === meetingId) {
      setExpandedId(null)
    } else {
      setExpandedId(meetingId)
      fetchParticipants(meetingId)
    }
  }

  const handleJoin = (meeting) => {
    const url = meeting.join_url || meeting.start_url
    if (url) window.open(url, '_blank')
  }

  useEffect(() => {
    if (!hasCredentials) return
    fetchAll()
    // Auto-refresh every 30 seconds
    pollRef.current = setInterval(fetchAll, 30000)
    return () => clearInterval(pollRef.current)
  }, [])

  if (!hasCredentials) return <NoCredentials />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: live.length > 0 ? C.green : C.muted, boxShadow: live.length > 0 ? `0 0 8px ${C.green}` : 'none', animation: live.length > 0 ? 'livePulse 1.5s ease infinite' : 'none' }} />
            <span style={{ fontSize: 13, color: live.length > 0 ? C.green : C.muted, fontWeight: 700 }}>
              {live.length > 0 ? `${live.length} class live` : 'No live classes'}
            </span>
          </div>
          {lastFetch && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Auto-refreshes every 30s · Last: {lastFetch.toLocaleTimeString()}</div>}
        </div>
        <button onClick={fetchAll} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: C.red, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && !live.length && !upcoming.length && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Loader size={24} color={C.accent} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: C.muted }}>Connecting to Zoom…</div>
        </div>
      )}

      {/* Live meetings */}
      {live.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={12} /> Live Classes
          </div>
          {live.map(m => (
            <LiveMeetingCard
              key={m.id}
              meeting={m}
              onJoin={handleJoin}
              onExpand={handleExpand}
              expanded={expandedId === m.id}
              participants={participants[m.id]}
              loadingParticipants={loadingParticipants === m.id}
            />
          ))}
        </div>
      )}

      {/* Upcoming meetings */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} /> Upcoming Classes
          </div>
          {upcoming.map(m => (
            <UpcomingCard key={m.id} meeting={m} onJoin={handleJoin} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && live.length === 0 && upcoming.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Video size={36} style={{ display: 'block', margin: '0 auto 14px', color: C.muted, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No classes scheduled</div>
          <div style={{ fontSize: 13, color: C.muted }}>Live and upcoming Zoom classes will appear here</div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}

