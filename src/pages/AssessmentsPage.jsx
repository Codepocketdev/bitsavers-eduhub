import { useState, useEffect, useRef } from 'react'
import { isAdmin } from '../config/admins'
import { Clock, CheckCircle, XCircle, ChevronRight, ClipboardList, BookOpen, Award, Loader } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const ASSESSMENT_TAG = 'bitsavers-assessment'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const getAssessments = () => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } }
const saveAssessments = (a) => localStorage.setItem('bitsavers_assessments', JSON.stringify(a))
const getResults = () => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } }
const saveResults = (r) => localStorage.setItem('bitsavers_results', JSON.stringify(r))

// Cohorts stored as object {code: cohort}
const getCohorts = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('bitsavers_cohorts') || '{}')
    return Array.isArray(raw) ? raw : Object.values(raw)
  } catch { return [] }
}

const publishSubmissionToNostr = async (result) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const event = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', `bitsavers-sub-${result.assessmentId}`], ['t', 'bitsavers-submission'], ['subject', result.assessmentTitle]],
      content: 'SUBMISSION:' + JSON.stringify(result),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
  } catch(e) { console.error('Failed to publish submission:', e) }
}

// ─── Hook: resolve which cohorts this user has joined via Nostr ───────────────
// This mirrors exactly how CohortsPage.jsx tracks joins — via the live
// bitsavers-cohort subscription — so it works even if bitsavers_joins is empty
function useMyJoinedCohortIds(userNpub) {
  const cohorts = getCohorts()

  // Seed from localStorage joins if available (fast path)
  const getSeedIds = () => {
    try {
      const joins = JSON.parse(localStorage.getItem('bitsavers_joins') || '{}')
      return cohorts
        .filter(c => joins[c.code]?.[userNpub]?.action === 'joined')
        .map(c => c.id)
    } catch { return [] }
  }

  const [myCohortIds, setMyCohortIds] = useState(getSeedIds)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userNpub) { setLoading(false); return }

    // joinsMap: { [cohortCode]: { [npub]: { action, ts } } }
    const joinsMap = {}
    const seen = new Set()
    const closers = []

    const flush = () => {
      // Derive which cohort IDs this user has joined
      const ids = cohorts
        .filter(c => joinsMap[c.code]?.[userNpub]?.action === 'joined')
        .map(c => c.id)
      setMyCohortIds(ids)
      setLoading(false)

      // Also persist back to localStorage so next load is instant
      try {
        const stored = JSON.parse(localStorage.getItem('bitsavers_joins') || '{}')
        Object.entries(joinsMap).forEach(([code, members]) => {
          if (!stored[code]) stored[code] = {}
          Object.entries(members).forEach(([npub, data]) => {
            const ex = stored[code][npub]
            if (!ex || data.ts > ex.ts) stored[code][npub] = data
          })
        })
        localStorage.setItem('bitsavers_joins', JSON.stringify(stored))
      } catch {}
    }

    const openWS = (url, filter) => {
      let ws, closed = false
      const subId = 'asmt-j-' + Math.random().toString(36).slice(2, 8)
      const go = () => {
        if (closed) return
        ws = new WebSocket(url)
        ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, filter]))
        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data)
            if (msg[0] === 'EVENT' && msg[1] === subId) {
              const e = msg[2]
              if (seen.has(e.id)) return
              seen.add(e.id)
              // Parse join/leave events: "joined-BTC-npub1...|Name"
              const m = e.content.match(/^(joined|left)-([A-Z0-9]+)-([^ |]+)[| ](.+)$/)
              if (m) {
                const [, action, code, npub, name] = m
                if (!joinsMap[code]) joinsMap[code] = {}
                const ex = joinsMap[code][npub]
                if (!ex || e.created_at > ex.ts)
                  joinsMap[code][npub] = { action, ts: e.created_at, name: name.trim() }
                flush()
              }
            }
            if (msg[0] === 'EOSE') flush()
          } catch {}
        }
        ws.onclose = () => { if (!closed) setTimeout(go, 3000) }
      }
      go()
      closers.push(() => { closed = true; ws?.close() })
    }

    // Subscribe to both cohort join tags — same as CohortsPage
    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohort'],  limit: 500 }))
    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohorts'], limit: 500 }))
    setTimeout(() => setLoading(false), 8000)
    return () => closers.forEach(c => c())
  }, [userNpub])

  return { myCohortIds, loading }
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function Timer({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds)
  const ref = useRef()
  useEffect(() => {
    ref.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) { clearInterval(ref.current); onExpire(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(ref.current)
  }, [])

  const mins = Math.floor(left / 60)
  const secs = left % 60
  const pct = (left / seconds) * 100
  const urgent = left < 60

  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: urgent ? 'rgba(239,68,68,0.1)' : C.dim, border: `1px solid ${urgent ? 'rgba(239,68,68,0.4)' : C.border}`, borderRadius: 30, padding: '8px 18px' }}>
        <Clock size={15} color={urgent ? C.red : C.accent} />
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: urgent ? C.red : C.accent }}>
          {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
        </span>
      </div>
      <div style={{ height: 4, background: C.dim, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: urgent ? C.red : C.accent, borderRadius: 2, transition: 'width 1s linear' }} />
      </div>
    </div>
  )
}

