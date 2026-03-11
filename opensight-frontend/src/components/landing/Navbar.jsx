import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { User } from '@/api/entities'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Menu, X, ChevronDown } from 'lucide-react'
import { useCurrency } from '@/contexts/CurrencyContext'

const injectStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .nb-root * { box-sizing:border-box; }
  .nb-root { font-family:'Inter',system-ui,-apple-system,sans-serif; }

  .nav-lnk { position:relative; }
  .nav-lnk::after {
    content:''; position:absolute; bottom:0; left:10px; right:10px;
    height:2px; border-radius:2px;
    background:linear-gradient(90deg,#F5A623,#FFCF6B);
    transform:scaleX(0); transform-origin:center;
    transition:transform .24s cubic-bezier(.34,1.3,.64,1);
  }
  .nav-lnk:hover::after { transform:scaleX(1); }

  .shine::before {
    content:''; position:absolute; top:0; left:-100%; width:55%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);
    transition:left .44s;
  }
  .shine:hover::before { left:160%; }

  .mob-dr { max-height:0; overflow:hidden; opacity:0; transition:max-height .38s cubic-bezier(.4,0,.2,1),opacity .25s ease; }
  .mob-dr.op { max-height:800px; opacity:1; }

  .curr-list { overflow-y:auto; max-height:min(240px, 45vh); }
  .curr-list::-webkit-scrollbar { width:4px; }
  .curr-list::-webkit-scrollbar-track { background:transparent; }
  .curr-list::-webkit-scrollbar-thumb { background:rgba(245,166,35,.4); border-radius:4px; }

  /* Responsive navbar */
  .nb-desk { display:flex; }
  .nb-mob-btn { display:none; }
  .nb-mob-drawer { display:none; }
  @media (max-width:767px) {
    .nb-desk { display:none !important; }
    .nb-mob-btn { display:flex !important; }
    .nb-mob-drawer { display:block !important; }
    .nb-bar { display:flex !important; grid-template-columns:none !important; justify-content:space-between !important; }
  }
