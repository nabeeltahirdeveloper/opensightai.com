import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/* ── Shared modal shell ── */
function ModalShell({ id, onClose, children }) {
  const overlayRef = useRef(null)

  // Close on overlay click
  const handleOverlay = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      id={id}
      ref={overlayRef}
      onClick={handleOverlay}
      className="modal saas-font"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(245,166,35,.22)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,.18), 0 0 0 1px rgba(245,166,35,.08)',
          position: 'relative',
          overflow: 'hidden',
          maxWidth: 480,
          width: '100%',
          padding: '32px',
        }}
      >
        {/* Top shimmer */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(245,166,35,.55),transparent)',
        }} />
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 220, height: 220,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle,rgba(245,166,35,.08) 0%,transparent 70%)',
        }} />
        {children}
      </div>
    </div>
  )
}

/* ── Shared close button ── */
function CloseBtn({ onClose }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClose}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: hov ? 'rgba(245,166,35,.15)' : 'rgba(245,166,35,.07)',
        color: hov ? '#F5A623' : 'var(--muted)',
        fontSize: 18, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .22s', flexShrink: 0,
      }}
    >
      ×
    </button>
  )
}

/* ── Styled input ── */
function Field({ type = 'text', placeholder, required, id, half, autoComplete }) {
  const [foc, setFoc] = useState(false)
  return (
    <input
      type={type}
      placeholder={placeholder}
      required={required}
      id={id}
      autoComplete={autoComplete || 'off'}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={{
        width: '100%',
        padding: '11px 16px',
        borderRadius: 12,
        border: `1.5px solid ${foc ? '#F5A623' : 'rgba(245,166,35,.2)'}`,
        background: 'var(--card)',
        color: 'var(--ink)',
        fontFamily: 'inherit',
        fontSize: 14,
        outline: 'none',
        boxShadow: foc ? '0 0 0 3px rgba(245,166,35,.1)' : 'none',
        transition: 'border-color .22s, box-shadow .22s',
      }}
    />
  )
}

/* ── Gold primary button ── */
function GoldBtn({ children, type = 'button', onClick, disabled, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        padding: '13px 24px',
        borderRadius: 50,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: hov && !disabled
          ? 'linear-gradient(135deg,#FFCF6B,#F5A623)'
          : 'linear-gradient(135deg,#F5A623,#FFCF6B)',
        color: '#111',
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 14.5,
        boxShadow: hov && !disabled
          ? '0 10px 32px rgba(245,166,35,.55), inset 0 1px 0 rgba(255,255,255,.3)'
          : '0 5px 20px rgba(245,166,35,.38), inset 0 1px 0 rgba(255,255,255,.3)',
        transform: hov && !disabled ? 'translateY(-2px)' : 'translateY(0)',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .25s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading && (
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          border: '2px solid rgba(0,0,0,.25)', borderTopColor: '#111',
          animation: 'modal-spin 0.7s linear infinite', display: 'inline-block',
        }} />
      )}
      {children}
    </button>
  )
}

/* ── Ghost button ── */
function GhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '11px 20px',
        borderRadius: 50,
        border: `1.5px solid ${hov ? '#F5A623' : 'rgba(245,166,35,.3)'}`,
        background: hov ? 'rgba(245,166,35,.07)' : 'transparent',
        color: hov ? '#F5A623' : 'var(--ink)',
        fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
        cursor: 'pointer',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .25s',
      }}
    >
      {children}
    </button>
  )
}

/* ── Modal header ── */
function ModalHead({ title, onClose, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg,#F5A623,#FFCF6B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 14px rgba(245,166,35,.4)',
          }}>
            {icon}
          </div>
        )}
        <h3 style={{ fontFamily: 'inherit', fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-.02em' }}>
          {title}
        </h3>
      </div>
      <CloseBtn onClose={onClose} />
    </div>
  )
}

