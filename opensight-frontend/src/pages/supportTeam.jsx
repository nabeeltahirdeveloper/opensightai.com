import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Server, Wand2, CheckCircle2, ArrowLeft, Heart, ShieldCheck, ExternalLink } from "lucide-react";

const SUPPORT_URL = "https://buymeacoffee.com/OpenSight";

const injectStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .st-root { font-family:'Inter',system-ui,-apple-system,sans-serif; }
  @keyframes blob1 { 0%,100%{transform:translate(-30%,-30%) scale(1)} 50%{transform:translate(-30%,-30%) scale(1.1)} }
  @keyframes blob2 { 0%,100%{transform:translate(30%,30%) scale(1)} 50%{transform:translate(30%,30%) scale(1.08)} }
  .st-blob1 { animation:blob1 8s ease-in-out infinite; }
  .st-blob2 { animation:blob2 10s ease-in-out infinite; }
  @keyframes cardIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .st-in { animation:cardIn .45s ease both; }
`

const FEATURE_CARDS = [
  { icon: Zap,    title: "Faster Releases",    desc: "Support helps us ship improvements and new capabilities more frequently." },
  { icon: Server, title: "Better Reliability", desc: "Contributes to infrastructure, stability, and consistent uptime." },
  { icon: Wand2,  title: "Product Polish",     desc: "Helps refine UX, improve workflows, and keep the interface premium." },
]

const ENABLES = [
  "New feature development & improvements",
  "Infrastructure scaling & uptime",
  "Better integrations and workflows",
  "UI/UX refinement and product quality",
]

function FeatureCard({ icon: Icon, title, desc, delay, dark }) {
  const [hov, setHov] = useState(false);
  const card = dark ? '#1E1C10' : '#FFFDF5'
  const bdr  = dark ? 'rgba(245,166,35,0.2)' : 'rgba(245,166,35,0.15)'
  return (
    <div
      className="st-in rounded-2xl p-5 flex flex-col gap-3 cursor-default"
      style={{
        animationDelay: delay,
        background: hov ? (dark ? 'rgba(245,166,35,0.08)' : 'rgba(245,166,35,0.05)') : card,
        border: `1.5px solid ${hov ? 'rgba(245,166,35,0.45)' : bdr}`,
        boxShadow: hov ? '0 10px 32px rgba(245,166,35,0.14)' : '0 1px 4px rgba(0,0,0,0.05)',
        transform: hov ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'all .28s cubic-bezier(.22,1,.36,1)',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width:40, height:40, borderRadius:12,
        background:'linear-gradient(135deg,#F5A623,#FFCF6B)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transform: hov ? 'scale(1.12) rotate(-5deg)' : 'scale(1)',
        boxShadow: hov ? '0 6px 18px rgba(245,166,35,0.45)' : '0 2px 8px rgba(245,166,35,0.25)',
        transition:'all .3s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <Icon style={{ width:20, height:20, color:'#111' }} />
      </div>
      <div>
        <p style={{ fontWeight:700, fontSize:13.5, marginBottom:4, color: dark ? '#F2EDD8' : '#1A180F' }}>{title}</p>
        <p style={{ fontSize:12, lineHeight:1.6, color: dark ? '#A0967E' : '#6B6555' }}>{desc}</p>
      </div>
    </div>
  );
}

export default function SupportTeam() {
  const navigate = useNavigate();

  /* Read dark mode from data-theme attribute — reactive to changes */
  const [dark, setDark] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const [hovMain,    setHovMain]    = useState(false)
  const [hovBack,    setHovBack]    = useState(false)
  const [hovEnables, setHovEnables] = useState(null)

  /* Theme tokens */
  const surface = dark ? '#0E0D08' : '#FEFCF3'
  const card    = dark ? '#141208' : '#FFFDF5'
  const ink     = dark ? '#F2EDD8' : '#1A180F'
  const muted   = dark ? '#A0967E' : '#6B6555'
  const bdr     = dark ? 'rgba(245,166,35,0.22)' : 'rgba(245,166,35,0.18)'
  const innerBg = dark ? 'rgba(245,166,35,0.05)' : 'rgba(245,166,35,0.03)'
  const hbg     = dark ? 'rgba(245,166,35,0.1)' : 'rgba(245,166,35,0.06)'

  return (
    <>
      <style>{injectStyle}</style>
      <div
        className="st-root min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden"
        style={{ background: surface, transition:'background .3s' }}
      >
        {/* Ambient blobs */}
        <div className="st-blob1 absolute top-0 left-0 w-[480px] h-[480px] rounded-full pointer-events-none blur-3xl"
          style={{ background:'radial-gradient(circle,rgba(245,166,35,0.16),transparent 65%)' }} />
        <div className="st-blob2 absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full pointer-events-none blur-3xl"
          style={{ background:'radial-gradient(circle,rgba(255,207,107,0.12),transparent 65%)' }} />

        <div className="w-full max-w-2xl relative z-10">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: card,
              border: `1.5px solid ${bdr}`,
              boxShadow: dark
                ? '0 8px 48px rgba(0,0,0,0.45), 0 2px 16px rgba(0,0,0,0.3)'
                : '0 8px 48px rgba(245,166,35,0.11), 0 2px 16px rgba(0,0,0,0.05)',
              transition:'all .3s',
            }}
          >
            {/* Gold top bar */}
            <div style={{ height:6, background:'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)', backgroundSize:'200% auto' }} />

            <div style={{ padding:'32px 36px 28px' }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:48, height:48, borderRadius:14, flexShrink:0,
                    background:'linear-gradient(135deg,#F5A623,#FFCF6B)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 4px 16px rgba(245,166,35,0.38)',
                  }}>
                    <Heart style={{ width:22, height:22, color:'#111' }} />
                  </div>
                  <div>
                    <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:'-.03em', color:ink, lineHeight:1.15 }}>
                      Support Our Team
                    </h1>
                    <p style={{ fontSize:12, color:muted, marginTop:3, fontWeight:500 }}>Help us build something great</p>
                  </div>
                </div>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'6px 12px', borderRadius:50, flexShrink:0,
                  background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.28)',
                  color:'#c77d00', fontSize:12, fontWeight:600, whiteSpace:'nowrap',
                }}>
                  <ShieldCheck style={{ width:14, height:14 }} />
                  Secure Portal
                </div>
              </div>

              <p style={{ fontSize:13.5, lineHeight:1.7, color:muted, marginBottom:24 }}>
                Help us keep OpenSight reliable and improving — your support contributes to better performance,
                new features, and a smoother experience for everyone.
              </p>

              {/* 3 feature cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:18 }}
                className="grid-cols-1 sm:grid-cols-3">
                {FEATURE_CARDS.map((c, i) => (
                  <FeatureCard key={c.title} {...c} delay={`${i*70}ms`} dark={dark} />
                ))}
              </div>

              {/* What it enables */}
              <div
                style={{
                  borderRadius:18, padding:'18px 20px', marginBottom:24,
                  background: innerBg, border:`1.5px solid ${bdr}`,
                  transition:'all .3s',
                }}
              >
                <p style={{ fontSize:13.5, fontWeight:700, color:ink, marginBottom:12 }}>What your support enables</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px' }}>
                  {ENABLES.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display:'flex', alignItems:'flex-start', gap:8,
                        padding:'5px 8px', borderRadius:10, cursor:'default',
                        background: hovEnables === i ? hbg : 'transparent',
                        transform: hovEnables === i ? 'translateX(3px)' : 'translateX(0)',
                        transition:'all .2s ease',
                      }}
                      onMouseEnter={() => setHovEnables(i)}
                      onMouseLeave={() => setHovEnables(null)}
                    >
                      <CheckCircle2 style={{
                        width:15, height:15, color:'#F5A623', flexShrink:0, marginTop:2,
                        transform: hovEnables === i ? 'scale(1.15)' : 'scale(1)',
                        transition:'transform .2s',
                      }} />
                      <span style={{ fontSize:12, lineHeight:1.55, color:muted }}>{e}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA row */}
              <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <p style={{ fontSize:11.5, color:muted }}>
                  Opens in a new tab — secure external portal.
                </p>
                <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                  {/* Back */}
                  <button
                    onClick={() => navigate("/")}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'10px 20px', borderRadius:50,
                      border:`1.5px solid ${hovBack ? 'rgba(245,166,35,0.5)' : bdr}`,
                      color: hovBack ? '#F5A623' : muted,
                      background: hovBack ? hbg : 'transparent',
                      transform: hovBack ? 'translateY(-1px)' : 'translateY(0)',
                      fontSize:13.5, fontWeight:600, cursor:'pointer',
                      transition:'all .22s',
                    }}
                    onMouseEnter={() => setHovBack(true)}
                    onMouseLeave={() => setHovBack(false)}
                  >
                    <ArrowLeft style={{ width:15, height:15 }} />
                    Back
                  </button>

                  {/* Main CTA */}
                  <button
                    onClick={() => window.open(SUPPORT_URL, "_blank", "noopener,noreferrer")}
                    style={{
                      position:'relative', overflow:'hidden',
                      display:'flex', alignItems:'center', gap:7,
                      padding:'10px 22px', borderRadius:50, border:'none',
                      background:'linear-gradient(135deg,#F5A623,#FFCF6B)', color:'#111',
                      fontSize:13.5, fontWeight:700, cursor:'pointer',
                      boxShadow: hovMain ? '0 10px 30px rgba(245,166,35,0.52)' : '0 4px 16px rgba(245,166,35,0.32)',
                      transform: hovMain ? 'translateY(-2px)' : 'translateY(0)',
                      transition:'all .22s',
                    }}
                    onMouseEnter={() => setHovMain(true)}
                    onMouseLeave={() => setHovMain(false)}
                  >
                    <Heart style={{ width:15, height:15 }} />
                    Make Payment
                    <ExternalLink style={{ width:13, height:13, opacity:.75 }} />
                  </button>
                </div>
              </div>

              {/* Footer note */}
              <p style={{
                fontSize:11, color:muted, marginTop:20, paddingTop:16,
                borderTop:`1px solid ${bdr}`,
              }}>
                OpenSight uses a secure external portal for support contributions. You will be redirected to buymeacoffee.com.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}