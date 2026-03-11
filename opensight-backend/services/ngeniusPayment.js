/**
 * N-Genius Online Payment Gateway Integration Service
 * Handles Hosted Payment Page (redirect flow) for FR and AU clients
 * Based on PHP implementation - user enters card on N-Genius hosted page
 * 
 * @see https://docs.ngenius-payments.com/reference/hosted-payment-page
 */

import axios from 'axios'

// N-Genius credentials (matching PHP NetworkPaymentService.php structure)
// NOTE: PHP has these swapped incorrectly - we use correct values here
const NGENIUS_API_KEY = process.env.NETWORK_INI_API_KEY || 'NzdmYjEyNDMtYmYzZS00Y2ZhLWI3YmYtODlmYjVmMzRlYmJmOmVmOTMzOWQxLTc3OTktNDRjNS1hYzQ2LWEwYTAzNDZkZDdjMg=='
const NGENIUS_OUTLET_REFERENCE = process.env.NETWORK_INI_OUTLET_REFERENCE || '16acc176-4bad-497c-89f5-c5d826f5be08'
const NGENIUS_BASE_URL = process.env.NETWORK_INI_BASE_URL || 'https://api-gateway.ngenius-payments.com'

// Access token cache (tokens expire in 5 minutes)
let cachedToken = null
let tokenExpiresAt = 0

/**
 * Get or refresh access token for N-Genius API
 * Tokens are cached for 5 minutes
 * @returns {Promise<string>} - Access token
 */
export async function getAccessToken() {
  const now = Date.now()
  
  // Return cached token if still valid (with 30 second buffer)
  if (cachedToken && tokenExpiresAt > now + 30000) {
    console.log('[ngenius] Using cached access token')
    return cachedToken
  }
  
  console.log('[ngenius] Requesting new access token')
  
  if (!NGENIUS_API_KEY) {
    throw new Error('N-Genius API key not configured')
  }
  
  try {
    console.log('[ngenius] Requesting token from:', `${NGENIUS_BASE_URL}/identity/auth/access-token`)
    console.log('[ngenius] Using API key:', NGENIUS_API_KEY.substring(0, 20) + '...')

    const config = {
      method: 'post',
      url: `${NGENIUS_BASE_URL}/identity/auth/access-token`,
      headers: { 
        'Content-Type': 'application/vnd.ni-identity.v1+json', 
        'Authorization': `Basic ${NGENIUS_API_KEY}`
      },
      data: ''
    }

    const response = await axios.request(config)
    
    console.log('[ngenius] Token response status:', response.status)
    
    if (!response.data || !response.data.access_token) {
      console.error('[ngenius] No access token in response:', response.data)
      throw new Error('No access token in response')
    }
    
    // Cache token
    cachedToken = response.data.access_token
    tokenExpiresAt = now + (response.data.expires_in * 1000) // Convert seconds to milliseconds
    
    console.log('[ngenius] Access token obtained, expires in', response.data.expires_in, 'seconds')
    
    return cachedToken
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error('[ngenius] Access token request failed:', error.response.status, error.response.data)
    } else if (error.request) {
      // The request was made but no response was received
      console.error('[ngenius] No response received:', error.request)
    } else {
      // Something happened in setting up the request
      console.error('[ngenius] Error:', error.message)
    }
    throw error
  }
}

/**
 * Create a payment order with N-Genius (Hosted Payment Page flow)
 * Returns a payment URL where user will enter their card details
 * Based on PHP NetworkPaymentService::createOrder() implementation
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in original currency
 * @param {string} params.currency - Original currency code (EUR, AUD, etc.)
 * @param {number} params.amountUSD - Amount converted to USD
 * @param {string} params.customerEmail - Customer email
 * @param {string} params.customerFirstName - Customer first name
 * @param {string} params.customerLastName - Customer last name
 * @param {string} params.merchantTransactionId - Unique transaction ID
 * @param {string} params.billingCountry - Billing country code
 * @param {string} params.billingCity - Billing city (optional)
 * @param {string} params.billingAddress - Billing address line 1 (optional)
 * @returns {Promise<Object>} - Payment response with payment URL
 */
