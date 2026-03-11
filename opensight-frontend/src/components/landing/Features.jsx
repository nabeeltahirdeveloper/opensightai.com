import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

const TABS = [
  { id: 'chart',     label: 'chartAnalysis' },
  { id: 'tutor',     label: 'aiTutor' },
  { id: 'market',    label: 'marketAssessment' },
  { id: 'portfolio', label: 'portfolio' },
]

const Tick = () => (
  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
    style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',boxShadow:'0 3px 10px rgba(245,166,35,.4)'}}>
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <polyline points="2,6 5,9 10,3" stroke="#1A180F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

const Sparkline = () => (
  <svg viewBox="0 0 400 120" fill="none" className="absolute inset-0 w-full h-full">
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F5A623" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#F5A623" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,90 C40,85 60,70 100,60 C140,50 160,75 200,45 C240,20 260,35 300,25 C340,15 360,30 400,10"
      stroke="#F5A623" strokeWidth="2.5" fill="none"/>
    <path d="M0,90 C40,85 60,70 100,60 C140,50 160,75 200,45 C240,20 260,35 300,25 C340,15 360,30 400,10 L400,120 L0,120 Z"
      fill="url(#sg)"/>
  </svg>
)

/* Shared card shell */
const Card = ({children, className=''}) => (
  <div className={`relative rounded-3xl p-7 overflow-hidden ${className}`}
    style={{
      background:'var(--card)',
      border:'1px solid rgba(245,166,35,.2)',
      backdropFilter:'blur(16px)',
      boxShadow:'0 20px 56px rgba(245,166,35,.1),0 4px 16px rgba(0,0,0,.04)',
    }}>
    <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(245,166,35,.5),transparent)'}}/>
    {children}
  </div>
)

const GoldBtn = ({children, onClick, full=false}) => (
  <button onClick={onClick}
    className={`relative overflow-hidden px-7 py-3.5 rounded-full font-bold text-sm cursor-pointer transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${full?'w-full justify-center flex':'inline-flex'}`}
    style={{
      background:'linear-gradient(135deg,#F5A623,#FFCF6B,#E8940A)',
      color:'#1A180F',border:'none',
      boxShadow:'0 5px 22px rgba(245,166,35,.45),inset 0 1px 0 rgba(255,255,255,.3)',
      fontFamily:'inherit',
    }}
    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 10px 32px rgba(245,166,35,.62),inset 0 1px 0 rgba(255,255,255,.3)'}
    onMouseLeave={e=>e.currentTarget.style.boxShadow='0 5px 22px rgba(245,166,35,.45),inset 0 1px 0 rgba(255,255,255,.3)'}
  >{children}</button>
)

