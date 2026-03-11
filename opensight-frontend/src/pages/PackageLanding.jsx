import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { ShoppingCart, Star, Check } from "lucide-react";
import { packages as fallbackPackages } from '@/data/packages';
import { pricesCustomConfig as fallbackCustomConfig, pricesCustomFeatures } from '@/data/pricesPackages';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import CreditPackageModal from '@/components/cart/CreditPackageModal';
import ProceedChangeModal from '@/components/cart/ProceedChangeModal';
import CartSidebar from '@/components/cart/CartSidebar';
import LandingStyles from '@/components/landing/LandingStyles';
import LandingScripts from '@/components/landing/LandingScripts';
import CurrencySelector from '@/components/CurrencySelector';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { serverApi } from '@/api/serverApi';
import { redirectToCheckout } from '@/utils/checkoutRedirect';

const PricingCard = ({ pkg, onAddToCart }) => {
  const { formatPrice } = useCurrency();

  return (
    <div className="premium-card p-8 relative max-w-md mx-auto">
      {pkg.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-1">
            <Star className="w-3 h-3" />
            Most Popular
          </div>
        </div>
      )}
      
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold heading-font text-gray-800 mb-2">
          {pkg.name}
        </h3>
        <div className="text-5xl font-bold text-gold mb-2">
          {formatPrice(pkg.price)}
        </div>
        <p className="text-gray-600">One-time payment</p>
        <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
      </div>
      
      <ul className="space-y-4 mb-8">
        {pkg.features.map((feature, index) => (
          <li key={index} className="flex items-start space-x-3">
            <i className="fas fa-check text-gold mt-1"></i>
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      
      <button 
        onClick={() => onAddToCart(pkg)}
        className="btn-premium w-full flex items-center justify-center gap-2 hover:transform hover:scale-105 transition-transform"
      >
        <ShoppingCart className="w-4 h-4" />
        Buy Now
      </button>
    </div>
  );
};

const CustomCreditsCard = ({ 
  customCredits, 
  setCustomCredits, 
  MIN_PRICE_USD, 
  MAX_PRICE_USD, 
  stepUsd, 
  features, 
  onChooseCustom,
  selectedCurrency,
  currentCurrency,
  exchangeRates
}) => {
  const currencySymbol = currentCurrency?.symbol || "$";
  const rate = exchangeRates?.[selectedCurrency] || 1;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getDisplayedPrice = () => {
    const price = customCredits * rate;
    return Math.round(price * 100) / 100;
  };

  const sliderValueUSD = clamp(customCredits, MIN_PRICE_USD, MAX_PRICE_USD);
  const creditsToReceive = getDisplayedPrice();

  const handleSliderChange = (value) => {
    const usd = value?.[0] ?? MIN_PRICE_USD;
    setCustomCredits(clamp(usd, MIN_PRICE_USD, MAX_PRICE_USD));
  };

  const handleInputChange = (e) => {
    const inputValue = parseFloat(e.target.value);
    const safeValue = Number.isFinite(inputValue) ? inputValue : 0;
    const usd = safeValue / rate;
    setCustomCredits(clamp(usd, MIN_PRICE_USD, MAX_PRICE_USD));
  };

  return (
    <div className="premium-card p-8 relative max-w-md mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold heading-font text-gray-800 mb-2">Custom Credits Package</h3>
        <div className="text-5xl font-bold text-gold mb-2">
          {currencySymbol}{getDisplayedPrice().toFixed(2)}
        </div>
        <div className="text-lg font-semibold text-slate-800">
          {customCredits >= 1500 ? 'Unlimited credits' : `${Math.floor(creditsToReceive).toLocaleString()} credits`}
        </div>
        <p className="text-gray-600">custom credits, one-time</p>
      </div>

      <div className="space-y-5 mb-8">
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2 text-center">
            Enter price ({currencySymbol})
          </div>
          <div className="custom-input-wrapper">
            <span className="currency-symbol">{currencySymbol}</span>
            <Input
              type="number"
              value={getDisplayedPrice().toFixed(2)}
              onChange={handleInputChange}
              className="w-full h-12 text-lg font-semibold"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Slider
            value={[sliderValueUSD]}
            onValueChange={handleSliderChange}
            min={MIN_PRICE_USD}
            max={MAX_PRICE_USD}
            step={stepUsd}
            className="custom-slider"
          />
        </div>

        <div className="text-center pt-1">
          <div className="text-sm text-gray-600 mb-1">You'll receive</div>
          <div className="text-2xl font-bold text-gray-800">
            {customCredits >= 1500 ? 'Unlimited' : Math.floor(creditsToReceive).toLocaleString()} Credits
          </div>
        </div>
      </div>

      <ul className="space-y-4 mb-8">
        {(features || []).map((feature, i) => (
          <li key={i} className="flex items-start space-x-3">
            <Check className="w-4 h-4 text-gold mt-1" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onChooseCustom}
        className="btn-premium w-full flex items-center justify-center gap-2 hover:transform hover:scale-105 transition-transform"
      >
        <ShoppingCart className="w-4 h-4" />
        Buy Now
      </button>
    </div>
  );
};

export default function PackageLanding() {
  const navigate = useNavigate();
  const { packageId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { addPackage, addCreditPackage, clearCart } = useCart();
  const { formatPrice, detectedCountry, selectedCurrency, currentCurrency, exchangeRates } = useCurrency();
  const [packages, setPackages] = useState(fallbackPackages);
  const [customConfig, setCustomConfig] = useState(fallbackCustomConfig);
  const [loading, setLoading] = useState(true);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(null);
  const [packageNotFound, setPackageNotFound] = useState(false);
  const [customCredits, setCustomCredits] = useState(100.0);
  
  // Check if this is a credit package route
  const isCreditRoute = location.pathname.startsWith('/credits/');
  const isCustom = packageId && packageId.toLowerCase() === 'custom';
  
  const MIN_PRICE_USD = customConfig?.minUsd ?? fallbackCustomConfig.minUsd;
  const MAX_PRICE_USD = customConfig?.maxUsd ?? fallbackCustomConfig.maxUsd;
  const STEP_USD = customConfig?.stepUsd ?? fallbackCustomConfig.stepUsd;

  // Capture link ID and brand slug from URL parameters for brand tracking
  useEffect(() => {
    const linkId = searchParams.get('link');
    if (linkId) {
      try {
        sessionStorage.setItem('vs_link_id', linkId);
        console.log('[link tracking] Captured link ID:', linkId);
      } catch (e) {
        console.error('[link tracking] Failed to store link ID:', e);
      }
    }
    
    const brandSlug = searchParams.get('b');
    if (brandSlug) {
      try {
        localStorage.setItem('vs_referral_slug', brandSlug);
        console.log('[referral] Captured brand slug:', brandSlug);
      } catch (e) {
        console.error('[referral] Failed to store brand slug:', e);
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
        
        // Fetch custom config if available
        if (data.customConfig) {
          setCustomConfig(data.customConfig);
        }
      } catch (error) {
        console.error('Failed to fetch packages, using fallback:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  // Find the specific package once packages are loaded
  useEffect(() => {
    if (!loading && packageId && !isCustom) {
      if (isCreditRoute) {
        // For credit routes, search in credit packages (if we had them)
        // For now, also search in regular packages
        const pkg = packages.find(p => p.id === packageId || p.id?.toLowerCase() === packageId?.toLowerCase());
        if (pkg) {
          setSelectedPackage(pkg);
          setPackageNotFound(false);
        } else {
          setPackageNotFound(true);
        }
      } else {
        // For regular package routes, search in regular packages
        const pkg = packages.find(p => p.id === packageId || p.id?.toLowerCase() === packageId?.toLowerCase());
        if (pkg) {
          setSelectedPackage(pkg);
          setPackageNotFound(false);
        } else {
          setPackageNotFound(true);
        }
      }
    }
  }, [loading, packageId, packages, isCreditRoute, isCustom]);

  const handleAddToCart = (pkg) => {
    if (isCreditRoute) {
      // For credit packages, add directly to cart
      addCreditPackage({
        ...pkg,
        type: 'credits',
        quantity: 1
      });
      navigate('/checkout');
    } else {
      // For regular packages, show credit modal
      addPackage(pkg);
      setShowCreditModal(true);
    }
  };

  const handleChooseCustom = () => {
    if (customCredits < MIN_PRICE_USD) {
      return;
    }

    // Reset cart
    clearCart();

    // Create custom package
    const customPkg = {
      id: `custom-credits-${Date.now()}`,
      name: "Custom Credits Package",
      price: customCredits,
      credits: customCredits,
      custom: true,
      type: "credits",
      quantity: 1,
    };

    // Add to cart
    addCreditPackage(customPkg);

    // Redirect to checkout
    redirectToCheckout(
      {
        items: [customPkg],
        totalItems: 1,
        totalAmount: customCredits,
      },
      selectedCurrency
    );
  };

  if (loading) {
    return (
      <>
        <LandingStyles />
        <LandingScripts />
        <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
          <div className="text-xl text-gray-600">Loading package...</div>
        </div>
      </>
    );
  }

  // Don't show package not found for custom credits
  if (packageNotFound && !isCustom) {
    return (
      <>
        <LandingStyles />
        <LandingScripts />
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-2xl mx-auto mt-16">
            <div className="premium-card p-12 text-center">
              <i className="fas fa-exclamation-circle text-6xl text-orange-500 mb-4"></i>
              <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">Package Not Found</h1>
              <p className="text-gray-600 mb-6">
                The package you're looking for doesn't exist or has been removed.
              </p>
              <a href="/pricing" className="btn-premium inline-flex items-center justify-center gap-2">
                View All Packages
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <LandingStyles />
      <LandingScripts />
      {isCustom && (
        <style>{`
          .custom-slider [data-radix-slider-track] { background: #f0f0f0 !important; height: 6px !important; border-radius: 3px !important; }
          .custom-slider [data-radix-slider-range] { background: linear-gradient(90deg, var(--gold), var(--orange)) !important; height: 100% !important; border-radius: 3px !important; }
          .custom-slider [data-radix-slider-thumb] { width: 20px !important; height: 20px !important; background: white !important; border: 3px solid var(--gold) !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3) !important; cursor: grab !important; }
          .custom-slider [data-radix-slider-thumb]:active { cursor: grabbing !important; }
          .custom-slider [data-radix-slider-thumb]:hover { border-color: var(--orange) !important; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4) !important; }
          .custom-input-wrapper { position: relative; display: flex; align-items: center; }
          .custom-input-wrapper .currency-symbol { position: absolute; left: 12px; color: #6B7280; font-weight: 600; pointer-events: none; z-index: 10; }
          .custom-input-wrapper input { border: 2px solid #e5e7eb; border-radius: 8px; font-size: 18px; font-weight: 600; padding-left: 40px; }
          .custom-input-wrapper input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1); }
        `}</style>
      )}
      
      {/* Header with Currency Selector */}
      <header className="glass-effect sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 gradient-gold rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-xl"></i>
            </div>
            <span className="text-2xl font-bold heading-font text-gray-800">OpenSightAI</span>
          </div>
          <div className="flex items-center gap-3">
            {detectedCountry && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/50 rounded-lg">
                <i className="fas fa-map-marker-alt text-gold"></i>
                <span className="text-sm text-gray-700">{detectedCountry}</span>
              </div>
            )}
            <CurrencySelector />
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-gray-50 py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold heading-font text-gray-800 mb-6">
              {isCustom ? 'Custom Credits' : selectedPackage?.name} <span className="text-gold">Package</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              {isCustom ? 'Choose your custom credit amount' : (selectedPackage?.description || 'Unlock powerful market insights with this package.')}
            </p>
          </div>
          
          <div className="max-w-md mx-auto">
            {isCustom ? (
              <CustomCreditsCard
                customCredits={customCredits}
                setCustomCredits={setCustomCredits}
                MIN_PRICE_USD={MIN_PRICE_USD}
                MAX_PRICE_USD={MAX_PRICE_USD}
                stepUsd={STEP_USD}
                features={pricesCustomFeatures}
                onChooseCustom={handleChooseCustom}
                selectedCurrency={selectedCurrency}
                currentCurrency={currentCurrency}
                exchangeRates={exchangeRates}
              />
            ) : selectedPackage ? (
              <PricingCard 
                pkg={selectedPackage} 
                onAddToCart={handleAddToCart}
              />
            ) : null}
          </div>

          <footer className="text-center mt-16 text-gray-500">
            <p className="mb-4">
              Payment processing is handled securely. For questions, email 
              <a href="mailto:suuport@OpenSightai.com" className="text-gold hover:underline"> suuport@OpenSightai.com</a> 
              or call 
              <a href="tel:+447537106208" className="text-gold hover:underline"> +44-7537-106208</a>.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 text-sm">
              <a href="/terms.html" target="_blank" rel="noopener" className="hover:text-gold">Terms</a>
              <span>•</span>
              <a href="/privacy.html" target="_blank" rel="noopener" className="hover:text-gold">Privacy</a>
              <span>•</span>
              <a href="/cookie-policy.html" target="_blank" rel="noopener" className="hover:text-gold">Cookies</a>
              <span>•</span>
              <a href="/refund-policy.html" target="_blank" rel="noopener" className="hover:text-gold">Refunds</a>
              <span>•</span>
              <a href="/acceptable-use.html" target="_blank" rel="noopener" className="hover:text-gold">Acceptable Use</a>
              <span>•</span>
              <a href="/privacy.html" target="_blank" rel="noopener" className="hover:text-gold">GDPR</a>
            </div>
            <div className="mt-3">
              <a href="/privacy.html" target="_blank" rel="noopener" aria-label="GDPR Privacy Policy" className="inline-block">
                <img src="https://img.shields.io/badge/Privacy-GDPR-gold?style=for-the-badge" alt="GDPR Compliant" className="h-6 inline" />
              </a>
            </div>
            <p className="font-bold mt-3 text-gray-800">OpenSightAI © 2025</p>
            <p className="text-xs text-gray-400 mt-2">Disclaimer: OpenSightAI is a technological research tool and does not provide financial or investment advice.</p>
          </footer>
        </div>
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
        onNavigateToCheckout={() => navigate('/checkout')}
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
          navigate('/checkout');
        }}
        onChange={() => {
          setShowConfirmModal(false);
          setShowCreditModal(true);
        }}
      />

      <CartSidebar onNavigateToCheckout={() => navigate('/checkout')} />
    </>
  );
}

