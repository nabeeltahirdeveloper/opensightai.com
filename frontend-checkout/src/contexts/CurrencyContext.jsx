import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { serverApi } from '@/api/serverApi'

const CurrencyContext = createContext()

const normalizeCode = (c) => String(c || '').trim().toUpperCase()

// Representative region/country per currency (currencies are not always 1:1 with countries, e.g. EUR)
const CURRENCY_TO_REGION = {
  USD: 'United States',
  EUR: 'Eurozone',
  GBP: 'United Kingdom',
  AUD: 'Australia',
  CAD: 'Canada',
  JPY: 'Japan',
  INR: 'India',
  CHF: 'Switzerland',
  SGD: 'Singapore',
  HKD: 'Hong Kong',
  MXN: 'Mexico',
  BRL: 'Brazil',
  KRW: 'South Korea',
  TRY: 'Turkey',
  AED: 'United Arab Emirates',
  SEK: 'Sweden',
  NOK: 'Norway',
  ZAR: 'South Africa',
  DKK: 'Denmark',
  ARS: 'Argentina',
  COP: 'Colombia',
  PEN: 'Peru',
  SAR: 'Saudi Arabia',
  RON: 'Romania',
  BGN: 'Bulgaria',
  PLN: 'Poland',
}

const invertRange = ([min, max]) => [1 / max, 1 / min]

// Plausible “units per 1 USD” ranges for your failing currencies.
// (Wide enough to survive volatility; just used to detect direction.)
const PER_USD_RANGES = {
  JPY: [50, 300],
  KRW: [500, 2500],
  COP: [1000, 9000],
  ARS: [50, 10000],     // volatile, keep wide
  HKD: [6, 10],
  BRL: [2, 12],
  TRY: [5, 80],
  SEK: [5, 20],
  NOK: [5, 25],
  DKK: [4, 10],
  RON: [3, 8],
  BGN: [1, 3],
}

const detectGlobalMode = (rates) => {
  const jpy = Number(rates?.JPY)
  if (Number.isFinite(jpy)) {
    if (jpy > 20) return 'PER_USD'        // 1 USD = X units
    if (jpy > 0 && jpy < 1) return 'USD_PER_UNIT' // 1 unit = X USD
  }
  return 'PER_USD'
}

const computeUsdPerUnit = (code, rawRate, globalMode) => {
  const c = normalizeCode(code)
  const r = Number(rawRate)
  if (!Number.isFinite(r) || r <= 0) return null

  // If we have a plausible range for this currency, use it to decide direction.
  const range = PER_USD_RANGES[c]
  if (range) {
    const [minPerUsd, maxPerUsd] = range
    const [minUsdPerUnit, maxUsdPerUnit] = invertRange(range)

    const looksPerUsd = r >= minPerUsd && r <= maxPerUsd
    const looksUsdPerUnit = r >= minUsdPerUnit && r <= maxUsdPerUnit

    if (looksPerUsd && !looksUsdPerUnit) return 1 / r      // raw is units per USD
    if (looksUsdPerUnit && !looksPerUsd) return r          // raw is USD per unit

    // If both or neither match (rare due to wide ranges), fall back to global mode.
  }

  // Global fallback (keeps behavior for normal currencies)
  if (globalMode === 'PER_USD') return 1 / r
  return r
}


// Works even if backend doesn’t send currency "name"
const getCurrencyNameIntl = (code) => {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'currency' })
    return dn.of(code) || code
  } catch {
    return code
  }
}

