/**
 * Solid Payment Gateway Integration Service
 * Handles COPYandPAY checkout preparation and payment verification
 */

import fetch from 'node-fetch'

// Regular credit card Entity ID
const SOLID_PAYMENT_ENTITY_ID = process.env.SOLID_PAYMENT_ENTITY_ID || "8acda4c999c83f980199c866d6cb0241"
// Apple Pay specific Entity ID
const SOLID_PAYMENT_ENTITY_ID_APPLEPAY = process.env.SOLID_PAYMENT_ENTITY_ID_APPLEPAY || "8acda4cc99c87920019a2629104a3e29"
// Google Pay specific Entity ID (same as credit card for TEST environment)
const SOLID_PAYMENT_ENTITY_ID_GOOGLEPAY = process.env.SOLID_PAYMENT_ENTITY_ID_GOOGLEPAY || "8acda4c999c83f980199c866d6cb0241"
const SOLID_PAYMENT_ACCESS_TOKEN = process.env.SOLID_PAYMENT_ACCESS_TOKEN || "OGFjZGE0Y2I5NmZjZjZlZjAxOTcyMGY5ZTFhZDFmMTB8IXg3cnJvUHNvcUxLIXA1b1QrPz0="
// IMPORTANT: Base URL must end with "/" per Solid Payment documentation
const SOLID_PAYMENT_BASE_URL = (process.env.SOLID_PAYMENT_BASE_URL || 'https://solidpayments.net').replace(/\/?$/, '/')
const verificationCache = new Map()

/**
 * Prepare a checkout session with Solid Payment
 * @param {Object} params - Checkout parameters
 * @param {number} params.amount - Amount in USD
 * @param {string} params.currency - Currency code (should be USD)
 * @param {string} params.paymentType - Payment type (DB for debit)
 * @param {string} params.customerEmail - Customer email
 * @param {string} params.customerGivenName - Customer first name
 * @param {string} params.customerSurname - Customer last name
 * @param {Object} params.browserData - Browser information for 3D Secure
 * @returns {Promise<Object>} - Checkout response with id
 */
