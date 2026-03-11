/**
 * Get the checkout subdomain base URL
 * @returns {String} - Base URL for checkout subdomain
 */
export function getCheckoutBaseUrl() {
  // Check if we're in development or production
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5174';
    }
    
    // Production - main app is OpenSightai.com, checkout is checkout.OpenSightai.com
    if (hostname.includes('OpenSightai.com')) {
      return 'https://checkout.OpenSightai.com';
    }
    
    // Fallback
    return 'https://checkout.OpenSightai.com';
  }
  
  return 'https://checkout.OpenSightai.com';
}

/**
 * Build checkout URL with cart data for checkout subdomain
 * @param {Array} items - Cart items
 * @param {String} currency - Selected currency
 * @param {String} referral - Brand referral slug
 * @param {String} linkId - Link tracking ID
 * @returns {String} - Full checkout URL
 */
export function buildCheckoutUrl(items, currency = 'USD', referral = null, linkId = null) {
  try {
    // Determine base URL
    const checkoutBase = getCheckoutBaseUrl();
    
    // Build query params
    const params = new URLSearchParams();
    
    // Encode items as JSON
    if (items && items.length > 0) {
      const itemsJson = JSON.stringify(items);
      params.set('items', encodeURIComponent(itemsJson));
    }
    
    if (currency && currency !== 'USD') {
      params.set('currency', currency);
    }
    
    if (referral) {
      params.set('referral', referral);
    }
    
    if (linkId) {
      params.set('linkId', linkId);
    }
    
    const queryString = params.toString();
    const url = `${checkoutBase}/pay${queryString ? '?' + queryString : ''}`;
    
    console.log('[checkoutRedirect] Built checkout URL:', url);
    return url;
  } catch (error) {
    console.error('[checkoutRedirect] Failed to build checkout URL:', error);
    return getCheckoutBaseUrl() + '/pay';
  }
}

/**
 * Redirect to checkout with current cart state
 * @param {Object} cart - Cart state
 * @param {String} currency - Selected currency
 */
export function redirectToCheckout(cart, currency = 'USD') {
  try {
    // Get referral slug from localStorage if present
    let referral = null;
    try {
      referral = localStorage.getItem('vs_referral_slug');
    } catch (e) {
      console.error('[checkoutRedirect] Failed to get referral slug:', e);
    }
    
    // Get link ID from sessionStorage if present
    let linkId = null;
    try {
      linkId = sessionStorage.getItem('vs_link_id');
    } catch (e) {
      console.error('[checkoutRedirect] Failed to get link ID:', e);
    }
    
    const url = buildCheckoutUrl(cart.items, currency, referral, linkId);
    window.location.href = url;
  } catch (error) {
    console.error('[checkoutRedirect] Failed to redirect to checkout:', error);
    // Fallback to direct checkout URL
    window.location.href = getCheckoutBaseUrl() + '/pay';
  }
}