export async function createOrder(params) {
  const {
    amount,
    currency,
    amountUSD,
    customerEmail,
    customerFirstName = 'Customer',
    customerLastName = 'User',
    merchantTransactionId,
    billingCountry = 'US',
    billingCity = 'City',
    billingAddress = null
  } = params
  
  console.log('[ngenius] Creating hosted payment page order:', {
    amount,
    currency,
    amountUSD,
    merchantTransactionId,
    billingCountry,
    billingCity
  })
  
  if (!NGENIUS_OUTLET_REFERENCE) {
    throw new Error('N-Genius outlet reference not configured')
  }
  
  // Validate required parameters
  if (!amountUSD || amountUSD <= 0) {
    throw new Error('Invalid amount')
  }
  
  if (!customerEmail) {
    throw new Error('Customer email is required')
  }
  
  try {
    // Get access token
    const accessToken = await getAccessToken()
    
    // N-Genius requires amount in minor units (cents)
    // Matching PHP: $postData->amount->value = $data->amount * 100;
    const amountInMinorUnits = Math.round(amountUSD * 100)
    
    // Sanitize merchant reference (no underscores)
    const sanitizedMerchantRef = (merchantTransactionId || `order-${Date.now()}`).replace(/_/g, '-')
    
    // Build callback URLs - N-Genius will redirect here after payment
    // Matching PHP redirectUrl and cancelUrl structure
    const backendBaseUrl = process.env.BACKEND_URL || 'https://api-dev.OpenSightai.com'
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'
    
    // Use ngenius-callback endpoint for redirect (success/failure handled by ref parameter)
    const redirectUrl = `${backendBaseUrl}/api/checkout/ngenius-callback?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`
    const cancelUrl = `${frontendBaseUrl}/payment-failed?reason=cancelled`
    
    console.log('[ngenius] Callback URLs:', { redirectUrl, cancelUrl })
    
    // Prepare request body matching PHP NetworkPaymentService::createOrder() exactly
    // Reference: NetworkPaymentService.php lines 135-157
    const requestBody = {
      action: 'SALE', // SALE = one-stage payment (PHP uses 'SALE')
      amount: {
        currencyCode: 'USD', // N-Genius requires USD (PHP uses $data->currency)
        value: amountInMinorUnits // Amount in minor units (cents)
      },
      emailAddress: customerEmail, // Required field in PHP
      merchantAttributes: {
        redirectUrl: redirectUrl, // PHP: 'https://www.fujtrade.com/network_success'
        cancelUrl: cancelUrl,     // PHP: 'https://www.fujtrade.com/network_cancel'
        skipConfirmationPage: true // PHP line 148
      },
      paymentAttempts: 3, // PHP line 149
      billingAddress: {
        firstName: customerFirstName,     // PHP: $data->customer->firstName
        lastName: customerLastName,       // PHP: $data->customer->lastName
        address1: billingAddress || `${billingCountry}, ${billingCity}`, // PHP: $data->address->country .' ,' .$data->address->city
        city: billingCity,                // PHP: $data->address->city
        countryCode: billingCountry       // PHP: $data->address->country
      }
    }
    
    console.log('[ngenius] Sending order creation request:', {
      action: requestBody.action,
      amount: amountInMinorUnits,
      currency: 'USD',
      merchantOrderReference: sanitizedMerchantRef
    })
    
    // Create order using axios
    try {
      const response = await axios({
        method: 'post',
        url: `${NGENIUS_BASE_URL}/transactions/outlets/${NGENIUS_OUTLET_REFERENCE}/orders`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.ni-payment.v2+json',
          'Accept': 'application/vnd.ni-payment.v2+json'
        },
        data: requestBody
      })
      
      const responseData = response.data
      
      console.log('[ngenius] Order creation response status:', response.status)
    
      // Extract payment URL
      const orderReference = responseData.reference
      const paymentUrl = responseData._links?.payment?.href
      
      if (!paymentUrl) {
        console.error('[ngenius] No payment URL in response')
        return {
          success: false,
          error: 'No payment URL available',
          raw: responseData
        }
      }
      
      console.log('[ngenius] Order created successfully:', {
        orderReference,
        paymentUrl
      })
      
      return {
        success: true,
        orderReference,
        paymentUrl,
        raw: responseData
      }
    } catch (axiosError) {
      if (axiosError.response) {
        console.error('[ngenius] Order creation failed:', axiosError.response.status, axiosError.response.data)
        return {
          success: false,
          error: axiosError.response.data.message || 'Failed to create order',
          raw: axiosError.response.data
        }
      }
      throw axiosError
    }
  } catch (error) {
    console.error('[ngenius] Error creating order:', error)
    throw error
  }
}

