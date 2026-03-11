import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const CSS = `
  @keyframes cw-breathe {
    0%,100% { box-shadow: 0 6px 28px rgba(245,166,35,.55), 0 0 0 0 rgba(245,166,35,.4); }
    50%      { box-shadow: 0 6px 28px rgba(245,166,35,.55), 0 0 0 10px rgba(245,166,35,0); }
  }
  @keyframes cw-ring {
    0%   { transform: scale(1);   opacity: .7; }
    100% { transform: scale(1.7); opacity: 0;  }
  }
  @keyframes cw-badge-pop {
    0%   { transform: scale(0) rotate(-20deg); }
    70%  { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes cw-slide-up {
    from { opacity:0; transform: translateY(18px) scale(.95); }
    to   { opacity:1; transform: translateY(0)    scale(1);   }
  }
  @keyframes cw-msg-in {
    from { opacity:0; transform: translateY(7px); }
    to   { opacity:1; transform: translateY(0);   }
  }
  @keyframes cw-dot {
    0%,80%,100% { transform: scale(.65); opacity:.35; }
    40%         { transform: scale(1);   opacity:1;   }
  }
  @keyframes cw-icon-wiggle {
    0%,100% { transform: rotate(0deg); }
    20%     { transform: rotate(-12deg); }
    40%     { transform: rotate(10deg); }
    60%     { transform: rotate(-7deg); }
    80%     { transform: rotate(5deg); }
  }

  /* ── FAB ── */
  .cw-fab-wrap {
    position: fixed; bottom: 28px; right: 28px; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; gap: 0;
  }

  .cw-fab {
    position: relative;
    width: 62px; height: 62px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(145deg, #FFCF6B 0%, #F5A623 55%, #E0870A 100%);
    display: flex; align-items: center; justify-content: center;
    animation: cw-breathe 2.8s ease-in-out infinite;
    transition: transform .25s, filter .25s;
    outline: none;
  }
  .cw-fab:hover {
    transform: scale(1.1);
    filter: brightness(1.08);
    animation: cw-icon-wiggle .5s ease, cw-breathe 2.8s ease-in-out 0.5s infinite;
  }
  .cw-fab:active { transform: scale(.95); }

  /* Pulse ring */
  .cw-ring {
    position: absolute; inset: -5px; border-radius: 50%;
    border: 2.5px solid rgba(245,166,35,.5);
    animation: cw-ring 2.2s ease-out infinite;
    pointer-events: none;
  }
  .cw-ring2 {
    position: absolute; inset: -5px; border-radius: 50%;
    border: 2.5px solid rgba(245,166,35,.3);
    animation: cw-ring 2.2s ease-out .7s infinite;
    pointer-events: none;
  }

  /* Chat bubble SVG icon */
  .cw-icon {
    width: 32px; height: 32px;
    position: relative; z-index: 1;
    transition: transform .25s;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.2));
  }
  .cw-fab:hover .cw-icon { transform: scale(1.08); }

  /* Notification badge — teal like screenshot */
  .cw-badge {
    position: absolute; top: -3px; right: -3px;
    min-width: 20px; height: 20px; border-radius: 50%;
    background: linear-gradient(135deg, #0fb8c9, #0891b2);
    color: #fff; font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 2.5px solid #fff;
    box-shadow: 0 2px 10px rgba(8,145,178,.55);
    animation: cw-badge-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    font-family: Inter, system-ui, sans-serif;
    padding: 0 3px;
    z-index: 2;
  }
  [data-theme="dark"] .cw-badge { border-color: #0E0D08; }

  /* ── Panel ── */
  .cw-panel {
    position: fixed; bottom: 104px; right: 28px; z-index: 9998;
    width: 338px; border-radius: 22px; overflow: hidden;
    background: var(--card, #FFFDF5);
    border: 1px solid rgba(245,166,35,.22);
    box-shadow: 0 28px 72px rgba(0,0,0,.16), 0 0 0 1px rgba(245,166,35,.1);
    animation: cw-slide-up .32s cubic-bezier(.34,1.3,.64,1) both;
    font-family: Inter, system-ui, sans-serif;
    display: flex; flex-direction: column;
  }
  [data-theme="dark"] .cw-panel { background: rgba(18,16,10,.97); }
  .cw-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(245,166,35,.6), transparent);
    z-index: 1;
  }

  /* Header */
  .cw-head {
    background: linear-gradient(135deg, #F5A623 0%, #FFCF6B 55%, #E8940A 100%);
    padding: 15px 17px;
    display: flex; align-items: center; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  .cw-head::after {
    content: ''; position: absolute; top: -28px; right: -16px;
    width: 88px; height: 88px; border-radius: 50%;
    background: rgba(255,255,255,.13); pointer-events: none;
  }
  .cw-head-left { display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
  .cw-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(0,0,0,.15);
    border: 2px solid rgba(255,255,255,.4);
    display: flex; align-items: center; justify-content: center; font-size: 17px;
  }
  .cw-head-name { font-size: 14px; font-weight: 700; color: #111; }
  .cw-head-sub {
    font-size: 11px; color: rgba(0,0,0,.55);
    display: flex; align-items: center; gap: 4px; margin-top: 1px;
  }
  .cw-online { width: 6px; height: 6px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 6px #16a34a; }
  .cw-x {
    width: 29px; height: 29px; border-radius: 8px; border: none; cursor: pointer;
    background: rgba(0,0,0,.12); color: #222; font-size: 17px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    transition: background .2s; position: relative; z-index: 1;
  }
  .cw-x:hover { background: rgba(0,0,0,.2); }

  /* Messages */
  .cw-msgs {
    flex: 1; padding: 14px; max-height: 210px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 9px;
    background: var(--surface, #FEFCF3);
  }
  [data-theme="dark"] .cw-msgs { background: rgba(14,12,8,.9); }
  .cw-msgs::-webkit-scrollbar { width: 3px; }
  .cw-msgs::-webkit-scrollbar-thumb { background: rgba(245,166,35,.25); border-radius: 3px; }

  .cw-ai {
    align-self: flex-start; max-width: 88%;
    background: rgba(245,166,35,.1); border: 1px solid rgba(245,166,35,.2);
    border-radius: 14px 14px 14px 4px;
    padding: 9px 13px; font-size: 13px; line-height: 1.6;
    color: var(--ink, #1A180F);
    animation: cw-msg-in .22s ease both;
  }
  .cw-usr {
    align-self: flex-end; max-width: 88%;
    background: linear-gradient(135deg, #F5A623, #FFCF6B);
    border-radius: 14px 14px 4px 14px;
    padding: 9px 13px; font-size: 13px; line-height: 1.6;
    color: #111; font-weight: 500;
    animation: cw-msg-in .22s ease both;
  }
  .cw-typing {
    align-self: flex-start; display: flex; align-items: center; gap: 4px;
    padding: 10px 13px;
    background: rgba(245,166,35,.08); border: 1px solid rgba(245,166,35,.15);
    border-radius: 14px 14px 14px 4px;
    animation: cw-msg-in .22s ease both;
  }
  .cw-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: #F5A623;
    animation: cw-dot .8s ease-in-out infinite;
  }
  .cw-typing span:nth-child(2) { animation-delay: .14s; }
  .cw-typing span:nth-child(3) { animation-delay: .28s; }

  /* Chips */
  .cw-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 14px 10px; }
  .cw-chip {
    padding: 5px 12px; border-radius: 50px; font-size: 12px; font-weight: 600;
    background: rgba(245,166,35,.1); border: 1px solid rgba(245,166,35,.25);
    color: var(--gold, #F5A623); cursor: pointer; font-family: inherit;
    transition: all .2s;
  }
  .cw-chip:hover { background: rgba(245,166,35,.2); transform: translateY(-1px); }

  /* Input */
  .cw-foot {
    padding: 11px 13px;
    border-top: 1px solid rgba(245,166,35,.12);
    background: var(--card, #FFFDF5);
    display: flex; align-items: center; gap: 8px;
  }
  [data-theme="dark"] .cw-foot { background: rgba(18,16,10,.97); }
  .cw-inp {
    flex: 1; padding: 9px 14px; border-radius: 50px;
    border: 1.5px solid rgba(245,166,35,.22);
    background: transparent; color: var(--ink, #1A180F);
    font-family: inherit; font-size: 13px; outline: none;
    transition: border-color .22s, box-shadow .22s;
  }
  .cw-inp:focus { border-color: #F5A623; box-shadow: 0 0 0 3px rgba(245,166,35,.1); }
  .cw-inp::placeholder { color: var(--muted, #6B6555); opacity: .65; }
  .cw-send {
    width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(135deg, #F5A623, #FFCF6B);
    color: #111; font-size: 15px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 12px rgba(245,166,35,.42);
    transition: transform .22s, box-shadow .22s; flex-shrink: 0;
  }
  .cw-send:hover { transform: scale(1.12); box-shadow: 0 6px 20px rgba(245,166,35,.62); }
  .cw-send:active { transform: scale(.92); }
`

