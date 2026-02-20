import { useState } from 'react'
import { Plus, Trash2, Clock, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const ASSESSMENT_TAG = 'bitsavers-assessment'

// Publish assessment deletion tombstone to Nostr
const publishAssessmentDelete = async (assessmentId, assessmentTitle) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    // kind:1 delete note — same tag as create so single subscription catches both
    const event = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'bitsavers'],
        ['t', ASSESSMENT_TAG],
      ],
      content: 'ASSESSMENT_DELETE:' + JSON.stringify({ id: assessmentId, title: assessmentTitle }),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
    console.log('✓ Assessment deletion published to Nostr:', assessmentTitle)
  } catch(e) { console.error('Failed to publish deletion:', e) }
}

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getAssessments = () => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } }
const saveAssessments = (a) => localStorage.setItem('bitsavers_assessments', JSON.stringify(a))
const getResults = () => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } }
const getCohorts = () => { try { return JSON.parse(localStorage.getItem('bitsavers_cohorts') || '[]') } catch { return [] } }

// Publish assessment to Nostr so students on any device can see it
const publishAssessmentToNostr = async (assessment) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    // kind:1 — appears in bitsavers feed AND filterable by tag
    // Same pattern as cohort join/leave: single tag, single subscription catches everything
    const event = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'bitsavers'],
        ['t', ASSESSMENT_TAG],
        ['subject', assessment.title],
      ],
      content: 'ASSESSMENT_CREATE:' + JSON.stringify(assessment),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
    console.log('✓ Assessment published to Nostr:', assessment.title)
  } catch(e) { console.error('Failed to publish assessment:', e) }
}