/**
 * Map N-Genius error code to user-friendly message
 * Based on https://docs.ngenius-payments.com/reference/error-codes-details
 * @param {string} code - Error code from N-Genius
 * @returns {string} - User-friendly error message
 */
export function mapNGeniusErrorCode(code) {
  const errorMap = {
    '00': 'Transaction Approved',
    '01': 'Card issue - Contact your bank',
    '02': 'Card issue - Contact your bank',
    '03': 'Invalid merchant configuration',
    '04': 'Card reported lost or stolen',
    '05': 'Payment declined by bank',
    '06': 'Card issue - Contact your bank',
    '07': 'Card reported lost or stolen',
    '08': 'Transaction Approved',
    '10': 'Partially approved',
    '12': 'Invalid transaction format',
    '13': 'Invalid amount',
    '14': 'Invalid card number',
    '15': 'Card issuer not found',
    '19': 'Please try again',
    '21': 'Card issue - Contact bank',
    '22': 'Bank temporarily unavailable',
    '23': 'Transaction fee error',
    '25': 'Card details not recognized',
    '30': 'Transaction format error',
    '31': 'Bank does not support online transactions',
    '33': 'Card expired',
    '34': 'Suspected fraud - Contact bank immediately',
    '35': 'Lost or stolen card',
    '36': 'Card restricted',
    '37': 'Lost or stolen card',
    '38': 'Too many incorrect PIN attempts',
    '39': 'Not a credit account',
    '40': 'Transaction type not supported',
    '41': 'Card reported lost',
    '42': 'Account type mismatch',
    '43': 'Card reported stolen',
    '44': 'Invalid account type',
    '51': 'Insufficient funds',
    '52': 'No checking account',
    '53': 'No savings account',
    '54': 'Card expired',
    '55': 'Incorrect PIN',
    '56': 'Card number not found',
    '57': 'Transaction not permitted for this card',
    '58': 'Transaction not permitted',
    '59': 'Suspected fraud - Contact bank',
    '60': 'Payment declined - Contact bank',
    '61': 'Withdrawal limit exceeded',
    '62': 'Card has restrictions',
    '63': 'Security violation',
    '64': 'Incorrect transaction amount',
    '65': 'Withdrawal frequency exceeded',
    '66': 'Security issue - Contact merchant',
    '67': 'Suspected counterfeit card',
    '75': 'Too many PIN attempts',
    '82': 'Incorrect CVV/CVC',
    '90': 'Bank system temporarily unavailable',
    '91': 'Bank temporarily unavailable',
    '92': 'Unable to process - Try another card',
    '93': 'Transaction violates regulations',
    '94': 'Duplicate transaction detected',
    '96': 'System error - Please retry'
  }
  
  return errorMap[code] || `Payment declined (Code: ${code})`
}

/**
 * Retrieve order status from N-Genius
 * Based on PHP NetworkPaymentService::getOrderStatus() implementation
 * @param {string} orderReference - Order reference from N-Genius
 * @returns {Promise<Object>} - Order status
 */
