import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User } from '@/api/entities'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Mail, Lock, CheckCircle, Sparkles, ArrowRight } from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .lg-root * { box-sizing:border-box; font-family:'Inter',system-ui,sans-serif; }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn  { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes orbit    { 0%{transform:rotate(0deg) translateX(72px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(72px) rotate(-360deg)} }
  @keyframes pulse    { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
  @keyframes popIn    { 0%{opacity:0;transform:scale(.72) translateY(12px)} 60%{transform:scale(1.06) translateY(-4px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes checkDraw{ 0%{stroke-dashoffset:60} 100%{stroke-dashoffset:0} }
  @keyframes floatBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

  .lg-card  { animation:scaleIn .5s cubic-bezier(.22,1,.36,1) both; }
  .lg-field-in:nth-child(1){ animation:fadeUp .45s .18s both }
  .lg-field-in:nth-child(2){ animation:fadeUp .45s .28s both }
  .lg-field-in:nth-child(3){ animation:fadeUp .45s .36s both }
  .lg-field-in:nth-child(4){ animation:fadeUp .45s .44s both }

  .lg-input {
    width:100%; padding:13px 44px 13px 42px; border-radius:13px;
    font-size:14px; font-weight:500; outline:none;
    background:rgba(245,166,35,.06); color:var(--lg-ink);
    border:1.5px solid rgba(245,166,35,.22);
    transition:border-color .22s, box-shadow .22s, background .22s;
  }
  .lg-input::placeholder { color:var(--lg-muted); }
  .lg-input:focus {
    border-color:rgba(245,166,35,.7);
    background:rgba(245,166,35,.09);
    box-shadow:0 0 0 4px rgba(245,166,35,.13), 0 2px 12px rgba(245,166,35,.1);
  }

  .lg-btn {
    position:relative; overflow:hidden; width:100%;
    padding:14px 24px; border:none; border-radius:50px; cursor:pointer;
    font-size:15px; font-weight:700; letter-spacing:.01em;
    background:linear-gradient(135deg,#F5A623,#FFCF6B,#E8940A);
    background-size:200% auto; color:#1A180F;
    box-shadow:0 4px 18px rgba(245,166,35,.42);
    transition:transform .22s, box-shadow .22s;
  }
  .lg-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 32px rgba(245,166,35,.55); }
  .lg-btn:active:not(:disabled){ transform:translateY(0); }
  .lg-btn:disabled { opacity:.65; cursor:not-allowed; }
  .lg-btn::before {
    content:''; position:absolute; top:0; left:-100%; width:55%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);
    transition:left .5s;
  }
  .lg-btn:hover::before { left:160%; }

  .lg-divider { display:flex; align-items:center; gap:12px; margin:18px 0; }
  .lg-divider::before,.lg-divider::after { content:''; flex:1; height:1px; background:rgba(245,166,35,.18); }

  .lg-social {
    width:100%; padding:11px; border-radius:13px; cursor:pointer;
    font-size:13.5px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:9px;
    background:transparent; transition:all .22s;
  }
  .lg-social:hover { transform:translateY(-1px); }

  /* ── Access Granted Popup ── */
  .ag-overlay {
    position:fixed; inset:0; z-index:999;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.55); backdrop-filter:blur(8px);
    animation:fadeUp .2s ease both;
  }
  .ag-card {
    padding:44px 52px; border-radius:28px; text-align:center;
    background:linear-gradient(145deg,#1A1608,#0E0D08);
    border:1.5px solid rgba(245,166,35,.35);
    box-shadow:0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(245,166,35,.08), inset 0 1px 0 rgba(245,166,35,.12);
    animation:popIn .5s cubic-bezier(.22,1,.36,1) both;
  }
  .ag-ring {
    position:relative; width:100px; height:100px; margin:0 auto 24px;
    display:flex; align-items:center; justify-content:center;
  }
  .ag-ring-bg {
    position:absolute; inset:0; border-radius:50%;
    background:radial-gradient(circle,rgba(245,166,35,.22),transparent 70%);
    animation:pulse 2s ease infinite;
  }
  .ag-icon-wrap {
    width:72px; height:72px; border-radius:50%; position:relative; z-index:2;
    background:linear-gradient(135deg,#F5A623,#FFCF6B);
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 6px 28px rgba(245,166,35,.6);
    animation:pulse 2s ease infinite;
  }
  .ag-particle {
    position:absolute; width:7px; height:7px; border-radius:50%;
    background:linear-gradient(135deg,#F5A623,#FFCF6B);
    animation:orbit 2.4s linear infinite;
  }
  .ag-check { stroke-dasharray:60; stroke-dashoffset:60; animation:checkDraw .5s .3s ease forwards; }
  .ag-title { font-size:24px; font-weight:800; color:#F2EDD8; margin:0 0 8px; letter-spacing:-.02em; }
  .ag-sub   { font-size:13.5px; color:#A0967E; margin:0 0 20px; }
  .ag-bar   {
    height:4px; border-radius:4px; margin:0 auto;
    background:linear-gradient(90deg,#F5A623,#FFCF6B);
    animation:shimmer 1.5s linear infinite;
    background-size:200% auto;
  }
  .ag-redirect { font-size:12px; color:#6B6050; margin:10px 0 0; }

  .lg-blob { position:absolute; border-radius:50%; filter:blur(72px); pointer-events:none; }
  .lg-blob1 { animation:floatBob 7s ease-in-out infinite; }
  .lg-blob2 { animation:floatBob 9s ease-in-out 2s infinite; }
`

export default function Login() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const [form,    setForm]    = useState({ email:'', password:'' })
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [granted, setGranted] = useState(false)
  const [dark,    setDark]    = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.getAttribute('data-theme') === 'dark'))
    obs.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const ink    = dark ? '#F2EDD8' : '#1A180F'
  const muted  = dark ? '#A0967E' : '#7A7060'
  const card   = dark ? '#141208' : '#FFFDF5'
  const surface= dark ? '#0E0D08' : '#FEFCF3'
  const bdr    = dark ? 'rgba(245,166,35,.22)' : 'rgba(245,166,35,.18)'

  const handleChange = e => { setForm(p => ({...p, [e.target.name]: e.target.value})); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await User.login(form.email, form.password)
      setGranted(true)
      setTimeout(() => navigate('/dashboard'), 2200)
    } catch(err) {
      setError(err?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="lg-root" style={{
        '--lg-ink': ink, '--lg-muted': muted,
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background: surface, padding:'24px', position:'relative', overflow:'hidden',
        transition:'background .3s',
      }}>
        {/* Ambient blobs */}
        <div className="lg-blob lg-blob1" style={{ width:420, height:420, top:'-10%', left:'-8%', background:'radial-gradient(circle,rgba(245,166,35,.14),transparent 65%)' }} />
        <div className="lg-blob lg-blob2" style={{ width:320, height:320, bottom:'-5%', right:'-5%', background:'radial-gradient(circle,rgba(255,207,107,.1),transparent 65%)' }} />

        <div style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1 }}>
          {/* Logo mark */}
          <div style={{ textAlign:'center', marginBottom:28, animation:'fadeUp .4s ease both' }}>
            <div style={{
              width:54, height:54, borderRadius:16, margin:'0 auto 14px',
              background:'linear-gradient(135deg,#F5A623,#FFCF6B)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 6px 24px rgba(245,166,35,.45)',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A180F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5-2.1 2.1M7.6 16.4l-2.1 2.1m0-12.5 2.1 2.1m8.8 8.8 2.1 2.1"/>
              </svg>
            </div>
            <h1 style={{ fontSize:27, fontWeight:800, color:ink, letterSpacing:'-.03em', margin:'0 0 6px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize:13.5, color:muted, margin:0 }}>
              Sign in to your <span style={{ color:'#F5A623', fontWeight:600 }}>OpenSightAI</span> account
            </p>
          </div>

          {/* Card */}
          <div className="lg-card" style={{
            background:card, borderRadius:24,
            border:`1.5px solid ${bdr}`,
            boxShadow: dark
              ? '0 8px 48px rgba(0,0,0,.45), 0 2px 12px rgba(0,0,0,.3)'
              : '0 8px 48px rgba(245,166,35,.1), 0 2px 12px rgba(0,0,0,.06)',
            padding:'32px 32px 28px',
            transition:'all .3s',
          }}>
            {/* Gold top accent */}
            <div style={{ height:3, background:'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)', borderRadius:'12px 12px 0 0', margin:'-32px -32px 28px' }} />

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {/* Email */}
              <div className="lg-field-in" style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:muted, marginBottom:7, letterSpacing:'.03em', textTransform:'uppercase' }}>Email</label>
                <div style={{ position:'relative' }}>
                  <Mail size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#F5A623', opacity:.7, pointerEvents:'none' }} />
                  <input
                    className="lg-input" type="email" name="email" required
                    placeholder="you@example.com" value={form.email} onChange={handleChange}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lg-field-in" style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                  <label style={{ fontSize:12.5, fontWeight:600, color:muted, letterSpacing:'.03em', textTransform:'uppercase' }}>Password</label>
                  <Link to="/forgot-password" style={{ fontSize:12, color:'#F5A623', fontWeight:500, textDecoration:'none', opacity:.85 }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='.85'}
                  >Forgot password?</Link>
                </div>
                <div style={{ position:'relative' }}>
                  <Lock size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#F5A623', opacity:.7, pointerEvents:'none' }} />
                  <input
                    className="lg-input" type={showPw?'text':'password'} name="password" required
                    placeholder="••••••••" value={form.password} onChange={handleChange}
                    style={{ paddingRight:42 }} autoComplete="current-password"
                  />
                  <button type="button" onClick={()=>setShowPw(v=>!v)}
                    style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#A0967E', padding:2, display:'flex', alignItems:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.color='#F5A623'}
                    onMouseLeave={e=>e.currentTarget.style.color='#A0967E'}
                  >
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="lg-field-in" style={{
                  padding:'10px 14px', borderRadius:11, marginBottom:16,
                  background:'rgba(220,60,60,.1)', border:'1px solid rgba(220,60,60,.25)',
                  color:'#E85555', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{ fontSize:16 }}>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <div className="lg-field-in">
                <button type="submit" className="lg-btn" disabled={loading}>
                  {loading ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" strokeDasharray="4" style={{ animation:'spin 1s linear infinite', transformOrigin:'center' }} />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      Sign in <ArrowRight size={16}/>
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="lg-divider">
              <span style={{ fontSize:12, color:muted, fontWeight:500, whiteSpace:'nowrap' }}>or continue with</span>
            </div>

            {/* Social */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { label:'Google', icon:(
                  <svg width="17" height="17" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                )},
                { label:'GitHub', icon:(
                  <svg width="17" height="17" viewBox="0 0 24 24" fill={ink}><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                )},
              ].map(s => (
                <button key={s.label} className="lg-social"
                  style={{ border:`1.5px solid ${bdr}`, color:ink }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,166,35,.5)'; e.currentTarget.style.background='rgba(245,166,35,.07)'; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=bdr; e.currentTarget.style.background='transparent'; e.currentTarget.style.transform='translateY(0)' }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            <p style={{ textAlign:'center', fontSize:13, color:muted, marginTop:20, marginBottom:0 }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color:'#F5A623', fontWeight:600, textDecoration:'none' }}
                onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}
              >Sign up free</Link>
            </p>
          </div>
        </div>

        {/* ── ACCESS GRANTED POPUP ── */}
        {granted && (
          <div className="ag-overlay">
            <div className="ag-card">
              <div className="ag-ring">
                <div className="ag-ring-bg" />
                {[0,1,2].map(i => (
                  <div key={i} className="ag-particle" style={{ animationDelay:`${i*0.8}s`, animationDuration:`${2.4+i*0.4}s` }} />
                ))}
                <div className="ag-icon-wrap">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1A180F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline className="ag-check" points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <p className="ag-title">Access Granted</p>
              <p className="ag-sub">Identity verified. Launching your workspace…</p>
              <div className="ag-bar" style={{ width:180 }} />
              <p className="ag-redirect">Redirecting to dashboard</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}