// ─── Question builder ─────────────────────────────────────────────────────────
function QuestionBuilder({ questions, onChange }) {
  const addQuestion = (type) => {
    const q = {
      id: Date.now().toString(),
      type,
      text: '',
      options: type === 'mcq' ? ['', '', '', ''] : [],
      correctAnswer: '',
    }
    onChange([...questions, q])
  }

  const updateQ = (id, field, value) => {
    onChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const updateOption = (qId, idx, value) => {
    onChange(questions.map(q => {
      if (q.id !== qId) return q
      const opts = [...q.options]
      opts[idx] = value
      return { ...q, options: opts }
    }))
  }

  const removeQ = (id) => onChange(questions.filter(q => q.id !== id))

  return (
    <div>
      {questions.map((q, i) => (
        <div key={q.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Q{i + 1}</span>
              <span style={{ fontSize: 11, background: q.type === 'mcq' ? C.dim : 'rgba(34,197,94,0.1)', border: `1px solid ${q.type === 'mcq' ? C.border : 'rgba(34,197,94,0.2)'}`, color: q.type === 'mcq' ? C.accent : C.green, padding: '2px 8px', borderRadius: 20 }}>
                {q.type === 'mcq' ? 'Multiple Choice' : 'Open Ended'}
              </span>
            </div>
            <button onClick={() => removeQ(q.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 4 }}>
              <Trash2 size={15} />
            </button>
          </div>

          {/* Question text */}
          <textarea
            value={q.text} onChange={e => updateQ(q.id, 'text', e.target.value)}
            placeholder="Type your question here…" rows={2}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
          />

          {/* MCQ options */}
          {q.type === 'mcq' && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Options — tap radio to mark correct answer:</div>
              {q.options.map((opt, idx) => {
                const letters = ['A', 'B', 'C', 'D']
                const isCorrect = q.correctAnswer === opt && opt.trim()
                return (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <button onClick={() => opt.trim() && updateQ(q.id, 'correctAnswer', opt)} style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: isCorrect ? C.green : 'transparent',
                      border: `2px solid ${isCorrect ? C.green : C.border}`,
                      color: isCorrect ? '#fff' : C.muted,
                      cursor: 'pointer', fontWeight: 800, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {letters[idx]}
                    </button>
                    <input
                      value={opt} onChange={e => updateOption(q.id, idx, e.target.value)}
                      placeholder={`Option ${letters[idx]}`}
                      style={{ flex: 1, background: 'transparent', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.4)' : C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                    />
                  </div>
                )
              })}
              {!q.correctAnswer && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Tap a letter to mark the correct answer</div>}
            </div>
          )}

          {/* Open ended hint */}
          {q.type === 'open' && (
            <div style={{ fontSize: 11, color: C.muted, background: C.dim, borderRadius: 7, padding: '8px 12px' }}>
              Students will type their answer. You can review submissions in Results.
            </div>
          )}
        </div>
      ))}

      {/* Add question buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => addQuestion('mcq')} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={14} /> Multiple Choice
        </button>
        <button onClick={() => addQuestion('open')} style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: C.green, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={14} /> Open Ended
        </button>
      </div>
    </div>
  )
}

// ─── Main Admin Assignments ───────────────────────────────────────────────────
export default function AdminAssignments() {
  const cohorts = getCohorts()
  const [assessments, setAssessmentsState] = useState(getAssessments)
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', cohortId: '', timer: '' })
  const [questions, setQuestions] = useState([])
  const [msg, setMsg] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveAssessment = async () => {
    if (!form.title.trim()) { setMsg('err: Title required'); return }
    if (!form.cohortId) { setMsg('err: Select a cohort'); return }
    if (questions.length === 0) { setMsg('err: Add at least one question'); return }
    const mcqWithNoAnswer = questions.filter(q => q.type === 'mcq' && !q.correctAnswer)
    if (mcqWithNoAnswer.length) { setMsg('err: All multiple choice questions need a correct answer marked'); return }

    const newA = {
      id: Date.now().toString(),
      ...form,
      timer: form.timer ? parseInt(form.timer) : null,
      questions,
      createdAt: Date.now(),
    }
    const updated = [newA, ...assessments]
    saveAssessments(updated)
    setAssessmentsState(updated)
    setMsg('ok: Saved! Publishing to Nostr…')
    await publishAssessmentToNostr(newA)
    setForm({ title: '', description: '', cohortId: '', timer: '' })
    setQuestions([])
    setCreating(false)
    setMsg('ok: Assessment published!')
    setTimeout(() => setMsg(''), 3000)
  }

  const deleteAssessment = async (id) => {
    const found = assessments.find(x => x.id === id)
    const updated = assessments.filter(x => x.id !== id)
    saveAssessments(updated)
    setAssessmentsState(updated)
    if (expanded === id) setExpanded(null)
    const deleted = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_assessments') || '[]') } catch { return [] } })()
    if (!deleted.includes(id)) {
      localStorage.setItem('bitsavers_deleted_assessments', JSON.stringify([...deleted, id]))
    }
    await publishAssessmentDelete(id, found?.title || '')
    setMsg('ok: Deleted everywhere via Nostr')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div>
      {msg && (
        <div style={{ padding: '10px 14px', display:'flex', alignItems:'center', gap:8, background: msg.startsWith('ok') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('ok') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 9, color: msg.startsWith('ok') ? C.green : C.red, fontSize: 13, marginBottom: 14 }}>
          {msg.replace(/^(ok|err): /, '')}
        </div>
      )}

      {!creating ? (
        <button onClick={() => setCreating(true)} style={{ width: '100%', background: C.accent, border: 'none', color: C.bg, padding: '13px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={16} /> Create New Assessment
        </button>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>New Assessment</div>

          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Assessment title"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />

          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description / instructions (optional)" rows={2}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />

          <select value={form.cohortId} onChange={e => set('cohortId', e.target.value)}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: form.cohortId ? C.text : C.muted, fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}>
            <option value="">Assign to cohort…</option>
            {cohorts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px' }}>
            <Clock size={16} color={C.accent} />
            <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>Timer (minutes, leave empty for no limit)</span>
            <input type="number" value={form.timer} onChange={e => set('timer', e.target.value)} placeholder="—"
              style={{ width: 60, background: 'transparent', border: 'none', color: C.accent, fontSize: 16, fontWeight: 800, outline: 'none', textAlign: 'center' }} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Questions</div>
          <QuestionBuilder questions={questions} onChange={setQuestions} />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => { setCreating(false); setQuestions([]) }} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={saveAssessment} style={{ flex: 2, background: C.accent, border: 'none', color: C.bg, padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Save Assessment
            </button>
          </div>
        </div>
      )}

      {/* Assessments list */}
      {assessments.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No assessments yet. Create one above.</div>
      )}

      {assessments.map(a => {
        const cohort = cohorts.find(c => c.id === a.cohortId)
        const results = getResults().filter(r => r.assessmentId === a.id)
        const isOpen = expanded === a.id
        return (
          <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setExpanded(isOpen ? null : a.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {cohort && <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>}
                  <span style={{ fontSize: 11, color: C.muted }}>{(a.questions||[]).length} questions</span>
                  {a.timer && <span style={{ fontSize: 11, color: C.red, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {a.timer}min</span>}
                  <span style={{ fontSize: 11, color: C.green }}>{results.length} submitted</span>
                </div>
              </div>
              {isOpen ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
            </div>

            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 18 }}>
                {a.description && <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>{a.description}</div>}
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                  {(a.questions||[]).length} questions · {a.timer ? a.timer + ' min timer' : 'No timer'} · View submissions in the Submissions tab
                </div>
                <button onClick={() => deleteAssessment(a.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '8px 16px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Delete Assessment
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

