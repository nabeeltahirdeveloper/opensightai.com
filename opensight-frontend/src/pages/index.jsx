import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard.jsx";
import Landing from "./Landing.jsx";

import ChartAnalysis from "./ChartAnalysis.jsx";
import AITutor from "./AITutor.jsx";
import History from "./History.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import BrandDashboard from "./BrandDashboard.jsx";
import ResellerDashboard from "./ResellerDashboard.jsx";
import SupportTeam from "./supportTeam.jsx";
import Login from "./Login.jsx";
import BrandLogin from "./BrandLogin.jsx";
import ResellerLogin from "./ResellerLogin.jsx";
import Signup from "./Signup.jsx";


import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import CartSidebar from '@/components/cart/CartSidebar';
import { redirectToCheckout } from '@/utils/checkoutRedirect';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
const PricingLazy = React.lazy(() => import('./Pricing.jsx'))
const PricingPageLazy = React.lazy(() => import('./prices.jsx'))
const PackageLandingLazy = React.lazy(() => import('./PackageLanding.jsx'))
const PaymentGatewayOnboardingLazy = React.lazy(() => import('./PaymentGatewayOnboarding.jsx'))

// Redirect component for old checkout routes
function CheckoutRedirect() {
  const cart = useCart();
  const { selectedCurrency } = useCurrency();
  
  useEffect(() => {
    // Redirect with cart data
    redirectToCheckout(cart, selectedCurrency);
  }, []);
  
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black/80 text-white">
      <div className="text-center">
        <div className="loading-spinner mb-4"></div>
        <p>Redirecting to secure checkout...</p>
      </div>
    </div>
  );
}

const PAGES = {
    
    Dashboard: Dashboard,
    
    ChartAnalysis: ChartAnalysis,
    
    AITutor: AITutor,
    
    History: History,
    
    SupportTeam: SupportTeam,
    AdminDashboard: AdminDashboard,
    BrandDashboard: BrandDashboard,
    ResellerDashboard: ResellerDashboard,
    Login: Login,
    Signup, 
    BrandLogin: BrandLogin,
    ResellerLogin: ResellerLogin,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPage = _getCurrentPage(location.pathname);
    
    // Check if current route should be standalone (no Layout wrapper)
    const standaloneRoutes = ['/admin-dashboard', '/brand-dashboard', '/reseller-dashboard', '/prices', '/login', '/signup', '/support-team'];
    const isStandalone = standaloneRoutes.includes(location.pathname) || 
                        location.pathname.startsWith('/package/') || 
                        location.pathname.startsWith('/credits/') ||
                        location.pathname.startsWith('/docs/') ||
                        location.pathname.startsWith('/prices') ||
                        location.pathname.startsWith('/login') ||
                        location.pathname.startsWith('/signup') ||
                        location.pathname.startsWith('/support-team');
    
    if (isStandalone) {
        return (
            <React.Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-black/80 text-white">Loading...</div>}>
                <Routes>
                    <Route path="/admin-dashboard" element={<AdminDashboard />} />
                    <Route path="/brand-dashboard" element={<BrandDashboard />} />
                    <Route path="/reseller-dashboard" element={<ResellerDashboard />} />
                    <Route path="/package/:packageId" element={<PackageLandingLazy />} />
                    <Route path="/credits/:packageId" element={<PackageLandingLazy />} />
                    <Route path="/docs/payment_gateway_onboarding" element={<PaymentGatewayOnboardingLazy />} />
                    <Route path="/docs/payment-gateway-onboarding" element={<PaymentGatewayOnboardingLazy />} />
                    <Route path="/prices" element={<PricingPageLazy />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/support-team" element={<SupportTeam />} />
                    {/* Catch-all route for standalone routes that don't match */}
                    <Route path="*" element={
                        <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                                <div className="text-xl text-gray-600 mb-2">Redirecting...</div>
                                <div className="loading-spinner mx-auto"></div>
                            </div>
                        </div>
                    } />
                </Routes>
            </React.Suspense>
        );
    }
    
    return (
        <Layout currentPageName={currentPage}>
            <React.Suspense fallback={<div className="w-full p-6">Loading...</div>}>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chart-analysis" element={<ChartAnalysis />} />
                    <Route path="/chartanalysis" element={<ChartAnalysis />} />
                    <Route path="/ai-tutor" element={<AITutor />} />
                    <Route path="/aitutor" element={<AITutor />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/pricing" element={<PricingLazy />} />
                    <Route path="/prices" element={<PricingPageLazy />} />
                    <Route path="/checkout" element={<CheckoutRedirect />} />
                    <Route path="/payment-result" element={<CheckoutRedirect />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/brand-login" element={<BrandLogin />} />
                    <Route path="/reseller-login" element={<ResellerLogin />} />
                    <Route path="/support-team" element={<SupportTeam />} />
                </Routes>
            </React.Suspense>
            <CartSidebar />
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}