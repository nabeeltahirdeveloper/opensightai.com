import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/* ─── Font import (one-time, lightweight) ─── */
const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Inter', system-ui, sans-serif; }

    /* Gold progress bar animation */
    .prog-fill { transition: width 1.4s cubic-bezier(.34,1.2,.64,1); }

    /* Shine sweep on gold button */
    .btn-shine { position:relative; overflow:hidden; }
    .btn-shine::before {
      content:''; position:absolute;
      top:0; left:-115%; width:55%; height:100%;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);
      transition:left .5s;
    }
    .btn-shine:hover::before { left:165%; }

    /* Badge dot pulse */
    @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
    .badge-dot { animation:pulse-dot 2s infinite; }

    /* Card shine top border */
    .card-top::before {
      content:''; position:absolute; top:0; left:0; right:0; height:1px;
      background:linear-gradient(90deg,transparent,rgba(245,166,35,.5),transparent);
    }

    /* Scrollbar for modal */
    .modal-scroll::-webkit-scrollbar { width:6px; }
    .modal-scroll::-webkit-scrollbar-track { background:transparent; }
    .modal-scroll::-webkit-scrollbar-thumb { background:rgba(245,166,35,.35); border-radius:10px; }
  `}</style>
)

/* ─── Static data ─── */
const ITEMS = [
  { icon: '◎', titleKey: 'about.mission.title', descKey: 'about.mission.description' },
  { icon: '👁',  titleKey: 'about.vision.title',  descKey: 'about.vision.description' },
  { icon: '♡',  titleKey: 'about.values.title',  descKey: 'about.values.description' },
]

const TECH = [
  { labelKey: 'about.technology.aiAccuracy',       pct: 98.5 },
  { labelKey: 'about.technology.processingSpeed',  pct: 95   },
  { labelKey: 'about.technology.userSatisfaction', pct: 99.2 },
]

const STATS = [
  { val: '50K+', lbl: 'Analyses'  },
  { val: '15K+', lbl: 'Users'     },
  { val: '24',   lbl: 'Countries' },
]

const FEATURES = [
  { icon: '⚡', title: 'Real-time insights',        desc: 'Fast analysis with instant highlights and levels' },
  { icon: '🧠', title: 'Deep pattern recognition',  desc: 'Identifies classical and advanced patterns'       },
  { icon: '📈', title: 'Indicator suite',            desc: '50+ technical indicators auto-computed'           },
  { icon: '🎓', title: 'AI Teacher',                 desc: 'Explains results with educational guidance'       },
]

const INDICATORS = [
  { cat: 'Momentum',      items: 'RSI, Stochastic, MACD, CCI'          },
  { cat: 'Volatility',    items: 'Bollinger Bands, ATR, Keltner'        },
  { cat: 'Trend',         items: 'MAs, EMA crossovers, Supertrend'      },
  { cat: 'Chart Patterns',items: 'H&S, triangles, flags, channels'      },
  { cat: 'Levels',        items: 'Support/resistance, Fib zones'        },
  { cat: 'Evaluation',    items: 'Automated analysis evaluation ratios' },
]

const BENCH = [
  { val: '98.5%', desc: 'Pattern recognition precision (benchmarked)' },
  { val: '< 2s',  desc: 'Median analysis time per chart'              },
  { val: '50+',   desc: 'Indicators analyzed automatically'           },
]

/* ─── Helper: detect dark mode ─── */
function useDark() {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.dataset.theme === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/* ══════════════════════════════════════════
   LEARN MORE MODAL
══════════════════════════════════════════ */
function LearnMoreModal({ onClose }) {
  const dark = useDark()

  // Close on Escape
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bg        = dark ? 'bg-[#0D0C09]'           : 'bg-[#FEFCF3]'
  const text       = dark ? 'text-[#F9F5E8]'         : 'text-gray-900'
  const muted      = dark ? 'text-gray-400'           : 'text-gray-500'
  const cardBg     = dark ? 'bg-[rgba(22,20,12,.9)]' : 'bg-[rgba(255,253,245,.88)]'
  const cardBorder = 'border border-[rgba(245,166,35,.22)]'
  const indBg      = dark ? 'bg-[rgba(245,166,35,.08)]' : 'bg-amber-50'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-20 pb-4 sm:pt-4"
      style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden
          modal-scroll overflow-y-auto shadow-2xl ${bg} ${text} ${cardBorder} card-top`}
      >
        {/* Mesh bg */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: dark
              ? 'radial-gradient(ellipse 600px 350px at -5% 70%,rgba(245,166,35,.15) 0%,transparent 65%),radial-gradient(ellipse 400px 300px at 105% 5%,rgba(245,166,35,.1) 0%,transparent 65%)'
              : 'radial-gradient(ellipse 600px 350px at -5% 70%,rgba(245,166,35,.09) 0%,transparent 65%),radial-gradient(ellipse 400px 300px at 105% 5%,rgba(245,166,35,.06) 0%,transparent 65%)',
          }}
        />

        <div className="relative z-10 p-5 sm:p-6 md:p-10">
          {/* Close button — always top-right with safe spacing */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 z-20 shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg
              transition-all duration-200 hover:scale-110 hover:bg-[rgba(245,166,35,.15)]
              ${muted} hover:text-amber-400 border ${cardBorder}`}
          >
            ✕
          </button>

          {/* Header */}
          <div className="mb-8 pr-14">
            <div>
              <div className="inline-flex items-center gap-2 bg-[rgba(245,166,35,.1)] border border-[rgba(245,166,35,.28)] text-amber-400 rounded-full px-4 py-1 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 badge-dot" />
                About OpenSightAI
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
                Learn More About{' '}
                <span className={dark ? 'text-amber-300' : 'text-amber-500'}>OpenSightAI</span>
              </h1>
            </div>
          </div>

          {/* What is section */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div>
              <h2 className="text-xl font-bold mb-3">What is OpenSightAI?</h2>
              <p className={`text-sm leading-relaxed mb-5 ${muted}`}>
                OpenSightAI is an AI-powered market intelligence platform that analyzes chart images
                to deliver precise, actionable insights. It combines computer vision with financial
                signal processing to recognize patterns, compute indicators, and recommend
                evidence-based scenarios.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className={`${cardBg} ${cardBorder} card-top relative rounded-xl p-4
                      transition-all duration-300 hover:-translate-y-1
                      hover:shadow-[0_12px_32px_rgba(245,166,35,.12)]`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{f.icon}</span>
                      <span className="text-sm font-semibold">{f.title}</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${muted}`}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture */}
            <div
              className={`${cardBg} ${cardBorder} card-top relative rounded-2xl p-6
                transition-all duration-300 hover:-translate-y-1
                hover:shadow-[0_16px_48px_rgba(245,166,35,.13)]`}
            >
              <h3 className="text-lg font-bold mb-4">High-level Architecture</h3>
              <ul className={`space-y-3 text-sm ${muted}`}>
                {[
                  'Vision encoder extracts chart structures (axes, candles, overlays)',
                  'Feature fusion combines vision signals with derived indicators',
                  'Pattern engine scores trendlines, channels, breakouts, and formations',
                  'Scenario module proposes levels and analysis evaluation ratios',
                  'Explanation layer turns raw signals into human-readable insights',
                ].map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)' }}
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Indicators grid */}
          <div
            className={`${cardBg} ${cardBorder} card-top relative rounded-2xl p-6 mb-8`}
          >
            <h2 className="text-lg font-bold mb-4">Supported Indicators and Patterns</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {INDICATORS.map((ind, i) => (
                <div key={i} className={`${indBg} border border-[rgba(245,166,35,.15)] rounded-xl p-4`}>
                  <h4 className="text-sm font-semibold mb-1">{ind.cat}</h4>
                  <p className={`text-xs ${muted}`}>{ind.items}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benchmark stats */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {BENCH.map((b, i) => (
              <div
                key={i}
                className={`${cardBg} ${cardBorder} card-top relative rounded-2xl p-5 text-center
                  transition-all duration-300 hover:-translate-y-1
                  hover:shadow-[0_12px_32px_rgba(245,166,35,.12)]`}
              >
                <div className={`text-3xl font-extrabold mb-1 ${dark ? 'text-amber-300' : 'text-amber-500'}`}>
                  {b.val}
                </div>
                <p className={`text-xs leading-relaxed ${muted}`}>{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy */}
          <div
            className={`${cardBg} ${cardBorder} card-top relative rounded-2xl p-6 mb-8`}
          >
            <h2 className="text-lg font-bold mb-3">Privacy & Security</h2>
            <ul className={`space-y-2 text-sm ${muted}`}>
              {[
                'Charts processed securely; no resale of uploaded data',
                'Role-based access for team accounts',
                'GDPR-conscious data handling',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)' }}
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={() => { onClose(); window.startFreeTrial?.() }}
              className="btn-shine px-10 py-3.5 text-sm font-bold rounded-full text-gray-900
                cursor-pointer transition-all duration-300 hover:-translate-y-1
                hover:shadow-[0_12px_36px_rgba(245,166,35,.55)]
                active:translate-y-0"
              style={{
                background: 'linear-gradient(135deg,#F5A623 0%,#FFCF6B 50%,#E8940A 100%)',
                boxShadow: '0 5px 22px rgba(245,166,35,.4),inset 0 1px 0 rgba(255,255,255,.3)',
              }}
            >
               &nbsp;Start Free Trial
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN ABOUT SECTION
══════════════════════════════════════════ */
export default function About() {
  const { t }          = useTranslation('landing')
  const dark           = useDark()
  const [modal, setModal] = useState(false)
  const progRef        = useRef(null)
  const [animated, setAnimated] = useState(false)

  /* Animate progress bars on scroll into view */
  useEffect(() => {
    if (!progRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true) },
      { threshold: 0.3 }
    )
    obs.observe(progRef.current)
    return () => obs.disconnect()
  }, [])

  /* Expose learnMore globally (backward compat) */
  useEffect(() => {
    window.learnMore = () => setModal(true)
  }, [])

  const surface = dark ? 'bg-[#0D0C09] text-[#F9F5E8]' : 'bg-[#FEFCF3] text-gray-900'
  const muted   = dark ? 'text-gray-400'                : 'text-gray-500'
  const cardBg  = dark ? 'bg-[rgba(22,20,12,.9)]'       : 'bg-[rgba(255,253,245,.88)]'
  const gold    = dark ? 'text-amber-300'                : 'text-amber-500'

  return (
    <>
      <FontImport />

      {modal && <LearnMoreModal onClose={() => setModal(false)} />}

      <section id="about" className={`${surface} relative overflow-hidden py-16 md:py-24 px-4 md:px-6`}>

        {/* Mesh background */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: dark
              ? 'radial-gradient(ellipse 600px 400px at -5% 60%,rgba(245,166,35,.17) 0%,transparent 65%),radial-gradient(ellipse 400px 300px at 105% 10%,rgba(245,166,35,.13) 0%,transparent 65%)'
              : 'radial-gradient(ellipse 600px 400px at -5% 60%,rgba(245,166,35,.1) 0%,transparent 65%),radial-gradient(ellipse 400px 300px at 105% 10%,rgba(245,166,35,.08) 0%,transparent 65%)',
          }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

            {/* ── LEFT COLUMN ── */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-[rgba(245,166,35,.1)] border border-[rgba(245,166,35,.28)] text-amber-400 rounded-full px-4 py-1.5 text-xs font-semibold mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 badge-dot" />
                About Us
              </div>

              {/* Heading */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
                {t('about.title').replace(t('about.titleHighlight'), '').trim()}{' '}
                <span className={gold}>{t('about.titleHighlight')}</span>
              </h2>

              <p className={`text-sm sm:text-base leading-relaxed mb-8 ${muted}`}>
                {t('about.description')}
              </p>

              {/* Mission / Vision / Values */}
              <div className="flex flex-col gap-5 mb-9">
                {ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5
                        transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg,#F5A623,#FFCF6B)',
                        boxShadow: '0 4px 14px rgba(245,166,35,.4)',
                        fontSize: 16,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base mb-1">
                        {t(item.titleKey)}
                      </h3>
                      <p className={`text-xs sm:text-sm leading-relaxed ${muted}`}>
                        {t(item.descKey)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                onClick={() => setModal(true)}
                className="btn-shine px-7 py-3 text-sm font-bold rounded-full text-gray-900
                  cursor-pointer transition-all duration-300 hover:-translate-y-0.5
                  hover:shadow-[0_10px_34px_rgba(245,166,35,.6)] active:translate-y-0"
                style={{
                  background: 'linear-gradient(135deg,#F5A623 0%,#FFCF6B 50%,#E8940A 100%)',
                  boxShadow: '0 5px 22px rgba(245,166,35,.42),inset 0 1px 0 rgba(255,255,255,.3)',
                }}
              >
                {t('about.learnMore')} →
              </button>
            </div>

            {/* ── RIGHT COLUMN — Technology Card ── */}
            <div
              ref={progRef}
              className={`${cardBg} card-top relative border border-[rgba(245,166,35,.2)]
                rounded-2xl p-6 sm:p-8 backdrop-blur-sm
                transition-all duration-300 hover:-translate-y-1
                hover:shadow-[0_20px_52px_rgba(245,166,35,.14)]
                hover:border-[rgba(245,166,35,.38)]`}
            >
              <h3 className="text-lg sm:text-xl font-bold mb-6">
                {t('about.technology.title')}
              </h3>

              {/* Progress bars */}
              <div className="flex flex-col gap-5 mb-8">
                {TECH.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs sm:text-sm font-semibold">
                        {t(item.labelKey)}
                      </span>
                      <span className={`text-xs sm:text-sm font-bold ${gold}`}>
                        {item.pct}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(245,166,35,.12)' }}
                    >
                      <div
                        className="prog-fill h-full rounded-full"
                        style={{
                          width: animated ? `${item.pct}%` : '0%',
                          background: 'linear-gradient(90deg,#F5A623,#FFCF6B)',
                          boxShadow: '0 0 8px rgba(245,166,35,.38)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Award strip */}
              <div
                className="rounded-xl py-3.5 px-5 text-sm font-semibold text-center mb-6"
                style={{
                  background: 'rgba(245,166,35,.08)',
                  border: '1px solid rgba(245,166,35,.2)',
                }}
              >
                🏆 &nbsp;{t('about.technology.award')}
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3">
                {STATS.map((s, i) => (
                  <div
                    key={i}
                    className="text-center py-3 px-2 rounded-xl cursor-default
                      transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'rgba(245,166,35,.07)',
                      border: '1px solid rgba(245,166,35,.15)',
                    }}
                  >
                    <div className={`text-base sm:text-lg font-extrabold leading-tight ${gold}`}>
                      {s.val}
                    </div>
                    <div className={`text-xs mt-0.5 ${muted}`}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  )
}