import './App.css'
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { CartProvider } from '@/contexts/CartContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { captureLinkIdFromUrl } from '@/utils/linkTracking'
import { parseCartFromUrl } from '@/utils/cartHydration'
import { checkVpnStatus } from '@/utils/vpnChecker'
import VpnBlocker from '@/components/VpnBlocker'
import Pay from '@/pages/Pay'
import Success from '@/pages/Success'
import DirectPurchasePage from '@/pages/DirectPurchasePage'
import ErrorMode from '@/components/ErrorMode.jsx'


function App() {
  const [vpnCheckComplete, setVpnCheckComplete] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isErrorMode, setIsErrorMode] = useState(false)
  
  // Parse URL params to get initial cart state
  const searchParams = new URLSearchParams(window.location.search);
  const { items, currency, linkId } = parseCartFromUrl(searchParams);
  
  // Initialize VPN check and link tracking on mount
  useEffect(() => {
    async function init() {
      // Check VPN/Proxy status first
      const vpnStatus = await checkVpnStatus()
      
      if (!vpnStatus.allowed) {
        setIsBlocked(true)
      }
      
      setVpnCheckComplete(true)
      
      // Only proceed with tracking if not blocked
      if (vpnStatus.allowed) {
        captureLinkIdFromUrl()
      }
    }
    
    init()
  }, [])

  // Show loading or blocked state
  if (!vpnCheckComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // if (isBlocked) {
  //   return <VpnBlocker />
  // }

  if (isErrorMode) {
    return <ErrorMode />
  }

  return (
    <CurrencyProvider initialCurrency={currency}>
      <CartProvider initialItems={items}>
        <Router>
          <Routes>
            <Route path="/" element={<Pay />} />
            <Route path="/pay" element={<Pay />} />
            <Route path="/direct-purchase/:linkId" element={<DirectPurchasePage />} />
            <Route path="/success" element={<Success />} />
            <Route path="/payment-success" element={<Success />} />
            <Route path="/payment-failed" element={<Success />} />
          </Routes>
        </Router>
      </CartProvider>
    </CurrencyProvider>
  )
}

export default App

