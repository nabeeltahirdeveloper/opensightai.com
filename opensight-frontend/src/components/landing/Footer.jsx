import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const LEGAL_LINKS = [
  { key: 'footer.termsAndConditions', en: '/terms.html',         tr: '/terms-tr.html' },
  { key: 'footer.privacyPolicy',      en: '/privacy.html',        tr: '/privacy-tr.html' },
  { key: 'footer.cookiePolicy',       en: '/cookie-policy.html',  tr: '/cookie-policy-tr.html' },
  { key: 'footer.refundPolicy',       en: '/refund-policy.html',  tr: '/refund-policy-tr.html' },
  { key: 'footer.acceptableUse',      en: '/acceptable-use.html', tr: '/acceptable-use-tr.html' },
]

const NAV_COLS = [
  {
    title: 'Platform',
    links: [
      { label: 'Home',         href: '#home' },
      { label: 'Features',     href: '#features' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Pricing',      href: '#pricing' },
      { label: 'FAQ',          href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us',      href: '#about' },
      { label: 'Testimonials',  href: '#testimonials' },
      { label: 'Contact',       href: '#contact' },
      { label: 'Support',       href: '/support-team' },
      { label: 'Privacy Policy',href: '/privacy.html', ext: true },
    ],
  },
]

const TRUST = [
  { icon: '🔒', label: 'SSL Secured' },
  { icon: '🛡', label: 'GDPR Compliant' },
  { icon: '✓',  label: '98% Accuracy' },
  { icon: '◷',  label: '24/7 Support' },
]

const STATS = [
  { val: '50K+', label: 'Analyses Done',  icon: '◈' },
  { val: '15K+', label: 'Active Users',    icon: '◉' },
  { val: '24',   label: 'Countries',       icon: '◆' },
  { val: '98%',  label: 'Accuracy Rate',   icon: '◇' },
]

const SOCIALS = [
  { label: 'Twitter', icon: '𝕏', href: '#' },
  { label: 'LinkedIn', icon: 'in', href: '#' },
  { label: 'GitHub', icon: '⌥', href: '#' },
]

// ── Animated counter hook ──
function useCounter(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    const num = parseFloat(target.replace(/[^0-9.]/g, ''))
    const suffix = target.replace(/[0-9.]/g, '')
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * num) + suffix)
      if (progress < 1) requestAnimationFrame(step)
      else setCount(target)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count || '0'
}