`

const LINKS = [
  { href:'#home',     key:'home'     },
  { href:'#features', key:'features' },
  { href:'#pricing',  key:'pricing'  },
  { href:'#about',    key:'about'    },
  { href:'#contact',  key:'contact'  },
]

/* ── Currency selector — proper width, scroll, all setter names covered ── */
function CurrencyBtn({ dark, inline }) {
  const ctx = useCurrency()
  const selected    = ctx.selectedCurrency   || 'USD'
  const currencies  = ctx.currencies         || []
  /* cover every possible setter name in different CurrencyContext builds */
  const applyCurrency = ctx.setCurrency      ||
                        ctx.setSelectedCurrency ||
                        ctx.changeCurrency   ||
                        ctx.selectCurrency   ||
                        (() => {})

  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  /* close on outside click */
  useEffect(() => {
    const fn = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const bg  = dark ? '#1C1A0E' : '#FFFDF5'
  const ink = dark ? '#F2EDD8' : '#1A180F'
  const hbg = dark ? 'rgba(245,166,35,.13)' : 'rgba(245,166,35,.07)'
  const bdr = dark ? 'rgba(245,166,35,.28)' : 'rgba(245,166,35,.22)'

  return (
    <div ref={wrapRef} style={{ position:'relative', flexShrink:0 }}>
      {/* Trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        style={{
          display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          padding:'8px 13px', borderRadius:11,
          border:`1.5px solid ${open ? 'rgba(245,166,35,.6)' : bdr}`,
          background: open ? hbg : 'transparent',
          color:ink, fontSize:13, fontWeight:600, cursor:'pointer',
          transition:'all .2s',
        }}
      >
        {selected}
        <ChevronDown size={13} style={{ color:'#F5A623', transition:'transform .2s', transform:open?'rotate(180deg)':'rotate(0)' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: inline ? 'relative' : 'absolute',
            top: inline ? 0 : 'calc(100% + 8px)',
            left: inline ? 0 : 0,
            width: inline ? '100%' : 220,
            marginTop: inline ? 8 : 0,
            background:bg,
            border:'1.5px solid rgba(245,166,35,.3)',
            borderRadius:16,
            boxShadow: inline ? 'none' : (dark
              ? '0 20px 56px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4)'
              : '0 20px 56px rgba(245,166,35,.18), 0 4px 16px rgba(0,0,0,.08)'),
            zIndex:500,
            overflow:'hidden',
            maxHeight: inline ? 'none' : 'min(260px, 50vh)',
          }}
        >
          <div className="curr-list">
            {currencies.map(c => {
              const isSel = c.code === selected
              return (
                <button
                  key={c.code}
                  onMouseDown={(e) => {
                    /* mousedown fires before outside-click closes — use this to select */
                    e.stopPropagation()
                    applyCurrency(c.code)
                    setOpen(false)
                  }}
                  style={{
                    display:'flex', alignItems:'center', gap:8,
                    width:'100%', padding:'9px 14px', border:'none',
                    cursor:'pointer', textAlign:'left', whiteSpace:'nowrap',
                    fontSize:13, fontWeight: isSel ? 700 : 500,
                    color: isSel ? '#F5A623' : ink,
                    background: isSel ? (dark?'rgba(245,166,35,.16)':'rgba(245,166,35,.09)') : 'transparent',
                    transition:'background .14s',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = hbg }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* symbol */}
                  <span style={{ color:'#F5A623', fontWeight:700, width:20, flexShrink:0 }}>{c.symbol}</span>
                  {/* code */}
                  <span style={{ fontWeight:600, flexShrink:0 }}>{c.code}</span>
                  {/* name — truncated */}
                  {c.name && (
                    <span style={{ color:dark?'#7A6F5A':'#A09080', fontSize:11, marginLeft:'auto', overflow:'hidden', textOverflow:'ellipsis', maxWidth:72 }}>
                      {c.name}
                    </span>
                  )}
                  {isSel && <span style={{ color:'#F5A623', fontSize:12, fontWeight:800, marginLeft:4, flexShrink:0 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Navbar ── */
export default function Navbar() {
  const { t } = useTranslation('common')
  const [user, setUser] = useState(null)
  const [sc,   setSc]   = useState(false)
  const [mob,  setMob]  = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  useEffect(() => {
    ;(async () => { try { setUser(await User.me()) } catch { setUser(null) } })()
  }, [])

  useEffect(() => {
    const fn = () => setSc(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive:true }); fn()
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const toggleDark = () => {
    const n = !dark; setDark(n)
    document.documentElement.setAttribute('data-theme', n ? 'dark' : 'light')
  }

  const ink   = dark ? '#F2EDD8' : '#1A180F'
  const muted = dark ? '#A0967E' : '#6B6555'
  const bdr   = dark ? 'rgba(245,166,35,.26)' : 'rgba(245,166,35,.22)'
  const hbg   = dark ? 'rgba(245,166,35,.11)' : 'rgba(245,166,35,.07)'
  const navBg = sc ? (dark ? 'rgba(14,13,8,.76)' : 'rgba(254,252,243,.76)') : 'transparent'
  const mobBg = dark ? 'rgba(14,13,8,.97)' : 'rgba(254,252,243,.97)'

  return (
    <>
      <style>{injectStyle}</style>
      <div className="nb-root">
        <header style={{
          position:'fixed', top:0, left:0, right:0, zIndex:100,
          background:navBg,
          backdropFilter: sc ? 'blur(22px) saturate(1.7)' : 'none',
          WebkitBackdropFilter: sc ? 'blur(22px) saturate(1.7)' : 'none',
          borderBottom:`1px solid ${sc?(dark?'rgba(245,166,35,.17)':'rgba(245,166,35,.12)'):'transparent'}`,
          boxShadow: sc ? (dark?'0 4px 24px rgba(0,0,0,.3)':'0 4px 24px rgba(245,166,35,.06)') : 'none',
          transition:'all .3s ease',
        }}>

          {/* ── 3-column grid: logo | CENTRE links | actions ── */}
          <div className="nb-bar" style={{
            maxWidth:1280, margin:'0 auto', padding:'0 28px',
            height:72,
            display:'grid',
            gridTemplateColumns:'1fr auto 1fr',
            alignItems:'center', gap:12,
          }}>

            {/* LEFT — Logo */}
            <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}
              className="group" >
              <div
                className="transition-all duration-300 group-hover:rotate-[-9deg] group-hover:scale-110"
                style={{
                  width:42, height:42, borderRadius:13, flexShrink:0,
                  background:'linear-gradient(135deg,#F5A623,#FFCF6B)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 16px rgba(245,166,35,.42)',
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1A180F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5-2.1 2.1M7.6 16.4l-2.1 2.1m0-12.5 2.1 2.1m8.8 8.8 2.1 2.1"/>
                </svg>
              </div>
              <span style={{ fontSize:20, fontWeight:800, letterSpacing:'-.025em', color:ink, lineHeight:1, whiteSpace:'nowrap' }}>
                OpenSight<span style={{ color:'#F5A623' }}>AI</span>
              </span>
            </Link>

            {/* CENTRE — Nav links (hidden on mobile) */}
            <nav className="nb-desk" style={{ alignItems:'center', gap:2 }}>
              {LINKS.map(l => (
                <a key={l.href} href={l.href}
                  className="nav-lnk"
                  style={{
                    padding:'9px 13px', borderRadius:10, fontSize:14, fontWeight:500,
                    color:muted, textDecoration:'none', transition:'color .2s', display:'block',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = ink}
                  onMouseLeave={e => e.currentTarget.style.color = muted}
                >
                  {t(l.key)}
                </a>
              ))}
            </nav>

            {/* RIGHT — Actions (hidden on mobile) + hamburger */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>

              {/* Desktop actions */}
              <div className="nb-desk" style={{ alignItems:'center', gap:8 }}>
                <CurrencyBtn dark={dark} />

                {/* Theme */}
                <button onClick={toggleDark}
                  style={{
                    width:36, height:36, borderRadius:10, border:`1px solid ${bdr}`,
                    background:'transparent', color:'#F5A623', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all .22s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background=hbg; e.currentTarget.style.transform='rotate(20deg)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.transform='rotate(0)' }}
                >
                  {dark ? <Sun size={15}/> : <Moon size={15}/>}
                </button>

                {/* Support */}
                <Link to="/support-team"
                  style={{
                    padding:'8px 16px', borderRadius:50, border:`1.5px solid ${bdr}`,
                    color:ink, fontSize:13.5, fontWeight:600, textDecoration:'none',
                    transition:'all .22s', whiteSpace:'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#F5A623'; e.currentTarget.style.color='#F5A623'; e.currentTarget.style.background=hbg; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=bdr; e.currentTarget.style.color=ink; e.currentTarget.style.background='transparent'; e.currentTarget.style.transform='none' }}
                >
                  Support
                </Link>

                {user ? (
                  <button onClick={() => window.location.href='/dashboard'}
                    className="shine"
                    style={{
                      position:'relative', overflow:'hidden',
                      padding:'9px 20px', borderRadius:50, border:'none',
                      background:'linear-gradient(135deg,#F5A623,#FFCF6B)', color:'#1A180F',
                      fontSize:13.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                      boxShadow:'0 3px 14px rgba(245,166,35,.36)', transition:'all .22s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(245,166,35,.52)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 3px 14px rgba(245,166,35,.36)' }}
                  >
                    {t('dashboard')}
                  </button>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => window.openModal?.('loginModal')}
                      className="shine"
                      style={{
                        position:'relative', overflow:'hidden',
                        padding:'9px 20px', borderRadius:50, border:'none',
                        background:'linear-gradient(135deg,#F5A623,#FFCF6B)', color:'#1A180F',
                        fontSize:13.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                        boxShadow:'0 3px 14px rgba(245,166,35,.36)', transition:'all .22s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(245,166,35,.52)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 3px 14px rgba(245,166,35,.36)' }}
                    >
                      {t('login')}
                    </button>
                    <Link to="/signup"
                      style={{
                        padding:'8px 16px', borderRadius:50,
                        border:'1.5px solid rgba(245,166,35,.38)', color:'#F5A623',
                        fontSize:13.5, fontWeight:600, textDecoration:'none',
                        transition:'all .22s', whiteSpace:'nowrap',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background=hbg; e.currentTarget.style.transform='translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.transform='none' }}
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>

              {/* Hamburger (mobile only) */}
              <button
                className="nb-mob-btn"
                onClick={() => setMob(v => !v)}
                style={{
                  width:40, height:40, borderRadius:11,
                  border:`1px solid ${bdr}`, background: mob ? hbg : 'transparent',
                  color:'#F5A623', cursor:'pointer', alignItems:'center', justifyContent:'center',
                  transition:'all .22s',
                }}
              >
                <div style={{ position:'relative', width:20, height:20 }}>
                  <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', opacity:mob?1:0, transform:mob?'scale(1)':'scale(.7) rotate(90deg)' }}><X size={18}/></span>
                  <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', opacity:mob?0:1, transform:mob?'scale(.7) rotate(-90deg)':'scale(1)' }}><Menu size={18}/></span>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile drawer */}
          <div className={`mob-dr nb-mob-drawer ${mob?'op':''}`}
            style={{ borderTop:`1px solid rgba(245,166,35,.1)`, background:mobBg, backdropFilter:'blur(24px)' }}>
            <div style={{ padding:'10px 20px 22px', display:'flex', flexDirection:'column', gap:1 }}>
              {LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMob(false)}
                  style={{
                    display:'block', padding:'11px 14px', borderRadius:12,
                    fontSize:14.5, fontWeight:500, color:muted, textDecoration:'none',
                    transition:'all .18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background=hbg; e.currentTarget.style.color=ink; e.currentTarget.style.paddingLeft='20px' }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=muted; e.currentTarget.style.paddingLeft='14px' }}
                >
                  {t(l.key)}
                </a>
              ))}

              <div style={{ height:1, background:'rgba(245,166,35,.12)', margin:'6px 4px' }} />
              <div style={{ padding:'2px 4px 0' }}><CurrencyBtn dark={dark} inline /></div>

              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10, padding:'0 4px', alignItems:'center' }}>
                <button onClick={toggleDark}
                  style={{ width:36, height:36, borderRadius:10, border:`1px solid ${bdr}`, background:'transparent', color:'#F5A623', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseEnter={e => e.currentTarget.style.background=hbg}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  {dark ? <Sun size={15}/> : <Moon size={15}/>}
                </button>
                <Link to="/support-team" onClick={() => setMob(false)}
                  style={{ padding:'8px 14px', borderRadius:50, border:`1.5px solid ${bdr}`, color:ink, fontSize:13, fontWeight:600, textDecoration:'none' }}>
                  Support
                </Link>
                {user ? (
                  <button onClick={() => window.location.href='/dashboard'}
                    className="shine"
                    style={{ position:'relative', overflow:'hidden', padding:'8px 18px', borderRadius:50, border:'none', background:'linear-gradient(135deg,#F5A623,#FFCF6B)', color:'#1A180F', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    {t('dashboard')}
                  </button>
                ) : (<>
                  <button onClick={() => { window.openModal?.('loginModal'); setMob(false) }}
                    className="shine"
                    style={{ position:'relative', overflow:'hidden', padding:'8px 18px', borderRadius:50, border:'none', background:'linear-gradient(135deg,#F5A623,#FFCF6B)', color:'#1A180F', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    {t('login')}
                  </button>
                  <Link to="/signup" onClick={() => setMob(false)}
                    style={{ padding:'8px 14px', borderRadius:50, border:'1.5px solid rgba(245,166,35,.38)', color:'#F5A623', fontSize:13, fontWeight:600, textDecoration:'none' }}>
                    Sign up
                  </Link>
                </>)}
              </div>
            </div>
          </div>
        </header>
      </div>
    </>
  )
}