const CHIPS = ['Pricing', 'Features', 'Get started', 'Support']

/* Chat bubble SVG — matches screenshot style */
const BubbleIcon = ({ isOpen }) => isOpen ? (
  <svg className="cw-icon" viewBox="0 0 32 32" fill="none">
    <line x1="8" y1="8" x2="24" y2="24" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/>
    <line x1="24" y1="8" x2="8" y2="24" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/>
  </svg>
) : (
  <svg className="cw-icon" viewBox="0 0 32 32" fill="none">
    <path d="M4 8C4 5.79 5.79 4 8 4H24C26.21 4 28 5.79 28 8V19C28 21.21 26.21 23 24 23H18L13 28V23H8C5.79 23 4 21.21 4 19V8Z"
      fill="rgba(255,255,255,.95)" stroke="rgba(255,255,255,.4)" strokeWidth=".5"/>
    <circle cx="11" cy="13.5" r="1.6" fill="#F5A623"/>
    <circle cx="16" cy="13.5" r="1.6" fill="#F5A623"/>
    <circle cx="21" cy="13.5" r="1.6" fill="#F5A623"/>
  </svg>
)

export default function ChatWidget() {
  const { t } = useTranslation('landing')
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([
    { role: 'ai', text: t('chatWidget.greeting') },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [unread, setUnread] = useState(1)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, typing])

  const toggle = () => {
    setOpen(v => !v)
    setUnread(0)
    window.toggleChat?.()
  }

  const send = (text) => {
    const msg = text ?? input.trim()
    if (!msg) return
    setInput('')
    setMsgs(v => [...v, { role: 'usr', text: msg }])
    setTyping(true)
    window.sendChatMessage?.()
    setTimeout(() => {
      setTyping(false)
      setMsgs(v => [...v, { role: 'ai', text: "Thanks! Our team will get back to you shortly. 🙌" }])
    }, 1400)
  }

  return (
    <>
      <style>{CSS}</style>

      {/* Panel */}
      {open && (
        <div className="cw-panel saas-font">
          <div className="cw-head">
            <div className="cw-head-left">
              <div className="cw-avatar">◎</div>
              <div>
                <div className="cw-head-name">{t('chatWidget.liveSupport')}</div>
                <div className="cw-head-sub">
                  <span className="cw-online" />
                  Online · Replies in minutes
                </div>
              </div>
            </div>
            <button className="cw-x" onClick={toggle}>×</button>
          </div>

          <div className="cw-msgs">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'ai' ? 'cw-ai' : 'cw-usr'}>{m.text}</div>
            ))}
            {typing && <div className="cw-typing"><span/><span/><span/></div>}
            <div ref={endRef} />
          </div>

          <div className="cw-chips">
            {CHIPS.map((c, i) => (
              <button key={i} className="cw-chip" onClick={() => send(c)}>{c}</button>
            ))}
          </div>

          <div className="cw-foot">
            <input
              id="chatInput"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder={t('chatWidget.placeholder')}
              className="cw-inp"
            />
            <button className="cw-send" onClick={() => send()}>→</button>
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="cw-fab-wrap">
        <button className="cw-fab" onClick={toggle} aria-label="Open chat">
          <span className="cw-ring" />
          <span className="cw-ring2" />
          <BubbleIcon isOpen={open} />
          {!open && unread > 0 && (
            <span className="cw-badge">{unread}</span>
          )}
        </button>
      </div>
    </>
  )
}