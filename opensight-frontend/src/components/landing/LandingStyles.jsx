import React from 'react'

export default function LandingStyles() {
  return (
    <style>{`
        :root {
            --gold: #F59E0B;
            --orange: #FF6B35;
            --amber: #FFA726;
            --charcoal: #2C3E50;
            --surface: #FEFCF3;
            --ink: #1A180F;
            --muted: #6B6555;
            --card: #FFFDF5;
        }
        [data-theme="dark"] {
            --surface: #0E0D08;
            --ink: #F2EDD8;
            --muted: #A0967E;
            --card: #12100A;
            --gold: #fcd34d;
        }

        * { font-family: 'Inter', sans-serif; }
        h1, h2, h3, h4, h5, h6, .heading-font { font-family: 'Poppins', sans-serif; }

        .gradient-gold { background: linear-gradient(135deg, var(--gold), var(--orange)); }
        .gradient-amber { background: linear-gradient(135deg, var(--amber), var(--orange)); }
        .text-gold { color: var(--gold); }
        .text-orange { color: var(--orange); }
        .text-amber { color: var(--amber); }
        .border-gold { border-color: var(--gold); }

        .premium-card {
            background: var(--card);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            border: 1px solid rgba(255, 215, 0, 0.2);
            transition: all 0.3s ease;
        }
        .premium-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.15);
            border-color: var(--gold);
        }

        .btn-premium {
            background: linear-gradient(135deg, var(--gold), var(--orange));
            color: white;
            padding: 14px 32px;
            border-radius: 50px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }
        .btn-premium:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(255, 107, 53, 0.4);
        }

        .glass-effect { background: var(--card); backdrop-filter: blur(10px); border: 1px solid rgba(255, 215, 0, 0.2); }

        .floating-particles { position: absolute; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
        .particle { position: absolute; background: var(--gold); border-radius: 50%; opacity: 0.1; animation: float 6s ease-in-out infinite; }

        @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }

        .hero-section { background: var(--surface); position: relative; overflow: hidden; }
        /* Prevent horizontal scroll on landing */
        body { overflow-x: hidden; }

        .pricing-popular { position: relative; transform: scale(1.05); border: 2px solid var(--gold); }
        .pricing-popular::before { content: "MOST POPULAR"; position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--gold), var(--orange)); color: white; padding: 8px 24px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }

        .feature-icon { width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 24px; }
        .testimonial-card { background: var(--card); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-left: 4px solid var(--gold); }
        .page-button { background: white; color: var(--gold); border: 2px solid var(--gold); border-radius: 8px; padding: 8px 16px; cursor: pointer; transition: all 0.3s ease; }
        .page-button.active { background: var(--gold); color: white; }
        .page-button:hover { background: var(--gold); color: white; }
        .nav-mobile { display: none; }
        /* Ensure elements explicitly marked as hidden stay hidden even on mobile */
        .nav-mobile.hidden { display: none !important; }
        @media (max-width: 767px) { .nav-desktop { display: none; } .nav-mobile { display: block; } .pricing-popular { transform: none; } }

        .upload-area { border: 3px dashed var(--gold); border-radius: 20px; padding: 60px 20px; text-align: center; background: rgba(255, 215, 0, 0.05); transition: all 0.3s ease; cursor: pointer; }
        .upload-area:hover { background: rgba(255, 215, 0, 0.1); transform: translateY(-5px); }
        .progress-bar { background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--orange)); border-radius: 10px; transition: width 0.3s ease; }
        .chat-message { background: var(--card); border-radius: 18px; padding: 16px 20px; margin: 8px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
        .chat-message.user { background: linear-gradient(135deg, var(--gold), var(--amber)); color: white; margin-left: 60px; }
        .chat-message.ai { background: #f8f9fa; margin-right: 60px; }

        /* Reduce side margins on small screens to avoid horizontal overflow */
        @media (max-width: 640px) {
          .chat-message.user { margin-left: 16px; }
          .chat-message.ai { margin-right: 16px; }
        }

        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; }
        .modal.active { display: flex; }
        .modal-content { background: var(--card); border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }

        .notification { position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, var(--gold), var(--orange)); color: white; padding: 16px 24px; border-radius: 10px; z-index: 1001; transform: translateX(400px); transition: transform 0.3s ease; }
        .notification.show { transform: translateX(0); }

        .stats-counter { font-size: 48px; font-weight: 700; color: var(--gold); font-family: 'Poppins', sans-serif; }
        .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid var(--gold); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }

        .section-divider { height: 2px; background: linear-gradient(90deg, transparent, var(--gold), transparent); margin: 80px 0; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tab-button { padding: 12px 24px; border: 2px solid var(--gold); background: white; color: var(--gold); border-radius: 30px; cursor: pointer; transition: all 0.3s ease; margin-right: 8px; }
        .tab-button.active { background: var(--gold); color: white; }
    `}</style>
  )
}


