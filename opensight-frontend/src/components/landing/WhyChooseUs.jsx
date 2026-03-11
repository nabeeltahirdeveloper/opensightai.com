import React, { useState, useEffect, useRef } from 'react'
import { Zap, ScanSearch, Layers, ShieldCheck, TrendingUp, ArrowUpRight, Check, Minus } from 'lucide-react'

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function useInView(threshold = 0.08) {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect() } }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, v]
}

const up = (v, d = 0) => ({
  opacity: v ? 1 : 0,
  transform: v ? 'translateY(0)' : 'translateY(24px)',
  transition: `opacity .6s ease ${d}s, transform .6s ease ${d}s`,
})

const FEATURES = [
  { Icon: Zap,         title: 'Instant Analysis',     stat: '< 2s',   sub: 'per chart',    desc: 'Full technical brief delivered in under 2 seconds via GPU-accelerated vision pipelines.' },
  { Icon: ScanSearch,  title: 'Pattern Precision',     stat: '98.5%',  sub: 'accuracy',     desc: 'Benchmarked on 50K+ labeled datasets. Identifies 80+ formations with zero guesswork.' },
  { Icon: Layers,      title: 'Auto Indicators',       stat: '50+',    sub: 'computed',     desc: 'RSI, MACD, Fibonacci, Ichimoku — every indicator read, computed, and explained for you.' },
  { Icon: TrendingUp,  title: 'Any Market',            stat: '24',     sub: 'asset classes', desc: 'Stocks, crypto, forex, commodities — paste any chart from any broker, anywhere.' },
  { Icon: ShieldCheck, title: 'Private & Secure',      stat: '100%',   sub: 'encrypted',    desc: 'Your charts are never stored or sold. GDPR-conscious infrastructure, always.' },
  { Icon: ArrowUpRight,'title': 'Actionable Output',   stat: '15K+',   sub: 'traders',      desc: 'Every analysis ends with clear entry/exit logic — not raw data dumps.' },
]

const COMPARE = [
  ['AI Chart Analysis',        true,  false],
  ['Sub-2s Processing',        true,  false],
  ['50+ Auto Indicators',      true,  false],
  ['Pattern Recognition',      true,  true ],
  ['Scenario Forecasting',     true,  false],
  ['No Setup Required',        true,  false],
  ['Educational Explanations', true,  false],
]

