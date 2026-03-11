import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LandingStyles from '@/components/landing/LandingStyles.jsx';
import { buildCheckoutUrl } from '@/utils/cartHydration';
import { getMainSiteBaseUrl } from '@/utils/cartHydration';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com';

export default function DirectPurchasePage() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        // Track visit
        try {
          await fetch(`${API_BASE_URL}/api/direct-purchase/${linkId}/visit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (visitErr) {
          console.warn('[DirectPurchase] Failed to track visit:', visitErr);
        }

        // Fetch link details
        const response = await fetch(`${API_BASE_URL}/api/direct-purchase/${linkId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Purchase link not found or inactive');
          } else {
            setError('Failed to load purchase link');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setLink(data.link);
      } catch (err) {
        console.error('[DirectPurchase] Error:', err);
        setError('Failed to load purchase link');
      } finally {
        setLoading(false);
      }
    };

    if (linkId) {
      fetchLink();
    } else {
      setError('Invalid link ID');
      setLoading(false);
    }
  }, [linkId]);

  const handleBuy = () => {
    if (!link) return;

    // Handle unlimited credits
    const isUnlimited = link.credits_amount === 'unlimited' || String(link.credits_amount).toLowerCase() === 'unlimited';
    const creditsId = isUnlimited ? 'credits-unlimited' : `credits-${link.credits_amount}`;
    const creditsName = isUnlimited ? 'Unlimited Credits' : `${link.credits_amount} Credits`;

    // Build items array with package and credits
    const items = [
      {
        id: link.package_id,
        name: link.name || 'Base Package',
        price: Number(link.package_price),
        quantity: 1,
        type: 'package',
        currency: '$'
      },
      {
        id: creditsId,
        name: creditsName,
        price: Number(link.credits_price),
        credits: isUnlimited ? 'unlimited' : link.credits_amount,
        quantity: 1,
        type: 'credits',
        currency: '$',
        unlimited: isUnlimited
      }
    ];

    // Build checkout URL with items and linkId
    const checkoutUrl = buildCheckoutUrl(items, 'USD', null, link.link_id);
    
    // Redirect to checkout
    window.location.href = checkoutUrl;
  };

  const mainSiteUrl = getMainSiteBaseUrl();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LandingStyles />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LandingStyles />
        <div className="security-header">
          <div className="checkout-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="ssl-indicator"><i className="fas fa-lock"></i><span>256-bit SSL Encrypted</span></div>
                <div className="ssl-indicator"><i className="fas fa-shield-alt"></i><span>PCI DSS Compliant</span></div>
              </div>
            </div>
          </div>
        </div>
        <header className="bg-white shadow-sm border-b py-6">
          <div className="checkout-container">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 gradient-gold rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-2xl"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold heading-font text-gray-800">OpenSightAI</h1>
                <p className="text-sm text-gray-600">Secure Purchase</p>
              </div>
            </div>
          </div>
        </header>
        <div className="checkout-container py-16 text-center">
          <h2 className="text-2xl font-bold heading-font text-gray-800 mb-2">Link Not Available</h2>
          <p className="text-gray-600 mb-6">{error || 'The purchase link you are looking for is not available.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={mainSiteUrl} className="btn-premium">Go to Home</a>
            <a href={`${mainSiteUrl}/pricing`} className="border-2 border-gold text-gold px-8 py-3 rounded-full font-semibold hover:bg-gold hover:text-white transition-all">View Pricing</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LandingStyles />
      <style>{`
        .security-badge { background: #22c55e; color: white; padding: 8px 16px; border-radius: 25px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
        .trust-indicator { background: #f0f9ff; border: 1px solid #38bdf8; color: #0369a1; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .security-header { background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 12px 0; }
        .checkout-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .ssl-indicator { background: #dcfce7; border: 1px solid #22c55e; color: #166534; padding: 8px 16px; border-radius: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
        .amount-display { font-size: 4rem; font-weight: bold; background: linear-gradient(135deg, #f97316, #ea580c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      `}</style>

      {/* Security Header */}
      <div className="security-header">
        <div className="checkout-container">
          <div className="flex items-center justify-between flex-col gap-3 sm:flex-row">
            <div className="flex items-center space-x-4">
              <div className="ssl-indicator"><i className="fas fa-lock"></i><span>256-bit SSL Encrypted</span></div>
              <div className="ssl-indicator"><i className="fas fa-shield-alt"></i><span>PCI DSS Compliant</span></div>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <i className="fas fa-phone"></i>
              <span>Support: +44-7537-106208</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white shadow-sm border-b py-6">
        <div className="checkout-container">
          <div className="flex items-center justify-between flex-col gap-4 md:flex-row">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 gradient-gold rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-2xl"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold heading-font text-gray-800">OpenSightAI</h1>
                <p className="text-sm text-gray-600">Direct Purchase</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="security-badge"><i className="fas fa-shield-check"></i>Secured by SSL</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="checkout-container py-16">
        <div className="max-w-2xl mx-auto">
          <div className="premium-card p-12 text-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold heading-font text-gray-800 mb-4">{link.name || 'Package Purchase'}</h2>
              <p className="text-gray-600 mb-6">Complete your purchase to get started</p>
            </div>

            <div className="mb-8">
              <div className="text-gray-600 text-sm mb-2">Total Amount</div>
              <div className="amount-display">${Number(link.total_amount).toFixed(2)}</div>
              <div className="text-gray-500 text-sm mt-2">USD</div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">What's Included</h3>
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Base Package</span>
                  <span className="font-semibold text-gray-900">${Number(link.package_price).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Credits</span>
                  <span className="font-semibold text-gray-900">
                    {link.credits_amount === 'unlimited' || String(link.credits_amount).toLowerCase() === 'unlimited' 
                      ? 'Unlimited credits' 
                      : `${link.credits_amount} credits`}
                  </span>
                </div>
                <hr className="my-3 border-blue-200" />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-orange-600">${Number(link.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBuy}
              className="btn-premium text-lg px-12 py-4 w-full md:w-auto"
            >
              <i className="fas fa-shopping-cart mr-2"></i>
              Buy Now - ${Number(link.total_amount).toFixed(2)}
            </button>

            <p className="text-xs text-gray-500 mt-6">
              Click "Buy Now" to proceed to secure checkout where you can enter your payment details.
            </p>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <i className="fas fa-lock text-green-600"></i>
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-shield-alt text-blue-600"></i>
                  <span>PCI DSS Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-undo text-orange-600"></i>
                  <span>30-Day Guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="checkout-container text-center">
          <p className="text-xs text-gray-500">© 2026 OpenSightAI. All rights reserved.</p>
          <p className="text-xs text-gray-500 mt-2">Disclaimer: OpenSightAI is a technological research tool and does not provide financial or investment advice.</p>
        </div>
      </footer>
    </div>
  );
}