export function CurrencyProvider({ children, initialCurrency = null }) {
  const [selectedCurrency, setSelectedCurrency] = useState(normalizeCode(initialCurrency) || 'USD')
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [exchangeRates, setExchangeRates] = useState({})
  const [detectedCountry, setDetectedCountry] = useState(null)
  const [usdPerUnitByCode, setUsdPerUnitByCode] = useState({})


  useEffect(() => {
    const loadCurrenciesAndDetectGeo = async () => {
      try {
        const data = await serverApi.currencies.listPublic()
        const list = (data?.currencies || []).map((c) => ({
          ...c,
          code: normalizeCode(c.code),
        }))
        setCurrencies(list)
        const parseRate = (v) => {
          if (v === null || v === undefined) return null
          const s = String(v).trim()
          if (!s) return null
        
          // supports "1,234.56" and "1234,56"
          const normalized =
            s.includes(',') && s.includes('.')
              ? s.replace(/,/g, '')
              : s.replace(',', '.')
        
          const n = Number(normalized)
          return Number.isFinite(n) && n > 0 ? n : null
        }
        
        const rates = {}
        for (const curr of list) {
          const code = normalizeCode(curr.code)
          const rate = parseRate(curr.exchange_rate)   // ✅ ONLY use exchange_rate
          if (code && rate) rates[code] = rate
        }
        rates.USD = rates.USD || 1
        setExchangeRates(rates)
        
        // ✅ 1 USD = rates[CODE] units  => 1 unit = 1/rates[CODE] USD
        const usdMap = {}
        for (const [code, unitsPerUsd] of Object.entries(rates)) {
          usdMap[code] = 1 / unitsPerUsd
        }
        usdMap.USD = 1
        setUsdPerUnitByCode(usdMap)
        

        // Always ensure USD exists
        // rates.USD = rates.USD || 1
        // setExchangeRates(rates)

        // Geo detection only if no initialCurrency
        if (!initialCurrency) {
          try {
            const ipRes = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
            const ipData = await ipRes.json()

            if (ipData?.country_code && !ipData?.error) {
              setDetectedCountry(ipData.country_code)

              try {
                const currencyData = await serverApi.currencies.getForCountry(ipData.country_code)
                const detected = normalizeCode(currencyData?.currency_code)
                if (detected && usdMap[detected]) {
                  setSelectedCurrency(detected)
                  console.log(`Auto-detected currency: ${detected} for country: ${ipData.country_code}`)
                } else {
                  console.log('Detected currency not supported/has no rate, using USD')
                }
              } catch {
                console.log('No specific currency mapping found for country, using USD')
              }
            }
          } catch (geoError) {
            console.log('Geo-detection failed, using default USD:', geoError?.message)
          }
        }
      } catch (error) {
        console.error('Failed to load currencies:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCurrenciesAndDetectGeo()
    

  }, [initialCurrency])

 

  useEffect(() => {
    if (initialCurrency) setSelectedCurrency(normalizeCode(initialCurrency))
  }, [initialCurrency])

  const changeCurrency = (currencyCode) => setSelectedCurrency(normalizeCode(currencyCode))

  const getCurrency = (code) => {
    const target = normalizeCode(code)
    return currencies.find((c) => c.code === target)
  }

  const currentCurrency = getCurrency(selectedCurrency) || getCurrency('USD')

  const convertUsdToCurrency = (priceInUSD, toCurrencyCode) => {
    const code = normalizeCode(toCurrencyCode)
    const usdPerUnit = usdPerUnitByCode[code]
    const usd = Number(priceInUSD)
  
    if (!Number.isFinite(usd)) return 0
  
    // ✅ if missing rate, fallback to USD (do NOT return 0)
    if (!usdPerUnit || !Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return usd
  
    return usd / usdPerUnit
  }
  
  const convertPrice = (priceInUSD, toCurrencyCode = selectedCurrency, isCustomPlan = false) => {
    const raw = convertUsdToCurrency(priceInUSD, toCurrencyCode)
    if (!Number.isFinite(raw)) return priceInUSD 
    if (isCustomPlan) return Math.round(raw * 100) / 100
    return Math.ceil(raw)
  }
  
  const convertPriceExact = (priceInUSD, toCurrencyCode = selectedCurrency) => {
    const raw = convertUsdToCurrency(priceInUSD, toCurrencyCode)
    if (!Number.isFinite(raw)) return priceInUSD 
    return Math.round(raw * 100) / 100
  }
  
  const formatPrice = (priceInUSD, currencyCode = selectedCurrency, isCustomPlan = false) => {
    const code = normalizeCode(currencyCode)
    const currency = getCurrency(code)

    const converted = convertPrice(priceInUSD, code, isCustomPlan)
    const amount = converted.toFixed(2)

    // keep your existing "amount + symbol" style
    const symbol = currency?.symbol || '$'
    return `${amount}${symbol}`
  }

  // ✅ Label: "United Kingdom — Pound sterling (GBP)"
  const getCurrencyLabel = (code) => {
    const c = getCurrency(code)
    const upper = normalizeCode(code)
    const currencyName = c?.name || getCurrencyNameIntl(upper)
    const region = CURRENCY_TO_REGION[upper]
    return region ? `${region} — ${currencyName} (${upper})` : `${currencyName} (${upper})`
  }

  const value = {
    selectedCurrency,
    usdPerUnitByCode,
    currencies,
    loading,
    exchangeRates,
    currentCurrency,
    detectedCountry,
    changeCurrency,
    getCurrency,
    convertPrice,
    formatPrice,
    convertPriceExact,
    getCurrencyLabel, // 👈 expose to UI
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider')
  return context
}
