import axios from 'axios'
import crypto from 'crypto'

function resolveNeogateConfig() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  const isProd = nodeEnv === 'production'

  const cfg = isProd
    ? {
        env: 'production',
        groupId: process.env.NEOGATE_GROUP_ID_PROD,
        apiKey: process.env.NEOGATE_API_KEY_PROD,
        controlKey: process.env.NEOGATE_CONTROL_KEY_PROD,
        baseUrl: process.env.NEOGATE_BASE_URL_PROD,
      }
    : {
        env: 'sandbox',
        groupId: process.env.NEOGATE_GROUP_ID_SANDBOX || '3234',
        apiKey: process.env.NEOGATE_API_KEY_SANDBOX || 'DD81EEC5-19CE-46D9-9392-12A35C874D6E',
        controlKey: process.env.NEOGATE_CONTROL_KEY_SANDBOX || '15A321A6-DBE2-48CA-A815-EFE1C412E273',
        baseUrl: process.env.NEOGATE_BASE_URL_SANDBOX || 'https://sandbox.neogate.cc',
      }

  // ---------- strict checks ----------
  if (!cfg.groupId) throw new Error(`[neogate] Missing groupId for env=${cfg.env}`)
  if (!cfg.apiKey) throw new Error(`[neogate] Missing apiKey for env=${cfg.env}`)
  if (!cfg.controlKey) throw new Error(`[neogate] Missing controlKey for env=${cfg.env}`)
  if (!cfg.baseUrl) throw new Error(`[neogate] Missing baseUrl for env=${cfg.env}`)

  if (cfg.env === 'sandbox') {
    if (cfg.baseUrl !== 'https://sandbox.neogate.cc') throw new Error('[neogate] Sandbox must use https://sandbox.neogate.cc')
    if (String(cfg.groupId) !== '3234') throw new Error('[neogate] Sandbox must use groupId=3234')
  } else {
    if (cfg.baseUrl.includes('sandbox')) throw new Error('[neogate] Production must not use sandbox baseUrl')
    if (String(cfg.groupId) === '3234') throw new Error('[neogate] Production must not use sandbox groupId')
  }

  return cfg
}

function sha1(data) {
  return crypto.createHash('sha1').update(data, 'utf8').digest('hex')
}

function calculateSaleFormControl(groupId, clientOrderId, amountInMinorUnits, email, controlKey) {
  const controlString = groupId + clientOrderId + amountInMinorUnits + email + controlKey
  return sha1(controlString)
}

const CURRENCY_EXPONENT = { JPY: 0, KRW: 0 }
function getCurrencyExponent(currency) {
  return Object.prototype.hasOwnProperty.call(CURRENCY_EXPONENT, currency) ? CURRENCY_EXPONENT[currency] : 2
}
function formatAmountForRequest(amount, currency) {
  const exp = getCurrencyExponent(currency)
  return Number(amount).toFixed(exp)
}
function toMinorUnits(amount, currency) {
  const exp = getCurrencyExponent(currency)
  const fixed = Number(amount).toFixed(exp)
  return exp === 0 ? fixed : fixed.replace('.', '')
}

const NEOGATE_CURRENCY_ENDPOINT = {
  EUR: '86169',
  CAD: '86488',
  GBP: '86489',
  USD: '86495',
  JPY: '86496',
  AUD: '86497',
  INR: '86600',
  CHF: '86601',
  SGD: '86602',
  MXN: '86603',
  BRL: '86604',
  KRW: '86605',
  TRY: '86606',
  AED: '86607',
  HKD: '86608',
  NOK: '86609',
  ZAR: '86610',
  DKK: '86611',
  COP: '86613',
  PEN: '86614',
  SAR: '86615',
  RON: '86616',
  BGN: '86617',
  PLN: '86618',
  SEK: '86619',
  ARS: '86628',
}

export function resolveEndpointId(currency) {
  const code = String(currency || '').toUpperCase()
  const endpointId = NEOGATE_CURRENCY_ENDPOINT[code]
  if (!endpointId) throw new Error(`Neogate endpoint_id not configured for currency: ${code}`)
  return endpointId
}