// ─── Quiz runner ──────────────────────────────────────────────────────────────
function QuizRunner({ assessment, user, onDone }) {
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const [expired, setExpired] = useState(false)

  const questions = assessment.questions || []
  const current = questions[qIndex]
  const totalTime = assessment.timer ? assessment.timer * 60 : null

  const selectAnswer = (qId, answer) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: answer }))
  }

  const submit = async (auto = false) => {
    if (submitted) return
    let correct = 0, mcqTotal = 0
    questions.forEach(q => {
      if (q.type === 'mcq') { mcqTotal++; if (answers[q.id] === q.correctAnswer) correct++ }
    })
    const result = {
      id: Date.now().toString(),
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      cohortId: assessment.cohortId,
      npub: user.npub,
      name: user.profile?.name || user.profile?.display_name || 'Anonymous',
      picture: user.profile?.picture || null,
      answers,
      questions: assessment.questions,
      score: mcqTotal > 0 ? correct + '/' + mcqTotal : null,
      correct, mcqTotal,
      submittedAt: Date.now(),
      autoSubmitted: auto,
    }
    const results = getResults()
    const filtered = results.filter(r => !(r.assessmentId === assessment.id && r.npub === user.npub))
    saveResults([...filtered, result])
    setScore({ correct, mcqTotal })
    setSubmitted(true)
    if (auto) setExpired(true)
    publishSubmissionToNostr(result)
  }

  if (submitted) {
    const pct = score?.mcqTotal > 0 ? Math.round((score.correct / score.mcqTotal) * 100) : null
    return (
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {expired ? <Clock size={56} color={C.red} /> : pct === null ? <ClipboardList size={56} color={C.accent} /> : pct >= 70 ? <Award size={56} color={C.green} /> : <BookOpen size={56} color={C.accent} />}
        </div>
        {expired && <div style={{ color: C.red, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Time ran out — auto submitted</div>}
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 8 }}>{pct === null ? 'Submitted!' : `${pct}%`}</div>
        {score?.mcqTotal > 0 && <div style={{ fontSize: 15, color: C.muted, marginBottom: 20 }}>{score.correct} out of {score.mcqTotal} correct</div>}
        {pct === null && <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>Your answers have been submitted for review.</div>}

        {score?.mcqTotal > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 20 }}>
            {questions.filter(q => q.type === 'mcq').map(q => {
              const userAns = answers[q.id]
              const isCorrect = userAns === q.correctAnswer
              return (
                <div key={q.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {isCorrect ? <CheckCircle size={16} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={16} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />}
                    <div>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>{q.text}</div>
                      <div style={{ fontSize: 12, color: isCorrect ? C.green : C.red }}>Your answer: {userAns || 'Not answered'}</div>
                      {!isCorrect && <div style={{ fontSize: 12, color: C.green }}>Correct: {q.correctAnswer}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={onDone} style={{ background: C.accent, border: 'none', color: C.bg, padding: '13px 32px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Back to Assessments
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>{assessment.title}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
          <span>Question {qIndex + 1} of {questions.length}</span>
          {assessment.timer && <span style={{ color: C.accent }}>Timed: {assessment.timer} min</span>}
        </div>
        <div style={{ height: 3, background: C.dim, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((qIndex + 1) / questions.length) * 100}%`, background: C.accent, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {totalTime && <Timer seconds={totalTime} onExpire={() => submit(true)} />}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.5, marginBottom: 20 }}>
          {qIndex + 1}. {current.text}
        </div>

        {current.type === 'mcq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.options.filter(o => o.trim()).map((option, i) => {
              const selected = answers[current.id] === option
              const letters = ['A', 'B', 'C', 'D']
              return (
                <button key={i} onClick={() => selectAnswer(current.id, option)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: selected ? C.dim : '#0a0a0a',
                  border: `2px solid ${selected ? C.accent : C.border}`,
                  borderRadius: 10, padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: selected ? C.accent : C.dim, border: `1px solid ${selected ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: selected ? C.bg : C.muted, flexShrink: 0 }}>
                    {letters[i]}
                  </div>
                  <span style={{ fontSize: 14, color: selected ? C.text : C.muted, fontWeight: selected ? 600 : 400 }}>{option}</span>
                </button>
              )
            })}
          </div>
        )}

        {current.type === 'open' && (
          <textarea value={answers[current.id] || ''} onChange={e => selectAnswer(current.id, e.target.value)}
            placeholder="Type your answer here…" rows={5}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, padding: '13px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {qIndex > 0 && (
          <button onClick={() => setQIndex(i => i - 1)} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Back
          </button>
        )}
        {qIndex < questions.length - 1 ? (
          <button onClick={() => setQIndex(i => i + 1)} style={{ flex: 2, background: C.accent, border: 'none', color: C.bg, padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => submit(false)} style={{ flex: 2, background: C.green, border: 'none', color: '#fff', padding: 13, borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Submit Assessment
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Fetch assessments from Nostr ─────────────────────────────────────────────
const fetchAssessmentsFromNostr = (cohortIds) => new Promise((resolve) => {
  if (!cohortIds.length) { resolve([]); return }
  const pool = getPool()
  const seen = new Set()
  const byId = {}
  const localDeleted = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_assessments') || '[]') } catch { return [] } })()

  const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [ASSESSMENT_TAG], limit: 500 }, {
    onevent(e) {
      if (seen.has(e.id)) return
      seen.add(e.id)
      try {
        if (e.content.startsWith('ASSESSMENT_CREATE:')) {
          const data = JSON.parse(e.content.slice('ASSESSMENT_CREATE:'.length))
          if (!data.id || !data.title || !cohortIds.includes(data.cohortId)) return
          if (!byId[data.id] || e.created_at > byId[data.id].created_at)
            byId[data.id] = { action: 'create', data, created_at: e.created_at }
        } else if (e.content.startsWith('ASSESSMENT_DELETE:')) {
          const data = JSON.parse(e.content.slice('ASSESSMENT_DELETE:'.length))
          if (!data.id) return
          if (!byId[data.id] || e.created_at > byId[data.id].created_at)
            byId[data.id] = { action: 'delete', data, created_at: e.created_at }
        }
      } catch {}
    },
    oneose() {
      sub.close()
      const result = []
      Object.values(byId).forEach(entry => {
        if (entry.action === 'delete') {
          if (!localDeleted.includes(entry.data.id)) {
            localDeleted.push(entry.data.id)
            localStorage.setItem('bitsavers_deleted_assessments', JSON.stringify(localDeleted))
          }
        } else if (!localDeleted.includes(entry.data.id)) {
          result.push(entry.data)
        }
      })
      resolve(result)
    }
  })
  setTimeout(() => { sub.close(); resolve([]) }, 8000)
})

// ─── Student assessments list ─────────────────────────────────────────────────
function StudentAssessments({ user }) {
  const [running, setRunning] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [loadingAssessments, setLoadingAssessments] = useState(true)

  // Resolve joined cohorts from Nostr — works even if bitsavers_joins is empty
  const { myCohortIds, loading: loadingJoins } = useMyJoinedCohortIds(user?.npub)

  const cohorts = getCohorts()
  const myCohorts = cohorts.filter(c => myCohortIds.includes(c.id))
  const results = getResults()

  useEffect(() => {
    if (loadingJoins) return // wait until we know the joined cohorts
    if (myCohortIds.length === 0) { setLoadingAssessments(false); return }

    const load = async () => {
      setLoadingAssessments(true)
      const deleted = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_assessments') || '[]') } catch { return [] } }

      // 1. Show localStorage cache immediately
      const local = getAssessments().filter(a => myCohortIds.includes(a.cohortId) && !deleted().includes(a.id))
      if (local.length) setAssessments(local)

      // 2. Fetch full history from Nostr
      try {
        const nostrAssessments = await fetchAssessmentsFromNostr(myCohortIds)
        const del = deleted()
        const merged = [...local]
        nostrAssessments.forEach(na => {
          if (del.includes(na.id)) return
          const idx = merged.findIndex(a => a.id === na.id)
          if (idx >= 0) merged[idx] = na
          else merged.push(na)
        })
        const all = getAssessments().filter(a => !del.includes(a.id))
        merged.forEach(ma => { if (!all.find(a => a.id === ma.id)) all.push(ma) })
        saveAssessments(all)
        setAssessments(merged)
      } catch(e) { console.error('Nostr fetch failed:', e) }

      setLoadingAssessments(false)
    }
    load()
  }, [myCohortIds.join(','), loadingJoins])

  // Live deletion subscription
  useEffect(() => {
    if (!myCohortIds.length) return
    const pool = getPool()
    const seen = new Set()
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [ASSESSMENT_TAG], limit: 100 }, {
      onevent(e) {
        if (seen.has(e.id)) return
        seen.add(e.id)
        if (!e.content.startsWith('ASSESSMENT_DELETE:')) return
        try {
          const { id } = JSON.parse(e.content.slice('ASSESSMENT_DELETE:'.length))
          if (!id) return
          const del = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_assessments') || '[]') } catch { return [] } })()
          if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_assessments', JSON.stringify([...del, id]))
          saveAssessments(getAssessments().filter(a => a.id !== id))
          setAssessments(prev => prev.filter(a => a.id !== id))
        } catch {}
      },
      oneose() {}
    })
    return () => sub.close()
  }, [myCohortIds.join(',')])

  const getMyResult = (aId) => results.find(r => r.assessmentId === aId && r.npub === user.npub)

  if (running) return <QuizRunner assessment={running} user={user} onDone={() => setRunning(null)} />

  // Still resolving which cohorts the user joined
  if (loadingJoins) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <Loader size={36} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 14, color: C.muted, marginTop: 12 }}>Checking cohort membership…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Not in any cohort
  if (myCohortIds.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <ClipboardList size={48} color={C.muted} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Join a cohort first</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>You need to join a cohort to see your assessments.</div>
      <button onClick={() => window.location.hash = '#cohorts'} style={{ background: C.accent, border: 'none', color: C.bg, padding: '11px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        Go to Cohorts
      </button>
    </div>
  )

  // In a cohort but assessments still loading
  if (loadingAssessments && assessments.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <Loader size={36} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 14, color: C.muted, marginTop: 12 }}>Fetching assessments from Nostr…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // In a cohort but no assessments yet
  if (assessments.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <ClipboardList size={48} color={C.muted} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>No assessments yet</div>
      <div style={{ fontSize: 13, color: C.muted }}>Your instructor hasn't published any assessments yet.</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
        You're in {myCohorts.length} cohort{myCohorts.length > 1 ? 's' : ''}: {myCohorts.map(c => c.code).join(', ')}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {assessments.map(a => {
        const result = getMyResult(a.id)
        const questions = a.questions || []
        const cohort = cohorts.find(c => c.id === a.cohortId)
        return (
          <div key={a.id} style={{ background: C.card, border: `1px solid ${result ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: result ? 'rgba(34,197,94,0.1)' : C.dim, border: `1px solid ${result ? 'rgba(34,197,94,0.3)' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {result ? <CheckCircle size={22} color={C.green} /> : <ClipboardList size={22} color={C.accent} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>{a.title}</div>
                {a.description && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>{a.description}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {cohort && (
                    <span style={{ fontSize: 11, background: C.dim, border: `1px solid ${C.border}`, borderRadius: 20, padding: '3px 10px', color: C.accent, fontFamily: 'monospace', fontWeight: 700 }}>
                      {cohort.code}
                    </span>
                  )}
                  <span style={{ fontSize: 11, background: C.dim, border: `1px solid ${C.border}`, borderRadius: 20, padding: '3px 10px', color: C.muted }}>
                    {questions.length} questions
                  </span>
                  {a.timer && (
                    <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '3px 10px', color: C.red, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> {a.timer} min
                    </span>
                  )}
                  {result?.score && (
                    <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '3px 10px', color: C.green }}>
                      Score: {result.score}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setRunning(a)} style={{
              width: '100%', marginTop: 14,
              background: result ? 'transparent' : C.accent,
              border: result ? `1px solid ${C.border}` : 'none',
              color: result ? C.muted : C.bg,
              padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              {result ? 'Retake Assessment' : 'Start Assessment'}
            </button>
          </div>
        )
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AssessmentsPage({ user }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ClipboardList size={24} color={C.accent} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Assessments</div>
          <div style={{ fontSize: 11, color: C.muted }}>Complete your assigned assessments</div>
        </div>
      </div>
      <StudentAssessments user={user} />
    </div>
  )
}