export default function WhyChooseUs() {
  const dark = useDark()
  const [hRef, hVis] = useInView()
  const [fRef, fVis] = useInView()
  const [bRef, bVis] = useInView()

  const gold   = dark ? '#FFCF6B' : '#F5A623'
  const ink    = dark ? '#F9F5E8' : '#0F0F0F'
  const sub    = dark ? '#9CA3AF' : '#6B7280'
  const cardBg = dark ? 'rgba(20,17,9,0.9)' : 'rgba(255,253,245,0.95)'
  const border = 'rgba(245,166,35,0.18)'
  const borderH= 'rgba(245,166,35,0.42)'

  return (
    <section className="relative overflow-hidden py-24 md:py-32 px-4 sm:px-6"
      style={{ background: dark ? '#0D0C09' : '#FEFCF3', color: ink, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Ambient glow — identical to About */}
      <div className="pointer-events-none absolute inset-0" style={{ background:
        dark ? 'radial-gradient(ellipse 700px 500px at -5% 55%,rgba(245,166,35,.16) 0%,transparent 60%),radial-gradient(ellipse 500px 400px at 108% 8%,rgba(245,166,35,.11) 0%,transparent 60%)'
             : 'radial-gradient(ellipse 700px 500px at -5% 55%,rgba(245,166,35,.09) 0%,transparent 60%),radial-gradient(ellipse 500px 400px at 108% 8%,rgba(245,166,35,.06) 0%,transparent 60%)',
      }} />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* ════ HEADER ════ */}
        <div ref={hRef} className="grid lg:grid-cols-2 gap-10 items-end mb-20">
          <div style={up(hVis)}>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] mb-6"
              style={{ background: 'rgba(245,166,35,.10)', border: `1px solid rgba(245,166,35,.3)`, color: gold }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: gold, boxShadow: `0 0 8px ${gold}` }} />
              Why OpenSightAI
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-0" style={{ color: ink }}>
              The intelligence<br />
              layer{' '}
              <span style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                markets deserve.
              </span>
            </h2>
          </div>
          <div style={up(hVis, 0.15)}>
            <p className="text-base leading-relaxed mb-6" style={{ color: sub }}>
              OpenSightAI is not another screener. It's an autonomous AI agent that reads your
              chart like a senior analyst — detecting patterns, computing indicators, and handing
              you a clear, actionable brief in under 2 seconds.
            </p>
            {/* Inline stats */}
            <div className="flex flex-wrap gap-6">
              {[['98.5%','Accuracy'],['< 2s','Per analysis'],['50+','Indicators'],['15K+','Active traders']].map(([v, l]) => (
                <div key={l}>
                  <div className="text-2xl font-extrabold leading-none" style={{ color: gold }}>{v}</div>
                  <div className="text-xs mt-0.5 font-medium" style={{ color: sub }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════ FEATURE CARDS ════ */}
        <div ref={fRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {FEATURES.map(({ Icon, title, stat, sub: s, desc }, i) => (
            <div key={i}
              className="group relative rounded-2xl p-6 overflow-hidden cursor-default"
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                backdropFilter: 'blur(12px)',
                transition: 'transform .3s ease, box-shadow .3s ease, border-color .3s ease',
                ...up(fVis, i * 0.07),
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow=`0 28px 60px rgba(245,166,35,.16)`; e.currentTarget.style.borderColor=borderH }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor=border }}>

              {/* Shimmer on hover */}
              <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(245,166,35,.65),transparent)', transition: 'opacity .3s' }} />

              {/* Number watermark */}
              <div className="absolute top-4 right-5 text-[42px] font-black leading-none select-none"
                style={{ color: dark ? 'rgba(245,166,35,.05)' : 'rgba(245,166,35,.08)', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2,'0')}
              </div>

              <div className="flex items-center justify-between mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', boxShadow: '0 4px 14px rgba(245,166,35,.38)', transition: 'transform .3s' }}
                  onMouseEnter={e => e.currentTarget.style.transform='scale(1.12)'}
                  onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                  <Icon size={17} color="#111" strokeWidth={2.3} />
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold leading-none" style={{ color: gold }}>{stat}</div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color: sub }}>{s}</div>
                </div>
              </div>

              <h3 className="text-[15px] font-bold mb-2" style={{ color: ink }}>{title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: sub }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ════ BOTTOM: COMPARE + CTA ════ */}
        <div ref={bRef} className="grid lg:grid-cols-5 gap-4 mt-14" style={up(bVis)}>

          {/* Comparison table */}
          <div className="lg:col-span-3 rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}`, backdropFilter: 'blur(12px)' }}>
            {/* Head */}
            <div className="grid grid-cols-3 px-6 py-4" style={{ background: 'rgba(245,166,35,.06)', borderBottom: `1px solid rgba(245,166,35,.12)` }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: sub }}>Feature</span>
              <div className="flex justify-center">
                <span className="text-[11px] font-bold px-3 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', color: '#111' }}>
                  OpenSightAI
                </span>
              </div>
              <p className="text-center text-[11px] font-bold uppercase tracking-widest" style={{ color: sub }}>Others</p>
            </div>
            {/* Rows */}
            {COMPARE.map(([feat, us, them], i) => (
              <div key={i} className="grid grid-cols-3 items-center px-6 py-3.5"
                style={{
                  borderBottom: i < COMPARE.length - 1 ? `1px solid ${dark ? 'rgba(245,166,35,.07)' : 'rgba(245,166,35,.09)'}` : 'none',
                  transition: 'background .15s',
                  ...up(bVis, i * 0.05),
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(245,166,35,.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span className="text-[13px] font-medium" style={{ color: ink }}>{feat}</span>
                <div className="flex justify-center">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', boxShadow: '0 2px 8px rgba(245,166,35,.4)' }}>
                    <Check size={11} color="#111" strokeWidth={3} />
                  </span>
                </div>
                <div className="flex justify-center">
                  {them
                    ? <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)' }}><Check size={11} color={sub} strokeWidth={2.5} /></span>
                    : <Minus size={14} color={sub} />}
                </div>
              </div>
            ))}
          </div>

          {/* CTA card */}
          <div className="lg:col-span-2 rounded-2xl p-7 flex flex-col justify-between relative overflow-hidden"
            style={{ background: dark ? 'linear-gradient(145deg,rgba(28,22,8,.98),rgba(18,14,4,.95))' : 'linear-gradient(145deg,#FFF9EC,#FFF3D0)', border: `1px solid rgba(245,166,35,.28)` }}>

            {/* Decorative ring */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle,rgba(245,166,35,.15) 0%,transparent 65%)' }} />

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.12em] mb-3" style={{ color: gold }}>Get started today</div>
              <h3 className="text-2xl font-extrabold leading-snug mb-3" style={{ color: ink }}>
                Smarter analysis.<br />Faster decisions.
              </h3>
              <p className="text-[13px] leading-relaxed mb-6" style={{ color: sub }}>
                Join 15,000+ traders who replaced manual chart reading with an AI that never
                misses a pattern, never needs a break, and never second-guesses.
              </p>
              <div className="flex flex-col gap-2 mb-7">
                {['No credit card required','Free trial included','Cancel anytime'].map(t => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(245,166,35,.18)', border: `1px solid rgba(245,166,35,.35)` }}>
                      <Check size={9} color={gold} strokeWidth={3} />
                    </span>
                    <span className="text-[12px] font-medium" style={{ color: sub }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => window.startFreeTrial?.()}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-[#111] cursor-pointer relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#F5A623 0%,#FFCF6B 55%,#E8940A 100%)', boxShadow: '0 6px 24px rgba(245,166,35,.45)', transition: 'transform .25s, box-shadow .25s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 38px rgba(245,166,35,.58)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(245,166,35,.45)' }}>
              Start Free Trial →
            </button>
          </div>

        </div>
      </div>
    </section>
  )
}