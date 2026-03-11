import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STEPS = [
  {
    num:'1', titleKey:'howItWorks.step1.title', descKey:'howItWorks.step1.description',
    feats:['◈ Quick Setup','◉ No Experience Needed','◆ Instant Access'],
  },
  {
    num:'2', titleKey:'howItWorks.step2.title', descKey:'howItWorks.step2.description',
    feats:['◈ AI Analysis','◉ Real-time Insights','◆ Smart Alerts'],
  },
  {
    num:'3', titleKey:'howItWorks.step3.title', descKey:'howItWorks.step3.description',
    feats:['◈ Track Progress','◉ Optimize Strategy','◆ Scale Results'],
  },
]

export default function HowItWorks() {
  const { t } = useTranslation('landing')
  const stepRefs = useRef([])
  const [vis, setVis] = useState([false,false,false])

  useEffect(() => {
    const observers = stepRefs.current.map((el,i) => {
      if (!el) return null
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVis(v => { const n=[...v]; n[i]=true; return n }), i*160)
          obs.disconnect()
        }
      }, {threshold:0.15})
      obs.observe(el)
      return obs
    })
    return () => observers.forEach(o=>o?.disconnect())
  }, [])

  return (
    <section id="how-it-works" className="relative overflow-hidden py-24 px-7"
      style={{background:'var(--surface)',color:'var(--ink)',fontFamily:'Inter, system-ui, sans-serif'}}>

      {/* Mesh */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        background:`
          radial-gradient(ellipse 700px 500px at 50% 0%,rgba(245,166,35,.1) 0%,transparent 65%),
          radial-gradient(ellipse 400px 300px at 0% 80%,rgba(245,166,35,.07) 0%,transparent 65%),
          radial-gradient(ellipse 400px 300px at 100% 80%,rgba(245,166,35,.07) 0%,transparent 65%)
        `,
      }}/>
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage:'radial-gradient(circle,rgba(245,166,35,.16) 1px,transparent 1px)',
        backgroundSize:'34px 34px',
        maskImage:'radial-gradient(ellipse 70% 70% at 50% 50%,black 20%,transparent 100%)',
      }}/>

      <div className="max-w-[1100px] mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-18 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 tracking-wide"
            style={{background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.28)',color:'#F5A623'}}>
            <span className="w-1.5 h-1.5 rounded-full" style={{background:'#F5A623',boxShadow:'0 0 7px #F5A623',animation:'blink 2s infinite'}}/>
            Simple Process
          </div>
          <h2 className="font-extrabold leading-tight tracking-tight mb-4"
            style={{fontSize:'clamp(2.2rem,4vw,3.4rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.035em'}}>
            {t('howItWorks.title')}{' '}
            <span style={{color:'#F5A623',textShadow:'0 0 40px rgba(245,166,35,.22)'}}>{t('howItWorks.titleHighlight')}</span>
          </h2>
          <p className="text-lg leading-relaxed max-w-[580px] mx-auto" style={{color:'var(--muted)'}}>
            {t('howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid items-start gap-0"
          style={{gridTemplateColumns:'1fr 80px 1fr 80px 1fr'}}>
          {STEPS.map((step,i) => (
            <React.Fragment key={i}>
              {/* Step card */}
              <div
                ref={el=>stepRefs.current[i]=el}
                className="relative rounded-3xl p-8 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-2"
                style={{
                  background:'var(--card)',
                  border:`1px solid rgba(245,166,35,.18)`,
                  backdropFilter:'blur(14px)',
                  opacity: vis[i] ? 1 : 0,
                  transform: vis[i] ? 'translateY(0)' : 'translateY(30px)',
                  transition:`opacity .7s ease ${i*0.12}s, transform .7s ease ${i*0.12}s, box-shadow .3s, border-color .3s`,
                }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 24px 60px rgba(245,166,35,.2)';e.currentTarget.style.borderColor='rgba(245,166,35,.38)'}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='rgba(245,166,35,.18)'}}
              >
                {/* Top shimmer */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(245,166,35,.5),transparent)'}}/>

                {/* Number badge */}
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-xl mb-5"
                  style={{
                    background:'linear-gradient(135deg,#F5A623,#FFCF6B)',
                    color:'#1A180F',
                    fontFamily:'inherit',
                    boxShadow:'0 6px 20px rgba(245,166,35,.45)',
                  }}>
                  {step.num}
                  <span className="absolute inset-[-4px] rounded-[20px] pointer-events-none"
                    style={{border:'1.5px solid rgba(245,166,35,.25)'}}/>
                </div>

                <div className="font-extrabold text-xl mb-3 leading-tight" style={{color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.02em'}}>
                  {t(step.titleKey)}
                </div>
                <div className="text-sm leading-relaxed mb-5" style={{color:'var(--muted)'}}>{t(step.descKey)}</div>

                {/* Feature list */}
                <div className="flex flex-col gap-2">
                  {step.feats.map((f,j) => (
                    <div key={j} className="flex items-center gap-2.5 text-sm font-medium" style={{color:'var(--ink)'}}>
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 text-xs"
                        style={{background:'rgba(245,166,35,.12)',border:'1px solid rgba(245,166,35,.2)',color:'#F5A623'}}>
                        {f[0]}
                      </span>
                      {f.slice(2)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector arrow */}
              {i<2 && (
                <div className="flex items-center justify-center pt-12 hidden md:flex">
                  <div className="w-full h-px relative" style={{background:'linear-gradient(90deg,rgba(245,166,35,.15),rgba(245,166,35,.6),rgba(245,166,35,.15))'}}>
                    <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-xl leading-none" style={{color:'#F5A623'}}>›</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-20 relative rounded-3xl px-12 py-11 overflow-hidden flex items-center justify-between gap-7 flex-wrap"
          style={{
            background:'var(--card)',
            border:'1px solid rgba(245,166,35,.2)',
            backdropFilter:'blur(16px)',
            boxShadow:'0 20px 56px rgba(245,166,35,.1)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(245,166,35,.55),transparent)'}}/>
          <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 500px 300px at 100% 50%,rgba(245,166,35,.08) 0%,transparent 65%)'}}/>
          <div className="relative z-10">
            <div className="font-extrabold mb-2" style={{fontSize:'clamp(1.5rem,2.5vw,2rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.025em'}}>
              Ready to get started?
            </div>
            <div className="text-base" style={{color:'var(--muted)'}}>Join 18,500+ users already using OpenSightAI</div>
          </div>
          <div className="flex gap-3 flex-wrap relative z-10">
            <button
              onClick={()=>window.startFreeTrial?.()}
              className="relative overflow-hidden px-8 py-3.5 rounded-full font-bold text-sm cursor-pointer transition-all duration-300 hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
              style={{
                background:'linear-gradient(135deg,#F5A623,#FFCF6B,#E8940A)',
                color:'#1A180F',border:'none',
                boxShadow:'0 5px 22px rgba(245,166,35,.45),inset 0 1px 0 rgba(255,255,255,.3)',
                fontFamily:'inherit',
              }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 10px 32px rgba(245,166,35,.62),inset 0 1px 0 rgba(255,255,255,.3)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow='0 5px 22px rgba(245,166,35,.45),inset 0 1px 0 rgba(255,255,255,.3)'}
            >
              Start Free Trial →
            </button>
            
          </div>
        </div>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </section>
  )
}