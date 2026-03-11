import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { serverApi } from '@/api/serverApi';

/**
 * Handles Neogate payment gateway redirect callbacks
 * Neogate redirects back via POST to /pay/pay_<transactionId>
 * This component extracts the transaction ID and redirects to success page
 */
export default function NeogateCallback() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const handleNeogateCallback = async () => {
      try {
        // Extract path from location.pathname (e.g., "/pay/pay_1768209374163_1023w")
        const pathname = location.pathname;
        console.log('[NeogateCallback] Handling callback, pathname:', pathname);
        console.log('[NeogateCallback] Full location:', location);
        console.log('[NeogateCallback] Params:', params);

        // Extract the part after /pay/ (e.g., "pay_1768209374163_1023w")
        const pathAfterPay = pathname.replace(/^\/pay\//, '');
        
        // Extract transaction ID from path (format: pay_<transactionId>)
        let transactionId = null;
        
        if (pathAfterPay) {
          // Remove "pay_" prefix if present
          transactionId = pathAfterPay.startsWith('pay_') 
            ? pathAfterPay.substring(4) 
            : pathAfterPay;
        }

        // Also check URL search params for any payment data
        const searchParams = new URLSearchParams(location.search);
        const orderId = searchParams.get('orderId') || searchParams.get('orderReference') || searchParams.get('id');
        const error = searchParams.get('error');
        const statusParam = searchParams.get('status');

        console.log('[NeogateCallback] Extracted data:', {
          transactionId,
          orderId,
          error,
          statusParam,
          searchParams: Object.fromEntries(searchParams)
        });

        // If there's an error, redirect to success page with error
        if (error) {
          console.log('[NeogateCallback] Error detected, redirecting to success with error');
          navigate(`/success?error=${encodeURIComponent(error)}`, { replace: true });
          return;
        }

        // If we have an orderId, redirect to success page with it
        if (orderId) {
          console.log('[NeogateCallback] OrderId found, redirecting to success');
          navigate(`/success?orderId=${encodeURIComponent(orderId)}`, { replace: true });
          return;
        }

        // If we have a transactionId, try to verify it with backend
        if (transactionId) {
          console.log('[NeogateCallback] TransactionId found, verifying payment');
          
          try {
            // Try to verify the payment with backend
            // The backend should have an endpoint to verify Neogate payments
            const result = await serverApi.payment.checkPaymentStatus(transactionId);
            
            if (result.success) {
              console.log('[NeogateCallback] Payment verified, redirecting to success');
              navigate(`/success?orderId=${encodeURIComponent(transactionId)}`, { replace: true });
              return;
            }
          } catch (verifyError) {
            console.warn('[NeogateCallback] Could not verify payment:', verifyError);
            // Still redirect to success page - it will handle verification
            navigate(`/success?orderId=${encodeURIComponent(transactionId)}`, { replace: true });
            return;
          }
        }

        // If status is provided, use it
        if (statusParam) {
          console.log('[NeogateCallback] Status param found:', statusParam);
          if (statusParam === 'SUCCESS' || statusParam === 'success') {
            navigate(`/success?orderId=${encodeURIComponent(transactionId || 'unknown')}`, { replace: true });
          } else {
            navigate(`/success?error=payment_${statusParam.toLowerCase()}`, { replace: true });
          }
          return;
        }

        // Fallback: redirect to success page with transaction ID if available
        if (transactionId) {
          console.log('[NeogateCallback] Fallback: redirecting with transactionId');
          navigate(`/success?orderId=${encodeURIComponent(transactionId)}`, { replace: true });
          return;
        }

        // Last resort: redirect to success page and let it handle the verification
        console.log('[NeogateCallback] No payment data found, redirecting to success');
        navigate('/success', { replace: true });
      } catch (error) {
        console.error('[NeogateCallback] Error handling callback:', error);
        setStatus('error');
        // Redirect to success page with error
        navigate('/success?error=callback_error', { replace: true });
      }
    };

    handleNeogateCallback();
  }, [pathParam, location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing payment redirect...</p>
      </div>
    </div>
  );
}
