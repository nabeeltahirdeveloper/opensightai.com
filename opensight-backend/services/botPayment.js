/**
 * Bot Payment Gateway Integration Service
 * Handles communication with external FastAPI payment bot server
 */

import fetch from 'node-fetch'

// Bot Payment API configuration
const BOT_PAYMENT_API_URL = process.env.BOT_PAYMENT_API_URL || 'http://127.0.0.1:8000'

// Allowed currencies for bot payment
const ALLOWED_CURRENCIES = ['EUR', 'AUD', 'USD', 'GBP', 'CAD']

/**
 * Trigger bot payment and get payment link
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Payment amount
 * @param {string} params.title - Unique transaction title (order ID)
 * @param {string} params.afterPaymentLink - Redirect URL after successful payment
 * @param {string} params.currency - Currency code (EUR, AUD, USD, GBP, CAD)
 * @returns {Promise<Object>} - Response with payment link
 */
export async function triggerBot(params) {
  const {
    amount,
    title,
    afterPaymentLink,
    currency = 'USD'
  } = params

  console.log('=== BOT PAYMENT TRIGGER ===')
  console.log('[bot-payment] API URL:', BOT_PAYMENT_API_URL)
  console.log('[bot-payment] Request params:', {
    amount,
    title,
    after_payment_link: afterPaymentLink,
    currency
  })

  // Validate required parameters
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount')
  }

  if (!title) {
    throw new Error('Transaction title (order ID) is required')
  }

  if (!afterPaymentLink) {
    throw new Error('After payment link is required')
  }

  // Validate currency
  const normalizedCurrency = currency.toUpperCase()
  if (!ALLOWED_CURRENCIES.includes(normalizedCurrency)) {
    console.warn(`[bot-payment] Currency ${currency} not in allowed list, defaulting to USD`)
  }

  const finalCurrency = ALLOWED_CURRENCIES.includes(normalizedCurrency) ? normalizedCurrency : 'USD'

  try {
    const response = await fetch(`${BOT_PAYMENT_API_URL}/trigger-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        title: title,
        after_payment_link: afterPaymentLink,
        currency: finalCurrency
      })
    })

    console.log('[bot-payment] Response status:', response.status, response.statusText)

    const data = await response.json()
    console.log('[bot-payment] Response body:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('=== BOT PAYMENT ERROR ===')
      console.error('[bot-payment] HTTP Status:', response.status, response.statusText)
      console.error('[bot-payment] Error data:', JSON.stringify(data, null, 2))
      throw new Error(data.detail || data.message || `Failed to trigger bot: ${response.status}`)
    }

    console.log('=== BOT PAYMENT SUCCESS ===')
    console.log('[bot-payment] Payment link:', data.link || data.payment_link || data.url)

    return {
      success: true,
      link: data.link || data.payment_link || data.url,
      rawResponse: data
    }
  } catch (error) {
    console.error('[bot-payment] Error triggering bot:', error)
    throw error
  }
}

/**
 * Check transaction status from bot server
 * @param {string} title - Transaction title (order ID) to check
 * @returns {Promise<Object>} - Status response
 */
export async function checkTransactionStatus(title) {
  console.log('=== BOT PAYMENT CHECK STATUS ===')
  console.log('[bot-payment] Checking status for title:', title)

  if (!title) {
    throw new Error('Transaction title is required')
  }

  try {
    const url = `${BOT_PAYMENT_API_URL}/check-transaction-status?title=${encodeURIComponent(title)}`
    console.log('[bot-payment] Status URL:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    console.log('[bot-payment] Status response:', response.status, response.statusText)

    const data = await response.json()
    console.log('[bot-payment] Status data:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[bot-payment] Status check error:', data)
      throw new Error(data.detail || data.message || `Failed to check status: ${response.status}`)
    }

    // Normalize status response
    const status = (data.status || 'pending').toLowerCase()
    const isPaid = status === 'paid' || status === 'completed' || status === 'success'

    console.log('[bot-payment] Transaction status:', status, '| isPaid:', isPaid)

    return {
      success: true,
      status: isPaid ? 'paid' : status,
      isPaid,
      rawResponse: data
    }
  } catch (error) {
    console.error('[bot-payment] Error checking status:', error)
    throw error
  }
}

/**
 * Validate if currency is allowed for bot payment
 * @param {string} currency - Currency code to validate
 * @returns {boolean} - True if currency is allowed
 */
export function isAllowedCurrency(currency) {
  return ALLOWED_CURRENCIES.includes(currency?.toUpperCase())
}

/**
 * Get list of allowed currencies
 * @returns {string[]} - Array of allowed currency codes
 */
export function getAllowedCurrencies() {
  return [...ALLOWED_CURRENCIES]
}

/**
 * Normalize currency to allowed value or default to USD
 * @param {string} currency - Currency code to normalize
 * @returns {string} - Normalized currency code
 */
export function normalizeCurrency(currency) {
  const upper = currency?.toUpperCase()
  return ALLOWED_CURRENCIES.includes(upper) ? upper : 'USD'
}


















