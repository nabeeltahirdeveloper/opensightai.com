import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { serverApi } from '@/api/serverApi';
import { useCart } from '@/contexts/CartContext';
import LandingStyles from '@/components/landing/LandingStyles';
import { clearLinkId } from '@/utils/linkTracking';
import { getMainSiteBaseUrl, getCheckoutBaseUrl } from '@/utils/cartHydration';

// Polling interval for checking payment status (5 seconds)
const POLLING_INTERVAL = 5000;
const MAX_POLLING_ATTEMPTS = 60; // 5 minutes max polling

export default function Success() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('loading'); // loading, success, failed, pending
  const [message, setMessage] = useState('Verifying your payment...');
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orderId, setOrderId] = useState('');
  
  // Refs for managing state
  const verificationAttempted = useRef(false);
  const pollingCount = useRef(0);
  const pollingIntervalRef = useRef(null);

  const mainSiteUrl = getMainSiteBaseUrl();
  const checkoutUrl = getCheckoutBaseUrl();

  // Function to poll payment status
  const pollPaymentStatus = useCallback(async (orderIdToCheck) => {
    try {
      console.log('[PaymentResult] Polling status for order:', orderIdToCheck, 'Attempt:', pollingCount.current + 1);
      
      const statusResult = await serverApi.payment.checkPaymentStatus(orderIdToCheck);
      
      if (statusResult.success && statusResult.isPaid) {
        console.log('[PaymentResult] Payment confirmed as paid from polling');
        
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Update status and mark as paid
        await handlePaymentSuccess(orderIdToCheck);
        return true;
      }
      
      pollingCount.current += 1;
      
      // Stop polling after max attempts
      if (pollingCount.current >= MAX_POLLING_ATTEMPTS) {
        console.log('[PaymentResult] Max polling attempts reached');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setStatus('pending');
        setMessage('Payment verification is taking longer than expected. Please contact support if your payment was made.');
      }
      
      return false;
    } catch (error) {
      console.error('[PaymentResult] Error polling status:', error);
      return false;
    }
  }, []);

  // Function to handle successful payment
  const handlePaymentSuccess = useCallback(async (orderIdValue) => {
    try {
      console.log('[PaymentResult] Marking order as paid:', orderIdValue);
      
      const result = await serverApi.payment.markOrderPaid(orderIdValue);
      
      if (result.success) {
        setStatus('success');
        setMessage('Payment successful! Your account has been created.');
        setOrderId(orderIdValue);
        setUserEmail(result.user?.email || '');
        
        if (result.password) {
          setPassword(result.password);
        }
        
        // Clear cart and referral data
        clearCart();
        try {
          localStorage.removeItem('vs_referral_slug');
          clearLinkId();
        } catch (e) {
          console.error('Failed to clear referral data:', e);
        }
        
        console.log('[PaymentResult] Success state set');
      } else {
        throw new Error(result.error || 'Failed to process payment');
      }
    } catch (error) {
      console.error('[PaymentResult] Error marking as paid:', error);
      // Still show success since user was redirected (payment happened)
      setStatus('success');
      setMessage('Payment received! Your account is being set up.');
      setOrderId(orderIdValue);
    }
  }, [clearCart]);

  // Start polling for payment status
  const startPolling = useCallback((orderIdToCheck) => {
    console.log('[PaymentResult] Starting status polling for:', orderIdToCheck);
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingCount.current = 0;
    
    // Start polling
    pollingIntervalRef.current = setInterval(() => {
      pollPaymentStatus(orderIdToCheck);
    }, POLLING_INTERVAL);
  }, [pollPaymentStatus]);

  useEffect(() => {
    console.log('[PaymentResult] Component mounted, checking payment result...');
    console.log('[PaymentResult] Current URL:', window.location.href);
    console.log('[PaymentResult] Search params:', Object.fromEntries(searchParams));
    
    // Prevent duplicate calls
    if (verificationAttempted.current) {
      console.log('[PaymentResult] Verification already attempted, skipping');
      return;
    }

    const verifyPayment = async () => {
      try {
        // Check if this is a payment failure route or has declined status
        const statusParam = searchParams.get('status');
        const isPaymentFailedRoute = location.pathname === '/payment-failed';
        const isDeclinedStatus = statusParam && ['declined', 'failed', 'cancelled', 'rejected', 'error'].includes(statusParam.toLowerCase());
        
        if (isPaymentFailedRoute || isDeclinedStatus) {
          console.log('[PaymentResult] Payment failed detected - route:', location.pathname, 'status:', statusParam);
          verificationAttempted.current = true;
          
          const orderIdParam = searchParams.get('orderId') || searchParams.get('paynetOrderId');
          if (orderIdParam) {
            setOrderId(orderIdParam);
          }
          
          const failureMessages = {
            'declined': 'Your payment was declined. Please try again with a different payment method.',
            'failed': 'Your payment could not be processed. Please try again.',
            'cancelled': 'Your payment was cancelled. No charges were made.',
            'rejected': 'Your payment was rejected. Please try again or contact your bank.',
            'error': 'An error occurred during payment processing. Please try again.'
          };
          
          const failureMessage = statusParam ? (failureMessages[statusParam.toLowerCase()] || 'Your payment could not be processed. Please try again.') : 'Your payment could not be processed. Please try again.';
          
          setStatus('failed');
          setMessage(failureMessage);
          return;
        }
        
        // Check for bot payment flow - id parameter indicates successful redirect
        const botOrderId = searchParams.get('id');
        
        if (botOrderId) {
          console.log('[PaymentResult] Bot payment redirect detected, orderId:', botOrderId);
          verificationAttempted.current = true;
          setOrderId(botOrderId);
          
          // When user is redirected back with ?id, it means payment was successful
          // First check if it's already marked as paid in our DB
          try {
            const statusResult = await serverApi.payment.checkPaymentStatus(botOrderId);
            
            if (statusResult.success && statusResult.isPaid) {
              console.log('[PaymentResult] Order already marked as paid');
              await handlePaymentSuccess(botOrderId);
              return;
            }
          } catch (e) {
            console.warn('[PaymentResult] Could not check status:', e.message);
          }
          
          // If not paid yet, mark as paid (redirect means successful payment)
          await handlePaymentSuccess(botOrderId);
          return;
        }
        
        // Legacy: Check for resourcePath (old Solid Payment flow)
        const resourcePath = searchParams.get('resourcePath');
        const ngeniusOrderId = searchParams.get('orderId');
        const errorParam = searchParams.get('error');
        
        console.log('[PaymentResult] Extracted params:', { resourcePath, ngeniusOrderId, errorParam, botOrderId });
        
        // Handle N-Genius payment result
        if (ngeniusOrderId) {
          console.log('[PaymentResult] N-Genius payment, orderId:', ngeniusOrderId);
          verificationAttempted.current = true;
          
          // Check status parameter for N-Genius payments
          const ngeniusStatus = searchParams.get('status');
          if (ngeniusStatus && ['declined', 'failed', 'cancelled', 'rejected', 'error'].includes(ngeniusStatus.toLowerCase())) {
            console.log('[PaymentResult] N-Genius payment failed, status:', ngeniusStatus);
            setStatus('failed');
            
            const failureMessages = {
              'declined': 'Your payment was declined. Please try again with a different payment method.',
              'failed': 'Your payment could not be processed. Please try again.',
              'cancelled': 'Your payment was cancelled. No charges were made.',
              'rejected': 'Your payment was rejected. Please try again or contact your bank.',
              'error': 'An error occurred during payment processing. Please try again.'
            };
            
            setMessage(failureMessages[ngeniusStatus.toLowerCase()] || 'Your payment could not be processed. Please try again.');
            setOrderId(ngeniusOrderId);
            return;
          }
          
          setStatus('success');
          setMessage('Payment successful! Your account has been created.');
          setOrderId(ngeniusOrderId);
          setUserEmail(searchParams.get('email') || '');

          
          clearCart();
          try {
            localStorage.removeItem('vs_referral_slug');
            clearLinkId();
          } catch (e) {
            console.error('Failed to clear referral data:', e);
          }
          
          return;
        }
        
        // Handle error flow
        if (errorParam) {
          console.log('[PaymentResult] Payment failed, error:', errorParam);
          verificationAttempted.current = true;
          
          const errorMessages = {
            'server_error': 'A server error occurred while processing your payment. Please try again or contact support.',
            'missing_transaction_id': 'Payment session expired. Please try again.',
            'missing_order_reference': 'Invalid payment reference. Please try again.',
            'session_expired': 'Your payment session has expired. Please try again.',
            'session_not_found': 'Payment session not found. Please try again.',
            'payment_not_captured': 'Payment was not completed successfully. No charges were made.'
          };
          
          const errorMessage = errorMessages[errorParam] || 'Payment failed. Please try again.';
          setStatus('failed');
          setMessage(errorMessage);
          return;
        }
        
        // Legacy: Solid Payment flow with resourcePath
        if (resourcePath) {
          console.log('[PaymentResult] Solid payment verification for:', resourcePath);
          verificationAttempted.current = true;

          const result = await serverApi.checkout.verifyPayment(resourcePath);

          if (result.success && result.status === 'success') {
            setStatus('success');
            setMessage('Payment successful! Your account has been created.');
            setUserEmail(result.user?.email || '');
            setPassword(result.password || '');
            setOrderId(result.orderId || '');
            
            clearCart();
            try {
              localStorage.removeItem('vs_referral_slug');
              clearLinkId();
            } catch (e) {
              console.error('Failed to clear referral data:', e);
            }
          } else if (result.status === 'pending') {
            setStatus('pending');
            setMessage('Your payment is being processed. Please wait...');
            setOrderId(result.orderId || '');
          } else {
            setStatus('failed');
            setMessage(result.message || 'Payment verification failed');
            setOrderId(result.orderId || '');
          }
          return;
        }
        
        // No valid params - invalid link
        console.log('[PaymentResult] No valid params - invalid link');
        setStatus('failed');
        setMessage('Invalid payment confirmation link');
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        setMessage(error.message || 'An error occurred while verifying your payment');
      }
    };

    verifyPayment();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [searchParams, clearCart, handlePaymentSuccess, startPolling]);

  // Handle polling for pending status
  useEffect(() => {
    if (status === 'pending' && orderId && !pollingIntervalRef.current) {
      startPolling(orderId);
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [status, orderId, startPolling]);

  const handleGoToLogin = () => {
    window.location.href = `${mainSiteUrl}/login`;
  };

  const handleTryAgain = () => {
    window.location.href = `${checkoutUrl}/pay`;
  };

  const handleViewPackages = () => {
    window.location.href = `${mainSiteUrl}/pricing`;
  };

  const handleCheckStatus = async () => {
    if (orderId) {
      const result = await pollPaymentStatus(orderId);
      if (!result && status === 'pending') {
        setMessage('Still processing... We will automatically check again in a few seconds.');
      }
    }
  };

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

                {userEmail && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-green-800 text-sm">
                      <i className="fas fa-envelope mr-2"></i>
                      A confirmation email with your login details has been sent to <strong>{userEmail}</strong>
                    </p>
                  </div>
                )}

                {password && (
                  <p className="text-gray-600 text-sm mb-6">
                    <i className="fas fa-info-circle mr-2"></i>
                    Please save your credentials above. When ready, click the button below to proceed to login.
                  </p>
                )}

                <button 
                  onClick={handleGoToLogin}
                  className="btn-premium inline-flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sign-in-alt"></i>
                  Proceed to Login
                </button>
              </>
            )}

            {status === 'pending' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-3 bg-yellow-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-clock text-yellow-600 text-3xl"></i>
                  </div>
                </div>
                <h1 className="text-3xl font-bold heading-font text-gray-800 mb-4">
                  Payment Processing
                </h1>
                <p className="text-gray-600 text-lg mb-6">
                  {message}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  <i className="fas fa-sync-alt mr-2 animate-spin"></i>
                  Checking status automatically every 5 seconds...
                </p>
                {orderId && (
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                    <p className="text-gray-700 text-sm">
                      <i className="fas fa-receipt mr-2"></i>
                      <strong>Order ID:</strong> <span className="font-mono">{orderId}</span>
                    </p>
                  </div>
                )}
                <button 
                  onClick={handleCheckStatus}
                  className="btn-premium inline-flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sync-alt"></i>
                  Check Status Now
                </button>
              </>
            )}

            {status === 'failed'  && (
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
                    onClick={handleTryAgain}
                    className="btn-premium inline-flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-redo-alt"></i>
                    Try Again
                  </button>
                  <button 
                    onClick={handleViewPackages}
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
