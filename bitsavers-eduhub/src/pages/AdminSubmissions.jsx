import { useState, useEffect } from 'react'
import {
  ClipboardList, RefreshCw, MessageSquare, Send, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Loader, Users, Eye, EyeOff, X
} from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip04, nip19 } from 'nostr-tools'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getAssessments = () => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } }
const getResults    = () => { try { return JSON.parse(localStorage.getItem('bitsavers_results')    || '[]') } catch { return [] } }
const saveResults   = (r) => localStorage.setItem('bitsavers_results', JSON.stringify(r))
const getCohorts    = () => { try { return JSON.parse(localStorage.getItem('bitsavers_cohorts')    || '[]') } catch { return [] } }

// ─── Fetch submissions from Nostr ─────────────────────────────────────────────
const fetchNostrSubmissions = (assessmentId) => new Promise((resolve) => {
  const pool = getPool()
  const found = []
  const seen = new Set()
  const tag = `bitsavers-sub-${assessmentId}`

  const sub = pool.subscribe(
    RELAYS,
    { kinds: [1], '#t': [tag], limit: 500 },
    {
      onevent(e) {
        if (seen.has(e.id)) return
        seen.add(e.id)
        try {
          const match = e.content.match(/SUBMISSION:(\{.+\})$/)
          if (!match) return
          const data = JSON.parse(match[1])
          if (data.assessmentId === assessmentId) found.push({ ...data, nostrId: e.id })
        } catch {}
      },
      oneose() { sub.close(); resolve(found) }
    }
  )
  setTimeout(() => { sub.close(); resolve(found) }, 8000)
})

// ─── Send Nostr DM (kind:4) ───────────────────────────────────────────────────
const sendDM = async (toNpub, message) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) throw new Error('No private key stored')
  const skBytes = nsecToBytes(nsec)
  const { data: toPubkey } = nip19.decode(toNpub)
  const encrypted = await nip04.encrypt(skBytes, toPubkey, message)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', toPubkey]],
    content: encrypted,
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

