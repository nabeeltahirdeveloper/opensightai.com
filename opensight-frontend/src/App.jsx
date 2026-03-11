import './App.css'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { CartProvider } from "@/contexts/CartContext"
import { CurrencyProvider } from "@/contexts/CurrencyContext"
import { initVisitTracking } from "@/utils/visitTracker"
import { captureLinkIdFromUrl } from "@/utils/linkTracking"
import SupportTeam from "@/pages/supportTeam.jsx"
import { checkVpnStatus } from "@/utils/vpnChecker"
import VpnBlocker from "@/components/VpnBlocker"
import Maintenance from "@/components/Maintenance.jsx"
import ErrorMode from "@/components/ErrorMode.jsx"
function App() {
  const { t, i18n } = useTranslation('common')
  // Set to true to enable maintenance mode
  const [isMaintenanceMode] = useState(false)
  const [isErrorMode, setIsErrorMode] = useState(false)
  const [vpnCheckComplete, setVpnCheckComplete] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState(null)

  // Set document title based on language
  useEffect(() => {
    const title = i18n.language === 'tr' ? 'ScopeZeka' : 'OpenSightAI'
    document.title = title
  }, [i18n.language])

  // Initialize VPN check, visit tracking and link tracking on mount
  useEffect(() => {
    async function init() {
      const currentPath = typeof window !== 'undefined' ? (window.location?.pathname || '') : ''
      const skipVpnCheck = currentPath === '/brand-login' || currentPath === '/brand-dashboard'
      if (skipVpnCheck) {
        setVpnCheckComplete(true)
        initVisitTracking()
        captureLinkIdFromUrl()
        return
      }

      // Check VPN/Proxy status first
      const vpnStatus = await checkVpnStatus()
      
      if (!vpnStatus.allowed) {
        setIsBlocked(true)
        setBlockReason(vpnStatus.blockReason || 'vpn')
      }
      
      setVpnCheckComplete(true)
      
      // Only proceed with tracking if not blocked
      if (vpnStatus.allowed) {
        initVisitTracking()
        captureLinkIdFromUrl()
      }
    }
    
    init()
  }, [])

  // Show maintenance mode
  if (isMaintenanceMode) {
    return <Maintenance />
  }

  if (isErrorMode) {
    return <ErrorMode />
  }

  // Show loading or blocked state
  if (!vpnCheckComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return <VpnBlocker blockReason={blockReason} />
  }

  return (
    <CurrencyProvider>
      <CartProvider>
        <Pages />
        <Toaster />
      </CartProvider>
    </CurrencyProvider>
  )
}

export default App 