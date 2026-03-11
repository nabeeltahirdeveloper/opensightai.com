/**
 * Parse cart data from URL query parameters
 * @param {URLSearchParams} searchParams - The URL search params
 * @returns {Object} - { items, currency, referral, linkId }
 */
export function parseCartFromUrl(searchParams) {
  try {
    const itemsParam = searchParams.get('items');
    const currency = searchParams.get('currency') || 'USD';
    const referral = searchParams.get('referral') || null;
    const linkId = searchParams.get('linkId') || null;
    
    let items = [];
    
    if (itemsParam) {
      // Decode and parse items JSON
      const decoded = decodeURIComponent(itemsParam);
      items = JSON.parse(decoded);
      console.log('[cartHydration] Parsed items from URL:', items);
    }
    
    return {
      items,
      currency,
      referral,
      linkId
    };
  } catch (error) {
    console.error('[cartHydration] Failed to parse cart from URL:', error);
    return {
      items: [],
      currency: 'USD',
      referral: null,
      linkId: null
    };
  }
}

/**
 * Build checkout URL with cart data
 * @param {Array} items - Cart items
 * @param {String} currency - Selected currency
 * @param {String} referral - Brand referral slug
 * @param {String} linkId - Link tracking ID
 * @param {String} baseUrl - Base URL for checkout (defaults to checkout subdomain)
 * @returns {String} - Full checkout URL
 */
export function buildCheckoutUrl(items, currency = 'USD', referral = null, linkId = null, baseUrl = null) {
  try {
    // Determine base URL
    const checkoutBase = baseUrl || getCheckoutBaseUrl();
    
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
    
    console.log('[cartHydration] Built checkout URL:', url);
    return url;
  } catch (error) {
    console.error('[cartHydration] Failed to build checkout URL:', error);
    return getCheckoutBaseUrl() + '/pay';
  }
}

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
    
    // Production - derive from current hostname
    if (hostname.includes('OpenSightai.com')) {
      return 'https://pay.OpenSightai.com';
    }
    
    // Fallback
    return 'https://pay.OpenSightai.com';
  }
  
  return 'https://pay.OpenSightai.com';
}

/**
 * Get the main site base URL
 * @returns {String} - Base URL for main site
 */
export function getMainSiteBaseUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5173';
    }
    
    // Production
    if (hostname.includes('OpenSightai.com')) {
      return 'https://www.OpenSightai.com';
    }
    
    // Fallback
    return 'https://www.OpenSightai.com';
  }
  
  return 'https://www.OpenSightai.com';
}

