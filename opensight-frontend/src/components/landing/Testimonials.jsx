import React, { useState, useEffect } from 'react'
import { Star, Quote, X, ExternalLink, Search } from 'lucide-react'

/* ─────────────────────────────────────────────────────────── */
/*  CSS                                                         */
/* ─────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .tm-root * { box-sizing:border-box; font-family:'Inter',system-ui,sans-serif; }

  /* Marquee — slower speed, NO pause on hover */
  @keyframes marquee-l { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes marquee-r { 0%{transform:translateX(-50%)} 100%{transform:translateX(0)} }

  .tm-track-l {
    animation: marquee-l 120s linear infinite;
    display: flex;
    width: max-content;
  }
  .tm-track-r {
    animation: marquee-r 120s linear infinite;
    display: flex;
    width: max-content;
  }

  /* Mobile: faster since fewer cards visible */
  @media (max-width: 640px) {
    .tm-track-l { animation-duration: 10s; }
    .tm-track-r { animation-duration: 12s; }
  }

  /* Cards */
  .tm-card {
    flex-shrink: 0;
    width: 320px;
    margin: 0 10px;
    border-radius: 20px;
    padding: 22px 22px 18px;
    cursor: default;
    transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s, border-color .3s;
  }
  .tm-card:hover {
    transform: translateY(-6px) scale(1.015);
  }

  /* Keyframes */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes popIn     { 0%{opacity:0;transform:scale(.88) translateY(16px)} 60%{transform:scale(1.02) translateY(-4px)} 100%{opacity:1;transform:scale(1) translateY(0)} }

  .tm-title-in { animation: fadeUp .5s ease both; }
  .tm-stat     { animation: fadeUp .5s ease both; }

  /* Modal */
  .tm-modal-overlay {
    position: fixed; inset: 0; z-index: 999; overflow-y: auto;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 16px;
    animation: fadeUp .2s ease both;
  }
  .tm-modal-inner {
    width: 100%; max-width: 920px; border-radius: 28px;
    animation: popIn .45s cubic-bezier(.22,1,.36,1) both;
    position: relative;
  }

  /* Modal grid */
  .tm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 16px; }

  /* Search input */
  .tm-search {
    padding: 11px 14px 11px 40px; border-radius: 12px; outline: none;
    font-size: 13.5px; font-weight: 500; width: 100%; transition: all .22s;
  }
  .tm-search:focus { box-shadow: 0 0 0 3px rgba(245,166,35,.2); }

  /* Filter chip */
  .tm-chip {
    padding: 6px 14px; border-radius: 50px; font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all .2s; border: 1.5px solid;
  }

  /* Avatar ring */
  .tm-av-ring {
    width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700; position: relative;
  }
  .tm-av-ring::after {
    content: ''; position: absolute; inset: -2px; border-radius: 50%;
    border: 2px solid transparent;
    background: linear-gradient(135deg,#F5A623,#FFCF6B) border-box;
    -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
  }
`

/* ─────────────────────────────────────────────────────────── */
/*  Static testimonial data                                     */
/* ─────────────────────────────────────────────────────────── */
const ALL_TESTIMONIALS = [
  { id:1,  name:'Sarah Mitchell',  role:'Product Lead',        company:'Stripe',        rating:5, text:'OpenSightAI cut our image QA time by 70%. The AI detection is scarily accurate and the UI is a joy to work in.', avatar:'SM', color:'#6366F1', category:'accuracy' },
  { id:2,  name:'James Okafor',    role:'CTO',                 company:'Vercel',        rating:5, text:'We integrated the API in a day. The results were better than our in-house model trained over 6 months. Impressive.', avatar:'JO', color:'#0EA5E9', category:'api' },
  { id:3,  name:'Priya Nair',      role:'Data Scientist',      company:'Databricks',    rating:5, text:'The batch processing handles our 10k+ daily scans without breaking a sweat. Reliable and blazing fast.', avatar:'PN', color:'#EC4899', category:'performance' },
  { id:4,  name:'Lucas Ferreira',  role:'Founder',             company:'Luma',          rating:5, text:'Best investment for our pipeline. Every dollar spent here saved ten in manual review costs downstream.', avatar:'LF', color:'#F59E0B', category:'value' },
  { id:5,  name:'Emma Zhao',       role:'ML Engineer',         company:'Figma',         rating:5, text:'The model accuracy on edge cases is remarkable. We stopped using three separate tools after switching to OpenSightAI.', avatar:'EZ', color:'#10B981', category:'accuracy' },
  { id:6,  name:'Noah Williams',   role:'Head of Growth',      company:'Linear',        rating:5, text:"Onboarding took 15 minutes and we were running scans immediately. The documentation is the best I've ever read.", avatar:'NW', color:'#8B5CF6', category:'onboarding' },
  { id:7,  name:'Aisha Patel',     role:'DevOps Engineer',     company:'Cloudflare',    rating:5, text:'Uptime has been 99.99% over 8 months. Never missed an SLA. The infrastructure is rock-solid.', avatar:'AP', color:'#F97316', category:'reliability' },
  { id:8,  name:'Mia Thompson',    role:'UX Researcher',       company:'Notion',        rating:5, text:'The dashboard is so thoughtfully designed. Our non-technical team adopted it without any training sessions.', avatar:'MT', color:'#06B6D4', category:'design' },
  { id:9,  name:'Ethan Kowalski',  role:'Senior Engineer',     company:'PlanetScale',   rating:5, text:'Webhooks, streaming results, bulk exports — everything just works. The DX is second to none.', avatar:'EK', color:'#84CC16', category:'api' },
  { id:10, name:'Olivia Chen',     role:'Operations Manager',  company:'Supabase',      rating:5, text:"ROI was visible in week one. We've processed 2M+ scans and counting with zero issues.", avatar:'OC', color:'#EF4444', category:'value' },
  { id:11, name:'Liam Nakamura',   role:'Backend Developer',   company:'Railway',       rating:4, text:'Clean REST API, great rate limits, and support responds in under 2 hours. Genuinely rare in this space.', avatar:'LN', color:'#A855F7', category:'api' },
  { id:12, name:'Zoe Anderson',    role:'Creative Director',   company:'Framer',        rating:5, text:'Visual outputs are polished enough to put directly in client presentations. Saves hours every week.', avatar:'ZA', color:'#F43F5E', category:'design' },
  { id:13, name:'Carlos Rivera',   role:'CTO',                 company:'Resend',        rating:5, text:'Migrated from a competitor in one afternoon. Performance is noticeably better and pricing is fairer.', avatar:'CR', color:'#0284C7', category:'performance' },
  { id:14, name:'Fatima Al-Sayed', role:'AI Researcher',       company:'Hugging Face',  rating:5, text:'The underlying model architecture is clearly state of the art. Results on our benchmark surpassed GPT-4V.', avatar:'FA', color:'#D97706', category:'accuracy' },
  { id:15, name:'Ben Foster',      role:'Startup Founder',     company:'Turso',         rating:5, text:"We're a team of 4 and OpenSightAI let us compete with teams 10x our size. Game changer.", avatar:'BF', color:'#059669', category:'value' },
  { id:16, name:'Sofia Kim',       role:'Product Designer',    company:'Raycast',       rating:5, text:'The API explorer in the dashboard is outstanding. Found and fixed an integration bug in minutes not days.', avatar:'SK', color:'#7C3AED', category:'design' },
]

const CATEGORIES = ['all', 'accuracy', 'performance', 'api', 'value', 'design', 'reliability', 'onboarding']

/* ─────────────────────────────────────────────────────────── */
/*  Stars                                                       */
/* ─────────────────────────────────────────────────────────── */
function Stars({ n, size = 13 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} fill={i <= n ? '#F5A623' : 'none'} stroke={i <= n ? '#F5A623' : 'rgba(245,166,35,.3)'} strokeWidth={1.5} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  TCard                                                       */
/* ─────────────────────────────────────────────────────────── */
function TCard({ t, dark, style = {} }) {
  const [hov, setHov] = useState(false)
  const card  = dark ? '#141208' : '#FFFDF5'
  const bdr   = dark ? 'rgba(245,166,35,.18)' : 'rgba(245,166,35,.14)'
  const ink   = dark ? '#F2EDD8' : '#1A180F'
  const muted = dark ? '#A0967E' : '#7A7060'

  return (
    <div
      className="tm-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (dark ? 'rgba(245,166,35,.07)' : 'rgba(245,166,35,.04)') : card,
        border: `1.5px solid ${hov ? 'rgba(245,166,35,.45)' : bdr}`,
        boxShadow: hov
          ? '0 20px 48px rgba(245,166,35,.16), 0 4px 16px rgba(0,0,0,.12)'
          : (dark ? '0 2px 12px rgba(0,0,0,.2)' : '0 2px 12px rgba(0,0,0,.05)'),
        ...style,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Quote size={18} fill="rgba(245,166,35,.25)" stroke="#F5A623" strokeWidth={1.5} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <Stars n={t.rating} />
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: muted, margin: '0 0 16px', fontStyle: 'italic' }}>
        "{t.text}"
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="tm-av-ring" style={{ background: `${t.color}22` }}>
          <span style={{ color: t.color, fontSize: 13, fontWeight: 700 }}>{t.avatar}</span>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: ink, margin: 0, lineHeight: 1.2 }}>{t.name}</p>
          <p style={{ fontSize: 11.5, color: muted, margin: 0, marginTop: 2 }}>
            {t.role} · <span style={{ color: '#F5A623', fontWeight: 600 }}>{t.company}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  ViewAllTestimonialsModal                                    */
/* ─────────────────────────────────────────────────────────── */
export function ViewAllTestimonialsModal({ open, onClose, dark }) {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('all')
  const [sort,     setSort]     = useState('default')

  const ink   = dark ? '#F2EDD8' : '#1A180F'
  const muted = dark ? '#A0967E' : '#7A7060'
  const card  = dark ? '#0E0D08' : '#FEFCF3'
  const bdr   = dark ? 'rgba(245,166,35,.2)' : 'rgba(245,166,35,.15)'

  const filtered = ALL_TESTIMONIALS
    .filter(t => {
      const matchQ = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.text.toLowerCase().includes(search.toLowerCase()) || t.company.toLowerCase().includes(search.toLowerCase())
      const matchC = category === 'all' || t.category === category
      return matchQ && matchC
    })
    .sort((a, b) => sort === 'rating' ? b.rating - a.rating : sort === 'company' ? a.company.localeCompare(b.company) : 0)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="tm-modal-overlay"
      style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="tm-modal-inner" style={{ background: card, border: `1.5px solid ${bdr}`, boxShadow: '0 32px 80px rgba(0,0,0,.5)' }}>
        <div style={{ height: 5, background: 'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)', borderRadius: '28px 28px 0 0', margin: '0 1px' }} />

        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: ink, margin: 0, letterSpacing: '-.02em' }}>All Testimonials</h2>
            <p style={{ fontSize: 13, color: muted, margin: '4px 0 0' }}>{filtered.length} of {ALL_TESTIMONIALS.length} reviews</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${bdr}`, background: 'transparent', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,166,35,.5)'; e.currentTarget.style.color = '#F5A623' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = muted }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 28px', borderBottom: `1px solid ${bdr}`, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#F5A623', opacity: .7, pointerEvents: 'none' }} />
            <input
              className="tm-search"
              placeholder="Search by name, company, keyword…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: `1.5px solid ${bdr}`, background: dark ? 'rgba(245,166,35,.06)' : 'rgba(245,166,35,.04)', color: ink }}
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 12, border: `1.5px solid ${bdr}`, background: dark ? '#1A1800' : '#FFFDF5', color: ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none' }}
          >
            <option value="default">Default</option>
            <option value="rating">Highest Rated</option>
            <option value="company">By Company</option>
          </select>
        </div>

        <div style={{ padding: '12px 28px', display: 'flex', flexWrap: 'wrap', gap: 7, borderBottom: `1px solid ${bdr}` }}>
          {CATEGORIES.map(c => {
            const sel = c === category
            return (
              <button
                key={c} className="tm-chip"
                onClick={() => setCategory(c)}
                style={{ borderColor: sel ? '#F5A623' : bdr, background: sel ? 'rgba(245,166,35,.15)' : 'transparent', color: sel ? '#F5A623' : muted }}
                onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = 'rgba(245,166,35,.4)'; e.currentTarget.style.color = '#F5A623' } }}
                onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = muted } }}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: muted }}>
              <Search size={32} style={{ opacity: .3, marginBottom: 12 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No testimonials match your filters</p>
            </div>
          ) : (
            <div className="tm-grid">
              {filtered.map((t, i) => (
                <div key={t.id} style={{ animation: `fadeUp .4s ${i * 30}ms both` }}>
                  <TCard t={t} dark={dark} style={{ width: '100%', margin: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  Main Testimonials Section                                   */
/* ─────────────────────────────────────────────────────────── */
export default function Testimonials() {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.getAttribute('data-theme') === 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const surface = dark ? '#0E0D08' : '#FEFCF3'
  const ink     = dark ? '#F2EDD8' : '#1A180F'
  const muted   = dark ? '#A0967E' : '#7A7060'
  const bdr     = dark ? 'rgba(245,166,35,.18)' : 'rgba(245,166,35,.13)'

  const row1 = ALL_TESTIMONIALS.slice(0, 8)
  const row2 = ALL_TESTIMONIALS.slice(8, 16)

  const STATS = [
    { value: '10,000+', label: 'Teams worldwide',   delay: '0ms'   },
    { value: '4.9/5',   label: 'Average rating',    delay: '80ms'  },
    { value: '99.8%',   label: 'Satisfaction rate', delay: '160ms' },
    { value: '2M+',     label: 'Scans processed',   delay: '240ms' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <section className="tm-root" id="testimonials" style={{ background: surface, padding: '96px 0 80px', position: 'relative', overflowX: 'hidden', overflowY: 'visible', transition: 'background .3s' }}>

        {/* Background decoration */}
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(245,166,35,.07),transparent 65%)', pointerEvents: 'none' }} />

        {/* Section Header */}
        <div style={{ textAlign: 'center', padding: '0 24px', marginBottom: 52 }}>
          <div className="tm-title-in" style={{ animationDelay: '0ms', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 16px', borderRadius: 50, marginBottom: 20, background: 'rgba(245,166,35,.1)', border: '1.5px solid rgba(245,166,35,.28)' }}>
            <Star size={13} fill="#F5A623" stroke="#F5A623" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#F5A623', letterSpacing: '.06em', textTransform: 'uppercase' }}>4.9 · 10,000+ teams</span>
          </div>

          <h2 className="tm-title-in" style={{ animationDelay: '80ms', fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: ink, margin: '0 0 16px', letterSpacing: '-.04em', lineHeight: 1.1 }}>
            Trusted by builders<br />
            <span style={{ background: 'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'gradShift 3s ease infinite' }}>
              worldwide
            </span>
          </h2>

          <p className="tm-title-in" style={{ animationDelay: '160ms', fontSize: 'clamp(14px,2vw,17px)', color: muted, maxWidth: 540, margin: '0 auto', lineHeight: 1.7 }}>
            From scrappy startups to Fortune 500 teams — see why thousands of developers and product teams choose OpenSightAI.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 800, margin: '0 auto 60px', padding: '0 24px' }}>
          {STATS.map((s, i) => (
            <div key={i} className="tm-stat" style={{ animationDelay: s.delay, flex: '1 1 140px', textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ fontSize: 'clamp(26px,4vw,36px)', fontWeight: 900, color: ink, letterSpacing: '-.03em', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: muted, marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Marquee row 1 (left) — overflow-x hidden only, vertical room for hover lift */}
        <div style={{ position: 'relative', marginBottom: 4, overflowX: 'hidden', overflowY: 'visible', padding: '12px 0' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 120, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(to right,${surface},transparent)` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 120, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(to left,${surface},transparent)` }} />
          <div className="tm-track-l">
            {[...row1, ...row1].map((t, i) => <TCard key={i} t={t} dark={dark} />)}
          </div>
        </div>

        {/* Marquee row 2 (right) — overflow-x hidden only */}
        <div style={{ position: 'relative', overflowX: 'hidden', overflowY: 'visible', padding: '12px 0' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 120, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(to right,${surface},transparent)` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 120, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(to left,${surface},transparent)` }} />
          <div className="tm-track-r">
            {[...row2, ...row2].map((t, i) => <TCard key={i} t={t} dark={dark} />)}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', marginTop: 52, padding: '0 24px' }}>
          <p style={{ fontSize: 14, color: muted, marginBottom: 20 }}>
            Want to see all <strong style={{ color: '#F5A623' }}>{ALL_TESTIMONIALS.length}+</strong> testimonials?
          </p>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              position: 'relative', overflow: 'hidden',
              padding: '13px 32px', borderRadius: 50, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', color: '#1A180F',
              fontSize: 14.5, fontWeight: 700, letterSpacing: '.01em',
              boxShadow: '0 4px 20px rgba(245,166,35,.42)',
              transition: 'all .22s', display: 'inline-flex', alignItems: 'center', gap: 9,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(245,166,35,.55)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,166,35,.42)' }}
          >
            <ExternalLink size={16} />
            View All Testimonials
          </button>
        </div>
      </section>

      <ViewAllTestimonialsModal open={modalOpen} onClose={() => setModalOpen(false)} dark={dark} />
    </>
  )
}