function StatCard({ val, label, icon, animate }) {
  const count = useCounter(val, 1600, animate)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        textAlign: 'center', padding: '20px 12px', borderRadius: 18,
        background: hov ? 'var(--ft-card-h)' : 'var(--ft-card)',
        border: `1px solid ${hov ? 'var(--ft-border-h)' : 'var(--ft-border)'}`,
        cursor: 'default', transition: 'all 0.35s cubic-bezier(.34,1.4,.64,1)',
        transform: hov ? 'translateY(-5px) scale(1.03)' : 'translateY(0) scale(1)',
        boxShadow: hov ? '0 16px 48px rgba(245,166,35,.15)' : '0 2px 12px rgba(0,0,0,.04)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Shimmer on hover */}
      <div style={{
        position: 'absolute', top: 0, left: hov ? '110%' : '-60%', width: '50%', height: '100%',
        background: 'linear-gradient(90deg,transparent,rgba(245,166,35,.1),transparent)',
        transition: 'left 0.6s ease', pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 18, marginBottom: 6, color: '#F5A623', opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#F5A623', letterSpacing: '-0.04em', fontFamily: 'inherit', lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 11, marginTop: 5, color: 'var(--ft-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

export default function Footer() {
  const { t, i18n } = useTranslation(['landing', 'common'])
  const isTurkish = i18n.language === 'tr'
  const [emailVal, setEmailVal] = useState('')
  const [subFocused, setSubFocused] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [visible, setVisible] = useState(false)
  const footerRef = useRef(null)

  // Intersection Observer for counter animation trigger
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (footerRef.current) obs.observe(footerRef.current)
    return () => obs.disconnect()
  }, [])

  const handleSubscribe = () => {
    if (!emailVal.trim()) return
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setEmailVal('')
  }

  return (
    <>
      <style>{`
        /* ── CSS Variables ── */
        .ft-root {
          --ft-bg:       #FAFAF7;
          --ft-bg2:      #F3F1EB;
          --ft-card:     rgba(245,166,35,.06);
          --ft-card-h:   rgba(245,166,35,.13);
          --ft-border:   rgba(245,166,35,.16);
          --ft-border-h: rgba(245,166,35,.42);
          --ft-txt:      #1A1710;
          --ft-muted:    rgba(26,23,16,.55);
          --ft-muted2:   rgba(26,23,16,.35);
          --ft-divider:  rgba(245,166,35,.13);
          --ft-ink:      #1A1710;
        }
        [data-theme="dark"] .ft-root {
          --ft-bg:       #0C0B07;
          --ft-bg2:      #111009;
          --ft-card:     rgba(255,255,255,.04);
          --ft-card-h:   rgba(245,166,35,.11);
          --ft-border:   rgba(245,166,35,.12);
          --ft-border-h: rgba(245,166,35,.35);
          --ft-txt:      rgba(240,234,214,.9);
          --ft-muted:    rgba(240,234,214,.5);
          --ft-muted2:   rgba(240,234,214,.28);
          --ft-divider:  rgba(245,166,35,.1);
          --ft-ink:      rgba(240,234,214,.9);
        }
        .ft-root * { box-sizing: border-box; }

        /* ── Nav link ── */
        .ft-nav-link {
          font-size: 13.5px; color: var(--ft-muted);
          text-decoration: none; display: flex; align-items: center; gap: 0;
          transition: color .22s, gap .22s; width: fit-content;
        }
        .ft-nav-link:hover { color: #F5A623; gap: 6px; }
        .ft-nav-link::before {
          content: ''; width: 0; height: 1.5px; background: #F5A623;
          border-radius: 2px; transition: width .22s ease; margin-right: 0;
          display: inline-block; flex-shrink: 0;
        }
        .ft-nav-link:hover::before { width: 10px; margin-right: 6px; }

        /* ── Legal link ── */
        .ft-legal-link {
          font-size: 11.5px; color: var(--ft-muted2); text-decoration: none;
          transition: color .2s; position: relative; padding-bottom: 1px;
        }
        .ft-legal-link::after {
          content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1px;
          background: #F5A623; transition: width .22s ease;
        }
        .ft-legal-link:hover { color: #F5A623; }
        .ft-legal-link:hover::after { width: 100%; }

        /* ── Contact link ── */
        .ft-contact-link {
          font-size: 13px; color: var(--ft-muted); text-decoration: none;
          transition: color .2s;
        }
        .ft-contact-link:hover { color: #F5A623; }

        /* ── Trust badge ── */
        .ft-trust-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 8px; font-size: 11px; font-weight: 600;
          background: var(--ft-card); border: 1px solid var(--ft-border);
          color: var(--ft-muted); cursor: default;
          transition: background .22s, color .22s, border-color .22s, transform .22s;
        }
        .ft-trust-badge:hover {
          background: var(--ft-card-h); color: #F5A623;
          border-color: var(--ft-border-h); transform: translateY(-2px);
        }

        /* ── Input ── */
        .ft-sub-input {
          flex: 1; min-width: 0; padding: 11px 15px; border-radius: 12px;
          font-size: 13.5px; font-family: inherit;
          background: var(--ft-card); color: var(--ft-ink); outline: none;
          transition: border-color .22s, box-shadow .22s;
        }
        .ft-sub-input::placeholder { color: var(--ft-muted2); }

        /* ── Subscribe button ── */
        .ft-sub-btn {
          position: relative; overflow: hidden; padding: 11px 20px;
          border-radius: 12px; border: none; cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg,#F5A623,#FFCF6B);
          color: #1A1710; font-weight: 800; font-size: 13px; white-space: nowrap;
          box-shadow: 0 4px 18px rgba(245,166,35,.4);
          transition: transform .25s, box-shadow .25s;
        }
        .ft-sub-btn::before {
          content: ''; position: absolute; top: 0; left: -120%; width: 60%; height: 100%;
          background: linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);
          transition: left .5s;
        }
        .ft-sub-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(245,166,35,.55); }
        .ft-sub-btn:hover::before { left: 160%; }

        /* ── Social button ── */
        .ft-social-btn {
          width: 38px; height: 38px; border-radius: 11px; border: 1px solid var(--ft-border);
          background: var(--ft-card); display: flex; align-items: center; justify-content: center;
          color: var(--ft-muted); font-size: 13px; font-weight: 700; cursor: pointer;
          text-decoration: none; transition: all .25s cubic-bezier(.34,1.4,.64,1);
        }
        .ft-social-btn:hover {
          background: #F5A623; color: #1A1710; border-color: #F5A623;
          transform: translateY(-3px) scale(1.08);
          box-shadow: 0 8px 24px rgba(245,166,35,.4);
        }

        /* ── Glow pulse on brand icon ── */
        @keyframes ft-pulse {
          0%,100% { box-shadow: 0 4px 14px rgba(245,166,35,.45); }
          50%      { box-shadow: 0 4px 28px rgba(245,166,35,.75); }
        }
        @keyframes ft-fade-up {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes ft-shimmer {
          from { left: -60%; }
          to   { left: 110%; }
        }
        @keyframes ft-blink {
          0%,100% { opacity:1; } 50% { opacity:.3; }
        }
      `}</style>

      <footer
        ref={footerRef}
        className="ft-root"
        style={{
          background: 'var(--ft-bg)',
          color: 'var(--ft-txt)',
          fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Ambient background decoration ── */}
        <div style={{
          position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 400, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(245,166,35,.07) 0%, transparent 68%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80, width: 340, height: 340,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(245,166,35,.05) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: -60, width: 260, height: 260,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(245,166,35,.04) 0%, transparent 70%)',
        }} />

        {/* ── TOP GLOW LINE ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, #F5A623 40%, #FFCF6B 60%, transparent)',
          opacity: 0.6,
        }} />

        {/* ── STATS BAR ── */}
        <div style={{ borderBottom: '1px solid var(--ft-divider)' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {STATS.map((s, i) => (
                <StatCard key={i} val={s.val} label={s.label} icon={s.icon} animate={visible} />
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '64px 28px 48px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.5fr', gap: 48 }}>

            {/* ── BRAND COL ── */}
            <div>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg,#F5A623,#FFCF6B)',
                  boxShadow: '0 4px 14px rgba(245,166,35,.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'ft-pulse 3s ease-in-out infinite',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5-2.1 2.1M7.6 16.4l-2.1 2.1m0-12.5 2.1 2.1m8.8 8.8 2.1 2.1"/>
                  </svg>
                </div>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--ft-ink)' }}>
                  OpenSight<span style={{ color: '#F5A623' }}>AI</span>
                </span>
              </div>

              <p style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--ft-muted)', maxWidth: 230, marginBottom: 24 }}>
                {t('footer.description', { ns: 'landing', defaultValue: 'Cutting-edge AI intelligence platform powering 50K+ analyses across 24 nations with 98% accuracy.' })}
              </p>

              {/* Trust badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 28 }}>
                {TRUST.map((b, i) => (
                  <span key={i} className="ft-trust-badge">{b.icon} {b.label}</span>
                ))}
              </div>

              {/* Socials */}
              <div style={{ display: 'flex', gap: 9 }}>
                {SOCIALS.map((s, i) => (
                  <a key={i} href={s.href} className="ft-social-btn" title={s.label}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* ── NAV COLS ── */}
            {NAV_COLS.map((col, ci) => (
              <div key={ci}>
                <h5 style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#F5A623', marginBottom: 22,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 16, height: 1.5, background: '#F5A623', display: 'inline-block', borderRadius: 2, opacity: 0.6 }} />
                  {col.title}
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {col.links.map((link, li) => (
                    <a
                      key={li} href={link.href}
                      className="ft-nav-link"
                      {...(link.ext ? { target: '_blank', rel: 'noopener' } : {})}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}

            {/* ── NEWSLETTER + CONTACT ── */}
            <div>
              <h5 style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#F5A623', marginBottom: 22,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 16, height: 1.5, background: '#F5A623', display: 'inline-block', borderRadius: 2, opacity: 0.6 }} />
                Stay Updated
              </h5>

              {/* Newsletter card */}
              <div style={{
                background: 'var(--ft-card)', border: '1px solid var(--ft-border)',
                borderRadius: 18, padding: '18px', marginBottom: 24,
                transition: 'border-color .3s, box-shadow .3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,166,35,.32)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(245,166,35,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ft-border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <p style={{ fontSize: 12.5, color: 'var(--ft-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  {t('footer.subscribeNewsletter', { ns: 'landing', defaultValue: 'Get the latest AI insights and platform updates.' })}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="email"
                    value={emailVal}
                    onChange={e => setEmailVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                    onFocus={() => setSubFocused(true)}
                    onBlur={() => setSubFocused(false)}
                    placeholder={t('enterYourEmail', { ns: 'common', defaultValue: 'Your email…' })}
                    className="ft-sub-input"
                    style={{
                      border: `1.5px solid ${subFocused ? '#F5A623' : 'var(--ft-border)'}`,
                      boxShadow: subFocused ? '0 0 0 3px rgba(245,166,35,.12)' : 'none',
                    }}
                  />
                  <button className="ft-sub-btn" onClick={handleSubscribe}>
                    {submitted ? '✓' : t('subscribe', { ns: 'common', defaultValue: 'Join' })}
                  </button>
                </div>
                {submitted && (
                  <div style={{
                    marginTop: 10, fontSize: 11.5, color: '#22C55E', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5,
                    animation: 'ft-fade-up .3s ease',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E', display: 'inline-block' }} />
                    You're subscribed!
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  { icon: '✉', val: 'support@OpenSightai.com', href: 'mailto:support@OpenSightai.com' },
                  { icon: '☏', val: '+44-7537-106208',           href: 'tel:+447537106208' },
                  { icon: '◎', val: 'Samut Prakan Province, Thailand' },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(245,166,35,.1)', border: '1px solid rgba(245,166,35,.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: '#F5A623',
                    }}>{c.icon}</span>
                    {c.href
                      ? <a href={c.href} className="ft-contact-link" style={{ marginTop: 4 }}>{c.val}</a>
                      : <span style={{ fontSize: 13, color: 'var(--ft-muted)', marginTop: 4 }}>{c.val}</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent 0%, var(--ft-divider) 20%, var(--ft-divider) 80%, transparent 100%)' }} />

        {/* ── BOTTOM BAR ── */}
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 28px' }}>
          {/* Business info */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', marginBottom: 18 }}>
            {[
              t('footer.businessDetails.company', { ns: 'landing', defaultValue: 'The Seacus Company LTD' }),
              t('footer.businessDetails.registration', { ns: 'landing', defaultValue: 'It is registered as a legal entity under the Civil & Commercial code at the Business Registration office, Samut Prakan Province.' }),
              t('footer.businessDetails.registrationNumber', { ns: 'landing', defaultValue: 'Company registration number: 0115569002129' }),
            ].map((item, i) => (
              <span key={i} style={{ fontSize: 11.5, color: 'var(--ft-muted2)' }}>{item}</span>
            ))}
          </div>

          {/* Legal + copyright */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {/* Legal links */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
              {LEGAL_LINKS.map((link, i) => (
                <a key={i}
                  href={isTurkish ? link.tr : link.en}
                  target="_blank" rel="noopener"
                  className="ft-legal-link"
                >
                  {t(link.key, { ns: 'landing' })}
                </a>
              ))}
            </div>

            {/* Copyright */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'var(--ft-muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
                  boxShadow: '0 0 6px #22C55E', display: 'inline-block',
                  animation: 'ft-blink 2.5s infinite',
                }} />
                {t('footer.copyright', { ns: 'landing', defaultValue: '© 2025 OpenSightAI. All rights reserved.' })}
              </p>
              <p style={{ fontSize: 11, color: 'var(--ft-muted2)', marginTop: 4, opacity: 0.7 }}>
                {t('footer.disclaimer', { ns: 'landing', defaultValue: 'AI-powered intelligence. Results may vary.' })}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}