// ─── DM Modal ─────────────────────────────────────────────────────────────────
function DMModal({ student, onClose }) {
  const [msg, setMsg]       = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus]   = useState(null) // {ok: bool, text: str}

  const send = async () => {
    if (!msg.trim()) return
    setSending(true); setStatus(null)
    try {
      await sendDM(student.npub, msg.trim())
      setStatus({ ok: true, text: 'DM sent via Nostr!' })
      setMsg('')
    } catch (e) {
      setStatus({ ok: false, text: e.message || 'Failed to send' })
    }
    setSending(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={16} color={C.accent} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>DM to {student.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {student.npub?.slice(0, 32)}…
        </div>

        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Write feedback, flag an issue, or send encouragement…"
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#0a0a0a', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px', color: C.text,
            fontSize: 14, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
            marginBottom: 12
          }}
        />

        {status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: status.ok ? C.green : C.red, marginBottom: 12 }}>
            {status.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            {status.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '10px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={send} disabled={sending || !msg.trim()} style={{ flex: 2, background: C.accent, border: 'none', color: '#000', padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!msg.trim() || sending) ? 0.6 : 1 }}>
            {sending ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
            {sending ? 'Sending…' : 'Send DM'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single submission card ────────────────────────────────────────────────────
function SubmissionCard({ result, questions }) {
  const [open, setOpen]     = useState(false)
  const [dmTarget, setDmTarget] = useState(null)

  const mcqQs  = questions.filter(q => q.type === 'mcq')
  const openQs = questions.filter(q => q.type === 'open')
  const initials = (result.name || '?').slice(0, 2).toUpperCase()

  return (
    <div style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0, overflow: 'hidden' }}>
          {result.picture
            ? <img src={result.picture} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
            : initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{result.name}</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.npub?.slice(0, 24)}…
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
          {result.score && (
            <div style={{ fontSize: 17, fontWeight: 900, color: result.correct === result.mcqTotal && result.mcqTotal > 0 ? C.green : C.accent }}>
              {result.score}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.muted }}>{new Date(result.submittedAt).toLocaleString()}</div>
          {result.autoSubmitted && <div style={{ fontSize: 10, color: C.red }}>⏰ Time out</div>}
        </div>

        <button onClick={() => setOpen(p => !p)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}>
          {open ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 14px 10px' }}>

          {/* MCQ breakdown */}
          {mcqQs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>MCQ Answers</div>
              {mcqQs.map((q, i) => {
                const ans = result.answers?.[q.id]
                const correct = ans === q.correctAnswer
                return (
                  <div key={q.id} style={{ marginBottom: 8, background: correct ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${correct ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Q{i + 1}: {q.text}</div>
                    <div style={{ fontSize: 12, color: correct ? C.green : C.red }}>
                      {correct ? '✓' : '✗'} <strong>{ans || 'No answer'}</strong>
                      {!correct && <span style={{ color: C.green, marginLeft: 8 }}>→ Correct: <strong>{q.correctAnswer}</strong></span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Open-ended */}
          {openQs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Open-Ended Answers</div>
              {openQs.map((q, i) => (
                <div key={q.id} style={{ marginBottom: 8, background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Q{i + 1}: {q.text}</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                    {result.answers?.[q.id] || <em style={{ color: C.muted }}>No answer given</em>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => setDmTarget(result)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <MessageSquare size={13} /> Send DM
          </button>
        </div>
      )}

      {dmTarget && <DMModal student={dmTarget} onClose={() => setDmTarget(null)} />}
    </div>
  )
}

// ─── Assessment submissions section ───────────────────────────────────────────
function AssessmentSubmissions({ assessment, cohort }) {
  const [results, setResults]   = useState(() => getResults().filter(r => r.assessmentId === assessment.id))
  const [fetching, setFetching] = useState(false)
  const [synced, setSynced]     = useState(null)
  const [open, setOpen]         = useState(false)

  const questions = assessment.questions || []
  const students  = cohort?.students || []
  const pending   = students.filter(s => !results.find(r => r.npub === s.npub))

  const sync = async () => {
    setFetching(true)
    const nostr = await fetchNostrSubmissions(assessment.id)
    setResults(prev => {
      const merged = [...prev]
      nostr.forEach(nr => {
        const idx = merged.findIndex(r => r.npub === nr.npub)
        if (idx === -1) merged.push(nr)
        else if (nr.submittedAt > merged[idx].submittedAt) merged[idx] = nr
      })
      const all = getResults().filter(r => r.assessmentId !== assessment.id)
      saveResults([...all, ...merged])
      return merged
    })
    setFetching(false)
    setSynced(new Date())
  }

  // Auto-sync on expand
  useEffect(() => { if (open) sync() }, [open])

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
      {/* Assessment header — clickable */}
      <div
        onClick={() => setOpen(p => !p)}
        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {assessment.title}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {cohort && <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>}
            <span style={{ fontSize: 11, color: C.muted }}>{questions.length} questions</span>
          </div>
        </div>

        {/* Stats badges */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '4px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.green }}>{results.length}</div>
            <div style={{ fontSize: 9, color: C.green }}>done</div>
          </div>
          {pending.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.red }}>{pending.length}</div>
              <div style={{ fontSize: 9, color: C.red }}>pend</div>
            </div>
          )}
          {open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>
      </div>

      {/* Expanded submissions */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 18px' }}>

          {/* Sync bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button
              onClick={sync} disabled={fetching}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={12} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
              {fetching ? 'Syncing Nostr…' : 'Sync from Nostr'}
            </button>
            {synced && <span style={{ fontSize: 10, color: C.muted }}>Last sync: {synced.toLocaleTimeString()}</span>}
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={11} color={C.red} /> Awaiting ({pending.length})
              </div>
              {pending.map(s => (
                <div key={s.npub} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.accent }}>
                    {(s.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{s.npub?.slice(0, 20)}…</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submissions */}
          {results.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={11} color={C.green} /> Submissions ({results.length})
              </div>
              {[...results].sort((a, b) => b.submittedAt - a.submittedAt).map(r => (
                <SubmissionCard
                  key={r.npub + r.submittedAt}
                  result={r}
                  questions={r.questions?.length ? r.questions : questions}
                />
              ))}
            </div>
          )}

          {results.length === 0 && !fetching && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted }}>
              <ClipboardList size={28} style={{ marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13 }}>No submissions yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Click "Sync from Nostr" to check for new ones</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AdminSubmissions() {
  const assessments = getAssessments()
  const cohorts     = getCohorts()

  if (assessments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
        <ClipboardList size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No Assessments Yet</div>
        <div style={{ fontSize: 13 }}>Create assessments in the Assignments tab first.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Users size={16} color={C.accent} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Submission Tracker</span>
        <span style={{ fontSize: 12, color: C.muted }}>— click an assessment to view</span>
      </div>

      {assessments.map(a => {
        const cohort = cohorts.find(c => c.id === a.cohortId)
        return (
          <AssessmentSubmissions key={a.id} assessment={a} cohort={cohort} />
        )
      })}
    </div>
  )
}

