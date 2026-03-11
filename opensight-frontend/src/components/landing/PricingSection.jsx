import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Star, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { packages as fallbackPackages } from '@/data/packages'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import CreditPackageModal from '@/components/cart/CreditPackageModal'
import ProceedChangeModal from '@/components/cart/ProceedChangeModal'
import EligibilityErrorModal from '@/components/cart/EligibilityErrorModal'
import { serverApi } from '@/api/serverApi'
import { redirectToCheckout } from '@/utils/checkoutRedirect'

export default function PricingSection() {
  const { t } = useTranslation(['common', 'landing'])
  const navigate = useNavigate()
  const { addPackage, items, totalAmount, totalItems } = useCart()
  const { formatPrice, selectedCurrency } = useCurrency()
  const [packages, setPackages] = useState(fallbackPackages)
  const [loading, setLoading] = useState(true)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(null)
  const [showEligibilityError, setShowEligibilityError] = useState(false)
  const [eligibilityErrorMessage, setEligibilityErrorMessage] = useState('')
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false)
  const [hoveredPkg, setHoveredPkg] = useState(null)

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await serverApi.packages.listPublic()
        if (data.packages && data.packages.length > 0) {
          const normalizedPackages = data.packages.map(pkg => ({
            ...pkg,
            price: Number(pkg.price),
            credits: pkg.credits === 'unlimited' || pkg.credits === null ? 'unlimited' : Number(pkg.credits),
          }))
          setPackages(normalizedPackages)
        }
      } catch (error) {
        console.error('Failed to fetch packages, using fallback:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const checkEligibility = async () => {
    const BASE = `${import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'}/api`
    const TOKEN_KEY = 'vs_auth_token'
    let authToken = null
    try { authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null } catch (_e) {}

    try {
      let clientIp = typeof window !== 'undefined' ? (window.__clientIp || null) : null
      let ipInfo = typeof window !== 'undefined' ? (window.__ipInfo || null) : null
      if (!clientIp && typeof window !== 'undefined') {
        try {
          const res = await fetch('http://ip-api.com/json/?fields=61439', { cache: 'no-store' })
          const json = await res.json().catch(() => null)
          if (json && json.status === 'success') { clientIp = json.query; ipInfo = json; window.__clientIp = clientIp; window.__ipInfo = ipInfo }
        } catch (_e) {}
      }
      const response = await fetch(`${BASE}/transaction/check-eligibility`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(authToken ? { authorization: `Bearer ${authToken}` } : {}) },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ ...(clientIp ? { client_ip: clientIp } : {}), ...(ipInfo ? { ip_info: ipInfo } : {}) }),
      })
      const text = await response.text()
      let json; try { json = text ? JSON.parse(text) : {} } catch (e) { json = { error: text } }
      if (!response.ok) {
        setEligibilityErrorMessage(json.message || json.error || json.errorMessage || json.reason || json.detail || `Unable to verify eligibility (${response.status}). Please try again.`)
        setShowEligibilityError(true); return false
      }
      if (!json.allowed) {
        setEligibilityErrorMessage(json.message || json.error || json.errorMessage || json.reason || json.detail || 'You are not eligible to proceed with this transaction.')
        setShowEligibilityError(true); return false
      }
      return true
    } catch (error) {
      let errorMessage = 'Failed to check eligibility. Please try again.'
      if (error.message) errorMessage = error.message
      if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')))
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
      setEligibilityErrorMessage(errorMessage); setShowEligibilityError(true); return false
    }
  }

  const handlePlanClick = async (pkg, e) => {
    if (e && e.target.closest('button')) return
    setIsCheckingEligibility(true)
    const isAllowed = await checkEligibility()
    setIsCheckingEligibility(false)
    if (!isAllowed) return
    setSelectedPackage(pkg)
  }

  const handleAddToCart = async (pkg, e) => {
    if (e) e.stopPropagation()
    setIsCheckingEligibility(true)
    const isAllowed = await checkEligibility()
    setIsCheckingEligibility(false)
    if (!isAllowed) return
    setSelectedPackage(pkg); addPackage(pkg); setShowCreditModal(true)
  }

  if (loading) {
    return (
      <section id="pricing" className="py-24 px-6" style={{ background: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full" style={{ background: 'rgba(245,166,35,.1)', border: '1px solid rgba(245,166,35,.25)' }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>{t('loadingPackages', { ns: 'common' })}</span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section id="pricing" className="saas-font relative overflow-hidden py-24 px-6" style={{ background: 'var(--surface)' }}>
        {/* Mesh bg */}
        <div className="g-mesh" />

        <div className="max-w-6xl mx-auto relative z-10">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="g-badge mb-5 inline-flex">
              <span className="g-badge-dot" />
              Pricing Plans
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5"
              style={{ color: 'var(--ink)', letterSpacing: '-.03em' }}>
              {t('pricing.title', { ns: 'landing' })}{' '}
              <span style={{ color: '#FFB800' }}>{t('pricing.titleHighlight', { ns: 'landing' })}</span>
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('pricing.subtitle', { ns: 'landing' })}
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => {
              const isPopular = pkg.popular
              const isHovered = hoveredPkg === pkg.id
              return (
                <div
                  key={pkg.id}
                  className="relative rounded-2xl cursor-pointer flex flex-col transition-all duration-300 g-card"
                  style={{
                    padding: '28px 24px',
                    ...(isPopular ? {
                      border: '1.5px solid rgba(245,166,35,.55)',
                      boxShadow: '0 16px 48px rgba(245,166,35,.2)',
                    } : {}),
                  }}
                  onClick={(e) => handlePlanClick(pkg, e)}
                  onMouseEnter={() => setHoveredPkg(pkg.id)}
                  onMouseLeave={() => setHoveredPkg(null)}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-white shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', color: '#111' }}>
                        <Star className="w-3 h-3 fill-current" />
                        {t('common.mostPopular')}
                      </div>
                    </div>
                  )}

                  {/* Plan name */}
                  <div className="mb-6">
                    <h3 className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>
                      {t(`pricing.packages.${pkg.id}.name`, { ns: 'landing', defaultValue: pkg.name })}
                    </h3>
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-4xl font-extrabold leading-none" style={{ color: '#FFB800' }}>
                        {formatPrice(pkg.price)}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('oneTimePayment', { ns: 'common' })}</p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                      {t(`pricing.packages.${pkg.id}.description`, { ns: 'landing', defaultValue: pkg.description })}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="h-px mb-5" style={{ background: 'rgba(245,166,35,.15)' }} />

                  {/* Features */}
                  <ul className="flex flex-col gap-3 mb-7 flex-1">
                    {pkg.features.map((feature, index) => {
                      const translatedFeature = t(`pricing.packages.${pkg.id}.features.${index}`, { ns: 'landing', defaultValue: feature })
                      return (
                        <li key={index} className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#F5A623,#FFCF6B)', minWidth: 16 }}>
                            <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: '#111' }} />
                          </span>
                          <span className="text-sm leading-snug" style={{ color: 'var(--ink)', opacity: .85 }}>
                            {translatedFeature}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  {/* CTA button */}
                  <button
                    onClick={(e) => handleAddToCart(pkg, e)}
                    disabled={isCheckingEligibility}
                    className="btn-gold-shine w-full flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCheckingEligibility ? (
                      <>
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#111', borderTopColor: 'transparent' }} />
                        {t('checking', { ns: 'common' })}
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        {t('addToCart', { ns: 'common' })}
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              {t('needCustomSolution', { ns: 'common' })}
            </p>
            <button
              onClick={() => window.openModal?.('contactModal')}
              className="btn-ghost-gold px-7 py-2.5 text-sm"
            >
              {t('contactSales', { ns: 'common' })} →
            </button>
          </div>
        </div>
      </section>

      {/* Modals — unchanged */}
      <CreditPackageModal
        isOpen={showCreditModal}
        onClose={(reason) => { if (reason === 'proceed') { setShowCreditModal(false); return; } setShowCreditModal(true) }}
        selectedPackage={selectedPackage}
        onNavigateToCheckout={() => redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency)}
        onConfirmSelection={(creditPkg) => { setShowCreditModal(false); setSelectedCreditPackage(creditPkg); setShowConfirmModal(true) }}
      />
      <ProceedChangeModal
        isOpen={showConfirmModal}
        selectedCreditPackage={selectedCreditPackage}
        onClose={() => setShowConfirmModal(false)}
        onProceed={() => { setShowConfirmModal(false); redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency) }}
        onChange={() => { setShowConfirmModal(false); setShowCreditModal(true) }}
      />
      <EligibilityErrorModal
        isOpen={showEligibilityError}
        onClose={() => setShowEligibilityError(false)}
        message={eligibilityErrorMessage}
      />
    </>
  )
}