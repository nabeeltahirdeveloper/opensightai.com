import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { creditPackages as fallbackCreditPackages } from '@/data/packages';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import LandingStyles from '@/components/landing/LandingStyles.jsx';
import { serverApi } from '@/api/serverApi';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

export default function CreditPackageModal({ isOpen, onClose, selectedPackage, onNavigateToCheckout, onConfirmSelection }) {
  const { addCreditPackage } = useCart();
  const { formatPrice, selectedCurrency, currentCurrency, convertPrice, exchangeRates } = useCurrency();
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(null);
  const [creditPackages, setCreditPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Custom plan state - only credits mode
  const [customCredits, setCustomCredits] = useState(100.00); // Credits value (1 USD = 1 credit)
  const MIN_CREDITS = 1;
  const MAX_CREDITS = 1500;

  useEffect(() => {
    const fetchCreditPackages = async () => {
      try {
        setLoading(true);
        const data = await serverApi.packages.listPublic();
        console.log('Fetched credit packages from database:', data.creditPackages);
        
        if (data.creditPackages && data.creditPackages.length > 0) {
          // Convert price strings to numbers for .toFixed() compatibility
          const normalizedCreditPackages = data.creditPackages.map(pkg => ({
            ...pkg,
            price: Number(pkg.price),
            credits: pkg.credits === 'unlimited' || pkg.credits === null ? 'unlimited' : Number(pkg.credits),
            unlimited: pkg.credits === 'unlimited' || pkg.credits === null
          }));
          setCreditPackages(normalizedCreditPackages);
        } else {
          console.warn('No credit packages returned from API, using fallback');
          setCreditPackages(fallbackCreditPackages);
        }
      } catch (error) {
        console.error('Failed to fetch credit packages, using fallback:', error);
        setCreditPackages(fallbackCreditPackages);
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      fetchCreditPackages();
    }
  }, [isOpen]);

  const handleSelectCreditPackage = (creditPackage) => {
    setSelectedCreditPackage(creditPackage);
  };

  const handleAddToCart = (creditPackage) => {
    const pkg = creditPackage || selectedCreditPackage;
    if (pkg) {
      addCreditPackage(pkg);
      onClose && onClose('proceed');
      onConfirmSelection && onConfirmSelection(pkg);
    }
  };

  const handleChangeSelection = () => {
    setSelectedCreditPackage(null);
  };

  // Custom plan handlers - credits only
  const getCustomPriceUSD = () => {
    return customCredits; // 1 USD = 1 credit (exact match, no rounding)
  };

  const getCustomPriceInCurrentCurrency = () => {
    // Convert to current currency without rounding up
    // If USD, price = credits exactly (1 USD = 1 credit)
    // For other currencies, convert but preserve exact decimals
    const rate = exchangeRates[selectedCurrency] || 1;
    const price = customCredits * rate;
    // Round to 2 decimal places without rounding up (use Math.round, not Math.ceil)
    return Math.round(price * 100) / 100;
  };

  const formatCustomPrice = () => {
    const currency = currentCurrency;
    if (!currency) return `${customCredits.toFixed(2)}$`;
    
    const priceInCurrentCurrency = getCustomPriceInCurrentCurrency();
    const symbol = currency.symbol;
    
    return `${priceInCurrentCurrency.toFixed(2)}${symbol}`;
  };

  // Handle slider change (credits)
  const handleCustomSliderChange = (value) => {
    const newCredits = value[0];
    const roundedCredits = Math.round(newCredits * 100) / 100; // Round to 2 decimal places
    setCustomCredits(Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, roundedCredits)));
  };

  // Handle input change (credits)
  const handleCustomInputChange = (e) => {
    const inputValue = parseFloat(e.target.value) || 0;
    const roundedCredits = Math.round(inputValue * 100) / 100; // Round to 2 decimal places
    const clampedCredits = Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, roundedCredits));
    setCustomCredits(clampedCredits);
  };

  // Handle custom plan submission
  const handleCustomPlanSubmit = () => {
    const customPackage = {
      id: `custom-credits-${Date.now()}`,
      name: 'Custom Plan',
      price: getCustomPriceUSD(), // Store in USD for consistency (1 USD = 1 credit)
      credits: customCredits,
      description: 'Custom credit package',
      features: ['Custom amount of credits', 'Flexible pricing'],
      custom: true
    };
    
    handleAddToCart(customPackage);
  };

  return (
    <Dialog
      open={isOpen}
      // If something external tries to close the dialog, inform parent with reason so it can auto-reopen
      onOpenChange={(open) => {
        if (!open) {
          onClose && onClose('accidental');
        }
      }}
    >
      <DialogContent hideClose
        className="w-[95vw] sm:max-w-2xl lg:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden pb-24 sm:pb-0"
        // Prevent accidental dismiss via Escape key or outside click
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <LandingStyles />
        <style>{`
          .credit-card { background: white; border-radius: 16px; border: 2px solid #f0f0f0; transition: all 0.3s ease; cursor: pointer; position: relative; }
          .credit-card:hover { border-color: var(--gold); transform: translateY(-3px); box-shadow: 0 15px 30px rgba(255, 215, 0, 0.2); }
          .credit-card.popular { border-color: var(--gold); transform: scale(1.02); }
          .credit-card.popular::before { content: "MOST POPULAR"; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--gold), var(--orange)); color: white; padding: 6px 16px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
          .credit-badge { background: linear-gradient(135deg, var(--gold), var(--amber)); color: white; font-weight: 700; font-size: 24px; padding: 8px 16px; border-radius: 12px; margin-bottom: 16px; display: inline-block; }
          .unlimited-badge { background: linear-gradient(135deg, #6B73FF, #9644FF); color: white; font-weight: 700; font-size: 20px; padding: 8px 16px; border-radius: 12px; margin-bottom: 16px; display: inline-block; }
          .credit-card.selected { border-color: var(--orange) !important; background: linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(255, 107, 53, 0.05)); transform: translateY(-3px); box-shadow: 0 15px 30px rgba(255, 107, 53, 0.3); }
          
          .custom-plan-card { background: white; border-radius: 16px; border: 2px solid #f0f0f0; transition: all 0.3s ease; cursor: pointer; position: relative; }
          .custom-plan-card:hover { border-color: var(--gold); transform: translateY(-3px); box-shadow: 0 15px 30px rgba(255, 215, 0, 0.2); }
          
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

        <DialogHeader>
          <div className="text-center mb-4">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="w-12 h-12 gradient-gold rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-2xl"></i>
              </div>
              <h1 className="text-3xl font-bold heading-font text-gray-800">OpenSightAI</h1>
            </div>
            <DialogTitle className="text-2xl font-bold heading-font text-gray-800">Choose Your Credit Package</DialogTitle>
          </div>
          <p className="text-gray-600 mt-1 text-center">
            {selectedPackage && (
              <>
                You've selected the <strong>{selectedPackage.name}</strong> plan ({formatPrice(Number(selectedPackage.price))}). Now choose a credit package to power your analyses.
              </>
            )}
          </p>
        </DialogHeader>

        <div className="floating-particles">
          <div className="particle" style={{ width: 4, height: 4, left: '10%', animationDelay: '0s' }}></div>
          <div className="particle" style={{ width: 6, height: 6, left: '30%', animationDelay: '2s' }}></div>
          <div className="particle" style={{ width: 8, height: 8, left: '60%', animationDelay: '4s' }}></div>
          <div className="particle" style={{ width: 4, height: 4, left: '80%', animationDelay: '1s' }}></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
              <p className="text-gray-600">Loading credit packages...</p>
            </div>
          </div>
        ) : creditPackages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600">No credit packages available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {/* Custom Plan Card - First */}
            <div className="custom-plan-card p-6">
              <div className="text-center mb-4">
                <div className="credit-badge">
                  Custom
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Custom Plan</h3>
                <p className="text-gray-600 mb-4">Personalized plans for every business</p>
              </div>

              {/* Price Label */}
              <div className="mb-3">
                <label className="block text-lg font-semibold text-gray-800 text-center">
                  Price
                </label>
              </div>

              {/* Price Display */}
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-800 text-center">
                  {selectedCurrency === 'USD' 
                    ? customCredits.toFixed(2)
                    : getCustomPriceInCurrentCurrency().toFixed(2)
                  }
                </div>
              </div>

              {/* Slider */}
              <div className="mb-4">
                <Slider
                  value={[customCredits]}
                  onValueChange={handleCustomSliderChange}
                  min={MIN_CREDITS}
                  max={MAX_CREDITS}
                  step={0.01}
                  className="custom-slider"
                />
              </div>

              {/* Price Input Field with Currency Symbol */}
              <div className="mb-4">
                <div className="custom-input-wrapper">
                  <span className="currency-symbol">{currentCurrency?.symbol || '$'}</span>
                  <Input
                    type="number"
                    value={selectedCurrency === 'USD' 
                      ? customCredits.toFixed(2)
                      : getCustomPriceInCurrentCurrency().toFixed(2)
                    }
                    onChange={(e) => {
                      const inputValue = parseFloat(e.target.value) || 0;
                      const rate = exchangeRates[selectedCurrency] || 1;
                      // Convert from current currency to USD, then to credits (1 USD = 1 credit)
                      const creditsFromPrice = inputValue / rate;
                      const roundedCredits = Math.round(creditsFromPrice * 100) / 100;
                      const clampedCredits = Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, roundedCredits));
                      setCustomCredits(clampedCredits);
                    }}
                    min={(MIN_CREDITS * (exchangeRates[selectedCurrency] || 1)).toFixed(2)}
                    max={(MAX_CREDITS * (exchangeRates[selectedCurrency] || 1)).toFixed(2)}
                    step={0.01}
                    className="w-full h-12"
                    placeholder="Enter price"
                  />
                </div>
              </div>

              {/* Credits Display */}
              <div className="mb-4 text-center">
                <div className="text-sm text-gray-600 mb-1">
                  Credits
                </div>
                <div className="text-xl font-bold text-gray-800">
                  {customCredits.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleCustomPlanSubmit}
                className="btn-premium w-full"
              >
                Select Package
              </button>
            </div>

            {/* Regular Packages */}
            {creditPackages.map((creditPkg) => {
              const isSelected = selectedCreditPackage?.id === creditPkg.id;
              const packagePrice = Number(creditPkg.price);
              const formattedPrice = formatPrice(packagePrice);
              
              return (
                <div
                  key={creditPkg.id}
                  className={`credit-card p-6 text-center ${creditPkg.popular ? 'popular' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectCreditPackage(creditPkg)}
                >
                  <div className={creditPkg.unlimited ? "unlimited-badge" : "credit-badge"}>
                    {formattedPrice}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{creditPkg.name}</h3>
                  <p className="text-gray-600 mb-4">{creditPkg.description}</p>
                  <div className="text-sm font-semibold text-gray-700 mb-3">
                    {creditPkg.unlimited ? 'Unlimited Credits' : `${creditPkg.credits} Credits`}
                  </div>
                  <ul className="text-sm text-gray-600 mb-6 space-y-1 text-left inline-block">
                    {creditPkg.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                  <button className="btn-premium w-full" onClick={(e) => { e.stopPropagation(); handleAddToCart(creditPkg); }}>
                    Select Package
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-sm text-gray-500 mt-6">
          <p>• Credits are required to use analysis features</p>
          <p>• Each analysis consumes credits based on complexity</p>
        </div>

        {/* No in-modal overlay; selection triggers parent confirmation modal */}
      </DialogContent>
    </Dialog>
  );
}