export async function getOrderStatus(orderReference) {
  console.log('[ngenius] Retrieving order status:', orderReference)
  
  if (!NGENIUS_OUTLET_REFERENCE) {
    throw new Error('N-Genius outlet reference not configured')
  }
  
  try {
    const accessToken = await getAccessToken()
    
    // Build URL matching PHP implementation
    // PHP: $url = $this->baseUrl . '/transactions/outlets/' . $this->outletReference . '/orders/' . $orderReference;
    const url = `${NGENIUS_BASE_URL}/transactions/outlets/${NGENIUS_OUTLET_REFERENCE}/orders/${orderReference}`
    
    console.log('[ngenius] Requesting order status from:', url)
    
    const response = await axios({
      method: 'get',
      url: url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.ni-payment.v2+json'
      }
    })
    
    const data = response.data
    
    // Extract payment state from embedded payment (matching PHP NetworkIntPaymentController.php)
    // PHP: $check_status=$orderStatus['data']['_embedded']['payment'][0]['state'];
    const payment = data._embedded?.payment?.[0] || {}
    const paymentState = payment.state || 'UNKNOWN'
    
    // Extract amount and currency from payment data (matching PHP lines 99-102)
    // PHP: $amountData = $data['_embedded']['payment'][0]['amount']['value'];
    // PHP: $currency = $data['_embedded']['payment'][0]['amount']['currencyCode'];
    const amountData = payment.amount?.value || data.amount?.value
    const currency = payment.amount?.currencyCode || data.amount?.currencyCode
    
    // Convert from minor units to major units (PHP line 102: $amount = $amountData / 100)
    const amount = amountData ? amountData / 100 : 0
    
    // Extract billing address (matching PHP lines 96-112)
    const billingAddress = data.billingAddress || {}
    
    // Get failure reason and error code if available
    // Extract error code from authResponse (matching N-Genius error codes documentation)
    const errorCode = payment.authResponse?.resultCode || payment['3ds']?.statusCode || null
    const failureMessage = payment.authResponse?.resultMessage || payment['3ds']?.status || null
    
    // Map error code to user-friendly message
    let failureReason = null
    if (errorCode && errorCode !== '00' && errorCode !== '08') {
      const mappedMessage = mapNGeniusErrorCode(errorCode)
      failureReason = `${mappedMessage} (Code: ${errorCode})`
    } else if (failureMessage) {
      failureReason = failureMessage
    }
    
    console.log('[ngenius] Order status retrieved:', {
      reference: data.reference,
      state: paymentState,
      amount,
      currency,
      emailAddress: data.emailAddress,
      billingAddress,
      errorCode,
      failureReason
    })
    
    return {
      success: true,
      orderReference: data.reference,
      state: paymentState,
      errorCode,
      failureReason,
      amount, // In major units (e.g., 10.50)
      amountMinorUnits: amountData, // In minor units (e.g., 1050)
      currency,
      emailAddress: data.emailAddress,
      billingAddress,
      raw: data
    }
  } catch (error) {
    if (error.response) {
      console.error('[ngenius] Failed to retrieve order status:', error.response.status, error.response.data)
    } else {
      console.error('[ngenius] Error retrieving order status:', error.message)
    }
    throw error
  }
}

/**
 * Verify payment result
 * Based on PHP NetworkIntPaymentController::network_success() implementation
 * @param {string} orderReference - Order reference from N-Genius
 * @returns {Promise<Object>} - Verification result with transaction data
 */
export async function verifyPayment(orderReference) {
  console.log('[ngenius] Verifying payment:', orderReference)
  
  try {
    const orderStatus = await getOrderStatus(orderReference)
    
    const state = orderStatus.state
    const failureReason = orderStatus.failureReason
    
    // Payment state verification matching PHP NetworkIntPaymentController.php lines 69-83
    // PHP switch statement checks for 'CAPTURED' status
    // case 'CAPTURED': $status = 'success'; break;
    // default: $status = 'error'; break;
    let isSuccess = false
    let status = 'error'
    
    switch (state) {
      case 'CAPTURED':
        // Payment successfully captured
        isSuccess = true
        status = 'success'
        console.log('[ngenius] Payment CAPTURED successfully:', {
          orderReference,
          amount: orderStatus.amount,
          currency: orderStatus.currency
        })
        break
      
      case 'PURCHASED':
      case 'AUTHORISED':
        // Also consider these as successful
        isSuccess = true
        status = 'success'
        console.log(`[ngenius] Payment ${state} successfully:`, {
          orderReference,
          amount: orderStatus.amount,
          currency: orderStatus.currency
        })
        break
      
      default:
        // Failed, pending, or unknown state
        isSuccess = false
        status = 'error'
        console.warn('[ngenius] Payment not successful:', {
          state,
          failureReason,
          orderReference
        })
        break
    }
    
    if (!isSuccess && failureReason) {
      console.warn('[ngenius] Payment failed with reason:', failureReason)
    }
    
    return {
      success: isSuccess,
      status, // 'success' or 'error' (matching PHP)
      state: state,
      failureReason,
      orderReference: orderStatus.orderReference,
      amount: orderStatus.amount, // In major units
      amountMinorUnits: orderStatus.amountMinorUnits, // In minor units
      currency: orderStatus.currency,
      emailAddress: orderStatus.emailAddress,
      billingAddress: orderStatus.billingAddress,
      raw: orderStatus.raw
    }
  } catch (error) {
    console.error('[ngenius] Error verifying payment:', error)
    throw error
  }
}
