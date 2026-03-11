import React from 'react'

const CSS = `
  @keyframes notif-in {
    from { opacity:0; transform:translateY(-18px) scale(.95); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes notif-out {
    from { opacity:1; transform:translateY(0) scale(1); }
    to   { opacity:0; transform:translateY(-14px) scale(.96); }
  }
  @keyframes notif-progress {
    from { width:100%; }
    to   { width:0%; }
  }

  #notification {
    position:fixed;
    top:88px;
    left:50%;
    transform:translateX(-50%);
    z-index:99999;
    min-width:300px;
    max-width:460px;
    border-radius:16px;
    padding:14px 18px;
    display:flex;
    align-items:center;
    gap:12px;
    font-family:Inter,system-ui,sans-serif;
    font-size:14px;
    font-weight:500;
    line-height:1.5;
    backdrop-filter:blur(18px);
    -webkit-backdrop-filter:blur(18px);
    box-shadow:0 12px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);
    pointer-events:none;
    opacity:0;
    overflow:hidden;
  }

  /* Show state (set by JS via class or display) */
  #notification.show {
    animation:notif-in .35s cubic-bezier(.34,1.3,.64,1) both;
  }
  #notification.hide {
    animation:notif-out .28s ease both;
  }

  /* Type variants — set via data-type attribute */
  #notification[data-type="success"],
  #notification.success {
    background:rgba(20,83,45,.88);
    border:1px solid rgba(34,197,94,.35);
    color:#dcfce7;
    box-shadow:0 12px 40px rgba(34,197,94,.2),0 2px 8px rgba(0,0,0,.1);
  }
  [data-theme="light"] #notification[data-type="success"],
  [data-theme="light"] #notification.success {
    background:rgba(240,253,244,.95);
    border-color:rgba(34,197,94,.4);
    color:#14532d;
    box-shadow:0 12px 40px rgba(34,197,94,.15),0 2px 8px rgba(0,0,0,.06);
  }

  #notification[data-type="error"],
  #notification.error {
    background:rgba(127,29,29,.88);
    border:1px solid rgba(239,68,68,.35);
    color:#fee2e2;
    box-shadow:0 12px 40px rgba(239,68,68,.2),0 2px 8px rgba(0,0,0,.1);
  }
  [data-theme="light"] #notification[data-type="error"],
  [data-theme="light"] #notification.error {
    background:rgba(254,242,242,.95);
    border-color:rgba(239,68,68,.4);
    color:#7f1d1d;
    box-shadow:0 12px 40px rgba(239,68,68,.12),0 2px 8px rgba(0,0,0,.06);
  }

  #notification[data-type="info"],
  #notification.info {
    background:rgba(14,12,8,.88);
    border:1px solid rgba(245,166,35,.32);
    color:rgba(229,224,208,.92);
    box-shadow:0 12px 40px rgba(245,166,35,.15),0 2px 8px rgba(0,0,0,.1);
  }
  [data-theme="light"] #notification[data-type="info"],
  [data-theme="light"] #notification.info {
    background:rgba(255,252,240,.95);
    border-color:rgba(245,166,35,.35);
    color:#1a1810;
    box-shadow:0 12px 40px rgba(245,166,35,.12),0 2px 8px rgba(0,0,0,.06);
  }

  #notification[data-type="warning"],
  #notification.warning {
    background:rgba(120,53,15,.88);
    border:1px solid rgba(245,158,11,.35);
    color:#fef3c7;
    box-shadow:0 12px 40px rgba(245,158,11,.2),0 2px 8px rgba(0,0,0,.1);
  }
  [data-theme="light"] #notification[data-type="warning"],
  [data-theme="light"] #notification.warning {
    background:rgba(255,251,235,.95);
    border-color:rgba(245,158,11,.4);
    color:#78350f;
    box-shadow:0 12px 40px rgba(245,158,11,.12),0 2px 8px rgba(0,0,0,.06);
  }

  /* Icon wrapper */
  .notif-icon-wrap {
    width:32px;height:32px;border-radius:10px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;font-size:16px;
  }

  /* Progress bar */
  .notif-bar {
    position:absolute;bottom:0;left:0;height:2px;border-radius:0 0 16px 16px;
    background:rgba(255,255,255,.25);
  }
  #notification[data-type="success"] .notif-bar,
  #notification.success .notif-bar  { background:rgba(34,197,94,.5); }
  #notification[data-type="error"]   .notif-bar,
  #notification.error   .notif-bar  { background:rgba(239,68,68,.5); }
  #notification[data-type="warning"] .notif-bar,
  #notification.warning .notif-bar  { background:rgba(245,158,11,.5); }
  #notification[data-type="info"]    .notif-bar,
  #notification.info    .notif-bar  { background:rgba(245,166,35,.55); }
`

export default function Notification() {
  return (
    <>
      <style>{CSS}</style>
      <div id="notification" role="alert" aria-live="polite">
        {/* Icon injected by JS into #notificationIcon */}
        <span id="notificationIcon" className="notif-icon-wrap" />
        <span id="notificationText" style={{ flex: 1, lineHeight: 1.55 }} />
        {/* Auto-dismiss progress bar */}
        <span className="notif-bar" id="notifBar" />
      </div>
    </>
  )
}