export default function Features() {
  const { t } = useTranslation('landing')
  const [active, setActive] = useState('chart')

  return (
    <section id="features" className="relative overflow-hidden py-24 px-7"
      style={{background:'var(--surface)',color:'var(--ink)',fontFamily:'Inter, system-ui, sans-serif'}}>

      {/* Mesh */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        background:`radial-gradient(ellipse 600px 400px at 100% 0%,rgba(245,166,35,.09) 0%,transparent 65%),
          radial-gradient(ellipse 400px 300px at 0% 100%,rgba(245,166,35,.07) 0%,transparent 65%)`,
      }}/>

      <div className="max-w-[1260px] mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 tracking-wide"
            style={{background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.28)',color:'#F5A623'}}>
            <span className="w-1.5 h-1.5 rounded-full" style={{background:'#F5A623',boxShadow:'0 0 7px #F5A623',animation:'blink 2s infinite'}}/>
            Platform Features
          </div>
          <h2 className="font-extrabold leading-tight tracking-tight mb-4"
            style={{fontSize:'clamp(2.2rem,4vw,3.4rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.035em'}}>
            {t('features.title').replace(t('features.titleHighlight'),'').trim()}{' '}
            <span style={{color:'#F5A623',textShadow:'0 0 40px rgba(245,166,35,.22)'}}>{t('features.titleHighlight')}</span>
          </h2>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{color:'var(--muted)'}}>{t('features.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center flex-wrap gap-2 mb-14 p-1.5 rounded-2xl w-fit mx-auto"
          style={{background:'rgba(245,166,35,.06)',border:'1px solid rgba(245,166,35,.18)'}}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActive(tab.id)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap relative overflow-hidden"
              style={{
                background: active===tab.id ? 'linear-gradient(135deg,#F5A623,#FFCF6B)' : 'transparent',
                color: active===tab.id ? '#1A180F' : 'var(--muted)',
                border:'none',fontFamily:'inherit',
                boxShadow: active===tab.id ? '0 4px 16px rgba(245,166,35,.35)' : 'none',
              }}
            >
              {t(`features.${tab.label}`)}
            </button>
          ))}
        </div>

        {/* ── CHART ANALYSIS ── */}
        {active==='chart' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <h3 className="font-extrabold mb-4 leading-tight" style={{fontSize:'clamp(1.8rem,3.2vw,2.6rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.03em'}}>
                {t('features.liveChartAnalytics.title')}
              </h3>
              <p className="text-base leading-relaxed mb-7" style={{color:'var(--muted)'}}>{t('features.liveChartAnalytics.description')}</p>
              <div className="flex flex-col gap-4 mb-7">
                {[
                  {title:t('features.liveChartAnalytics.indicators'),       desc:t('features.liveChartAnalytics.indicatorsDesc')},
                  {title:t('features.liveChartAnalytics.patternRecognition'),desc:t('features.liveChartAnalytics.patternRecognitionDesc')},
                  {title:t('features.liveChartAnalytics.marketAssessmentTools'),desc:t('features.liveChartAnalytics.marketAssessmentToolsDesc')},
                ].map((c,i) => (
                  <div key={i} className="flex items-start gap-3.5">
                    <Tick/>
                    <div>
                      <div className="font-bold text-sm mb-1" style={{color:'var(--ink)'}}>{c.title}</div>
                      <div className="text-sm leading-relaxed" style={{color:'var(--muted)'}}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <GoldBtn onClick={()=>window.openChartAnalyzer?.()}>{t('features.liveChartAnalytics.tryChartAnalyzer')} →</GoldBtn>
            </div>
            <Card>
              <div className="border-dashed border-2 rounded-2xl p-9 text-center cursor-pointer transition-all duration-300 hover:scale-[1.01] mb-3"
                style={{borderColor:'rgba(245,166,35,.38)',background:'rgba(245,166,35,.03)'}}
                onClick={()=>document.getElementById('chartUpload').click()}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#F5A623';e.currentTarget.style.background='rgba(245,166,35,.07)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(245,166,35,.38)';e.currentTarget.style.background='rgba(245,166,35,.03)'}}>
                <div className="text-5xl mb-3">⬆</div>
                <div className="font-bold text-base mb-1.5" style={{color:'var(--ink)'}}>{t('features.uploadChartScreenshot')}</div>
                <div className="text-sm" style={{color:'var(--muted)'}}>{t('features.dragDropOrClick')}</div>
                <input type="file" id="chartUpload" className="hidden" accept="image/*" onChange={e=>window.handleChartUpload?.(e.target)}/>
              </div>
              <div className="text-xs" style={{color:'var(--muted)'}}>
                {t('features.freeDemoAnalyses')}: <span style={{color:'#F5A623',fontWeight:700}}><span id="demoTryCounter">0/3</span></span>
              </div>
              <div id="analysisProgress" className="hidden mt-4">
                <div className="flex justify-between text-xs mb-1.5" style={{color:'var(--muted)'}}>
                  <span>{t('features.analyzingChart')}</span>
                  <span id="progressText" style={{color:'#F5A623',fontWeight:700}}>0%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(245,166,35,.12)'}}>
                  <div id="progressFill" className="h-full rounded-full" style={{width:'0%',background:'linear-gradient(90deg,#F5A623,#FFCF6B)',boxShadow:'0 0 8px rgba(245,166,35,.4)'}}/>
                </div>
              </div>
              <div id="analysisResults" className="hidden mt-5 p-3.5 rounded-2xl"
                style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.25)'}}>
                <div className="font-bold text-sm mb-1.5" style={{color:'#16a34a'}}>{t('features.analysisComplete')}</div>
                <div className="text-xs leading-relaxed" style={{color:'#166534'}}>{t('features.analysisCompleteDesc')}</div>
              </div>
            </Card>
          </div>
        )}

        {/* ── AI TUTOR ── */}
        {active==='tutor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',boxShadow:'0 3px 12px rgba(245,166,35,.4)'}}>◎</div>
                <div className="font-bold text-sm" style={{color:'var(--ink)'}}>{t('features.aiTutorSection.aiAgentTeacher')}</div>
              </div>
              <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto mb-4 pr-1 scrollbar-thin">
                {[
                  {ai:true,  text:"Hello! I'm your AI Agent Teacher. What would you like to learn today?"},
                  {ai:false, text:"Can you explain support and resistance levels?"},
                  {ai:true,  text:"Support and resistance are key concepts in technical analysis. Support is where demand prevents further decline, while resistance is where selling pressure halts price rises."},
                ].map((m,i) => (
                  <div key={i} className="max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      alignSelf: m.ai ? 'flex-start' : 'flex-end',
                      background: m.ai ? 'rgba(245,166,35,.09)' : 'linear-gradient(135deg,#F5A623,#FFCF6B)',
                      border: m.ai ? '1px solid rgba(245,166,35,.18)' : 'none',
                      borderRadius: m.ai ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                      color: m.ai ? 'var(--ink)' : '#1A180F',
                      fontWeight: m.ai ? 400 : 600,
                    }}>{m.text}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <input id="tutorInput" type="text" placeholder={t('features.aiTutorSection.askAnything')}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none transition-all duration-200"
                  style={{background:'transparent',border:'1.5px solid rgba(245,166,35,.22)',color:'var(--ink)',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor='#F5A623'}
                  onBlur={e=>e.target.style.borderColor='rgba(245,166,35,.22)'}/>
                <button className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-base transition-all duration-200 hover:scale-110 active:scale-90"
                  style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',color:'#1A180F',border:'none',cursor:'pointer',boxShadow:'0 3px 12px rgba(245,166,35,.4)'}}
                  onClick={()=>window.sendTutorMessage?.()}>→</button>
              </div>
              <div className="text-xs mt-2.5" style={{color:'var(--muted)'}}>
                {t('features.aiTutorSection.freeTutorMessages')}: <span style={{color:'#F5A623',fontWeight:700}}><span id="tutorCreditsCounter">0/20</span></span>
              </div>
            </Card>
            <div>
              <h3 className="font-extrabold mb-4 leading-tight" style={{fontSize:'clamp(1.8rem,3.2vw,2.6rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.03em'}}>
                {t('features.aiTutorSection.title')}
              </h3>
              <p className="text-base leading-relaxed mb-7" style={{color:'var(--muted)'}}>{t('features.aiTutorSection.description')}</p>
              <div className="flex flex-col gap-4 mb-7">
                {[
                  {title:t('features.aiTutorSection.personalizedLearning'),desc:t('features.aiTutorSection.personalizedLearningDesc')},
                  {title:t('features.aiTutorSection.progressTracking'),    desc:t('features.aiTutorSection.progressTrackingDesc')},
                  {title:t('features.aiTutorSection.communityLearning'),   desc:t('features.aiTutorSection.communityLearningDesc')},
                ].map((c,i) => (
                  <div key={i} className="flex items-start gap-3.5">
                    <Tick/>
                    <div>
                      <div className="font-bold text-sm mb-1" style={{color:'var(--ink)'}}>{c.title}</div>
                      <div className="text-sm leading-relaxed" style={{color:'var(--muted)'}}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <GoldBtn onClick={()=>window.startLearning?.()}>{t('features.aiTutorSection.startLearning')} →</GoldBtn>
            </div>
          </div>
        )}

        {/* ── MARKET ASSESSMENT ── */}
        {active==='market' && (
          <div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
                style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',boxShadow:'0 6px 22px rgba(245,166,35,.4)'}}>◈</div>
              <h3 className="font-extrabold mb-3 tracking-tight" style={{fontSize:'clamp(1.8rem,3.2vw,2.6rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.03em'}}>
                {t('features.marketAssessmentSection.title')}
              </h3>
              <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{color:'var(--muted)'}}>{t('features.marketAssessmentSection.description')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {ico:'◆',title:t('features.marketAssessmentSection.positionSizing'),         desc:t('features.marketAssessmentSection.positionSizingDesc'),        btn:t('features.marketAssessmentSection.useCalculator')},
                {ico:'◉',title:t('features.marketAssessmentSection.marketConditionAnalysis'), desc:t('features.marketAssessmentSection.marketConditionAnalysisDesc'),btn:t('features.marketAssessmentSection.assessMarket')},
                {ico:'◇',title:t('features.marketAssessmentSection.portfolioOptimization'),   desc:t('features.marketAssessmentSection.portfolioOptimizationDesc'),  btn:t('features.marketAssessmentSection.optimizePortfolio')},
              ].map((c,i) => (
                <div key={i}
                  className="text-center relative rounded-3xl p-7 overflow-hidden transition-all duration-300 hover:-translate-y-2"
                  style={{
                    background:'var(--card)',border:'1px solid rgba(245,166,35,.18)',
                    backdropFilter:'blur(14px)',boxShadow:'0 8px 28px rgba(0,0,0,.05)',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 20px 52px rgba(245,166,35,.18)';e.currentTarget.style.borderColor='rgba(245,166,35,.38)'}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.05)';e.currentTarget.style.borderColor='rgba(245,166,35,.18)'}}>
                  <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(245,166,35,.4),transparent)'}}/>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5"
                    style={{background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.2)'}}>{c.ico}</div>
                  <div className="font-bold text-lg mb-2.5" style={{color:'var(--ink)',fontFamily:'inherit'}}>{c.title}</div>
                  <div className="text-sm leading-relaxed mb-5" style={{color:'var(--muted)'}}>{c.desc}</div>
                  <GoldBtn full>{c.btn} →</GoldBtn>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PORTFOLIO ── */}
        {active==='portfolio' && (
          <div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
                style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',boxShadow:'0 6px 22px rgba(245,166,35,.4)'}}>◇</div>
              <h3 className="font-extrabold mb-3 tracking-tight" style={{fontSize:'clamp(1.8rem,3.2vw,2.6rem)',color:'var(--ink)',fontFamily:'inherit',letterSpacing:'-.03em'}}>
                {t('features.portfolioSection.title')}
              </h3>
              <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{color:'var(--muted)'}}>{t('features.portfolioSection.description')}</p>
            </div>
            <Card className="mb-6">
              <div className="relative h-44 rounded-2xl overflow-hidden mb-5"
                style={{background:'rgba(245,166,35,.05)',border:'1px solid rgba(245,166,35,.15)'}}>
                <Sparkline/>
              </div>
              <canvas id="portfolioChart" className="hidden"/>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {num:'$125,430',col:'#F5A623', lbl:t('features.portfolioSection.totalPortfolioValue')},
                {num:'+12.5%', col:'#22C55E', lbl:t('features.portfolioSection.monthlyReturn')},
                {num:'1.24',   col:'#60a5fa', lbl:t('features.portfolioSection.sharpeRatio')},
                {num:'15.2%',  col:'#F5A623', lbl:t('features.portfolioSection.maxDrawdown')},
              ].map((s,i) => (
                <div key={i} className="text-center rounded-2xl p-4.5 py-5 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background:'var(--card)',
                    border:'1px solid rgba(245,166,35,.18)',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 14px 36px rgba(245,166,35,.15)';e.currentTarget.style.borderColor='rgba(245,166,35,.38)'}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='rgba(245,166,35,.18)'}}>
                  <div className="font-extrabold text-2xl mb-1" style={{color:s.col,fontFamily:'inherit'}}>{s.num}</div>
                  <div className="text-xs" style={{color:'var(--muted)'}}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </section>
  )
}