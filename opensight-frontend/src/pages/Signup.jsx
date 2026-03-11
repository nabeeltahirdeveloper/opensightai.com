import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User } from '@/api/entities'
import { Eye, EyeOff, Mail, Lock, User as UserIcon, CheckCircle2, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react'

function pwStrength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const PW_LABELS = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong']
const PW_COLORS = ['#E85555', '#E87F30', '#E8C230', '#48C878', '#2ECC71']

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [granted, setGranted] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const t = {
    bg:      dark ? '#0E0D08' : '#FEFCF3',
    card:    dark ? '#141208' : '#FFFFFF',
    ink:     dark ? '#F2EDD8' : '#1A180F',
    muted:   dark ? '#A0967E' : '#7A7060',
    border:  dark ? 'rgba(245,166,35,.22)' : 'rgba(245,166,35,.18)',
    input:   dark ? 'rgba(245,166,35,.07)' : 'rgba(245,166,35,.05)',
    shadow:  dark ? '0 8px 48px rgba(0,0,0,.5)' : '0 8px 48px rgba(245,166,35,.12)',
  }

  const handleChange = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError('') }
  const strength = pwStrength(form.password)
  const pwMatch = form.confirm && form.password === form.confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      await User.register({ full_name: form.name, email: form.email, password: form.password })
      setGranted(true)
      setTimeout(() => navigate('/dashboard'), 2400)
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (valid) => ({
    width: '100%', padding: '11px 40px 11px 36px', borderRadius: 12,
    fontSize: 14, fontWeight: 500, outline: 'none',
    color: t.ink, background: t.input,
    border: `1.5px solid ${valid === true ? 'rgba(72,200,120,.5)' : valid === false ? 'rgba(220,60,60,.45)' : t.border}`,
    transition: 'border-color .2s, box-shadow .2s',
  })

  const fields = [
    { label: 'Full Name', name: 'name', type: 'text', placeholder: 'John Doe', icon: <UserIcon size={14} />, autoComplete: 'name' },
    { label: 'Email', name: 'email', type: 'email', placeholder: 'you@example.com', icon: <Mail size={14} />, autoComplete: 'email' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: '24px 16px', position: 'relative', overflow: 'hidden', transition: 'background .3s' }}>
      {/* Blobs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-8%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,166,35,.13),transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-8%', right: '-6%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,207,107,.09),transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>

        {/* Back Button */}
      
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13.5, fontWeight: 600, color: '#F5A623', textDecoration: 'none', transition: 'opacity .2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <ArrowLeft size={14} /> Back to Home
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 50, height: 50, borderRadius: 15, margin: '0 auto 12px', background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(245,166,35,.45)' }}>
            <Sparkles size={22} color="#1A180F" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: t.ink, letterSpacing: '-.03em', margin: '0 0 5px' }}>Create your account</h1>
          <p style={{ fontSize: 13.5, color: t.muted, margin: 0 }}>
            Join <span style={{ color: '#F5A623', fontWeight: 600 }}>OpenSightAI</span> and start scanning smarter
          </p>
        </div>

        {/* Card */}
        <div style={{ background: t.card, borderRadius: 22, border: `1.5px solid ${t.border}`, boxShadow: t.shadow, overflow: 'hidden', transition: 'all .3s' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)' }} />
          <div style={{ padding: '28px 28px 24px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Name + Email */}
              {fields.map(f => (
                <div key={f.name}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: t.muted, marginBottom: 6 }}>{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#F5A623', opacity: .7 }}>{f.icon}</span>
                    <input name={f.name} type={f.type} required placeholder={f.placeholder} value={form[f.name]} onChange={handleChange} autoComplete={f.autoComplete} style={inputStyle(null)} />
                  </div>
                </div>
              ))}

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: t.muted, marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#F5A623', opacity: .7 }} />
                  <input name="password" type={showPw ? 'text' : 'password'} required placeholder="Min 8 characters" value={form.password} onChange={handleChange} autoComplete="new-password"
                    style={{ ...inputStyle(form.password ? strength >= 3 : null), paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.muted, display: 'flex' }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {form.password && (
                  <div style={{ marginTop: 7 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, transition: 'background .35s', background: i <= strength ? PW_COLORS[strength] : (dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)') }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PW_COLORS[strength] }}>{PW_LABELS[strength]}</span>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: t.muted, marginBottom: 6 }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#F5A623', opacity: .7 }} />
                  <input name="confirm" type={showCf ? 'text' : 'password'} required placeholder="Re-enter password" value={form.confirm} onChange={handleChange} autoComplete="new-password"
                    style={{ ...inputStyle(form.confirm ? pwMatch : null), paddingRight: 72 }} />
                  {pwMatch && <CheckCircle2 size={14} style={{ position: 'absolute', right: 38, top: '50%', transform: 'translateY(-50%)', color: '#48C878' }} />}
                  <button type="button" onClick={() => setShowCf(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.muted, display: 'flex' }}>
                    {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 13px', borderRadius: 10, background: 'rgba(220,60,60,.1)', border: '1px solid rgba(220,60,60,.25)', color: '#E85555', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px 24px', border: 'none', borderRadius: 50, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg,#F5A623,#FFCF6B,#E8940A)', color: '#1A180F', boxShadow: '0 4px 18px rgba(245,166,35,.42)', opacity: loading ? .65 : 1, transition: 'transform .2s, box-shadow .2s' }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(245,166,35,.55)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(245,166,35,.42)' }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg style={{ animation: 'spin .9s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4" strokeDasharray="2 4" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    Create Account <ArrowRight size={15} />
                  </span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: 12, color: t.muted, fontWeight: 500 }}>or sign up with</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            {/* Social */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Google', icon: (<svg width="17" height="17" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>) },
                { label: 'GitHub', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill={t.ink}><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>) },
              ].map(s => (
                <button key={s.label}
                  style={{ padding: '10px', borderRadius: 12, border: `1.5px solid ${t.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: t.ink, transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,166,35,.5)'; e.currentTarget.style.background = 'rgba(245,166,35,.07)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: t.muted, margin: 0 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#F5A623', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: t.muted, marginTop: 14, opacity: .7 }}>
          By creating an account you agree to our{' '}
          <Link to="/terms" style={{ color: '#F5A623', textDecoration: 'none' }}>Terms</Link> &{' '}
          <Link to="/privacy" style={{ color: '#F5A623', textDecoration: 'none' }}>Privacy Policy</Link>
        </p>
      </div>

      {/* Success Popup */}
      {granted && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)' }}>
          <div style={{ padding: '40px 50px', borderRadius: 26, textAlign: 'center', background: 'linear-gradient(145deg,#1A1608,#0E0D08)', border: '1.5px solid rgba(245,166,35,.35)', boxShadow: '0 32px 80px rgba(0,0,0,.7)' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', margin: '0 auto 20px', background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 28px rgba(245,166,35,.6)' }}>
              <CheckCircle2 size={30} color="#1A180F" />
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#F2EDD8', margin: '0 0 7px' }}>Account Created!</p>
            <p style={{ fontSize: 13, color: '#A0967E', margin: '0 0 18px' }}>Welcome to OpenSightAI. Setting up your workspace…</p>
            <div style={{ height: 4, borderRadius: 4, width: 160, margin: '0 auto', background: 'linear-gradient(90deg,#F5A623,#FFCF6B)', animation: 'pulse 1.5s ease infinite' }} />
            <p style={{ fontSize: 12, color: '#6B6050', marginTop: 8 }}>Redirecting to dashboard…</p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}