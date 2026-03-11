import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Zap, Crown, Sparkles, Star } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { redirectToCheckout } from "@/utils/checkoutRedirect";
import LandingStyles from "@/components/landing/LandingStyles.jsx";
import LandingScripts from "@/components/landing/LandingScripts.jsx";
import {
  pricesPackages as fallbackPackages,
  pricesCustomConfig as fallbackCustomConfig,
  pricesCustomFeatures,
} from "@/data/pricesPackages";
import { serverApi } from "@/api/serverApi";

const injectStyles = `
  /* ── Slider ── */
  .gold-slider [data-radix-slider-track]{background:rgba(245,166,35,.18)!important;height:5px!important;border-radius:99px!important}
  .gold-slider [data-radix-slider-range]{background:linear-gradient(90deg,#F5A623,#FFCF6B)!important;border-radius:99px!important}
  .gold-slider [data-radix-slider-thumb]{width:18px!important;height:18px!important;background:var(--card,#fff)!important;border:2.5px solid #F5A623!important;border-radius:50%!important;box-shadow:0 2px 10px rgba(245,166,35,.45)!important;cursor:grab!important;transition:transform 180ms ease,box-shadow 180ms ease!important}
  .gold-slider [data-radix-slider-thumb]:hover{transform:scale(1.35)!important;box-shadow:0 4px 20px rgba(245,166,35,.65)!important}

  /* ── Centre card continuous animations ── */
  @keyframes orbitGlow {
    0%   { box-shadow: 0 20px 56px rgba(245,166,35,.28), 0 6px 20px rgba(0,0,0,.1),  0  0 0 0   rgba(245,166,35,0); }
    25%  { box-shadow: 0 24px 64px rgba(245,166,35,.38), 0 6px 20px rgba(0,0,0,.1),  6px 0 28px 0 rgba(245,166,35,.18); }
    50%  { box-shadow: 0 28px 72px rgba(245,166,35,.46), 0 6px 20px rgba(0,0,0,.1),  0  8px 32px 0 rgba(245,166,35,.22); }
    75%  { box-shadow: 0 24px 64px rgba(245,166,35,.38), 0 6px 20px rgba(0,0,0,.1), -6px 0 28px 0 rgba(245,166,35,.18); }
    100% { box-shadow: 0 20px 56px rgba(245,166,35,.28), 0 6px 20px rgba(0,0,0,.1),  0  0 0 0   rgba(245,166,35,0); }
  }
  @keyframes pulseBorder {
    0%,100% { border-color: rgba(245,166,35,.55); }
    50%     { border-color: rgba(245,166,35,.95); }
  }
  @keyframes shimmerBtn {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
  @keyframes topLineGlow {
    0%,100% { opacity: .5; }
    50%     { opacity: 1; }
  }

  .centre-animated {
    animation: orbitGlow 3.5s ease-in-out infinite, pulseBorder 3.5s ease-in-out infinite;
  }
  .centre-top-line { animation: topLineGlow 3.5s ease-in-out infinite; }
  .shimmer-btn {
    background: linear-gradient(90deg,#F5A623 0%,#FFCF6B 30%,#fff9e6 50%,#FFCF6B 70%,#F5A623 100%);
    background-size: 250% auto;
    animation: shimmerBtn 2.8s linear infinite;
  }

  /* ── Shared card transition ── */
  .p-card {
    transition: transform 460ms cubic-bezier(.22,1,.36,1), box-shadow 460ms cubic-bezier(.22,1,.36,1), border-color 320ms ease;
  }
`;

