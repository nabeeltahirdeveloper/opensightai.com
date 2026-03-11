import React from 'react'

export default function LandingStyles() {
  return (
    <style>{`
        :root {
            --gold: #FFD700;
            --orange: #FF6B35;
            --amber: #FFA726;
            --charcoal: #2C3E50;
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
            background: white;
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

        .glass-effect { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255, 215, 0, 0.2); }

        .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid var(--gold); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }

        body { overflow-x: hidden; }
    `}</style>
  )
}

