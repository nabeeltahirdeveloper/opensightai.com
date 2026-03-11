import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { serverApi } from '@/api/serverApi';
import { useCart } from '@/contexts/CartContext';
import LandingStyles from '@/components/landing/LandingStyles';
import { getStoredLinkId, clearLinkId } from '@/utils/linkTracking';
import { transformPaymentMessage } from '@/utils/paymentMessages';

export default function PaymentResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('loading'); // loading, success, failed, pending
  const [message, setMessage] = useState('Verifying your payment...');
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orderId, setOrderId] = useState('');
  
  // Ref to prevent duplicate verification calls
  // React Strict Mode and re-renders can trigger useEffect multiple times
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls - Solid Payments only allows ONE verification per checkout
    if (verificationAttempted.current) {
      console.log('[PaymentResult] Verification already attempted, skipping duplicate call');
      return;
    }

    const verifyPayment = async () => {
      try {
        const resourcePath = searchParams.get('resourcePath');
        
        if (!resourcePath) {
          setStatus('failed');
          setMessage('Invalid payment confirmation link');
          return;
        }

        console.log('[PaymentResult] Starting payment verification for:', resourcePath);
        verificationAttempted.current = true; // Mark as attempted before API call

        // Verify payment with backend (backend has caching to prevent duplicate API calls)
        const result = await serverApi.checkout.verifyPayment(resourcePath);

        if (result.success && result.status === 'success') {
          setStatus('success');
          setMessage('Payment successful! Your account has been created.');
          setUserEmail(result.user?.email || '');
          setPassword(result.password || '');
          setOrderId(result.orderId || '');
          
          // Clear cart and referral data
          clearCart();
          try {
            localStorage.removeItem('vs_referral_slug');
            clearLinkId();
          } catch (e) {
            console.error('Failed to clear referral data:', e);
          }

          // Don't auto-redirect - let user read credentials and click button when ready
        } else if (result.status === 'pending') {
          setStatus('pending');
          setMessage('Your payment is being processed. Please wait...');
          setOrderId(result.orderId || '');
        } else if (result.status === 'failed') {
          setStatus('failed');
          setMessage(transformPaymentMessage(result.message) || 'Payment verification failed');
          setOrderId(result.orderId || '');
        } else {
          setStatus('failed');
          setMessage(transformPaymentMessage(result.message) || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        setMessage(transformPaymentMessage(error.message) || 'An error occurred while verifying your payment');
      }
    };

    verifyPayment();
  }, [searchParams]); // Removed clearCart and navigate from dependencies to prevent re-runs

  return (
    <>
      <LandingStyles />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="premium-card p-8 md:p-12 text-center">
            {status === 'loading' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-4 border-orange-300 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
                </div>
                <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">
                  Verifying Payment
                </h1>
                <p className="text-gray-600 text-lg">
                  Please wait while we confirm your payment...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-check-circle text-green-600 text-5xl"></i>
                </div>
                <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">
                  Payment Successful!
                </h1>
                <p className="text-gray-600 text-lg mb-6">
                  {message}
                </p>
                
                {password && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6 text-left">
                    <h3 className="font-semibold text-blue-900 mb-4 text-lg">
                      <i className="fas fa-key mr-2"></i>
                      Your Login Credentials
                    </h3>
                    <div className="space-y-2 bg-white rounded-lg p-4 border border-blue-100">
                      <div className="flex items-start">
                        <span className="font-medium text-gray-700 w-24">Email:</span>
                        <span className="text-gray-900 font-mono text-sm flex-1 break-all">{userEmail}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-medium text-gray-700 w-24">Password:</span>
                        <span className="text-gray-900 font-mono text-sm flex-1 break-all">{password}</span>
                      </div>
                    </div>
                    <p className="text-sm text-blue-700 mt-4">
                      <i className="fas fa-info-circle mr-1"></i>
                      Please save these credentials. You'll also receive them via email.
                    </p>
                  </div>
                )}

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-green-800 text-sm">
                    <i className="fas fa-envelope mr-2"></i>
                    A confirmation email with your login details has been sent to <strong>{userEmail}</strong>
                  </p>
                </div>

                <p className="text-gray-600 text-sm mb-6">
                  <i className="fas fa-info-circle mr-2"></i>
                  Please save your credentials above. When ready, click the button below to proceed to login.
                </p>

                <button 
                  onClick={() => navigate('/login')}
                  className="btn-premium inline-flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sign-in-alt"></i>
                  Proceed to Login
                </button>
              </>
            )}

            {status === 'pending' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-clock text-yellow-600 text-5xl"></i>
                </div>
                <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">
                  Payment Pending
                </h1>
                <p className="text-gray-600 text-lg mb-6">
                  {message}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This page will automatically refresh to check the status.
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="btn-premium inline-flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sync-alt"></i>
                  Check Status Again
                </button>
              </>
            )}

            {status === 'failed' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-times-circle text-red-600 text-5xl"></i>
                </div>
                <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">
                  Payment Failed
                </h1>
                <p className="text-gray-600 text-lg mb-6 whitespace-pre-line">
                  {message || 'Your payment could not be processed.'}
                </p>
                
                {orderId && (
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                    <p className="text-gray-700 text-sm">
                      <i className="fas fa-receipt mr-2"></i>
                      <strong>Order ID:</strong> <span className="font-mono">{orderId}</span>
                    </p>
                  </div>
                )}
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    Your payment could not be processed. No charges have been made to your account.
                  </p>
                </div>

                {orderId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800 text-sm">
                      <i className="fas fa-info-circle mr-2"></i>
                      This order has been recorded in our system with a failed status. 
                      Please try again or contact support if you need assistance.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={() => navigate('/checkout')}
                    className="btn-premium inline-flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-redo-alt"></i>
                    Try Again
                  </button>
                  <button 
                    onClick={() => navigate('/pricing')}
                    className="border-2 border-gold text-gold px-8 py-3 rounded-full font-semibold hover:bg-gold hover:text-white transition-all inline-flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-shopping-cart"></i>
                    View Packages
                  </button>
                </div>
              </>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Need help? Contact us at{' '}
                <a href="mailto:suuport@OpenSightai.com" className="text-gold hover:underline">
                  suuport@OpenSightai.com
                </a>
                {' '}or call{' '}
                <a href="tel:+447537106208" className="text-gold hover:underline">
                  +44-7537-106208
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

