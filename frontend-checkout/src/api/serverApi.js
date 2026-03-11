// ⚠️ FORCE localhost in development mode - DO NOT USE api-dev.OpenSightai.com
const isDevelopment = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

// In development, ALWAYS use localhost:3001, ignore environment variables
// In production, use OpenSightai.com API (not opensightai.com)
let envApiUrl = import.meta.env.VITE_API_URL
// Override if environment variable points to opensightai.com
// if (envApiUrl && envApiUrl.includes('opensightai.com')) {
//   console.warn('[serverApi] ⚠️ Environment variable points to opensightai.com, overriding to OpenSightai.com')
//   envApiUrl = null
// }
const API_BASE = isDevelopment
  ? 'http://localhost:3001'
  : (envApiUrl || 'https://api-dev.OpenSightai.com'); 

const BASE = `${API_BASE}/api`

// Debug: Log which API base URL is being used
console.log('[serverApi] ========== API CONFIGURATION ==========')
console.log('[serverApi] Is Development:', isDevelopment)
console.log('[serverApi] Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A')
console.log('[serverApi] Environment variables:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    API_BASE: API_BASE,
    BASE: BASE
})
console.log('[serverApi] ✅ Using API Base:', API_BASE)
console.log('[serverApi] ✅ Full API URL:', BASE)
console.log('[serverApi] ======================================')

const TOKEN_KEY = 'vs_auth_token'

let authToken = null
try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (saved) authToken = saved
} catch (_e) {}

async function http(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'content-type': 'application/json',
            ...(authToken ? { 'authorization': `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json
    try { json = text ? JSON.parse(text) : {} } catch (_e) { json = { error: text } }
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
    return json
}

export const serverApi = {
    // checkout: {
    //     async prepareCheckout({ items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency }) {
    //         const res = await http('/checkout/prepare', { 
    //             method: 'POST', 
    //             body: { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency } 
    //         })
    //         return res
    //     },
    //     async verifyPayment(resourcePath) {
    //         const q = new URLSearchParams({ resourcePath }).toString()
    //         const res = await http(`/checkout/verify-payment?${q}`)
    //         return res
    //     },
    //     async neogatePrepare({
    //         items,
    //         totalAmount,
    //         paymentDetails,
    //         currency,
    //         redirect_url,
    //         client_orderid,
    //       }) {
    //         const res = await http('/checkout/neogate-prepare', {
    //           method: 'POST',
    //           body: {
    //             items,
    //             totalAmount,
    //             paymentDetails,
    //             currency,
    //             redirect_url,
    //             client_orderid,
    //           }
    //         })
    //         return res
    //       }          
    // },
    payment: {
        async triggerBotPayment({ items, totalAmount, paymentDetails, brandSlug, linkId, currency }) {
            const res = await http('/payment/trigger-bot', {
                method: 'POST',
                body: { items, totalAmount, paymentDetails, brandSlug, linkId, currency }
            })
            return res
        },
        async checkPaymentStatus(orderId) {
            const res = await http(`/payment/check-status/${encodeURIComponent(orderId)}`)
            return res
        },
        async markOrderPaid(orderId) {
            const res = await http(`/payment/mark-paid/${encodeURIComponent(orderId)}`, {
                method: 'POST'
            })
            return res
        },
        async getOrder(orderId) {
            const res = await http(`/payment/order/${encodeURIComponent(orderId)}`)
            return res
        },
        async callBotPayment(payload) {
            const res = await http('/checkout/bot-payment', {
                method: 'POST',
                body: payload
            })
            return res
        },
        async createBotPaymentOrder(orderData) {
            const res = await http('/checkout/bot-payment-order', {
                method: 'POST',
                body: orderData
            })
            return res
        }
    },
    currencies: {
        async listPublic() {
            const res = await http('/currencies/public')
            return res
        },
        async getForCountry(countryCode) {
            const res = await http(`/currencies/for-country/${countryCode}`)
            return res
        },
    },
    async checkVpn() {
        const res = await http('/check-vpn', { method: 'POST' })
        return res
    },
}