export async function prepareCheckout(params) {
  const {
    amount,
    currency = 'USD',
    paymentType = 'DB',
    customerEmail,
    customerGivenName,
    customerSurname,
    customerPhone,
    customerIp,
    billingStreet,
    billingCity,
    billingPostcode,
    billingCountry,
    billingState,
    shippingStreet,
    shippingCity,
    shippingPostcode,
    shippingCountry,
    shippingState,
    merchantTransactionId,
    browserData = {},
    isApplePay = false, // Flag to determine which Entity ID to use
    isGooglePay = false // Flag for Google Pay
  } = params

  // Select the appropriate Entity ID based on payment method
  const entityId = isApplePay ? SOLID_PAYMENT_ENTITY_ID_APPLEPAY 
                  : isGooglePay ? SOLID_PAYMENT_ENTITY_ID_GOOGLEPAY 
                  : SOLID_PAYMENT_ENTITY_ID
  
  const paymentMethod = isApplePay ? 'Apple Pay' : isGooglePay ? 'Google Pay' : 'Credit Card'
  console.log(`[solid-payment] Using Entity ID for ${paymentMethod}:`, entityId)

  if (!entityId || !SOLID_PAYMENT_ACCESS_TOKEN) {
    throw new Error('Solid Payment credentials not configured')
  }

  // Validate required parameters
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount')
  }
  
  if (!customerEmail) {
    throw new Error('Customer email is required')
  }

  // Validate amount constraints (max $1000 per transaction)
  // if (amount > 1689) {
  //   throw new Error('Amount exceeds maximum limit of $1689 per transaction')
  // }

  // Use form-encoded data like PHP implementation
  // NOTE: shopperResultUrl is NOT included here - only in the form's action attribute
  const formData = new URLSearchParams({
    'entityId': entityId,
    'amount': amount.toFixed(2),
    'currency': currency,
    'paymentType': paymentType,
    'integrity': 'true'
  })
  
  // Add merchant transaction ID if provided
  if (merchantTransactionId) {
    formData.append('merchantTransactionId', merchantTransactionId)
  }
  
  // Add customer details (required by Solid Payment)
  formData.append('customer.email', customerEmail)
  if (customerGivenName) formData.append('customer.givenName', customerGivenName)
  if (customerSurname) formData.append('customer.surname', customerSurname)
  if (customerPhone) formData.append('customer.phone', customerPhone)
  if (customerIp) formData.append('customer.ip', customerIp)
  
  // Add billing details if provided
  if (billingStreet) formData.append('billing.street1', billingStreet)
  if (billingCity) formData.append('billing.city', billingCity)
  if (billingPostcode) formData.append('billing.postcode', billingPostcode)
  if (billingCountry) formData.append('billing.country', billingCountry.toUpperCase())
  if (billingState) formData.append('billing.state', billingState)
  
  // Add shipping details if provided (recommended for fraud prevention)
  if (shippingStreet) formData.append('shipping.street1', shippingStreet)
  if (shippingCity) formData.append('shipping.city', shippingCity)
  if (shippingPostcode) formData.append('shipping.postcode', shippingPostcode)
  if (shippingCountry) formData.append('shipping.country', shippingCountry.toUpperCase())
  if (shippingState) formData.append('shipping.state', shippingState)
  
  // NOTE: Browser data is NOT sent here - the COPYandPAY widget collects it automatically
  // When the payment form loads in the browser. Sending it here causes "already set" errors.
  // The widget automatically collects: language, screenHeight, screenWidth, timezone,
  // userAgent, javaEnabled, javascriptEnabled, screenColorDepth, challengeWindow
  // Reference: https://docs.solidpayments.net/integrations/copyandpay

  console.log('=== SOLID PAYMENT PREPARE CHECKOUT ===')
  console.log('[solid-payment] Base URL:', SOLID_PAYMENT_BASE_URL)
  console.log('[solid-payment] Entity ID:', SOLID_PAYMENT_ENTITY_ID)
  console.log('[solid-payment] Token (first 20 chars):', SOLID_PAYMENT_ACCESS_TOKEN.substring(0, 20) + '...')
  console.log('[solid-payment] Request params:', {
    entityId: SOLID_PAYMENT_ENTITY_ID,
    amount: amount.toFixed(2),
    currency,
    paymentType,
    merchantTransactionId: merchantTransactionId || 'not provided',
    customerEmail,
    customerGivenName,
    customerSurname,
    customerPhone: customerPhone || 'not provided',
    customerIp: customerIp || 'not provided',
    billingStreet: billingStreet || 'not provided',
    billingCity: billingCity || 'not provided',
    billingPostcode: billingPostcode || 'not provided',
    billingCountry: billingCountry || 'not provided'
  })
  console.log('[solid-payment] NOTE: Browser data will be collected automatically by COPYandPAY widget')
  console.log('[solid-payment] NOTE: shopperResultUrl is set in form action, not in API request')
  console.log('[solid-payment] Full form data:', formData.toString())

  try {
    const response = await fetch(`${SOLID_PAYMENT_BASE_URL}v1/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SOLID_PAYMENT_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    console.log('[solid-payment] Response status:', response.status, response.statusText)
    
    const data = await response.json()
    
    console.log('[solid-payment] Response body:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('=== SOLID PAYMENT ERROR ===')
      console.error('[solid-payment] HTTP Status:', response.status, response.statusText)
      console.error('[solid-payment] Error data:', JSON.stringify(data, null, 2))
      console.error('[solid-payment] Result code:', data.result?.code)
      console.error('[solid-payment] Result description:', data.result?.description)
      throw new Error(data.result?.description || `Failed to prepare checkout: ${response.status}`)
    }

    // Check if checkout was successfully created
    if (!data.id) {
      console.error('=== SOLID PAYMENT MISSING ID ===')
      console.error('[solid-payment] No checkout ID in response:', JSON.stringify(data, null, 2))
      throw new Error('No checkout ID received from payment gateway')
    }

    console.log('=== SOLID PAYMENT SUCCESS ===')
    console.log('[solid-payment] Checkout ID:', data.id)
    console.log('[solid-payment] Integrity:', data.integrity)
    console.log('[solid-payment] Has integrity:', !!data.integrity)
    console.log('[solid-payment] Full response:', JSON.stringify(data, null, 2))
    
    return data
  } catch (error) {
    console.error('[solid-payment] Error preparing checkout:', error)
    throw error
  }
}

/**
 * Verify payment status from Solid Payment
 * IMPORTANT: Solid Payments only allows verification ONCE per checkout
 * This function caches results to prevent duplicate API calls
 * @param {string} resourcePath - Resource path from redirect (e.g., /v1/checkouts/{id}/payment)
 * @returns {Promise<Object>} - Payment status response
 */
export async function verifyPayment(resourcePath) {
  console.log('=== SOLID PAYMENT VERIFY PAYMENT ===')
  
  if (!SOLID_PAYMENT_ENTITY_ID || !SOLID_PAYMENT_ACCESS_TOKEN) {
    throw new Error('Solid Payment credentials not configured')
  }

  if (!resourcePath) {
    throw new Error('Resource path is required')
  }

  // Check cache first - Solid Payments only allows ONE verification per checkout
  const cached = verificationCache.get(resourcePath)
  if (cached) {
    const cacheAge = Date.now() - cached.timestamp
    const cacheAgeMinutes = Math.floor(cacheAge / 60000)
    console.log('[solid-payment] ✅ RETURNING CACHED VERIFICATION RESULT')
    console.log('[solid-payment] Cache age:', cacheAgeMinutes, 'minutes')
    console.log('[solid-payment] Cached result code:', cached.data.result?.code)
    return cached.data
  }

  // Build the full URL - remove leading slash from resourcePath since BASE_URL ends with /
  // Per docs: GET request to baseUrl + resourcePath (e.g., "https://test.solidpayments.net/" + "v1/checkouts/{id}/payment")
  const cleanResourcePath = resourcePath.startsWith('/') ? resourcePath.substring(1) : resourcePath
  const url = `${SOLID_PAYMENT_BASE_URL}${cleanResourcePath}?entityId=${SOLID_PAYMENT_ENTITY_ID}`
  
  console.log('[solid-payment] 🔍 FIRST VERIFICATION - Calling Solid Payments API')
  console.log('[solid-payment] Verification URL:', url)
  console.log('[solid-payment] Resource Path:', resourcePath)
  console.log('[solid-payment] Entity ID:', SOLID_PAYMENT_ENTITY_ID)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SOLID_PAYMENT_ACCESS_TOKEN}`,
      }
    })

    console.log('[solid-payment] Verification response status:', response.status, response.statusText)
    
    const data = await response.json()
    
    console.log('[solid-payment] Verification response body:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('=== SOLID PAYMENT VERIFICATION ERROR ===')
      console.error('[solid-payment] HTTP Status:', response.status, response.statusText)
      console.error('[solid-payment] Error data:', JSON.stringify(data, null, 2))
      throw new Error(data.result?.description || 'Failed to verify payment')
    }

    console.log('=== PAYMENT VERIFICATION DETAILS ===')
    console.log('[solid-payment] Transaction ID:', data.id)
    console.log('[solid-payment] Result code:', data.result?.code)
    console.log('[solid-payment] Result description:', data.result?.description)
    console.log('[solid-payment] Payment type:', data.paymentType)
    console.log('[solid-payment] Amount:', data.amount, data.currency)
    console.log('[solid-payment] Card details:', {
      bin: data.card?.bin,
      last4: data.card?.last4Digits,
      brand: data.card?.brand,
      holder: data.card?.holder
    })
    console.log('[solid-payment] Merchant transaction ID:', data.merchantTransactionId)
    console.log('[solid-payment] Checkout ID:', data.referencedId)

    // Cache the result to prevent duplicate API calls
    // Solid Payments only allows verification once per checkout
    verificationCache.set(resourcePath, {
      data,
      timestamp: Date.now()
    })
    console.log('[solid-payment] ✅ Result cached for future requests')

    return data
  } catch (error) {
    console.error('[solid-payment] Error verifying payment:', error)
    throw error
  }
}

/**
 * Check if a payment result code indicates success
 * Success codes match: /^(000\.000\.|000\.100\.1|000\.[36])/
 * @param {string} code - Result code from payment response
 * @returns {boolean} - True if payment was successful
 */
export function isPaymentSuccessful(code) {
  if (!code) return false
  
  // Solid Payment success patterns
  const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/
  return successPattern.test(code)
}

/**
 * Check if a payment is pending
 * Pending codes match: /^(000\.200)/
 * @param {string} code - Result code from payment response
 * @returns {boolean} - True if payment is pending
 */
export function isPaymentPending(code) {
  if (!code) return false
  
  const pendingPattern = /^(000\.200)/
  return pendingPattern.test(code)
}

/**
 * Clear cached verification results (useful for testing)
 * In production, cache persists for the lifetime of the server process
 */
export function clearVerificationCache() {
  const size = verificationCache.size
  verificationCache.clear()
  console.log(`[solid-payment] Cleared ${size} cached verification results`)
  return size
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: verificationCache.size,
    entries: Array.from(verificationCache.keys()).map(key => ({
      resourcePath: key,
      age: Date.now() - verificationCache.get(key).timestamp,
      resultCode: verificationCache.get(key).data.result?.code
    }))
  }
}

