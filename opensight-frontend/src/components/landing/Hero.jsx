import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── DATA ─────────────────────────────────────────────────────────────────────
const DATA = [62, 65, 61, 68, 72, 70, 76, 74, 80, 78, 84, 83, 88, 87, 92, 95, 94, 97, 96, 98]
// Each point represents one day — smooth uptrend like a real trading chart

const SIGNALS = [
  { sym: 'AAPL', action: 'BUY',  price: '$189.42', change: '+2.14%', up: true  },
  { sym: 'NVDA', action: 'BUY',  price: '$875.60', change: '+4.31%', up: true  },
  { sym: 'TSLA', action: 'SELL', price: '$242.80', change: '-1.03%', up: false },
]
const ALL_SYM = [
  { sym:'AAPL', price:'$189.42' }, { sym:'NVDA', price:'$875.60' },
  { sym:'TSLA', price:'$242.80' }, { sym:'MSFT', price:'$415.20' },
  { sym:'META', price:'$523.10' }, { sym:'AMD',  price:'$168.40' },
]

// ─── COUNTER ──────────────────────────────────────────────────────────────────
function Counter({ to, suffix = '', delay = 0 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf; const t = setTimeout(() => {
      const s = performance.now()
      const run = (now) => { const p = Math.min((now-s)/1600,1); setN(Math.round((1-Math.pow(1-p,4))*to)); if(p<1) raf=requestAnimationFrame(run) }
      raf = requestAnimationFrame(run)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [to, delay])
  return <>{n.toLocaleString()}{suffix}</>
}

// ─── TRADING CHART ────────────────────────────────────────────────────────────
// The KEY FIX: mouse events on a transparent overlay rect the same size as the SVG
// so coordinates are always correct. Tooltip rendered as HTML div outside SVG.
function TradingChart() {
  const wrapRef   = useRef(null)
  const [W, setW] = useState(320)
  const H         = 120
  const PAD       = { t: 8, r: 4, b: 24, l: 4 }
  const cW        = W  - PAD.l - PAD.r   // chart inner width
  const cH        = H  - PAD.t - PAD.b   // chart inner height

  // Resize observer
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Draw-in animation
  const [drawn, setDrawn] = useState(0) // 0-1
  useEffect(() => {
    const tid = setTimeout(() => {
      const start = performance.now()
      const dur   = 1400
      const frame = (now) => {
        const p = Math.min((now - start) / dur, 1)
        setDrawn(p)
        if (p < 1) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }, 600)
    return () => clearTimeout(tid)
  }, [])

  // Hover state — index into DATA
  const [hov, setHov] = useState(null)

  // Convert DATA → SVG coords
  const min  = Math.min(...DATA)
  const max  = Math.max(...DATA)
  const pts  = DATA.map((v, i) => ({
    x: PAD.l + (i / (DATA.length - 1)) * cW,
    y: PAD.t + cH - ((v - min) / (max - min)) * cH,
    v,
  }))

  // Smooth cubic bezier path through all pts
  const fullPath = (() => {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const cpx = ((pts[i-1].x + pts[i].x) / 2).toFixed(1)
      d += ` C ${cpx},${pts[i-1].y.toFixed(1)} ${cpx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
    }
    return d
  })()

  // Clip path id (unique per instance)
  const clipId = 'tc-clip'

  // Clip width based on drawn progress
  const clipW = PAD.l + cW * drawn

  // Bottom of chart (for area fill)
  const botY = PAD.t + cH

  // Area path = line path + close bottom
  const areaPath = fullPath + ` L ${pts[pts.length-1].x.toFixed(1)},${botY} L ${pts[0].x.toFixed(1)},${botY} Z`

  // Last drawn point (for live dot)
  const lastIdx  = Math.min(Math.floor(drawn * (DATA.length - 1)), DATA.length - 1)
  const lastPt   = pts[lastIdx]

  // Mouse → index mapping: use the wrap div for getBoundingClientRect
  const handleMouseMove = (e) => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left - PAD.l
    const idx  = Math.round((relX / cW) * (DATA.length - 1))
    setHov(Math.max(0, Math.min(DATA.length - 1, idx)))
  }

  // Tooltip position in px relative to wrap div
  const hovPt = hov !== null ? pts[hov] : null
  let tipLeft = 0, tipTop = 0
  if (hovPt) {
    tipLeft = hovPt.x - 30   // 60px wide tooltip, center it
    tipTop  = hovPt.y - 52   // 44px tall, 8px gap above dot
    // clamp left
    tipLeft = Math.max(0, Math.min(tipLeft, W - 60))
    // if too close to top, put below dot
    if (tipTop < 0) tipTop = hovPt.y + 14
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHov(null)}
    >
      {/* ── SVG chart ── */}
      <svg
        width="100%" height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          {/* Clip draws the line left→right */}
          <clipPath id={clipId}>
            <rect x={0} y={0} width={clipW} height={H + 10} />
          </clipPath>
          {/* Golden gradient fill */}
          <linearGradient id="aFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0.01" />
          </linearGradient>
          {/* Golden stroke gradient */}
          <linearGradient id="aLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#C47A0A" />
            <stop offset="50%"  stopColor="#F5A623" />
            <stop offset="100%" stopColor="#FFD166" />
          </linearGradient>
          <filter id="aGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Subtle horizontal grid */}
        {[0.25, 0.5, 0.75].map((f, i) => {
          const gy = PAD.t + cH * f
          const val = Math.round(max - f * (max - min))
          return (
            <g key={i}>
              <line x1={PAD.l} y1={gy} x2={PAD.l + cW} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD.l - 2} y={gy + 3.5} textAnchor="end" fontSize="8" fill="rgba(128,128,128,0.4)" fontFamily="monospace">{val}</text>
            </g>
          )
        })}

        {/* Area fill (clipped) */}
        <path d={areaPath} fill="url(#aFill)" clipPath={`url(#${clipId})`} />

        {/* Main line (clipped) */}
        <path
          d={fullPath}
          fill="none"
          stroke="url(#aLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#aGlow)"
          clipPath={`url(#${clipId})`}
        />

        {/* Hover: vertical crosshair + dot — rendered at exact data point coords */}
        {hov !== null && hovPt && drawn >= 1 && (
          <>
            <line
              x1={hovPt.x} y1={PAD.t}
              x2={hovPt.x} y2={PAD.t + cH}
              stroke="rgba(245,166,35,0.4)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            {/* Outer ring */}
            <circle cx={hovPt.x} cy={hovPt.y} r="7" fill="rgba(245,166,35,0.15)" />
            {/* Inner dot */}
            <circle cx={hovPt.x} cy={hovPt.y} r="4" fill="#F5A623" stroke="#1A1A2E" strokeWidth="2" />
          </>
        )}

        {/* Live pulse dot at last drawn point */}
        {drawn >= 1 && hov === null && (
          <>
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="rgba(245,166,35,0.15)">
              <animate attributeName="r" values="4;11;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#F5A623" stroke="#1A1A2E" strokeWidth="2" />
          </>
        )}

        {/* X-axis day labels */}
        {['M','T','W','T','F','S','S','M','T','W'].map((d, i) => {
          const x = PAD.l + (i / 9) * cW
          return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="rgba(128,128,128,0.35)" fontFamily="system-ui">{d}</text>
        })}
      </svg>

      {/* ── HTML Tooltip — positioned via absolute, always readable ── */}
      {hov !== null && hovPt && drawn >= 1 && (
        <div style={{
          position:      'absolute',
          left:          tipLeft,
          top:           tipTop,
          width:         60,
          pointerEvents: 'none',
          zIndex:        20,
          background:    '#111318',
          border:        '1px solid rgba(245,166,35,0.45)',
          borderRadius:  8,
          padding:       '5px 0',
          textAlign:     'center',
          boxShadow:     '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#F5A623', letterSpacing: '0.06em', lineHeight: 1.2 }}>ACC</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{DATA[hov]}%</div>
        </div>
      )}
    </div>
  )
}

// ─── LIVE SIGNALS ─────────────────────────────────────────────────────────────
function LiveSignals() {
  const [items, setItems] = useState(SIGNALS)
  const [tick,  setTick]  = useState(0)
  useEffect(() => {
    const acts = ['BUY','SELL','HOLD']
    const iv   = setInterval(() => {
      setTick(t => t + 1)
      const b  = ALL_SYM[Math.floor(Math.random() * ALL_SYM.length)]
      const ac = acts[Math.floor(Math.random() * 3)]
      const up = ac !== 'SELL'
      const p  = (Math.random() * 4 + 0.3).toFixed(2)
      setItems(prev => [{ sym:b.sym, action:ac, price:b.price, change:`${up?'+':'-'}${p}%`, up }, ...prev.slice(0,2)])
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const AC = { BUY:'#22C55E', SELL:'#EF4444', HOLD:'#F5A623' }
  const AB = { BUY:'rgba(34,197,94,.12)', SELL:'rgba(239,68,68,.12)', HOLD:'rgba(245,166,35,.12)' }

  return (
    <div>
      {items.map((it, i) => (
        <div key={`${it.sym}-${i}-${tick}`} style={{
          display: 'flex', alignItems: 'center', padding: '9px 0',
          borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          animation: i === 0 ? 'feedIn .25s ease both' : 'none',
          opacity: 1 - i * 0.2,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', width: 44 }}>{it.sym}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: AB[it.action], color: AC[it.action], marginRight: 'auto' }}>{it.action}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 12 }}>{it.price}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: it.up ? '#22C55E' : '#EF4444' }}>{it.change}</span>
        </div>
      ))}
    </div>
  )
}

// ─── RIGHT PANEL ──────────────────────────────────────────────────────────────
function RightPanel() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(iv) }, [])
  const ts = time.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })

  const sh  = '0 20px 60px rgba(0,0,0,.14), 0 4px 20px rgba(245,166,35,.08), inset 0 1px 0 rgba(255,255,255,.06)'
  const shH = '0 28px 72px rgba(0,0,0,.18), 0 6px 24px rgba(245,166,35,.12), inset 0 1px 0 rgba(255,255,255,.06)'

  return (
    <div style={{ position:'relative', animation:'slideIn .8s .1s cubic-bezier(.16,1,.3,1) both' }}>

      {/* ROI badge */}
      <div style={{
        position:'absolute', top:-38, right:6, zIndex:10,
        padding:'8px 13px', borderRadius:12,
        background:'var(--card)', border:'1px solid rgba(34,197,94,.22)',
        boxShadow:'0 6px 20px rgba(34,197,94,.12)',
        animation:'floatA 4s ease-in-out infinite',
      }}>
        <p style={{ fontSize:9, color:'rgba(34,197,94,.6)', fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:3 }}>Monthly ROI</p>
        <p style={{ fontSize:18, fontWeight:800, color:'#22C55E', letterSpacing:'-0.02em', lineHeight:1 }}>+118.6%</p>
      </div>

      {/* Users badge */}
      <div style={{
        position:'absolute', bottom:-16, left:-12, zIndex:10,
        display:'flex', alignItems:'center', gap:8,
        padding:'7px 11px', borderRadius:12,
        background:'var(--card)', border:'1px solid rgba(245,166,35,.15)',
        boxShadow:'0 6px 18px rgba(0,0,0,.1)',
        animation:'floatB 3.8s ease-in-out infinite',
      }}>
        <div style={{ display:'flex' }}>
          {['#F5A623','#6366F1','#22C55E'].map((c,i) => (
            <div key={i} style={{ width:20, height:20, borderRadius:'50%', background:c, border:'2px solid var(--card)', marginLeft:i===0?0:-5, zIndex:3-i }} />
          ))}
        </div>
        <div>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--ink)', lineHeight:1, marginBottom:2 }}>15,240 traders</p>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#22C55E', display:'inline-block', animation:'blink 1.5s infinite' }} />
            <span style={{ fontSize:9, color:'var(--muted)' }}>Active now</span>
          </div>
        </div>
      </div>

      {/* ── Card ── */}
      <div
        style={{ borderRadius:20, background:'var(--card)', border:'1px solid rgba(245,166,35,.15)', boxShadow:sh, animation:'cardFloat 7s ease-in-out infinite', transition:'box-shadow .35s', position:'relative', overflow:'visible' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow=shH}
        onMouseLeave={e => e.currentTarget.style.boxShadow=sh}
      >
        {/* shimmer */}
        <div style={{ position:'absolute',top:0,left:'10%',right:'10%',height:1,borderRadius:2,background:'linear-gradient(90deg,transparent,rgba(245,166,35,.5),transparent)',pointerEvents:'none' }} />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px 13px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#F5A623,#FFD166)', boxShadow:'0 3px 12px rgba(245,166,35,.3)', fontSize:16 }}>◈</div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--ink)', lineHeight:1, letterSpacing:'-0.01em' }}>AI Dashboard</p>
              <p style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Live market analytics</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:20, background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.2)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', display:'inline-block', animation:'blink 1.5s infinite' }} />
            <span style={{ fontSize:10, fontWeight:600, color:'#22C55E' }}>LIVE</span>
          </div>
        </div>

        {/* Chart section with stat row above */}
        <div style={{ padding:'14px 18px 10px' }}>
          {/* Stat row: big number + change + label */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:10, fontWeight:500, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Accuracy · 20 days</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <span style={{ fontSize:28, fontWeight:800, color:'var(--ink)', letterSpacing:'-0.04em', lineHeight:1 }}>98</span>
                <span style={{ fontSize:16, fontWeight:700, color:'#F5A623' }}>%</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#22C55E', background:'rgba(34,197,94,.1)', padding:'2px 9px', borderRadius:20, marginLeft:2 }}>↑ +36%</span>
              </div>
            </div>
            <span style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{ts}</span>
          </div>

          {/* THE CHART */}
          <TradingChart />
        </div>

        {/* 4 metrics compact */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, padding:'0 18px 14px' }}>
          {[
            { l:'Win Rate',  v:'94.2%', d:'+1.8%', up:true  },
            { l:'Sharpe',    v:'3.82',  d:'+0.24', up:true  },
            { l:'Drawdown',  v:'-2.1%', d:'-0.3%', up:false },
            { l:'Latency',   v:'1.4ms', d:'-0.2s', up:true  },
          ].map((m,i) => (
            <div key={i} style={{ textAlign:'center', borderRadius:10, padding:'9px 6px', background:'rgba(128,128,128,.05)', border:'1px solid rgba(128,128,128,.08)', transition:'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,166,35,.22)'; e.currentTarget.style.background='rgba(245,166,35,.04)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(128,128,128,.08)'; e.currentTarget.style.background='rgba(128,128,128,.05)' }}>
              <p style={{ fontSize:9, color:'var(--muted)', marginBottom:5, letterSpacing:'0.03em' }}>{m.l}</p>
              <p style={{ fontSize:14, fontWeight:800, color:'var(--ink)', letterSpacing:'-0.02em', lineHeight:1, marginBottom:3 }}>{m.v}</p>
              <p style={{ fontSize:9, fontWeight:600, color: m.up ? '#22C55E' : '#EF4444' }}>{m.d}</p>
            </div>
          ))}
        </div>

        {/* Live signals */}
        <div style={{ margin:'0 18px 18px', borderRadius:12, padding:'11px 13px', background:'rgba(128,128,128,.04)', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Live Signals</span>
              <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:'rgba(245,166,35,.1)', color:'#F5A623', fontWeight:600 }}>3 Active</span>
            </div>
            <span style={{ fontSize:9, color:'var(--muted)' }}>Updates every 3s</span>
          </div>
          <LiveSignals />
        </div>

      </div>
    </div>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
export default function Hero() {
  const navigate = useNavigate()

  return (
    <section id="home" className="hs"
      style={{ position:'relative', overflow:'hidden', background:'var(--surface)', color:'var(--ink)', fontFamily:"'DM Sans',Inter,system-ui,sans-serif" }}>

      {/* Background */}
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
        background:'radial-gradient(ellipse 700px 500px at -5% 55%, rgba(245,166,35,.09) 0%, transparent 65%), radial-gradient(ellipse 500px 400px at 105% 10%, rgba(245,166,35,.07) 0%, transparent 65%)' }} />
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
        backgroundImage:'radial-gradient(circle, rgba(245,166,35,.1) 1px, transparent 1px)',
        backgroundSize:'32px 32px',
        maskImage:'radial-gradient(ellipse 70% 70% at 50% 50%, black 5%, transparent 100%)',
        WebkitMaskImage:'radial-gradient(ellipse 70% 70% at 50% 50%, black 5%, transparent 100%)' }} />

      <div className="hs-grid" style={{ position:'relative', zIndex:1, maxWidth:1280, margin:'0 auto', width:'100%' }}>

        {/* ── LEFT PANEL ── */}
        <div>

          

          {/* Stars */}
          <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:14, animation:'fadeUp .5s .07s ease both' }}>
            {'★★★★★'.split('').map((s,i) => <span key={i} style={{ color:'#F5A623', fontSize:15 }}>{s}</span>)}
            <span style={{ fontSize:14, fontWeight:700, marginLeft:7, color:'var(--ink)' }}>4.8 on Trustpilot</span>
            <span style={{ fontSize:13, color:'var(--muted)', marginLeft:4 }}>(18,500+ users)</span>
          </div>

          {/* H1 */}
          <h1 style={{ fontWeight:900, lineHeight:1.06, marginBottom:16, color:'var(--ink)', fontSize:'clamp(2.1rem,3.8vw,3.3rem)', letterSpacing:'-0.04em', fontFamily:'inherit', animation:'fadeUp .6s .12s ease both' }}>
            Master Your{' '}
            <span style={{ color:'#F5A623', textShadow:'0 0 48px rgba(245,166,35,.28)' }}>AI Intelligence</span>
            {' '}Challenges
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize:16, lineHeight:1.65, marginBottom:24, maxWidth:480, color:'var(--muted)', animation:'fadeUp .6s .17s ease both' }}>
            Harness cutting-edge AI to analyze market data, complete intelligent challenges, and unlock your full potential — all in real time.
          </p>

          {/* CTAs */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:20, animation:'fadeUp .6s .23s ease both' }}>
            <button onClick={() => navigate('/signup')} style={{ padding:'13px 34px', borderRadius:30, fontWeight:800, fontSize:15, cursor:'pointer', border:'none', fontFamily:'inherit', background:'linear-gradient(135deg,#F5A623,#FFCF6B,#E8940A)', color:'#1A180F', boxShadow:'0 6px 28px rgba(245,166,35,.4)', transition:'all .3s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 36px rgba(245,166,35,.56)' }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 6px 28px rgba(245,166,35,.4)' }}>
              Start Free Trial →
            </button>
            
          </div>

          {/* Trust line */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginBottom:28, fontSize:12, color:'var(--muted)', animation:'fadeUp .6s .28s ease both' }}>
            {['No credit card required','Cancel anytime','14-day free trial'].map((t,i) => (
              <span key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ color:'#22C55E' }}>✓</span>{t}
              </span>
            ))}
          </div>

          {/* Stat pills — icon + number + label only, NO sparkline */}
          <div className="hs-stats" style={{ animation:'fadeUp .6s .34s ease both' }}>
            {[
              { ico:'◈', v:50, s:'K+', l:'Analyses Completed', accent:'#F5A623', sub:'+12% this week' },
              { ico:'◉', v:15, s:'K+', l:'Active Traders',     accent:'#22C55E', sub:'Online now'     },
              { ico:'◆', v:98, s:'%',  l:'Accuracy Rate',      accent:'#F5A623', sub:'Industry best'  },
            ].map((st, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, borderRadius:14, padding:'12px 14px', background:'var(--card)', border:'1px solid rgba(245,166,35,.12)', transition:'all .28s', cursor:'default' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 28px rgba(245,166,35,.1)'; e.currentTarget.style.borderColor='rgba(245,166,35,.3)'; e.currentTarget.style.transform='translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor='rgba(245,166,35,.12)'; e.currentTarget.style.transform='' }}>
                <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`${st.accent}14`, fontSize:17, color:'#F5A623' }}>{st.ico}</div>
                <div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
                    <span style={{ fontWeight:800, fontSize:17, color:'var(--ink)', letterSpacing:'-0.02em' }}>
                      <Counter to={st.v} suffix={st.s} delay={500 + i*150} />
                    </span>
                    <span style={{ fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:20, color:st.accent, background:`${st.accent}12` }}>{st.sub}</span>
                  </div>
                  <p style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{st.l}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="hs-right">
          <RightPanel />
        </div>

      </div>

      {/* ── SINGLE STYLE BLOCK — all keyframes here ── */}
      <style>{`
        .hs        { padding: 80px 16px 60px; }
        .hs-grid   { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: start; }
        .hs-stats  { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .hs-right  { padding-top: 0; }

        @media (min-width: 480px) {
          .hs-stats { grid-template-columns: repeat(3,1fr); }
        }
        @media (min-width: 640px) {
          .hs { padding: 84px 24px 64px; }
        }
        @media (min-width: 768px) {
          .hs       { padding: 80px 28px 60px; }
          .hs-grid  { grid-template-columns: 1fr 1fr; gap: 52px; align-items: start; }
          .hs-right { padding-top: 12px; }
        }
        @media (min-width: 1024px) {
          .hs       { padding: 88px 40px 68px; }
          .hs-grid  { gap: 64px; }
          .hs-right { padding-top: 16px; }
        }
        @media (max-width: 767px) {
          .hs-right { max-width: 460px; margin: 0 auto; }
        }
        @media (max-width: 480px) {
          .hs       { padding: 70px 14px 52px; }
          .hs-right { max-width: 100%; }
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes blink {
          0%,100% { opacity:1; }
          50%     { opacity:0.2; }
        }
        @keyframes cardFloat {
          0%,100% { transform:translateY(0) rotate(0deg); }
          40%     { transform:translateY(-8px) rotate(0.2deg); }
          70%     { transform:translateY(-4px) rotate(-0.15deg); }
        }
        @keyframes floatA {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(-8px); }
        }
        @keyframes floatB {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(7px); }
        }
        @keyframes slideIn {
          from { opacity:0; transform:translateX(32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes feedIn {
          from { opacity:0; transform:translateY(-5px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </section>
  )
}