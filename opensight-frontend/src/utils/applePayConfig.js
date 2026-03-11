

export const APPLE_PAY_CONFIG = {

  merchantIdentifier: 'merchant.com.OpenSightai.payments',
  
  // Supported networks (same as other card brands)
  supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
  
  // Merchant capabilities
  merchantCapabilities: ['supports3DS'],
  
  // Country code (ISO 3166-1 alpha-2)
  countryCode: 'US',
  
  // Display name for the merchant
  displayName: 'OpenSight AI',
};

/**
 * Check if Apple Pay is available on the current device/browser
 * @returns {boolean}
 */
export const isApplePayAvailable = () => {
  return window.ApplePaySession && ApplePaySession.canMakePayments();
};

/**
 * Create Apple Pay payment request object
 * @param {number} totalAmount - Total amount to charge
 * @param {string} currency - Currency code (e.g., 'USD')
 * @returns {object} Apple Pay payment request
 */
export const createApplePayRequest = (totalAmount, currency = 'USD') => {
  return {
    countryCode: APPLE_PAY_CONFIG.countryCode,
    currencyCode: currency,
    supportedNetworks: APPLE_PAY_CONFIG.supportedNetworks,
    merchantCapabilities: APPLE_PAY_CONFIG.merchantCapabilities,
    total: {
      label: APPLE_PAY_CONFIG.displayName,
      amount: totalAmount.toFixed(2),
      type: 'final'
    }
  };
};
