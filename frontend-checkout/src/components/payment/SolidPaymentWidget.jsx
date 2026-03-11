import React, { useEffect, useState, useRef } from 'react';
import { logError } from '../../utils/logToBackend';
import NgeniusPaymentForm from './NgeniusPaymentForm';

// IMPORTANT: Base URL must end with "/" per Solid Payment documentation
const SOLID_PAYMENT_BASE_URL = 'https://solidpayments.net/';

/**
 * Payment Widget Component
 * Conditionally renders either N-Genius Direct API form or Solid Payment widget
 * based on gateway selection (FR/AU use N-Genius, others use Solid)
 */
export default function SolidPaymentWidget({ 
  gateway,
  merchantTransactionId,
  amount,
  currency,
  originalAmount,
  originalCurrency,
  checkoutId, 
  checkoutIdApplePay,
  checkoutIdGooglePay,
  integrity, 
  integrityApplePay,
  integrityGooglePay,
  googlePayEntityId,
  onError, 
  onReady, 
  totalAmount
}) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(null);
  const [widgetRendered, setWidgetRendered] = useState(false);
  const formContainerRef = useRef(null);
  const scriptRef = useRef(null);

  // Handle N-Genius payment success
  const handleNgeniusSuccess = (data) => {
    console.log('[NgeniusPayment] Payment successful:', data);
    // Redirect to success page with order ID
    if (data.orderId) {
      window.location.href = `/success?orderId=${data.orderId}`;
    }
  };

  // Handle N-Genius payment error
  const handleNgeniusError = (error) => {
    console.error('[NgeniusPayment] Payment error:', error);
    if (onError) {
      onError(error);
    }
  };

  // If N-Genius gateway, render the direct payment form
  if (gateway === 'ngenius') {
    console.log('[PaymentWidget] Rendering N-Genius payment form');
    return (
      <div className="ngenius-payment-container">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            <i className="fas fa-lock mr-2"></i>
            Secure payment powered by Network International
          </p>
        </div>
        <NgeniusPaymentForm
          merchantTransactionId={merchantTransactionId}
          amount={originalAmount || amount}
          currency={originalCurrency || currency}
          onSuccess={handleNgeniusSuccess}
          onError={handleNgeniusError}
        />
      </div>
    );
  }

  // Otherwise, use Solid Payment widget (default)
  useEffect(() => {
    console.log('=== SOLID PAYMENT WIDGET EFFECT ===');
    console.log('[SolidPaymentWidget] Credit Card Checkout ID:', checkoutId);
    console.log('[SolidPaymentWidget] Apple Pay Checkout ID:', checkoutIdApplePay);
    console.log('[SolidPaymentWidget] Google Pay Checkout ID:', checkoutIdGooglePay);
    console.log('[SolidPaymentWidget] Credit Card Integrity:', integrity);
    console.log('[SolidPaymentWidget] Apple Pay Integrity:', integrityApplePay);
    console.log('[SolidPaymentWidget] Google Pay Integrity:', integrityGooglePay);
    
    if (!checkoutId || !checkoutIdApplePay || !checkoutIdGooglePay) {
      console.log('[SolidPaymentWidget] Missing checkout IDs, skipping script load');
      return;
    }

    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src*="paymentWidgets.js"]`);
    if (existingScript) {
      console.log('[SolidPaymentWidget] Removing existing script');
      existingScript.remove();
    }

    // Configure options for CREDIT CARD only (no Apple Pay/Google Pay config to prevent mixing)
    window.wpwlOptions = {
      // Add global error handler
      onError: function(error) {
        console.error('[Solid Payment] Error occurred:', error);
        
        // Determine payment method from error
        const paymentMethod = error.brand === 'APPLEPAY' ? 'APPLEPAY' 
                            : error.brand === 'GOOGLEPAY' ? 'GOOGLEPAY' 
                            : 'PAYMENT';
        
        // Log to backend for admin visibility
        logError(
          paymentMethod,
          error.event || 'PAYMENT_ERROR',
          error.message || 'Payment widget error',
          {
            brand: error.brand,
            event: error.event,
            checkoutId: checkoutId,
            checkoutIdApplePay: checkoutIdApplePay,
            checkoutIdGooglePay: checkoutIdGooglePay,
            errorObject: error
          }
        );
        
        if (onError) {
          onError(error.message || 'Payment processing error');
        }
      },
      // Add ready callback
      onReady: function() {
        console.log('[Solid Payment] Widget ready');
      }
    };

    // Create and load the Solid Payment script for CREDIT CARD
    const script = document.createElement('script');
    const scriptSrc = `${SOLID_PAYMENT_BASE_URL}v1/paymentWidgets.js?checkoutId=${checkoutId}`;
    
    console.log('[SolidPaymentWidget] Credit Card Script URL:', scriptSrc);
    console.log('[SolidPaymentWidget] Credit Card Integrity value:', integrity);
    
    script.src = scriptSrc;
    
    // Add integrity attribute as per Solid Payment documentation
    if (integrity) {
      script.setAttribute('integrity', integrity);
      console.log('[SolidPaymentWidget] ✅ Credit Card Integrity attribute set');
    } else {
      console.warn('[SolidPaymentWidget] ⚠️ No credit card integrity value provided');
    }
    
    // Set crossorigin as required by docs
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;
    
    script.onload = () => {
      console.log('[SolidPaymentWidget] ✅ Credit Card script loaded successfully');
      console.log('[SolidPaymentWidget] Payment form should now be visible');
      
      // Check if form element exists immediately
      setTimeout(() => {
        const allForms = document.querySelectorAll('.paymentWidgets');
        console.log('[SolidPaymentWidget] Forms found after script load:', allForms.length);
        allForms.forEach((f, i) => {
          console.log(`[SolidPaymentWidget] Form ${i}:`, f.className, 'data-brands:', f.getAttribute('data-brands'));
        });
      }, 100);
      
      // Load Apple Pay script after a delay to avoid conflicts
      setTimeout(() => {
        // Now configure Apple Pay options ONLY for the Apple Pay script
        window.wpwlOptions = {
          applePay: {
            displayName: "OpenSightAI",
            total: { 
              label: "OpenSightAI"
            },
            version: 3,
            style: "black",
            // Add callbacks to handle Apple Pay events
            onCancel: function(data) {
              console.log('[Apple Pay] Payment cancelled by user:', data);
            },
            onPaymentAuthorized: function(payment) {
              console.log('[Apple Pay] Payment authorized:', payment);
              return true; // Return true to continue processing
            }
          },
          // Keep error handler
          onError: function(error) {
            console.error('[Solid Payment] Error occurred:', error);
            
            // Determine payment method from error
            const paymentMethod = error.brand === 'APPLEPAY' ? 'APPLEPAY' 
                                : error.brand === 'GOOGLEPAY' ? 'GOOGLEPAY' 
                                : 'PAYMENT';
            
            // Log to backend for admin visibility
            logError(
              paymentMethod,
              error.event || 'PAYMENT_ERROR',
              error.message || 'Payment widget error',
              {
                brand: error.brand,
                event: error.event,
                checkoutId: checkoutId,
                checkoutIdApplePay: checkoutIdApplePay,
                checkoutIdGooglePay: checkoutIdGooglePay,
                errorObject: error
              }
            );
            
            if (onError) {
              onError(error.message || 'Payment processing error');
            }
          },
          onReady: function() {
            console.log('[Solid Payment] Apple Pay Widget ready');
          }
        };
        
        const scriptApplePay = document.createElement('script');
        const scriptApplePaySrc = `${SOLID_PAYMENT_BASE_URL}v1/paymentWidgets.js?checkoutId=${checkoutIdApplePay}`;
        
        console.log('[SolidPaymentWidget] Apple Pay Script URL:', scriptApplePaySrc);
        console.log('[SolidPaymentWidget] Apple Pay Integrity value:', integrityApplePay);
        
        scriptApplePay.src = scriptApplePaySrc;
        
        if (integrityApplePay) {
          scriptApplePay.setAttribute('integrity', integrityApplePay);
          console.log('[SolidPaymentWidget] ✅ Apple Pay Integrity attribute set');
        }
        
        scriptApplePay.setAttribute('crossorigin', 'anonymous');
        scriptApplePay.async = true;
        
        scriptApplePay.onload = () => {
          console.log('[SolidPaymentWidget] ✅ Apple Pay script loaded successfully');
          
          // Style Apple Pay button
          setTimeout(() => {
            const applePayButton = document.querySelector('.applePayForm .wpwl-apple-pay-button, .applePayForm .wpwl-apple-pay-button-black, .applePayForm button[type="button"]');
            if (applePayButton) {
              console.log('[SolidPaymentWidget] Found Apple Pay button, applying styles');
              applePayButton.style.width = '100%';
              applePayButton.style.maxWidth = '100%';
              applePayButton.style.height = '48px';
              applePayButton.style.minHeight = '48px';
              
              // Check if button needs fallback content
              const hasContent = applePayButton.textContent && applePayButton.textContent.trim().length > 2;
              const hasChildren = applePayButton.children.length > 0;
              
              if (!hasContent && !hasChildren) {
                console.log('[SolidPaymentWidget] Apple Pay button empty, injecting fallback content');
                const content = document.createElement('span');
                content.className = 'apple-pay-content';
                content.innerHTML = '<i class="fab fa-apple" style="font-size: 20px; margin-right: 8px;"></i> Pay';
                content.style.display = 'flex';
                content.style.alignItems = 'center';
                content.style.justifyContent = 'center';
                applePayButton.appendChild(content);
              }
            }
          }, 200);
          
          // Load Google Pay script after Apple Pay loads
          setTimeout(() => {
            // Configure Google Pay options ONLY for the Google Pay script
            window.wpwlOptions = {
              googlePay: {
                gatewayMerchantId: googlePayEntityId, // Use actual Entity ID from backend
                merchantName: "OpenSightAI",
                buttonType: "checkout",
                buttonColor: "black",
                checkoutOption: "COMPLETE_IMMEDIATE_PURCHASE",
                emailRequired: true,
                billingAddressRequired: true,
                billingAddressParameters: {
                  format: "FULL",
                  phoneNumberRequired: true
                },
                shippingAddressRequired: true,
                shippingAddressParameters: {
                  allowedCountryCodes: ["US"],
                  phoneNumberRequired: true
                },
                submitOnPaymentAuthorized: ["customer", "billing"],
                // Callback functions
                onPaymentAuthorized: function(paymentData) {
                  console.log('[Google Pay] Payment authorized:', paymentData);
                  return new Promise(function(resolve) {
                    // Return success to continue processing
                    resolve({ transactionState: 'SUCCESS' });
                  });
                },
                onPaymentDataChanged: function(intermediatePaymentData) {
                  console.log('[Google Pay] Payment data changed:', intermediatePaymentData);
                  return new Promise(function(resolve) {
                    // Handle shipping address/option changes if needed
                    resolve({});
                  });
                },
                onCancel: function(errorCode) {
                  console.log('[Google Pay] Payment cancelled by user:', errorCode);
                }
              },
              // Keep error handler
              onError: function(error) {
                console.error('[Solid Payment] Error occurred:', error);
                
                // Determine payment method from error
                const paymentMethod = error.brand === 'APPLEPAY' ? 'APPLEPAY' 
                                    : error.brand === 'GOOGLEPAY' ? 'GOOGLEPAY' 
                                    : 'PAYMENT';
                
                // Log to backend for admin visibility
                logError(
                  paymentMethod,
                  error.event || 'PAYMENT_ERROR',
                  error.message || 'Payment widget error',
                  {
                    brand: error.brand,
                    event: error.event,
                    checkoutId: checkoutId,
                    checkoutIdApplePay: checkoutIdApplePay,
                    checkoutIdGooglePay: checkoutIdGooglePay,
                    errorObject: error
                  }
                );
                
                if (onError) {
                  onError(error.message || 'Payment processing error');
                }
              },
              onReady: function() {
                console.log('[Solid Payment] Google Pay Widget ready');
              }
            };
            
            const scriptGooglePay = document.createElement('script');
            const scriptGooglePaySrc = `${SOLID_PAYMENT_BASE_URL}v1/paymentWidgets.js?checkoutId=${checkoutIdGooglePay}`;
            
            console.log('[SolidPaymentWidget] Google Pay Script URL:', scriptGooglePaySrc);
            console.log('[SolidPaymentWidget] Google Pay Integrity value:', integrityGooglePay);
            
            scriptGooglePay.src = scriptGooglePaySrc;
            
            if (integrityGooglePay) {
              scriptGooglePay.setAttribute('integrity', integrityGooglePay);
              console.log('[SolidPaymentWidget] ✅ Google Pay Integrity attribute set');
            }
            
            scriptGooglePay.setAttribute('crossorigin', 'anonymous');
            scriptGooglePay.async = true;
            
            scriptGooglePay.onload = () => {
              console.log('[SolidPaymentWidget] ✅ Google Pay script loaded successfully');
              
              // Style Google Pay button
              setTimeout(() => {
                const googlePayButton = document.querySelector('.googlePayForm .wpwl-button-pay, .googlePayForm button[type="button"]');
                if (googlePayButton) {
                  console.log('[SolidPaymentWidget] Found Google Pay button, applying styles');
                  googlePayButton.style.width = '100%';
                  googlePayButton.style.maxWidth = '100%';
                  googlePayButton.style.height = '48px';
                  googlePayButton.style.minHeight = '48px';
                }
              }, 200);
            };
            
            scriptGooglePay.onerror = (error) => {
              console.error('[SolidPaymentWidget] ❌ Google Pay script failed to load:', error);
            };
            
            document.body.appendChild(scriptGooglePay);
          }, 500);
        };
        
        scriptApplePay.onerror = (error) => {
          console.error('[SolidPaymentWidget] ❌ Apple Pay script failed to load:', error);
        };
        
        document.body.appendChild(scriptApplePay);
      }, 500);
      
      // Function to add validation to payment form
      const addPaymentValidation = () => {
        console.log('[SolidPaymentWidget] ========== STARTING VALIDATION SETUP ==========');
        
        // Try to find the payment form - look for the actual Solid Payment form
        const paymentForm = document.querySelector('.wpwl-form-card');
        const payButton = document.querySelector('.wpwl-button.wpwl-button-pay');
        const cardHolderInput = document.querySelector('.wpwl-control.wpwl-control-cardHolder');
        const cardNumberIframe = document.querySelector("iframe[name='card.number']");
        
        console.log('[SolidPaymentWidget] Form found:', paymentForm);
        console.log('[SolidPaymentWidget] Pay button found:', payButton);
        console.log('[SolidPaymentWidget] Card holder input found:', cardHolderInput);
        console.log('[SolidPaymentWidget] Card number iframe found:', cardNumberIframe);
        
        if (!payButton || !paymentForm) {
          console.warn('[SolidPaymentWidget] ⚠️ Essential elements not found yet');
          return false;
        }
        
        if (!cardHolderInput) {
          console.error('[SolidPaymentWidget] ❌ Card holder input not found - validation cannot be applied!');
          return false;
        }

        // Function to check if card holder is filled
        const isCardHolderValid = () => {
          const value = cardHolderInput?.value?.trim() || '';
          console.log('[SolidPaymentWidget] Card holder value:', value);
          return value.length > 0;
        };

        // Function to update button state
        const updateButtonState = () => {
          const isValid = isCardHolderValid();
          console.log('[SolidPaymentWidget] Updating button state - Valid:', isValid);
          
          if (isValid) {
            payButton.disabled = false;
            payButton.style.opacity = '1';
            payButton.style.cursor = 'pointer';
          } else {
            payButton.disabled = true;
            payButton.style.opacity = '0.6';
            payButton.style.cursor = 'not-allowed';
          }
        };

        // Initially disable the button
        console.log('[SolidPaymentWidget] Disabling button initially');
        payButton.disabled = true;
        payButton.style.opacity = '0.6';
        payButton.style.cursor = 'not-allowed';

        // Add event listeners to card holder field
        if (cardHolderInput) {
          console.log('[SolidPaymentWidget] Adding input listeners to card holder field');
          cardHolderInput.addEventListener('input', updateButtonState);
          cardHolderInput.addEventListener('change', updateButtonState);
          cardHolderInput.addEventListener('blur', updateButtonState);
          cardHolderInput.addEventListener('keyup', updateButtonState);
        } else {
          console.warn('[SolidPaymentWidget] ⚠️ Card holder input not found!');
        }

        // Add form submit validation (CRITICAL - this prevents form submission)
        paymentForm.addEventListener('submit', (e) => {
          console.log('[SolidPaymentWidget] ========== FORM SUBMIT EVENT ==========');
          const cardHolderValue = cardHolderInput?.value?.trim() || '';
          console.log('[SolidPaymentWidget] Card holder value on submit:', cardHolderValue);
          
          if (!cardHolderValue || cardHolderValue.length === 0) {
            console.error('[SolidPaymentWidget] ❌ VALIDATION FAILED - Preventing submission');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Show error message
            alert('Please enter the cardholder name before proceeding with payment.');
            
            // Highlight the card holder input
            if (cardHolderInput) {
              cardHolderInput.focus();
              cardHolderInput.style.borderColor = '#ef4444 !important';
              cardHolderInput.style.borderWidth = '2px';
              
              // Reset border color after 3 seconds
              setTimeout(() => {
                cardHolderInput.style.borderColor = '';
                cardHolderInput.style.borderWidth = '';
              }, 3000);
            }
            
            return false;
          }
          
          console.log('[SolidPaymentWidget] ✅ VALIDATION PASSED - Allowing submission');
        }, true); // Use capture phase to ensure we catch it first

        // ALSO add click validation on the pay button itself as backup
        payButton.addEventListener('click', (e) => {
          console.log('[SolidPaymentWidget] ========== BUTTON CLICK EVENT ==========');
          const cardHolderValue = cardHolderInput?.value?.trim() || '';
          console.log('[SolidPaymentWidget] Card holder value on click:', cardHolderValue);
          
          if (!cardHolderValue || cardHolderValue.length === 0) {
            console.error('[SolidPaymentWidget] ❌ VALIDATION FAILED - Preventing click');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Show error message
            alert('Please enter the cardholder name before proceeding with payment.');
            
            // Highlight the card holder input
            if (cardHolderInput) {
              cardHolderInput.focus();
              cardHolderInput.style.borderColor = '#ef4444';
              cardHolderInput.style.borderWidth = '2px';
              
              // Reset border color after 3 seconds
              setTimeout(() => {
                cardHolderInput.style.borderColor = '';
                cardHolderInput.style.borderWidth = '';
              }, 3000);
            }
            
            return false;
          }
          
          console.log('[SolidPaymentWidget] ✅ VALIDATION PASSED on button click');
        }, true); // Use capture phase

        // Mark button as having validation applied
        payButton.dataset.validationApplied = 'true';
        
        console.log('[SolidPaymentWidget] ========== VALIDATION SETUP COMPLETE ==========');
        return true;
      };

      // Check if form fields were actually rendered
      const checkInterval = setInterval(() => {
        // Look for the actual Solid Payment form, not the container
        const form = document.querySelector('.wpwl-form-card');
        const inputs = form?.querySelectorAll('input, select, button');
        const inputCount = inputs?.length || 0;
        
        console.log('[SolidPaymentWidget] Checking for rendered fields...', inputCount);
        
        if (inputCount > 0) {
          console.log('[SolidPaymentWidget] ✅ Widget rendered successfully!', inputCount, 'fields');
          console.log('[SolidPaymentWidget] Form HTML:', form?.innerHTML?.substring(0, 300));
          setWidgetRendered(true);
          
          // Add validation after a short delay to ensure all elements are ready
          setTimeout(() => {
            const validationAdded = addPaymentValidation();
            if (validationAdded) {
              console.log('[SolidPaymentWidget] ✅ Payment validation added successfully');
            } else {
              console.warn('[SolidPaymentWidget] ⚠️ Could not add payment validation - retrying...');
              // Retry after another delay
              setTimeout(() => {
                const retryValidation = addPaymentValidation();
                if (retryValidation) {
                  console.log('[SolidPaymentWidget] ✅ Payment validation added on retry');
                } else {
                  console.error('[SolidPaymentWidget] ❌ Failed to add payment validation after retry');
                }
              }, 1000);
            }
          }, 500);
          
          // Also add a MutationObserver to re-apply validation if form changes
          const observer = new MutationObserver(() => {
            const payButton = document.querySelector('.wpwl-button.wpwl-button-pay');
            if (payButton && !payButton.dataset.validationApplied) {
              console.log('[SolidPaymentWidget] Form changed, re-applying validation');
              setTimeout(() => addPaymentValidation(), 100);
            }
          });
          
          if (form) {
            observer.observe(form, {
              childList: true,
              subtree: true,
              attributes: true
            });
          }
          
          clearInterval(checkInterval);
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        const form = document.querySelector('.wpwl-form-card');
        const inputs = form?.querySelectorAll('input, select, button');
        
        if (!inputs || inputs.length === 0) {
          console.error('[SolidPaymentWidget] ❌ TIMEOUT: Widget failed to render fields after 10s!');
          console.error('[SolidPaymentWidget] This will cause payment submission to fail');
          console.error('[SolidPaymentWidget] Form HTML:', form?.innerHTML);
          
          // Log all forms on the page for debugging
          const allForms = document.querySelectorAll('.wpwl-form');
          console.error('[SolidPaymentWidget] All wpwl forms on page:', allForms.length);
          allForms.forEach((f, i) => {
            console.error(`[SolidPaymentWidget] Form ${i}:`, f.className, 'HTML:', f.innerHTML?.substring(0, 200));
          });
        }
      }, 10000);
      
      setScriptLoaded(true);
      if (onReady) onReady();
    };

    script.onerror = (error) => {
      console.error('[SolidPaymentWidget] ❌ Script failed to load:', error);
      const errorMsg = 'Failed to load payment form. Please try again.';
      setScriptError(errorMsg);
      
      // Log to backend
      logError(
        'PAYMENT',
        'SCRIPT_LOAD_FAILED',
        'Failed to load Solid Payment script',
        {
          scriptSrc,
          checkoutId,
          error: error?.message || 'Script load error'
        }
      );
      
      if (onError) onError(errorMsg);
    };

    console.log('[SolidPaymentWidget] Appending script to body...');
    document.body.appendChild(script);
    scriptRef.current = script;

    // Cleanup function
    return () => {
      if (scriptRef.current) {
        try {
          document.body.removeChild(scriptRef.current);
        } catch (e) {
          // Script already removed
        }
        scriptRef.current = null;
      }
      setScriptLoaded(false);
      setScriptError(null);
    };
  }, [checkoutId, checkoutIdApplePay, checkoutIdGooglePay, integrity, integrityApplePay, integrityGooglePay, onError, onReady]);

  if (scriptError) {
    return (
      <div className="p-6 text-center bg-red-50 rounded-lg border-2 border-red-200">
        <i className="mb-3 text-3xl text-red-600 fas fa-exclamation-triangle"></i>
        <p className="mb-2 font-medium text-red-800">Payment Form Error</p>
        <p className="text-sm text-red-600">{scriptError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 mt-4 text-white bg-red-600 rounded-lg transition-colors hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  }

  if (!checkoutId && !checkoutIdApplePay && !checkoutIdGooglePay) {
    return (
      <div className="p-6 text-center bg-yellow-50 rounded-lg border-2 border-yellow-200">
        <i className="mb-3 text-3xl text-yellow-600 fas fa-info-circle"></i>
        <p className="font-medium text-yellow-800">No checkout session available</p>
        <p className="mt-2 text-sm text-yellow-600">Please fill in your information and try again</p>
      </div>
    );
  }

  return (
    <div className="solid-payment-widget-container">
      {/* Loading state while script loads */}
      {!scriptLoaded && (
        <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-gray-200">
          <div className="inline-block mb-4 w-12 h-12 rounded-full border-4 animate-spin border-gold border-t-transparent"></div>
          <p className="text-gray-600">Loading secure payment form...</p>
        </div>
      )}
      
      

      {/* Payment form container - will be populated by Solid Payment script */}
      <div 
        ref={formContainerRef}
        className={`payment-form-wrapper ${!scriptLoaded ? 'hidden' : ''}`}
      >
        {/* Credit Card Payment Form */}
        <form 
          action={`${window.location.origin}/success`}
          className="paymentWidgets" 
          data-brands="VISA MASTER AMEX MAESTRO"
          onSubmit={(e) => {
            // Prevent auto-submit if widget hasn't rendered
            const hasInputs = e.currentTarget.querySelectorAll('input, select').length > 0;
            if (!hasInputs) {
              console.error('[SolidPaymentWidget] Form submitted but no payment fields found! Preventing submit.');
              e.preventDefault();
              return false;
            }
            console.log('[SolidPaymentWidget] Form submitted with payment data');
          }}
        >
          {/* Loading message shown until widget renders fields */}
          {!widgetRendered && (
            <div className="widget-loading-message" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <i className="mr-2 fas fa-spinner fa-spin"></i>
              Loading payment form...
            </div>
          )}
        </form>

        {/* OR Divider */}
        <div style={{ 
          margin: '32px 0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '16px'
        }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
          <span style={{ 
            color: '#6b7280', 
            fontSize: '14px', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
        </div>

        {/* Apple Pay Section */}
        <div className="apple-pay-section" style={{ marginBottom: '24px' }}>
          {/* Apple Pay Info Card */}
          <div style={{
            background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <i className="fab fa-apple" style={{ 
              fontSize: '48px', 
              color: 'white'
            }}></i>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: 'white', 
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Pay with Apple Pay
              </h3>
              <p style={{ 
                margin: 0, 
                color: '#a0a0a0', 
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                Fast, secure checkout using Face ID, Touch ID, or your device passcode
              </p>
            </div>
          </div>

          {/* Apple Pay Payment Form */}
          <form 
            action={`${window.location.origin}/success`}
            className="paymentWidgets applePayForm" 
            data-brands="APPLEPAY"
            style={{ width: '100%', maxWidth: '100%' }}
            onSubmit={(e) => {
              console.log('[SolidPaymentWidget] Apple Pay form submit triggered');
              // Don't prevent default - let Solid Payment handle it
            }}
          >
            {/* Apple Pay button will be rendered here by Solid Payment script */}
          </form>
          
          {/* Availability Note */}
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px'
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: '12px', 
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fas fa-info-circle"></i>
              Apple Pay is available on compatible Apple devices (Mac, iPhone, iPad)
            </p>
          </div>
        </div>

        {/* Google Pay Section */}
        <div className="google-pay-section" style={{ marginBottom: '24px' }}>
          {/* Google Pay Info Card */}
          <div style={{
            background: 'linear-gradient(135deg, #4285F4 0%, #34A853 25%, #FBBC04 50%, #EA4335 100%)',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <i className="fab fa-google" style={{ 
              fontSize: '48px', 
              color: 'white'
            }}></i>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: 'white', 
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Pay with Google Pay
              </h3>
              <p style={{ 
                margin: 0, 
                color: 'rgba(255, 255, 255, 0.9)', 
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                Fast, secure checkout using your saved payment methods
              </p>
            </div>
          </div>

          {/* Google Pay Payment Form */}
          <form 
            action={`${window.location.origin}/success`}
            className="paymentWidgets googlePayForm" 
            data-brands="GOOGLEPAY"
            style={{ width: '100%', maxWidth: '100%' }}
            onSubmit={(e) => {
              console.log('[SolidPaymentWidget] Google Pay form submit triggered');
              // Don't prevent default - let Solid Payment handle it
            }}
          >
            {/* Google Pay button will be rendered here by Solid Payment script */}
          </form>
          
          {/* Availability Note */}
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px'
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: '12px', 
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fas fa-info-circle"></i>
              Google Pay is available on compatible devices with Chrome or Android
            </p>
          </div>
        </div>
      </div>

      {/* Custom styling for the payment form - Force theme styling */}
      <style>{`
        .solid-payment-widget-container {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        .payment-form-wrapper {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        /* Force font family across all elements */
        .paymentWidgets,
        .paymentWidgets *,
        .wpwl-form,
        .wpwl-form *,
        .wpwl-wrapper,
        .wpwl-wrapper * {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }

        /* Main form styling */
        .wpwl-form,
        .wpwl-form-card {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-shadow: none !important;
        }

        /* Group styling */
        .wpwl-group {
          margin-bottom: 20px !important;
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .wpwl-group-submit {
          margin-top: 24px !important;
          margin-bottom: 0 !important;
        }

        /* Label styling - match your app's labels */
        .wpwl-label {
          display: block !important;
          font-weight: 500 !important;
          color: #374151 !important;
          margin-bottom: 8px !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
        }

        /* Wrapper styling */
        .wpwl-wrapper {
          width: 100% !important;
          max-width: 100% !important;
          display: block !important;
          box-sizing: border-box !important;
        }

        /* Control styling - match your form-input class */
        .wpwl-control,
        .wpwl-control-cardHolder,
        .wpwl-control-expiry,
        select.wpwl-control {
          border: 2px solid #e5e7eb !important;
          border-radius: 12px !important;
          padding: 14px 16px !important;
          font-size: 16px !important;
          transition: all 0.3s ease !important;
          width: 100% !important;
          max-width: 100% !important;
          background: #ffffff !important;
          color: #1f2937 !important;
          line-height: 1.5 !important;
          box-sizing: border-box !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          margin: 0 !important;
        }

        /* Iframe controls (card number, CVV) */
        .wpwl-control-iframe {
          border: 2px solid #e5e7eb !important;
          border-radius: 12px !important;
          height: 50px !important;
          width: 100% !important;
          max-width: 100% !important;
          background: #ffffff !important;
          box-sizing: border-box !important;
          margin: 0 !important;
        }

        /* Focus state - match your gold theme */
        .wpwl-control:focus,
        .wpwl-control-iframe:focus,
        select.wpwl-control:focus {
          border-color: #f59e0b !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important;
        }

        /* Placeholder styling */
        .wpwl-control::placeholder {
          color: #9ca3af !important;
        }

        /* Button styling - match your btn-premium class */
        .wpwl-button,
        .wpwl-button-pay {
          background: linear-gradient(90deg, #f59e0b, #f97316) !important;
          border: none !important;
          padding: 14px 32px !important;
          border-radius: 9999px !important;
          font-weight: 600 !important;
          font-size: 16px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          width: 100% !important;
          max-width: 100% !important;
          text-transform: none !important;
          letter-spacing: normal !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
          height: auto !important;
          line-height: 1.5 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
        }

        .wpwl-button:hover,
        .wpwl-button-pay:hover {
          transform: translateY(-1px) scale(1.01) !important;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4) !important;
        }

        .wpwl-button:active,
        .wpwl-button-pay:active {
          transform: translateY(0) scale(1) !important;
        }

        .wpwl-button:disabled,
        .wpwl-button-pay:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
          transform: none !important;
        }

        /* Brand group styling - HIDE BRAND DROPDOWN */
        .wpwl-group-brand {
          display: none !important;
        }

        /* Brand wrapper - hide */
        .wpwl-wrapper-brand {
          display: none !important;
        }

        /* Brand icon/logo - show detected brand logo */
        .wpwl-brand,
        .wpwl-brand-card {
          display: inline-block !important;
          width: 50px !important;
          height: 32px !important;
          margin: 0 4px 0 0 !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center left !important;
          vertical-align: middle !important;
          position: relative !important;
          top: 0 !important;
        }

        .wpwl-brand-VISA {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32'%3E%3Crect width='48' height='32' rx='4' fill='%231434CB'/%3E%3Cpath d='M21.3 20.5h-2.8l1.8-10.8h2.8l-1.8 10.8zm10.8-10.5c-.6-.2-1.4-.4-2.5-.4-2.8 0-4.7 1.4-4.7 3.4 0 1.5 1.4 2.3 2.5 2.8 1.1.5 1.5.8 1.5 1.3 0 .7-.9 1-1.7 1-1.1 0-1.7-.2-2.7-.5l-.4-.2-.4 2.3c.7.3 1.9.5 3.2.5 3 0 4.9-1.4 4.9-3.6 0-1.2-.8-2.1-2.4-2.8-1-.5-1.6-.8-1.6-1.3s.5-1 1.6-1c.9 0 1.6.2 2.1.4l.3.1.4-2.2zm5.9 6.9c.2-.6 1.1-2.9 1.1-2.9l.6 2.9h-1.7zm3.3-6.8h-2.2c-.7 0-1.2.2-1.5.9l-4.2 9.9h3l.6-1.6h3.7l.4 1.6h2.6l-2.3-10.8h-.1zM18.8 9.7L16 17.5l-.3-1.5c-.5-1.6-2-3.3-3.7-4.2l2.5 9.5 3-.1 4.4-10.7h-3.1v-.8z' fill='white'/%3E%3Cpath d='M13 9.7H8.3l0 .2c3.6.9 6 3 7 5.5l-1-5.3c-.2-.7-.7-.9-1.3-.9z' fill='%23F7B600'/%3E%3C/svg%3E") !important;
        }

        .wpwl-brand-MASTER {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32'%3E%3Crect width='48' height='32' rx='4' fill='%23000000'/%3E%3Ccircle cx='18' cy='16' r='8' fill='%23EB001B'/%3E%3Ccircle cx='30' cy='16' r='8' fill='%23F79E1B'/%3E%3Cpath d='M24 9.6c-1.4 1.2-2.3 3-2.3 5 0 2 .9 3.8 2.3 5 1.4-1.2 2.3-3 2.3-5 0-2-.9-3.8-2.3-5z' fill='%23FF5F00'/%3E%3C/svg%3E") !important;
        }

        .wpwl-brand-MAESTRO {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32'%3E%3Crect width='48' height='32' rx='4' fill='%230099DF'/%3E%3Ccircle cx='15' cy='16' r='7' fill='%230099DF'/%3E%3Ccircle cx='33' cy='16' r='7' fill='%23ED0006'/%3E%3Cpath d='M24 10c-1.3 1.1-2.1 2.7-2.1 4.5s.8 3.4 2.1 4.5c1.3-1.1 2.1-2.7 2.1-4.5S25.3 11.1 24 10z' fill='%23CC0000'/%3E%3C/svg%3E") !important;
        }

        .wpwl-brand-AMEX {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32'%3E%3Crect width='48' height='32' rx='4' fill='%23006FCF'/%3E%3Cpath d='M11 13.5l-.8 1.9h1.6l-.8-1.9zm10.5 0l-.8 1.9h1.6l-.8-1.9zM8 11h3.2l2.8 6.5 2.8-6.5h3.2v9h-2.3v-5.8l-2.5 5.8h-2l-2.5-5.8V20H8v-9zm16.5 0h6.5v2h-4.2v1.5h4v2h-4v1.5h4.2v2h-6.5v-9zm8.5 0h2.5l2 3 2-3h2.5l-3.3 4.7v4.3h-2.3v-4.3L31 11z' fill='white'/%3E%3C/svg%3E") !important;
        }

        /* Brand label - hide */
        .wpwl-label-brand {
          display: none !important;
        }
        
        /* Brand select dropdown - hide */
        .wpwl-control-brand {
          display: none !important;
        }

        /* Apple Pay Specific Styles */
        .wpwl-apple-pay-button,
        .wpwl-apple-pay-button-black,
        .applePayForm button[type="button"] {
          width: 100% !important;
          max-width: 100% !important;
          height: 48px !important;
          min-height: 48px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto !important;
          -webkit-appearance: -apple-pay-button !important;
          -apple-pay-button-type: plain !important;
          -apple-pay-button-style: black !important;
          background-color: #000 !important;
          color: white !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
        }

        .wpwl-apple-pay-button:hover,
        .wpwl-apple-pay-button-black:hover,
        .applePayForm button[type="button"]:hover {
          opacity: 0.9 !important;
          transform: translateY(-1px) !important;
        }

        /* Wrapper elements */
        .wpwl-group-apple-pay,
        .wpwl-wrapper-apple-pay {
          width: 100% !important;
          max-width: 100% !important;
        }

        /* If we inject our own content */
        .apple-pay-content {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
        }

        /* Google Pay Specific Styles */
        .googlePayForm .wpwl-button-pay,
        .googlePayForm button[type="button"] {
          width: 100% !important;
          max-width: 100% !important;
          height: 48px !important;
          min-height: 48px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto !important;
          background-color: #000 !important;
          background-image: none !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
          padding: 12px 24px !important;
          box-sizing: border-box !important;
        }

        .googlePayForm .wpwl-button-pay:hover,
        .googlePayForm button[type="button"]:hover {
          opacity: 0.9 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        }

        /* Wrapper elements for Google Pay */
        .wpwl-group-google-pay,
        .wpwl-wrapper-google-pay {
          width: 100% !important;
          max-width: 100% !important;
        }

        /* Error states */
        .wpwl-has-error .wpwl-control,
        .wpwl-has-error .wpwl-control-iframe {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }

        .wpwl-hint,
        .wpwl-hint-error {
          color: #ef4444 !important;
          font-size: 12px !important;
          margin-top: 6px !important;
          display: block !important;
        }

        /* Success states */
        .wpwl-has-success .wpwl-control {
          border-color: #10b981 !important;
        }

        /* Remove any default margins/paddings that might interfere */
        .wpwl-clearfix::after {
          content: "" !important;
          display: table !important;
          clear: both !important;
        }

        /* Security/info text styling */
        .wpwl-sup-wrapper {
          margin-top: 16px !important;
          padding-top: 16px !important;
          border-top: 1px solid #e5e7eb !important;
          font-size: 12px !important;
          color: #6b7280 !important;
        }

        /* Checkbox styling for confirmations */
        .wpwl-checkbox {
          width: 18px !important;
          height: 18px !important;
          border-radius: 4px !important;
          border: 2px solid #e5e7eb !important;
          margin-right: 8px !important;
        }

        .wpwl-checkbox:checked {
          background-color: #f59e0b !important;
          border-color: #f59e0b !important;
        }

        .wpwl-text-confirmation {
          font-size: 13px !important;
          color: #4b5563 !important;
          line-height: 1.6 !important;
        }

        /* Confirmation group */
        .wpwl-confirmation {
          display: flex !important;
          align-items: flex-start !important;
          padding: 12px !important;
          background: #f9fafb !important;
          border-radius: 8px !important;
          margin-bottom: 16px !important;
        }

        /* Hidden fields should stay hidden */
        input[type="hidden"] {
          display: none !important;
        }

        /* Loading/processing states */
        .wpwl-form.wpwl-form-processing .wpwl-button {
          position: relative !important;
          color: transparent !important;
        }

        .wpwl-form.wpwl-form-processing .wpwl-button::after {
          content: "" !important;
          position: absolute !important;
          width: 20px !important;
          height: 20px !important;
          top: 50% !important;
          left: 50% !important;
          margin-left: -10px !important;
          margin-top: -10px !important;
          border: 3px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 50% !important;
          border-top-color: #ffffff !important;
          animation: wpwl-spin 0.8s linear infinite !important;
        }

        @keyframes wpwl-spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .payment-form-wrapper {
            padding: 0 !important;
          }
          
          .wpwl-control,
          .wpwl-control-iframe {
            font-size: 16px !important; /* Prevent zoom on iOS */
          }
        }

        /* Force override any inline styles */
        .wpwl-group[style] {
          display: block !important;
        }

        .wpwl-group[style*="display: none"] {
          display: none !important;
        }

        /* Remove any container borders or backgrounds that might show */
        .wpwl-container,
        .wpwl-group-container {
          border: none !important;
          background: transparent !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Ensure clearfix doesn't add extra width */
        .wpwl-clearfix {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
      `}</style>
    </div>
  );
}