export default function Modals() {
  const { t } = useTranslation(['landing', 'common'])

  const close = (id) => window.closeModal?.(id)

  return (
    <>
      <style>{`
        @keyframes modal-spin { to { transform: rotate(360deg); } }
        .modal-placeholder { color: var(--muted); }
        input::placeholder, textarea::placeholder { color: var(--muted); opacity: .7; }
        /* Fix browser autofill overriding text/background color */
        .modal input:-webkit-autofill,
        .modal input:-webkit-autofill:hover,
        .modal input:-webkit-autofill:focus,
        .modal input:-webkit-autofill:active {
          -webkit-text-fill-color: var(--ink) !important;
          -webkit-box-shadow: 0 0 0 9999px var(--card) inset !important;
          box-shadow: 0 0 0 9999px var(--card) inset !important;
          background-color: var(--card) !important;
          border-color: rgba(245,166,35,.35) !important;
          transition: background-color 5000s ease-in-out 0s !important;
          caret-color: var(--ink) !important;
          font-size: 14px !important;
        }
      `}</style>

      {/* ── LOGIN MODAL ── */}
      <ModalShell id="loginModal" onClose={() => close('loginModal')}>
        <ModalHead
          title={t('modals.login.title')}
          icon="◎"
          onClose={() => close('loginModal')}
        />

        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); window.handleLogin?.(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field type="email" placeholder={t('modals.login.emailPlaceholder')} required autoComplete="new-password" />
          <Field type="password" placeholder={t('modals.login.passwordPlaceholder')} required autoComplete="new-password" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" style={{ accentColor: '#F5A623' }} />
              {t('modals.login.rememberMe')}
            </label>
            <a href="#" style={{ color: '#F5A623', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
              {t('modals.login.forgotPassword')}
            </a>
          </div>

          <div style={{ marginTop: 4 }}>
            <GoldBtn type="submit">{t('login', { ns: 'common' })} →</GoldBtn>
          </div>
        </form>

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Don't have an account?{' '}
          <a href="/signup"
            onClick={() => close('loginModal')}
            style={{ color: '#F5A623', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            Create one
          </a>
        </div>

        {/* Divider + trust */}
        <div style={{
          marginTop: 20, paddingTop: 18,
          borderTop: '1px solid rgba(245,166,35,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          {['🔒 Secure Login', '◈ Encrypted', '✓ Trusted'].map((badge, i) => (
            <span key={i} style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {badge}
            </span>
          ))}
        </div>
      </ModalShell>

      {/* ── DEMO MODAL ── */}
      <ModalShell id="demoModal" onClose={() => close('demoModal')}>
        <ModalHead
          title={t('modals.demo.title')}
          icon="▷"
          onClose={() => close('demoModal')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
            {t('modals.demo.description')}
          </p>

          <div style={{
            borderRadius: 18, padding: '36px 24px',
            background: 'rgba(245,166,35,.05)',
            border: '1px solid rgba(245,166,35,.15)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            {/* Spinner */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: '3px solid rgba(245,166,35,.15)',
              borderTopColor: '#F5A623',
              animation: 'modal-spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
              {t('modals.demo.loading')}
            </p>
          </div>

          <GhostBtn onClick={() => close('demoModal')}>Close</GhostBtn>
        </div>
      </ModalShell>

      {/* ── PAYMENT MODAL ── */}
      <ModalShell id="paymentModal" onClose={() => close('paymentModal')}>
        <ModalHead
          title={t('modals.payment.title')}
          icon="◆"
          onClose={() => close('paymentModal')}
        />

        {/* Selected plan box */}
        <div id="selectedPlan" style={{
          marginBottom: 20, padding: '12px 16px',
          borderRadius: 14,
          background: 'rgba(245,166,35,.08)',
          border: '1px solid rgba(245,166,35,.2)',
          fontSize: 13, color: 'var(--ink)',
        }} />

        <form
          autoComplete="off"
          onSubmit={(e) => { e.preventDefault(); window.processPayment?.(e) }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field placeholder={t('modals.payment.firstName')} required />
            <Field placeholder={t('modals.payment.lastName')} required />
          </div>
          <Field type="email" placeholder={t('modals.payment.emailAddress')} required />
          <Field placeholder={t('modals.payment.cardNumber')} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field placeholder={t('modals.payment.mmYy')} required />
            <Field placeholder={t('modals.payment.cvc')} required />
            <Field placeholder={t('modals.payment.zipCode')} required />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--muted)', cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" id="billing" required style={{ accentColor: '#F5A623', marginTop: 2 }} />
            <span>{t('modals.payment.agreeTerms')}</span>
          </label>

          <div style={{ marginTop: 4 }}>
            <GoldBtn type="submit">
              ◆ &nbsp;{t('modals.payment.completePayment')}
            </GoldBtn>
          </div>
        </form>

        {/* Trust row */}
        <div style={{
          marginTop: 18, paddingTop: 16,
          borderTop: '1px solid rgba(245,166,35,.1)',
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14,
        }}>
          {[
            { icon: '🔒', label: t('modals.payment.securePayment') },
            { icon: '◈', label: t('modals.payment.allMajorCards') },
            { icon: '✓', label: t('modals.payment.guarantee') },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </ModalShell>
    </>
  )
}