function FeatureList({ features }) {
  return (
    <ul className="flex flex-col gap-2 mb-5 flex-1">
      {features.map((f, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#F5A623,#FFCF6B)", minWidth: 16 }}>
            <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: "#111" }} />
          </span>
          <span className="text-sm leading-snug" style={{ color: "var(--ink)", opacity: .83 }}>{f}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Side Card ── */
function SideCard({ pkg, icon: Icon, onChoose }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="p-card relative flex flex-col rounded-2xl p-8"
      style={{
        background: "var(--card)",
        border: "1.5px solid rgba(245,166,35,.18)",
        boxShadow: hov ? "0 20px 50px rgba(245,166,35,.24), 0 6px 18px rgba(0,0,0,.08)" : "0 2px 10px rgba(0,0,0,.04)",
        borderColor: hov ? "rgba(245,166,35,.52)" : "rgba(245,166,35,.18)",
        transform: hov ? "translateY(-8px) scale(1.015)" : "translateY(0) scale(1)",
        zIndex: 1,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {pkg.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap z-10"
          style={{ background: "linear-gradient(135deg,#F5A623,#FFCF6B)", color: "#111", boxShadow: "0 4px 14px rgba(245,166,35,.4)" }}>
          <Star className="w-3 h-3 fill-current" /> Most Popular
        </div>
      )}

      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
        style={{
          background: "linear-gradient(135deg,#F5A623,#FFCF6B)",
          transform: hov ? "scale(1.14) rotate(-5deg)" : "scale(1)",
          boxShadow: hov ? "0 6px 18px rgba(245,166,35,.48)" : "none",
          transition: "transform 400ms cubic-bezier(.34,1.56,.64,1), box-shadow 350ms ease",
        }}>
        <Icon className="w-6 h-6" style={{ color: "#111" }} />
      </div>

      <div className={pkg.popular ? "mt-2" : ""}>
        <h3 className="text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>{pkg.name}</h3>
        <div className="text-4xl font-black leading-none mb-1" style={{ color: "var(--gold)" }}>{pkg._fmtPrice}</div>
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>one-time · {pkg._credits} credits</p>
        {pkg.description && <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--muted)" }}>{pkg.description}</p>}
      </div>

      <div className="h-px my-3" style={{ background: "rgba(245,166,35,.15)" }} />
      <FeatureList features={pkg.features} />

      <button onClick={onChoose}
        className="mt-auto w-full py-3.5 rounded-xl text-sm font-bold"
        style={{
          background: "linear-gradient(135deg,#F5A623,#FFCF6B)", color: "#111",
          boxShadow: hov ? "0 10px 28px rgba(245,166,35,.52)" : "0 2px 8px rgba(245,166,35,.25)",
          transform: hov ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 300ms cubic-bezier(.22,1,.36,1), box-shadow 300ms ease",
        }}>
        Get Started →
      </button>
    </div>
  );
}

/* ── Centre Card — continuously animated, smooth hover ── */
function CentreCard({ sym, customDisplay, customCreditLbl, customCredits, setCustomCredits, MIN, MAX, STEP, onChoose }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={`p-card relative flex flex-col rounded-2xl${hov ? "" : " centre-animated"}`}
      style={{
        padding: "32px 26px 26px",
        background: "linear-gradient(155deg, var(--card) 58%, rgba(245,166,35,.07) 100%)",
        border: "1.5px solid rgba(245,166,35,.62)",
        borderColor: hov ? "rgba(245,166,35,.92)" : undefined,
        transform: hov ? "translateY(-20px) scale(1.05)" : "translateY(-12px) scale(1.04)",
        boxShadow: hov ? "0 32px 72px rgba(245,166,35,.44), 0 10px 28px rgba(0,0,0,.14)" : undefined,
        zIndex: 2,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Animated top glow line */}
      <div className="centre-top-line absolute top-0 left-8 right-8 h-px rounded-full"
        style={{ background: "linear-gradient(90deg,transparent,rgba(245,166,35,.9),transparent)" }} />

      {/* Badge */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap z-10"
        style={{ background: "linear-gradient(135deg,#F5A623,#FFCF6B)", color: "#111", boxShadow: "0 4px 16px rgba(245,166,35,.5)" }}>
        <Sparkles className="w-3 h-3" /> Custom
      </div>

      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 mt-1"
        style={{
          background: "linear-gradient(135deg,#F5A623,#FFCF6B)",
          transform: hov ? "scale(1.15) rotate(-6deg)" : "scale(1)",
          boxShadow: hov ? "0 8px 22px rgba(245,166,35,.55)" : "0 3px 12px rgba(245,166,35,.3)",
          transition: "transform 400ms cubic-bezier(.34,1.56,.64,1), box-shadow 350ms ease",
        }}>
        <Sparkles className="w-5 h-5" style={{ color: "#111" }} />
      </div>

      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>Custom Package</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(245,166,35,.14)", color: "#c77d00", border: "1px solid rgba(245,166,35,.3)" }}>
          FLEX
        </span>
      </div>

      <div className="text-3xl font-black leading-none mb-1" style={{ color: "var(--gold)" }}>{sym}{customDisplay.toFixed(2)}</div>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>one-time · {customCreditLbl} credits</p>

      <div className="h-px mb-3" style={{ background: "rgba(245,166,35,.2)" }} />

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--muted)" }}>
          <span>{sym}{Math.round(MIN)}</span>
          <span className="font-semibold" style={{ color: "var(--gold)" }}>{sym}{customDisplay.toFixed(0)}</span>
          <span>{sym}{Math.round(MAX)}</span>
        </div>
        <Slider value={[Math.max(MIN, Math.min(MAX, customCredits))]}
          onValueChange={([v]) => setCustomCredits(v)}
          min={MIN} max={MAX} step={STEP} className="gold-slider" />
      </div>

      <div className="rounded-xl py-2.5 px-4 mb-3 text-center"
        style={{
          background: hov ? "rgba(245,166,35,.13)" : "rgba(245,166,35,.08)",
          border: "1px solid rgba(245,166,35,.22)",
          transition: "background 350ms ease",
        }}>
        <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>You'll receive</p>
        <p className="text-lg font-black" style={{ color: "var(--ink)" }}>{customCreditLbl} Credits</p>
      </div>

      <FeatureList features={pricesCustomFeatures || []} />

      <button onClick={onChoose}
        className="shimmer-btn mt-auto w-full py-3 rounded-xl text-sm font-bold"
        style={{
          color: "#111",
          boxShadow: hov ? "0 12px 30px rgba(245,166,35,.6)" : "0 4px 16px rgba(245,166,35,.35)",
          transform: hov ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 300ms cubic-bezier(.22,1,.36,1), box-shadow 300ms ease",
        }}>
        Choose Custom →
      </button>
    </div>
  );
}

export default function Prices() {
  const [searchParams] = useSearchParams();
  const { addPackage, addCreditPackage, clearCart } = useCart();
  const { selectedCurrency, currentCurrency, exchangeRates, loading: currencyLoading } = useCurrency();
  const [packages, setPackages] = useState(fallbackPackages);
  const [customCredits, setCustomCredits] = useState(fallbackCustomConfig?.minUsd ?? 50);

  const MIN  = fallbackCustomConfig?.minUsd  ?? 50;
  const MAX  = fallbackCustomConfig?.maxUsd  ?? 1500;
  const STEP = fallbackCustomConfig?.stepUsd ?? 10;
  const rate = exchangeRates?.[selectedCurrency] || 1;
  const sym  = currentCurrency?.symbol || "$";

  useEffect(() => {
    const ref = searchParams.get("ref") || searchParams.get("b");
    if (ref) try { localStorage.setItem("vs_referral_slug", ref); } catch (_) {}
  }, [searchParams]);

  useEffect(() => {
    serverApi.packages.listPublic().then(data => {
      if (data?.packages?.length)
        setPackages(data.packages.map(p => ({
          ...p,
          price:    Number(p.price),
          credits:  p.credits === "unlimited" || p.credits === null ? "unlimited" : Number(p.credits),
          features: Array.isArray(p.features) ? p.features : [],
          popular:  Boolean(p.popular),
        })));
    }).catch(() => {});
  }, []);

  const fmt = (usd) => `${sym}${Math.round(usd * rate * 100) / 100}`;
  const customDisplay   = Math.round(customCredits * rate * 100) / 100;
  const customCreditLbl = customCredits >= 1500 ? "Unlimited" : Math.floor(customDisplay).toLocaleString();

  const shown = packages.slice(0, 2).map(p => ({
    ...p,
    _fmtPrice: fmt(p.price),
    _credits: p.credits === "unlimited" ? "Unlimited"
      : typeof p.credits === "number" ? Math.round(p.credits * rate).toLocaleString() : p.credits,
  }));

  if (currencyLoading || !currentCurrency) {
    return (
      <>
        <LandingStyles /><LandingScripts />
        <section className="py-24 px-6" style={{ background: "var(--surface)" }}>
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
              style={{ background: "rgba(245,166,35,.08)", border: "1px solid rgba(245,166,35,.25)" }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: "#F5A623", borderTopColor: "transparent" }} />
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Loading prices…</span>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <LandingStyles /><LandingScripts />
      <style>{injectStyles}</style>

      <section id="pricing" className="saas-font relative overflow-hidden py-24 px-6" style={{ background: "var(--surface)" }}>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle,#F5A623,transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full pointer-events-none blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle,#FFCF6B,transparent 70%)" }} />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="g-badge mb-5 inline-flex"><span className="g-badge-dot" />Pricing Plans</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: "var(--ink)", letterSpacing: "-.03em" }}>
              Simple,{" "}<span style={{ color: "var(--gold)" }}>Transparent</span>{" "}Pricing
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: "var(--muted)" }}>
              One-time payment. No subscriptions. No surprises.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-end pb-8">
            {shown[0] && (
              <SideCard pkg={shown[0]} icon={Zap} onChoose={() => {
                clearCart();
                addPackage({ ...shown[0], type: "package", quantity: 1 });
                redirectToCheckout({ items: [{ ...shown[0], type: "package", quantity: 1 }], totalItems: 1, totalAmount: shown[0].price }, selectedCurrency);
              }} />
            )}
            <CentreCard sym={sym} customDisplay={customDisplay} customCreditLbl={customCreditLbl}
              customCredits={customCredits} setCustomCredits={setCustomCredits}
              MIN={MIN} MAX={MAX} STEP={STEP}
              onChoose={() => {
                if (customCredits < MIN) return;
                clearCart();
                const cp = { id: `custom-${Date.now()}`, name: "Custom Package", price: customCredits, credits: customCredits, custom: true, type: "credits", quantity: 1 };
                addCreditPackage(cp);
                redirectToCheckout({ items: [cp], totalItems: 1, totalAmount: customCredits }, selectedCurrency);
              }} />
            {shown[1] && (
              <SideCard pkg={shown[1]} icon={Crown} onChoose={() => {
                clearCart();
                addPackage({ ...shown[1], type: "package", quantity: 1 });
                redirectToCheckout({ items: [{ ...shown[1], type: "package", quantity: 1 }], totalItems: 1, totalAmount: shown[1].price }, selectedCurrency);
              }} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}