export async function createPaymentForm(params) {
  const { env, groupId, apiKey, controlKey, baseUrl } = resolveNeogateConfig()

  const amount = params.amount ?? params.totalAmount
  const currency = String(params.currency || 'USD').toUpperCase()

  const clientOrderId = params.clientOrderId ?? params.client_orderid ?? params.client_order_id
  const email = params.email ?? params.paymentDetails?.email
  const firstName = params.firstName ?? params.first_name ?? params.paymentDetails?.firstName
  const lastName = params.lastName ?? params.last_name ?? params.paymentDetails?.lastName

  const phone = params.phone ?? params.paymentDetails?.phone
  const address1 = params.address1 ?? params.paymentDetails?.address1
  const city = params.city ?? params.paymentDetails?.city
  const state = params.state ?? params.paymentDetails?.state
  const zipCode = params.zipCode ?? params.zip_code ?? params.paymentDetails?.zipCode
  const country = params.country ?? params.paymentDetails?.country

  const ipAddress = params.ipAddress ?? params.ipaddress ?? '13.50.237.116'
  const orderDesc = params.orderDesc ?? params.order_desc ?? 'Payment for OpenSightAI'

  const redirectUrl = params.redirectUrl ?? params.redirect_url
  const serverCallbackUrl = params.serverCallbackUrl ?? params.server_callback_url

  const merchantTransactionId = params.merchantTransactionId || params.merchant_transaction_id || clientOrderId

  
  if (!amount || Number(amount) <= 0) throw new Error('Invalid amount')
  if (!clientOrderId) throw new Error('Client order ID is required')
  if (!email) throw new Error('Customer email is required')
  if (!redirectUrl) throw new Error('redirect_url is required')
  if (!serverCallbackUrl) throw new Error('server_callback_url is required')

  const amountFormatted = formatAmountForRequest(amount, currency)
  const amountInMinorUnits = toMinorUnits(amountFormatted, currency).toString()

  const formData = new URLSearchParams()


  const control = calculateSaleFormControl(String(groupId), clientOrderId, amountInMinorUnits, email, controlKey)
  const endpointId = resolveEndpointId(currency)
  const countryNorm =
  (country || '').toUpperCase() ||
  (currency === 'CAD' ? 'CA' : 'US');

formData.append('country', countryNorm);

  formData.append('amount', amountFormatted)
  formData.append('currency', currency)
  formData.append('client_orderid', clientOrderId)
  if (merchantTransactionId) 
  formData.append('merchant_transaction_id', merchantTransactionId)
  formData.append('email', email)
  formData.append('first_name', firstName || '')
  formData.append('last_name', lastName || '')
  formData.append('address1', address1 || '')
  formData.append('city', city || '')
  formData.append('zip_code', zipCode || '')
  formData.append('state', state || '')
  formData.append('ipaddress', ipAddress || '')
  formData.append('order_desc', orderDesc)
  formData.append('control', control)
  formData.append('endpoint_id', endpointId)
  formData.append('redirect_url', redirectUrl)
  formData.append('server_callback_url', serverCallbackUrl)
  formData.append('phone', phone || '')

  // IMPORTANT: never log card values
  const payloadString = formData.toString()
  // if (creditCardNumber || cvv2) {
  //   console.log('[neogate] Payload built (card fields hidden). Keys:', [...new URLSearchParams(payloadString).keys()])
  // } else {
  //   console.log('[neogate] Form payload:', payloadString)
  // }

  const url = `${baseUrl}/paynet/api/v2/sale-form/group/${String(groupId)}`
  console.log('[neogate] ENV:', env, '| URL:', url)

  console.log('[neogate] endpointId resolved:', endpointId)
console.log('[neogate] outgoing payload:', payloadString)


  const response = await axios({
    method: 'post',
    url,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${apiKey}`,
    },
    data: payloadString,
  })

  // -----------------------------
  // Parse Neogate response
  // -----------------------------
  const responseText = response.data
  const parsed = {}

  if (typeof responseText === 'string') {
    for (const line of responseText.split('\n')) {
      const cleaned = line.trim().replace(/^&/, '')
      if (!cleaned || !cleaned.includes('=')) continue
      const idx = cleaned.indexOf('=')
      const key = cleaned.slice(0, idx)
      const value = cleaned.slice(idx + 1)
      parsed[key] = decodeURIComponent(value)
    }
  } else if (typeof responseText === 'object' && responseText) {
    Object.assign(parsed, responseText)
  }

  if (parsed.type === 'validation-error' || parsed.type === 'error') {
    return {
      success: false,
      error: parsed['error-message'] || parsed['error_message'] || 'Neogate error',
      errorCode: parsed['error-code'] || parsed['error_code'] || null,
      raw: parsed,
    }
  }

  const paymentUrl = parsed['redirect-url'] || parsed['redirect_url']
  const orderId = parsed['paynet-order-id'] || parsed['paynet_order_id']
  const serialNumber = parsed['serial-number'] || parsed['serial_number']

  if (!paymentUrl) {
    return { success: false, error: 'No redirect-url returned by Neogate', raw: parsed }
  }

  return { success: true, paymentUrl, orderId, serialNumber, raw: parsed }
}
