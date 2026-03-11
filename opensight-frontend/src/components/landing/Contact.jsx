import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .ct * { box-sizing:border-box; font-family:'Inter',system-ui,sans-serif; }

  @keyframes ct-up   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes ct-grad { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes ct-spin { to{transform:rotate(360deg)} }
  @keyframes ct-pop  { 0%{opacity:0;transform:scale(0)} 60%{transform:scale(1.15)} 100%{opacity:1;transform:scale(1)} }
  @keyframes ct-dot  { 0%,100%{box-shadow:0 0 0 0 rgba(245,166,35,.5)} 50%{box-shadow:0 0 0 5px rgba(245,166,35,0)} }

  .ct-in  { animation:ct-up .6s cubic-bezier(.22,1,.36,1) both; }
  .ct-ok  { animation:ct-up .4s ease both; }
  .ct-chk { animation:ct-pop .5s .1s cubic-bezier(.22,1,.36,1) both; }

  /* label */
  .ct-lbl { position:absolute; left:16px; pointer-events:none; z-index:2; font-weight:500;
    transition: top .45s ease, font-size .45s ease, color .45s ease, letter-spacing .45s ease; }
  .ct-lbl-i  { top:50%; transform:translateY(-50%); font-size:14px; }
  .ct-lbl-a  { top:9px; transform:none; font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
  .ct-lbl-ti { top:15px; transform:none; font-size:14px; }
  .ct-lbl-ta { top:9px;  transform:none; font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }

  /* input */
  .ct-inp, .ct-ta {
    width:100%; border-radius:12px; font-size:14px; font-weight:500; outline:none;
    font-family:inherit; -webkit-appearance:none;
    transition: border-color .5s ease, box-shadow .5s ease, background .5s ease;
  }
  .ct-inp { padding:22px 16px 8px; height:54px; }
  .ct-ta  { padding:28px 16px 10px; resize:vertical; min-height:130px; }
  .ct-inp:hover, .ct-ta:hover { border-color:rgba(245,166,35,.4) !important; }

  /* icon */
  .ct-ico {
    width:38px; height:38px; border-radius:10px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; font-size:17px;
    transition: background .55s ease, box-shadow .55s ease, transform .55s ease, border-color .55s ease;
  }

  /* row bg */
  .ct-row { display:flex; align-items:flex-start; gap:14px; padding:15px 20px; border-radius:12px;
    transition: background .5s ease; cursor:default; }

  /* submit */
  .ct-sub { width:100%; padding:14px 24px; border-radius:12px; border:none; cursor:pointer;
    font-size:14.5px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;
    transition: transform .4s ease, box-shadow .4s ease; }
  .ct-sub:hover  { transform:translateY(-2px); }
  .ct-sub:active { transform:none; }
`

function Field({ label, name, type='text', textarea, value, onChange, required, dark }) {
  const [f, setF] = useState(false)
  const on = f || !!value
  const muted = dark ? '#6A6050' : '#9A9282'
  const s = {
    background: f ? (dark?'rgba(245,166,35,.05)':'rgba(245,166,35,.03)') : (dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.025)'),
    border: `1.5px solid ${f ? '#F5A623' : (dark?'rgba(255,255,255,.1)':'rgba(0,0,0,.1)')}`,
    color: dark ? '#F2EDD8' : '#1A180F',
    boxShadow: f ? '0 0 0 4px rgba(245,166,35,.1)' : 'none',
  }
  const lc = textarea ? (on?'ct-lbl ct-lbl-ta':'ct-lbl ct-lbl-ti') : (on?'ct-lbl ct-lbl-a':'ct-lbl ct-lbl-i')
  return (
    <div style={{position:'relative',width:'100%'}}>
      <label className={lc} style={{color: on?'#F5A623':muted}}>{label}</label>
      {textarea
        ? <textarea className="ct-ta" {...{name,required,value,onChange}} rows={5} onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={s}/>
        : <input className="ct-inp" {...{name,type,required,value,onChange}} onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={s}/>}
    </div>
  )
}

function InfoRow({ icon, title, value, link, desc, dark }) {
  const [h, setH] = useState(false)
  const ink   = dark ? '#F2EDD8' : '#1A180F'
  const muted = dark ? '#6A6050' : '#9A9282'
  return (
    <div className="ct-row" style={{background: h?(dark?'rgba(245,166,35,.06)':'rgba(245,166,35,.04)'):'transparent'}}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
      <div className="ct-ico" style={{
        background: h ? 'linear-gradient(135deg,#F5A623,#FFCF6B)' : 'rgba(245,166,35,.12)',
        border: `1.5px solid ${h?'rgba(245,166,35,.5)':'rgba(245,166,35,.22)'}`,
        color: h ? '#1A180F' : '#F5A623',
        transform: h ? 'scale(1.1) rotate(-4deg)' : 'scale(1)',
        boxShadow: h ? '0 6px 18px rgba(245,166,35,.25)' : 'none',
      }}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:10.5,fontWeight:700,color:'#F5A623',margin:'0 0 3px',letterSpacing:'.08em',textTransform:'uppercase',opacity:.85}}>{title}</p>
        {link
          ? <a href={link} style={{fontSize:14,fontWeight:600,color:ink,textDecoration:'none',transition:'color .4s ease'}}
              onMouseEnter={e=>e.currentTarget.style.color='#F5A623'} onMouseLeave={e=>e.currentTarget.style.color=ink}>{value}</a>
          : <p style={{fontSize:14,fontWeight:600,color:ink,margin:0,lineHeight:1.55,whiteSpace:'pre-line'}}>{value}</p>}
        {desc && <p style={{fontSize:12,color:muted,margin:'3px 0 0'}}>{desc}</p>}
      </div>
    </div>
  )
}

export default function Contact() {
  const { t } = useTranslation('landing')
  const [dark, setDark] = useState(()=>document.documentElement.getAttribute('data-theme')==='dark')
  const [form, setForm] = useState({fname:'',lname:'',email:'',subject:'',message:''})
  const [st, setSt] = useState('idle')

  useEffect(()=>{
    const obs = new MutationObserver(()=>setDark(document.documentElement.getAttribute('data-theme')==='dark'))
    obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    return ()=>obs.disconnect()
  },[])

  const ink    = dark ? '#F2EDD8' : '#1A180F'
  const muted  = dark ? '#6A6050' : '#9A9282'
  const cardBg = dark ? '#121108' : '#fff'
  const cardBd = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const divBd  = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'
  const shadow = dark ? '0 12px 48px rgba(0,0,0,.35)' : '0 12px 48px rgba(0,0,0,.07)'

  const handle = e => setForm(p=>({...p,[e.target.name]:e.target.value}))
  const submit = e => { e.preventDefault(); setSt('loading'); setTimeout(()=>setSt('success'),1800); window.submitContactForm?.(e) }

  return (
    <>
      <style>{CSS}</style>
      <section id="contact" className="ct" style={{background:dark?'#0E0D08':'#FEFCF3',padding:'100px 0 96px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'15%',left:'50%',transform:'translateX(-50%)',width:900,height:600,borderRadius:'50%',pointerEvents:'none',background:'radial-gradient(ellipse,rgba(245,166,35,.05),transparent 65%)'}}/>

        <div style={{maxWidth:1100,margin:'0 auto',padding:'0 24px',position:'relative',zIndex:1}}>

          {/* Header */}
          <div className="ct-in" style={{textAlign:'center',marginBottom:72}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 16px',borderRadius:50,marginBottom:22,background:'rgba(245,166,35,.1)',border:'1.5px solid rgba(245,166,35,.22)'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#F5A623',animation:'ct-dot 2s ease infinite',display:'inline-block'}}/>
              <span style={{fontSize:11.5,fontWeight:700,color:'#F5A623',letterSpacing:'.08em',textTransform:'uppercase'}}>Get in Touch</span>
            </div>
            <h2 style={{fontSize:'clamp(32px,5vw,54px)',fontWeight:900,color:ink,margin:'0 0 18px',letterSpacing:'-.04em',lineHeight:1.08}}>
              We'd love to{' '}
              <span style={{background:'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'ct-grad 3s ease infinite'}}>
                hear from you
              </span>
            </h2>
            <p style={{fontSize:'clamp(14px,1.8vw,17px)',color:muted,maxWidth:480,margin:'0 auto',lineHeight:1.7}}>
              Have a question or want to get started? Drop us a message and we'll get back to you shortly.
            </p>
          </div>

          {/* Grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:28,alignItems:'start'}}>

            {/* Form card */}
            <div className="ct-in" style={{animationDelay:'60ms',background:cardBg,border:`1px solid ${cardBd}`,borderRadius:20,boxShadow:shadow,overflow:'hidden'}}>
              <div style={{height:3,background:'linear-gradient(90deg,#F5A623,#FFCF6B,#F5A623)',borderRadius:'20px 20px 0 0'}}/>
              <div style={{padding:'28px 28px 32px'}}>
                <h3 style={{fontSize:18,fontWeight:800,color:ink,margin:'0 0 4px',letterSpacing:'-.02em'}}>Send a message</h3>
                <p style={{fontSize:13.5,color:muted,margin:'0 0 24px',lineHeight:1.55}}>We reply within 2 hours on business days.</p>

                {st==='success' ? (
                  <div className="ct-ok" style={{textAlign:'center',padding:'28px 0'}}>
                    <div className="ct-chk" style={{width:58,height:58,borderRadius:'50%',background:'rgba(245,166,35,.12)',border:'2px solid rgba(245,166,35,.35)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:24,color:'#F5A623'}}>✓</div>
                    <h4 style={{fontSize:17,fontWeight:800,color:ink,margin:'0 0 6px'}}>Message sent!</h4>
                    <p style={{fontSize:13.5,color:muted,margin:'0 0 20px'}}>We'll get back to you within 2 hours.</p>
                    <button onClick={()=>{setSt('idle');setForm({fname:'',lname:'',email:'',subject:'',message:''})}}
                      style={{padding:'8px 22px',borderRadius:10,border:`1.5px solid ${divBd}`,background:'transparent',color:muted,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .4s ease'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(245,166,35,.45)';e.currentTarget.style.color='#F5A623'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=divBd;e.currentTarget.style.color=muted}}>
                      Send another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <Field label="First Name" name="fname" dark={dark} value={form.fname} onChange={handle} required/>
                      <Field label="Last Name"  name="lname" dark={dark} value={form.lname} onChange={handle} required/>
                    </div>
                    <Field label="Email Address" type="email" name="email"   dark={dark} value={form.email}   onChange={handle} required/>
                    <Field label="Subject"                    name="subject" dark={dark} value={form.subject} onChange={handle} required/>
                    <Field label="Your message"               name="message" dark={dark} value={form.message} onChange={handle} textarea required/>
                    <button type="submit" className="ct-sub" disabled={st==='loading'}
                      style={{background:'linear-gradient(135deg,#F5A623,#FFCF6B)',color:'#1A180F',boxShadow:'0 2px 14px rgba(245,166,35,.35)',marginTop:4,opacity:st==='loading'?.85:1}}
                      onMouseEnter={e=>{if(st!=='loading')e.currentTarget.style.boxShadow='0 8px 28px rgba(245,166,35,.55)'}}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 14px rgba(245,166,35,.35)'}>
                      {st==='loading'
                        ? <><span style={{width:15,height:15,border:'2px solid rgba(26,24,15,.25)',borderTopColor:'#1A180F',borderRadius:'50%',animation:'ct-spin .7s linear infinite',display:'inline-block',flexShrink:0}}/> Sending…</>
                        : 'Send Message →'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="ct-in" style={{animationDelay:'120ms',background:cardBg,border:`1px solid ${cardBd}`,borderRadius:20,boxShadow:shadow,overflow:'hidden'}}>
              <div style={{padding:'28px 8px 24px'}}>
                <div style={{padding:'0 20px',marginBottom:8}}>
                  <h3 style={{fontSize:18,fontWeight:800,color:ink,margin:'0 0 4px',letterSpacing:'-.02em'}}>Contact Information</h3>
                  <p style={{fontSize:13.5,color:muted,margin:0,lineHeight:1.55}}>Multiple ways to reach our team.</p>
                </div>
                <div style={{marginTop:16}}>
                  <InfoRow icon="✉" title="Email"  value="support@OpenSightai.com" link="mailto:support@OpenSightai.com" desc="Typically replies in under 2 hours" dark={dark}/>
                  <div style={{height:1,background:divBd,margin:'2px 20px'}}/>
                  <InfoRow icon="☏" title="Phone"  value="+44 7537 106208" link="tel:+447537106208" desc="Mon–Fri, 9am – 6pm GMT" dark={dark}/>
                  <div style={{height:1,background:divBd,margin:'2px 20px'}}/>
                  <InfoRow icon="◎" title="Company" value={"The Seacus Company LTD\nRegistered under the Civil & Commercial code\nBusiness Registration office, Samut Prakan Province\nCompany registration number: 0115569002129"} dark={dark}/>
                  <div style={{height:1,background:divBd,margin:'2px 20px'}}/>
                  <InfoRow icon="◷" title="Hours"  value={"Monday – Friday\n9:00 AM – 6:00 PM GMT"} desc="Closed on UK public holidays" dark={dark}/>
                </div>
                <div style={{margin:'16px 12px 4px',padding:'13px 16px',borderRadius:10,background:'rgba(245,166,35,.05)',border:'1px solid rgba(245,166,35,.15)'}}>
                  <p style={{fontSize:12.5,color:muted,margin:0,lineHeight:1.65}}>Your data is encrypted and never shared with third parties.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  )
}