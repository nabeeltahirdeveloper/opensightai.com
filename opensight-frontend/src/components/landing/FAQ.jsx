import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const QUESTIONS = ['accuracy', 'purchase', 'formats', 'refunds', 'credits']

/* ─────────────────────────────────────────────────────────── */
/*  CSS                                                         */
/* ─────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .fq-root * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }

  @keyframes fq-fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fq-gradShift {
    0%,100% { background-position: 0% 50%; }
    50%     { background-position: 100% 50%; }
  }
  @keyframes fq-pulse {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245,166,35,.5); }
    50%     { opacity: .6; box-shadow: 0 0 0 6px rgba(245,166,35,0); }
  }
  @keyframes fq-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes fq-rotatePlus {
    from { transform: rotate(0deg); }
    to   { transform: rotate(135deg); }
  }
  @keyframes fq-rotateBack {
    from { transform: rotate(135deg); }
    to   { transform: rotate(0deg); }
  }

  .fq-in  { animation: fq-fadeUp .6s cubic-bezier(.22,1,.36,1) both; }

  /* ── Accordion item ── */
  .fq-item {
    border-radius: 18px;
    transition:
      border-color .45s cubic-bezier(.22,1,.36,1),
      box-shadow   .45s cubic-bezier(.22,1,.36,1),
      background   .45s cubic-bezier(.22,1,.36,1),
      transform    .35s cubic-bezier(.22,1,.36,1);
    position: relative;
    overflow: hidden;
  }
  .fq-item:hover {
    transform: translateX(3px);
  }
  .fq-item.fq-open {
    transform: translateX(0px) !important;
  }

  /* Left accent bar */
  .fq-item::before {
    content: '';
    position: absolute;
    left: 0; top: 16px; bottom: 16px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    transition: background .45s cubic-bezier(.22,1,.36,1), opacity .45s;
    opacity: 0;
  }
  .fq-item.fq-open::before {
    opacity: 1;
    background: linear-gradient(180deg, #F5A623, #FFCF6B);
  }

  /* Shimmer on hover */
  .fq-shimmer {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: 18px;
  }
  .fq-shimmer::after {
    content: '';
    position: absolute; top: 0; bottom: 0; left: 0; width: 40%;
    background: linear-gradient(90deg, transparent, rgba(245,166,35,.04), transparent);
    transform: translateX(-100%);
    transition: none;
  }
  .fq-item:hover .fq-shimmer::after {
    animation: fq-shimmer .65s ease forwards;
  }

  /* ── Trigger button ── */
  .fq-trigger {
    width: 100%; background: transparent; border: none; cursor: pointer;
    display: flex; align-items: center; gap: 16px;
    padding: 20px 22px 20px 22px; text-align: left;
  }

  /* ── Number badge ── */
  .fq-num {
    width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800;
    transition:
      background .4s cubic-bezier(.22,1,.36,1),
      color      .4s cubic-bezier(.22,1,.36,1),
      box-shadow .4s cubic-bezier(.22,1,.36,1),
      transform  .4s cubic-bezier(.22,1,.36,1);
  }

  /* ── Plus icon ── */
  .fq-plus {
    width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 300; line-height: 1;
    transition:
      background .4s cubic-bezier(.22,1,.36,1),
      color      .4s cubic-bezier(.22,1,.36,1),
      box-shadow .4s cubic-bezier(.22,1,.36,1);
  }
  .fq-plus-icon {
    display: inline-block;
    transition: transform .5s cubic-bezier(.34,1.56,.64,1);
  }
  .fq-plus-icon.open  { transform: rotate(135deg); }
  .fq-plus-icon.shut  { transform: rotate(0deg); }

  /* ── Answer panel ── */
  .fq-body {
    overflow: hidden;
    transition: height .55s cubic-bezier(.22,1,.36,1);
    will-change: height;
  }
  .fq-body-inner {
    padding: 0 22px 22px 68px;
  }

  /* ── CTA strip ── */
  .fq-cta {
    border-radius: 20px;
    transition: border-color .4s, box-shadow .4s, background .4s;
  }
  .fq-cta:hover {
    border-color: rgba(245,166,35,.4) !important;
    box-shadow: 0 8px 32px rgba(245,166,35,.12);
  }

  /* ── CTA button ── */
  .fq-btn {
    padding: 11px 26px; border-radius: 50px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; letter-spacing: .01em;
    display: inline-flex; align-items: center; gap: 7px;
    transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s cubic-bezier(.22,1,.36,1);
    background: linear-gradient(135deg,#F5A623,#FFCF6B);
    color: #1A180F;
    box-shadow: 0 2px 12px rgba(245,166,35,.35);
  }
  .fq-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 26px rgba(245,166,35,.55);
  }
  .fq-btn:active { transform: translateY(0); }
`

/* ─────────────────────────────────────────────────────────── */
/*  AccordionItem                                               */
/* ─────────────────────────────────────────────────────────── */
function AccordionItem({ questionKey, index, isOpen, onToggle, dark }) {
  const { t } = useTranslation('landing')
  const bodyRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (bodyRef.current) setHeight(bodyRef.current.scrollHeight)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !bodyRef.current) return
    const ro = new ResizeObserver(() => {
      if (bodyRef.current) setHeight(bodyRef.current.scrollHeight)
    })
    ro.observe(bodyRef.current)
    return () => ro.disconnect()
  }, [isOpen])

  const ink    = dark ? '#F2EDD8' : '#1A180F'
  const muted  = dark ? '#8A8272' : '#7A7468'
  const cardBg = dark ? '#141208' : '#FFFFFF'
  const bdrColor = isOpen
    ? 'rgba(245,166,35,.42)'
    : dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'
  const bgColor = isOpen
    ? (dark ? 'rgba(245,166,35,.04)' : 'rgba(245,166,35,.025)')
    : cardBg
  const boxShadow = isOpen
    ? '0 8px 32px rgba(245,166,35,.12), 0 2px 8px rgba(0,0,0,.06)'
    : dark ? '0 1px 4px rgba(0,0,0,.3)' : '0 1px 4px rgba(0,0,0,.05)'

  return (
    <div
      className={`fq-item${isOpen ? ' fq-open' : ''}`}
      style={{
        background: bgColor,
        border: `1.5px solid ${bdrColor}`,
        boxShadow,
      }}
    >
      {/* Shimmer layer */}
      <div className="fq-shimmer" />

      {/* Trigger */}
      <button className="fq-trigger" onClick={onToggle}>
        {/* Number badge */}
        <span
          className="fq-num"
          style={{
            background: isOpen ? 'linear-gradient(135deg,#F5A623,#FFCF6B)' : 'rgba(245,166,35,.1)',
            color: isOpen ? '#1A180F' : '#F5A623',
            border: `1.5px solid ${isOpen ? 'rgba(245,166,35,.5)' : 'rgba(245,166,35,.2)'}`,
            boxShadow: isOpen ? '0 3px 10px rgba(245,166,35,.3)' : 'none',
            transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Question text */}
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: ink, lineHeight: 1.45, letterSpacing: '-.01em' }}>
          {t(`faq.questions.${questionKey}.question`)}
        </span>

        {/* Plus/minus icon */}
        <span
          className="fq-plus"
          style={{
            background: isOpen ? 'linear-gradient(135deg,#F5A623,#FFCF6B)' : 'rgba(245,166,35,.08)',
            color: isOpen ? '#1A180F' : '#F5A623',
            border: `1.5px solid ${isOpen ? 'rgba(245,166,35,.5)' : 'rgba(245,166,35,.15)'}`,
            boxShadow: isOpen ? '0 3px 10px rgba(245,166,35,.25)' : 'none',
          }}
        >
          <span className={`fq-plus-icon ${isOpen ? 'open' : 'shut'}`}>+</span>
        </span>
      </button>

      {/* Answer — real height animation */}
      <div className="fq-body" style={{ height: isOpen ? height : 0 }}>
        <div ref={bodyRef} className="fq-body-inner">
          {/* Thin separator */}
          <div style={{ height: 1, background: dark ? 'rgba(245,166,35,.12)' : 'rgba(245,166,35,.15)', marginBottom: 16, borderRadius: 1 }} />
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: muted, margin: 0 }}>
            {t(`faq.questions.${questionKey}.answer`)}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  Main FAQ                                                    */
/* ─────────────────────────────────────────────────────────── */
export default function FAQ() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const surface = dark ? '#0E0D08' : '#FEFCF3'
  const ink     = dark ? '#F2EDD8' : '#1A180F'
  const muted   = dark ? '#8A8272' : '#7A7468'

  return (
    <>
      <style>{CSS}</style>
      <section id="faq" className="fq-root" style={{
        background: surface, padding: '100px 0 96px',
        position: 'relative', overflow: 'hidden', transition: 'background .3s',
      }}>
        {/* Background radial glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 600, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse,rgba(245,166,35,.055),transparent 65%)',
        }} />

        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>

          {/* ── Header ── */}
          <div className="fq-in" style={{ animationDelay: '0ms', textAlign: 'center', marginBottom: 64 }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px',
              borderRadius: 50, marginBottom: 22,
              background: 'rgba(245,166,35,.1)', border: '1.5px solid rgba(245,166,35,.22)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#F5A623',
                animation: 'fq-pulse 2s ease-in-out infinite', display: 'inline-block',
              }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#F5A623', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                FAQ
              </span>
            </div>

            <h2 style={{ fontSize: 'clamp(32px,5vw,54px)', fontWeight: 900, color: ink, margin: '0 0 18px', letterSpacing: '-.04em', lineHeight: 1.08 }}>
              {t('faq.title').replace(t('faq.titleHighlight'), '').replace('Questions', '').trim()}{' '}
              <span style={{ background: 'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'fq-gradShift 3s ease infinite' }}>
                {t('faq.titleHighlight')}
              </span>
            </h2>

            <p style={{ fontSize: 'clamp(14px,1.8vw,17px)', color: muted, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              {t('faq.subtitle')}
            </p>
          </div>

          {/* ── Accordion ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {QUESTIONS.map((key, i) => (
              <div
                key={key}
                className="fq-in"
                style={{ animationDelay: `${80 + i * 55}ms` }}
              >
                <AccordionItem
                  questionKey={key}
                  index={i}
                  isOpen={open === i}
                  onToggle={() => setOpen(open === i ? null : i)}
                  dark={dark}
                />
              </div>
            ))}
          </div>

          {/* ── CTA strip ── */}
          <div
            className="fq-in fq-cta"
            style={{
              animationDelay: '400ms',
              marginTop: 36,
              padding: '26px 28px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: dark ? 'rgba(245,166,35,.05)' : 'rgba(245,166,35,.05)',
              border: '1.5px solid rgba(245,166,35,.18)',
            }}
          >
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: ink, margin: '0 0 4px', letterSpacing: '-.01em' }}>
                Still have questions?
              </p>
              <p style={{ fontSize: 13.5, color: muted, margin: 0, lineHeight: 1.5 }}>
                Our support team is available Mon–Fri, 9am to 6pm GMT.
              </p>
            </div>
            <button
              className="fq-btn"
              onClick={() => navigate('/support-team')}
            >
              Contact Support →
            </button>
          </div>

        </div>
      </section>
    </>
  )
}