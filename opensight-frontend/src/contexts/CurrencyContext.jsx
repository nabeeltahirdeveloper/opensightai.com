import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { serverApi } from "@/api/serverApi";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  const getCurrency = (code) => currencies.find((c) => c.code === code);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 1) Load currencies from backend
        const data = await serverApi.currencies.listPublic();
        const list = data?.currencies || [];
        if (cancelled) return;

        setCurrencies(list);

        const rates = {};
        for (const c of list) rates[c.code] = Number(c.exchange_rate) || 1;
        setExchangeRates(rates);

        // 2) Resolve country (prefer window.__ipInfo set by LandingScripts.jsx)
        const winIpInfo = typeof window !== "undefined" ? window.__ipInfo : null;
        let country =
          winIpInfo?.countryCode ||
          winIpInfo?.country_code ||
          winIpInfo?.country ||
          null;

        // IMPORTANT:
        // - ipapi.co is blocked by CORS on localhost in many cases
        // - ipwho.is is HTTPS + CORS-friendly, so use it as primary fallback
        if (!country) {
          try {
            const r = await fetch("https://ipwho.is/", { cache: "no-store" });
            const j = await r.json().catch(() => null);
            country = j?.country_code || null;

            // optionally store for other parts of app
            if (country && typeof window !== "undefined") {
              window.__ipInfo = { countryCode: country, query: j?.ip };
              window.__clientIp = j?.ip;
            }
          } catch (_e) {
            // ignore
          }
        }

        if (cancelled) return;

        if (country) setDetectedCountry(country);

        // 3) Ask backend mapping for country -> currency
        if (country) {
          try {
            const currencyData = await serverApi.currencies.getForCountry(country);
            if (currencyData?.currency_code) {
              setSelectedCurrency(currencyData.currency_code);
              return;
            }
          } catch (_e) {
            // ignore
          }
        }

        // 4) Fallback
        setSelectedCurrency("USD");
      } catch (err) {
        console.error("Failed to load currencies:", err);
        setSelectedCurrency("USD");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentCurrency = useMemo(() => {
    return getCurrency(selectedCurrency) || getCurrency("USD");
  }, [selectedCurrency, currencies]);

  // Convert price from base currency (USD) to selected currency (rounded UP to whole number)
  const convertPrice = (priceInUSD, toCurrencyCode = selectedCurrency) => {
    const rate = Number(exchangeRates?.[toCurrencyCode]) || 1;
    return Math.ceil(Number(priceInUSD) * rate);
  };

  // Format as 2 decimals (e.g., 25.00$)
  const formatPrice = (priceInUSD, currencyCode = selectedCurrency) => {
    const currency = getCurrency(currencyCode);
    const converted = convertPrice(priceInUSD, currencyCode);
    const symbol = currency?.symbol || "$";
    return `${Number(converted).toFixed(2)}${symbol}`;
  };

  const value = {
    selectedCurrency,
    currencies,
    loading,
    exchangeRates,
    currentCurrency,
    detectedCountry,
    changeCurrency: setSelectedCurrency,
    getCurrency,
    convertPrice,
    formatPrice,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
