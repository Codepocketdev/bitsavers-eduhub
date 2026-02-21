import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { BookOpen, Clock, User, ExternalLink, ChevronDown, ChevronUp, Zap, Filter, Loader } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const COURSES_TAG = 'bitsavers-courses'

const C = {
  bg: '#080808', card: '#141414', surface: '#0f0f0f',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const LEVEL_COLORS = {
  Beginner:     { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  Intermediate: { bg: 'rgba(247,147,26,0.12)', color: '#F7931A' },
  Advanced:     { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const getCached = () => { try { return JSON.parse(localStorage.getItem('bitsavers_courses') || '[]') } catch { return [] } }

function CourseCard({ course }) {
  const [expanded, setExpanded] = useState(false)
  const lvl = LEVEL_COLORS[course.level] || LEVEL_COLORS.Beginner

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      {/* Cover image */}
      {course.image && (
        <img src={course.image} alt={course.title}
          style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
          onError={e => e.target.style.display = 'none'}
        />
      )}

      <div style={{ padding: 16 }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, background: lvl.bg, color: lvl.color, padding: '3px 10px', borderRadius: 20 }}>
            {course.level}
          </span>
          {course.category && (
            <span style={{ fontSize: 10, color: C.muted, background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>
              {course.category}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: course.price === 'Free' ? C.green : C.accent, background: course.price === 'Free' ? 'rgba(34,197,94,0.1)' : C.dim, padding: '3px 10px', borderRadius: 20 }}>
            {course.price === 'Free' ? 'FREE' : course.priceAmount || 'PAID'}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
          {course.title}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          {course.instructor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <User size={11} /> {course.instructor}
            </div>
          )}
          {course.duration && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <Clock size={11} /> {course.duration}
            </div>
          )}
        </div>

        {/* Description toggle */}
        {course.description && (
          <>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10,
              overflow: 'hidden', maxHeight: expanded ? 'none' : 60,
              maskImage: expanded ? 'none' : 'linear-gradient(to bottom, black 40%, transparent 100%)',
              WebkitMaskImage: expanded ? 'none' : 'linear-gradient(to bottom, black 40%, transparent 100%)',
            }}>
              {course.description}
            </div>
            {course.description.length > 120 && (
              <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 12 }}>
                {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Read more</>}
              </button>
            )}
          </>
        )}

        {/* Tags */}
        {course.tags && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {course.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} style={{ fontSize: 10, color: C.muted, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 12 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA Button */}
        {course.link && (
          <a href={course.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '13px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ExternalLink size={15} /> {course.linkLabel || 'Register Now'}
            </button>
          </a>
        )}
      </div>
    </div>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState(getCached)
  const [loading, setLoading] = useState(getCached().length === 0)
  const [filter, setFilter] = useState('All')
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    const pool = new SimplePool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [COURSES_TAG], limit: 10 }, {
      onevent(e) {
        if (!e.content.startsWith('COURSES:')) return
        try {
          if (e.created_at > latest.created_at)
            latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('COURSES:'.length)) }
        } catch {}
      },
      oneose() {
        sub.close()
        if (latest.data) {
          localStorage.setItem('bitsavers_courses', JSON.stringify(latest.data))
          setCourses(latest.data)
        }
        setLoading(false)
        setLastSync(new Date())
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 10000)
    return () => sub.close()
  }, [])

  const levels = ['All', 'Beginner', 'Intermediate', 'Advanced']
  const filtered = filter === 'All' ? courses : courses.filter(c => c.level === filter)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
        <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{RELAYS[0]} + {RELAYS.length - 1} more</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>{courses.length}</span> course{courses.length !== 1 ? 's' : ''} available
        </div>
        {lastSync && <div style={{ fontSize: 10, color: C.muted }}>Synced {lastSync.toLocaleTimeString()}</div>}
      </div>

      {/* Level filter */}
      {courses.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
          {levels.map(l => (
            <button key={l} onClick={() => setFilter(l)} style={{
              flexShrink: 0, background: filter === l ? C.accent : C.card,
              border: `1px solid ${filter === l ? C.accent : C.border}`,
              color: filter === l ? '#000' : C.muted,
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}>{l}</button>
          ))}
        </div>
      )}

      {/* Course grid */}
      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <BookOpen size={36} style={{ display: 'block', margin: '0 auto 14px', color: C.muted, opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {courses.length === 0 ? 'No courses yet' : `No ${filter} courses`}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {courses.length === 0 ? 'Check back soon — courses coming!' : 'Try a different filter'}
          </div>
        </div>
      )}

      {filtered.map(course => <CourseCard key={course.id} course={course} />)}
    </div>
  )
}

