
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, TrendingUp, ShoppingCart, Star } from "lucide-react";
import { motion } from "framer-motion";
import { packages as fallbackPackages } from '@/data/packages';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import CreditPackageModal from '@/components/cart/CreditPackageModal';
import ProceedChangeModal from '@/components/cart/ProceedChangeModal';
import { serverApi } from '@/api/serverApi';
import { redirectToCheckout } from '@/utils/checkoutRedirect';

const PricingCard = ({ pkg, index, onAddToCart }) => {
  const { formatPrice } = useCurrency();
  const colorClasses = {
    blue: "from-blue-600 to-blue-800",
    orange: "from-orange-500 to-orange-600",
    purple: "from-purple-600 to-purple-800",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className="relative"
    >
      {pkg.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-lg flex items-center gap-1">
            <Star className="w-3 h-3" />
            Most Popular
          </div>
        </div>
      )}
      <Card className={`h-full flex flex-col bg-white/80 backdrop-blur-sm shadow-xl border-0 ${pkg.popular ? 'border-2 border-orange-400' : ''}`}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-800">{pkg.name}</CardTitle>
          <p className="text-4xl font-extrabold gradient-text mt-4">{formatPrice(pkg.price)}</p>
          <p className="text-sm text-slate-500">per user, one-time</p>
          <p className="text-sm text-slate-600 mt-2">{pkg.description}</p>
        </CardHeader>
        <CardContent className="flex-1">
          <ul className="space-y-3">
            {pkg.features.slice(0, 8).map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-r ${colorClasses[pkg.color]}`}>
                    <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-slate-600">{feature}</span>
              </li>
            ))}
            {pkg.features.length > 8 && (
              <li className="text-slate-500 text-sm">
                + {pkg.features.length - 8} more features...
              </li>
            )}
          </ul>
        </CardContent>
        <CardFooter>
          <Button 
            size="lg" 
            onClick={() => onAddToCart(pkg)}
            className={`w-full bg-gradient-to-r ${colorClasses[pkg.color]} hover:shadow-xl transition-all flex items-center justify-center gap-2`}
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addPackage, items, totalAmount, totalItems } = useCart();
  const { formatPrice, selectedCurrency } = useCurrency();
  const [packages, setPackages] = useState(fallbackPackages);
  const [loading, setLoading] = useState(true);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(null);

  // Capture referral slug from URL parameters (?ref= or ?b=)
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('b');
    if (ref) {
      try {
        localStorage.setItem('vs_referral_slug', ref);
        console.log('[referral] Captured brand slug:', ref);
      } catch (e) {
        console.error('[referral] Failed to store slug:', e);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await serverApi.packages.listPublic();
        if (data.packages && data.packages.length > 0) {
          // Convert price strings to numbers for .toFixed() compatibility
          const normalizedPackages = data.packages.map(pkg => ({
            ...pkg,
            price: Number(pkg.price),
            credits: pkg.credits === 'unlimited' || pkg.credits === null ? 'unlimited' : Number(pkg.credits)
          }));
          setPackages(normalizedPackages);
        }
      } catch (error) {
        console.error('Failed to fetch packages, using fallback:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const handleAddToCart = (pkg) => {
    setSelectedPackage(pkg);
    addPackage(pkg);
    setShowCreditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8 flex items-center justify-center">
        <div className="text-xl text-slate-600">Loading packages...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <header className="text-center mb-16">
          <div className="inline-block bg-white p-3 rounded-xl shadow-md mb-4">
              <TrendingUp className="w-8 h-8 gradient-text" />
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900">
            Find Your Perfect Plan
          </h1>
          <p className="text-xl text-slate-600 mt-4 max-w-2xl mx-auto">
            Unlock powerful market insights with the right package for your needs.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/login"><Button>Sign in</Button></Link>
          </div>
        </header>
        
        <main className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg, index) => (
              <PricingCard 
                key={pkg.id} 
                pkg={pkg} 
                index={index} 
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </main>

        <footer className="text-center mt-16 text-slate-500">
            <p>
              Payment processing is handled securely. For questions, email 
              <a href="mailto:suuport@OpenSightai.com" className="underline hover:text-slate-700"> suuport@OpenSightai.com</a> 
              or call 
              <a href="tel:+447537106208" className="underline hover:text-slate-700">+44-7537-106208</a>.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <a href="/terms.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">Terms</a>
              <span>•</span>
              <a href="/privacy.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">Privacy</a>
              <span>•</span>
              <a href="/cookie-policy.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">Cookies</a>
              <span>•</span>
              <a href="/refund-policy.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">Refunds</a>
              <span>•</span>
              <a href="/acceptable-use.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">Acceptable Use</a>
              <span>•</span>
              <a href="/privacy.html" target="_blank" rel="noopener" className="underline hover:text-slate-700">GDPR</a>
            </div>
            <div className="mt-3">
              <a href="/privacy.html" target="_blank" rel="noopener" aria-label="GDPR Privacy Policy" className="inline-block">
                <img src="https://img.shields.io/badge/Privacy-GDPR-gold?style=for-the-badge" alt="GDPR Compliant" className="h-6 inline" />
              </a>
            </div>
            <p className="font-bold mt-2">OpenSightAI © 2025</p>
            <p className="text-xs text-slate-400 mt-2">Disclaimer: OpenSightAI is a technological research tool and does not provide financial or investment advice.</p>
        </footer>
      </div>

      <CreditPackageModal
        isOpen={showCreditModal}
        onClose={(reason) => {
          if (reason === 'proceed') {
            setShowCreditModal(false);
            return;
          }
          // Auto-reopen if closed accidentally or by user without proceeding
          setShowCreditModal(true);
        }}
        selectedPackage={selectedPackage}
        onNavigateToCheckout={() => redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency)}
        onConfirmSelection={(creditPkg) => {
          setShowCreditModal(false);
          setSelectedCreditPackage(creditPkg);
          setShowConfirmModal(true);
        }}
      />

      <ProceedChangeModal
        isOpen={showConfirmModal}
        selectedCreditPackage={selectedCreditPackage}
        onClose={() => setShowConfirmModal(false)}
        onProceed={() => {
          setShowConfirmModal(false);
          redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency);
        }}
        onChange={() => {
          setShowConfirmModal(false);
          setShowCreditModal(true);
        }}
      />
    </>
  );
}
