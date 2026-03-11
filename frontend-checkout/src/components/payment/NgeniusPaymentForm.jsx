import React, { useState, useEffect } from 'react';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com';

/**
 * N-Genius Hosted Payment Page
 * Redirects user to N-Genius hosted page for card input
 * Used for FR and AU clients
 */
const NgeniusPaymentForm = ({ merchantTransactionId, onError }) => {
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    const initiatePayment = async () => {
      try {
        console.log('[ngenius-form] Initiating payment for:', merchantTransactionId);
        
        const response = await fetch(`${API_BASE_URL}/api/checkout/ngenius-pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ merchantTransactionId })
        });

        const data = await response.json();
        
        console.log('[ngenius-form] API response:', data);

        if (response.ok && data.success && data.paymentUrl) {
          console.log('[ngenius-form] Redirecting to:', data.paymentUrl);
          // Redirect to N-Genius hosted payment page
          window.location.href = data.paymentUrl;
        } else {
          setIsRedirecting(false);
          const errorMessage = data.error || 'Failed to initialize payment';
          console.error('[ngenius-form] Payment initialization failed:', errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        }
      } catch (error) {
        console.error('[ngenius-form] Error:', error);
        setIsRedirecting(false);
        if (onError) {
          onError('An error occurred while initializing payment');
        }
      }
    };

    initiatePayment();
  }, [merchantTransactionId, onError]);

  return (
    <div className="text-center py-8">
      {isRedirecting ? (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to secure payment page...</p>
        </>
      ) : (
        <p className="text-red-600">Failed to initialize payment. Please try again.</p>
      )}
    </div>
  );
};

export default NgeniusPaymentForm;

