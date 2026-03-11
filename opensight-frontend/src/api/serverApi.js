const BASE = `${import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'}/api`

const TOKEN_KEY = 'vs_auth_token'

let authToken = null
try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (saved) authToken = saved
} catch (_e) {}




function getFrontendRouteFlag() {
    if (typeof window === 'undefined') return null
    const path = window.location?.pathname || ''
    if (path === '/brand-dashboard' || path === '/brand-login') {
        return path
    }
    return null
}

async function http(path, { method = 'GET', body, cache } = {}) {
    const url = `${BASE}${path}`
    const frontendRouteFlag = getFrontendRouteFlag()
    const res = await fetch(url, {
        method,
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            ...(authToken ? { 'authorization': `Bearer ${authToken}` } : {}),
            ...(frontendRouteFlag ? { 'x-frontend-route': frontendRouteFlag } : {}),
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
        ...(cache ? { cache } : {}), // Support cache option (e.g., 'no-store')
    })
    
    const contentType = res.headers.get('content-type') || ''
    const text = await res.text()
    
    // Check if response is HTML (likely an error page or redirect)
    if (contentType.includes('text/html') || text.trim().startsWith('<!')) {
        console.error(`[http] Received HTML response for ${url}:`, {
            status: res.status,
            statusText: res.statusText,
            contentType,
            preview: text.substring(0, 200)
        })
        const err = new Error(`Server returned HTML instead of JSON (likely a 404 or redirect). Status: ${res.status}`)
        err.status = res.status
        err.error = 'html_response'
        err.message = `Unexpected response format. Please check the API endpoint.`
        throw err
    }
    
    let json
    try { 
        json = text ? JSON.parse(text) : {} 
    } catch (parseError) {
        console.error(`[http] JSON parse error for ${url}:`, {
            status: res.status,
            contentType,
            textPreview: text.substring(0, 200),
            parseError: parseError.message
        })
        // If it's not HTML and not JSON, it's likely an error message
        const err = new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
        err.status = res.status
        err.error = 'parse_error'
        err.message = text || `Invalid response from server`
        throw err
    }
    
    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`)
      err.status = res.status
      err.error = json?.error
      err.message = json?.message || json?.error || `HTTP ${res.status}`
      throw err
    }
    return json
}

export const serverApi = {
    auth: {
        async register({ email, full_name, password, plan }) {
            const { user, token } = await http('/auth/register', { method: 'POST', body: { email, full_name, password, plan } })
            authToken = token || authToken
            try { if (token) localStorage.setItem(TOKEN_KEY, token) } catch (_e) {}
            return user
        },
        async login({ email, password }) {
            const { user, token } = await http('/auth/login', { method: 'POST', body: { email, password } })
            authToken = token || authToken
            try { if (token) localStorage.setItem(TOKEN_KEY, token) } catch (_e) {}
            return user
        },
        async brandLogin({ username, password }) {
            const { user, token } = await http('/auth/brand-login', { method: 'POST', body: { username, password } })
            authToken = token || authToken
            try { if (token) localStorage.setItem(TOKEN_KEY, token) } catch (_e) {}
            return user
        },
        async resellerLogin({ username, password }) {
            const { user, token } = await http('/auth/reseller-login', { method: 'POST', body: { username, password } })
            authToken = token || authToken
            try { if (token) localStorage.setItem(TOKEN_KEY, token) } catch (_e) {}
            return user
        },
        async me() {
            const { user } = await http('/auth/me')
            return user
        },
        async updateMyUserData(partial) {
            const { user } = await http('/auth/me', { method: 'PATCH', body: partial })
            return user
        },
        async logout() {
            await http('/auth/logout', { method: 'POST' })
            authToken = null
            try { localStorage.removeItem(TOKEN_KEY) } catch (_e) {}
        },
        async list() {
            // Try admin endpoint first; fallback to current user only
            try {
                const { users } = await http('/admin/users')
                return users
            } catch (_e) {
                const { users } = await http('/users')
                return users
            }
        },
        async update(id, partial) {
            if (id === 'me') return this.updateMyUserData(partial)
            const body = { ...partial }
            if (Object.prototype.hasOwnProperty.call(body, 'subscription_tier')) {
                body.plan = body.subscription_tier
                delete body.subscription_tier
            }
            const { user } = await http(`/admin/users/${id}`, { method: 'PATCH', body })
            return user
        },
        async changePassword(currentPassword, newPassword) {
            const response = await http('/auth/password', { 
                method: 'PATCH', 
                body: { currentPassword, newPassword } 
            })
            return response
        },
    },
    settings: {
        async getSettings() {
            const { settings } = await http('/user/settings')
            return settings
        },
        async updateNotifications(preferences) {
            const response = await http('/user/settings/notifications', { 
                method: 'PATCH', 
                body: preferences 
            })
            return response
        },
        async updateSettlement(settlementData) {
            const response = await http('/user/settings/settlement', { 
                method: 'PATCH', 
                body: settlementData 
            })
            return response
        },
    },
    checkout: {
        async guestCheckout({ items, totalAmount, paymentDetails, linkId }) {
            const res = await http('/checkout/guest', { method: 'POST', body: { items, totalAmount, paymentDetails, linkId } })
            return res
        },
        async checkoutWithAuth({ items, totalAmount, paymentDetails, linkId }) {
            const res = await http('/cart/checkout', { method: 'POST', body: { items, totalAmount, paymentDetails, linkId } })
            return res
        },
        async prepareCheckout({ items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency }) {
            const res = await http('/checkout/prepare', { 
                method: 'POST', 
                body: { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency } 
            })
            return res
        },
        async verifyPayment(resourcePath) {
            const q = new URLSearchParams({ resourcePath }).toString()
            const res = await http(`/checkout/verify-payment?${q}`)
            return res
        },
        async checkStatus() {
            const res = await http('/checkout/check-status')
            return res
        }
    },
    tutor: {
        async listConversations(limit = 50) {
            const q = new URLSearchParams({ limit: String(limit) }).toString()
            const { conversations } = await http(`/tutor/conversations?${q}`)
            return conversations || []
        },
        async createConversation({ title, topic }) {
            const { conversation } = await http('/tutor/conversations', { method: 'POST', body: { title, topic } })
            return conversation
        },
        async getMessages(conversationId) {
            const { messages } = await http(`/tutor/conversations/${encodeURIComponent(conversationId)}/messages`)
            return messages || []
        },
        async sendMessage(conversationId, { content, temperature, language }) {
            const { assistant_message } = await http(`/tutor/conversations/${encodeURIComponent(conversationId)}/messages`, {
                method: 'POST',
                body: { 
                    content, 
                    ...(typeof temperature === 'number' ? { temperature: Number(temperature) } : {}),
                    ...(typeof language === 'string' ? { language: language } : {})
                },
            })
            return assistant_message
        },
    },
    charts: {
        async uploadToCloudinary({ file_data_url, folder }) {
            const res = await http('/chart/upload', { method: 'POST', body: { file_data_url, folder } })
            return res
        },
        async analyze({ image_url, image_data_url, symbol }) {
            const { analysis } = await http('/chart/analyze', { method: 'POST', body: { image_url, image_data_url, symbol } })
            return analysis
        },
        async listAnalyses(limit = 50) {
            const q = new URLSearchParams({ limit: String(limit) }).toString()
            const { analyses } = await http(`/chart/analyses?${q}`)
            return analyses || []
        },
    },
    // Admin module
    admin: {
        analytics: {
            async overview() {
                const res = await http('/admin/analytics/overview')
                return res
            },
        },
        users: {
            async create(userData) {
                const { user } = await http('/admin/users', { method: 'POST', body: userData })
                return user
            },
        },
        packages: {
            async list() {
                const res = await http('/admin/packages')
                return res
            },
            async create(packageData) {
                const { package: pkg } = await http('/admin/packages', { method: 'POST', body: packageData })
                return pkg
            },
            async update(id, packageData) {
                const { package: pkg } = await http(`/admin/packages/${id}`, { method: 'PUT', body: packageData })
                return pkg
            },
            async delete(id) {
                await http(`/admin/packages/${id}`, { method: 'DELETE' })
            },
        },
        currencies: {
            async list() {
                const res = await http('/admin/currencies')
                return res
            },
            async update(code, data) {
                const res = await http(`/admin/currencies/${code}`, { method: 'PUT', body: data })
                return res
            },
            async syncRates() {
                const res = await http('/admin/currencies/sync-rates', { method: 'POST' })
                return res
            },
            async updateConversionFee(amount) {
                const res = await http('/admin/currencies/conversion-fee', { method: 'PUT', body: { amount } })
                return res
            },
            async delete(code) {
                await http(`/admin/currencies/${code}`, { method: 'DELETE' })
            },
        },
        currencyGeoMappings: {
            async list() {
                const res = await http('/admin/currency-geo-mappings')
                return res
            },
            async create(data) {
                const res = await http('/admin/currency-geo-mappings', { method: 'POST', body: data })
                return res
            },
            async update(countryCode, data) {
                const res = await http(`/admin/currency-geo-mappings/${countryCode}`, { method: 'PUT', body: data })
                return res
            },
            async delete(countryCode) {
                await http(`/admin/currency-geo-mappings/${countryCode}`, { method: 'DELETE' })
            },
        },
        packagePrices: {
            async get(packageId) {
                const res = await http(`/admin/package-prices/${packageId}`)
                return res
            },
            async update(packageId, prices) {
                const res = await http(`/admin/package-prices/${packageId}`, { method: 'PUT', body: { prices } })
                return res
            },
        },
        brands: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/brands${q ? '?' + q : ''}`)
                return res
            },
            async get(id) {
                const res = await http(`/admin/brands/${encodeURIComponent(id)}`)
                return res
            },
            async create(brandData) {
                const res = await http('/admin/brands', { method: 'POST', body: brandData })
                return res
            },
            async update(id, brandData) {
                const res = await http(`/admin/brands/${encodeURIComponent(id)}`, { method: 'PATCH', body: brandData })
                return res
            },
            async delete(id) {
                await http(`/admin/brands/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
            async getUnpaidTransactions(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/brands/unpaid-transactions${q ? '?' + q : ''}`)
                return res
            },
            async getDashboard(id) {
                const res = await http(`/admin/brands/${encodeURIComponent(id)}/dashboard`)
                return res
            },
            async getPending(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/brands/pending${q ? '?' + q : ''}`)
                return res
            },
            async approve(id) {
                const res = await http(`/admin/brands/${encodeURIComponent(id)}/approve`, { method: 'POST' })
                return res
            },
            async reject(id, reason) {
                const res = await http(`/admin/brands/${encodeURIComponent(id)}/reject`, { 
                    method: 'POST', 
                    body: reason ? { reason } : {} 
                })
                return res
            },
        },
        directPurchaseLinks: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/direct-purchase-links${q ? '?' + q : ''}`)
                return res
            },
            async listByBrand(brandId) {
                const res = await http(`/admin/direct-purchase-links/brand/${encodeURIComponent(brandId)}`)
                return res
            },
        },
        orders: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/orders${q ? '?' + q : ''}`)
                return res
            },
            async get(id) {
                const res = await http(`/admin/orders/${encodeURIComponent(id)}`)
                return res
            },
            async create(orderData) {
                const res = await http('/admin/orders', { method: 'POST', body: orderData })
                return res
            },
            async createManual(orderData) {
                const res = await http('/admin/orders/manual', { method: 'POST', body: orderData })
                return res
            },
            async update(id, orderData) {
                const res = await http(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: orderData })
                return res
            },
            async delete(id) {
                await http(`/admin/orders/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
        },
        visits: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/visits${q ? '?' + q : ''}`)
                return res
            },
            async getStats(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/visits/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        transactions: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/all-transactions${q ? '?' + q : ''}`)
                return res
            },
        },
        payouts: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/payouts${q ? '?' + q : ''}`)
                return res
            },
            async markPaid({ brandIds, orderIds, fromDate, toDate }) {
                const res = await http('/admin/payouts/mark-paid', { 
                    method: 'POST', 
                    body: { brandIds, orderIds, fromDate, toDate } 
                })
                return res
            },
        },
        brandWallets: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/brand-wallets${q ? '?' + q : ''}`)
                return res
            },
        },
        ipWhitelist: {
            async list() {
                const res = await http('/admin/ip-whitelist')
                return res.ips || []
            },
            async add(ip, label) {
                const res = await http('/admin/ip-whitelist', { method: 'POST', body: { ip, label } })
                return res.ip
            },
            async delete(id) {
                await http(`/admin/ip-whitelist/${id}`, { method: 'DELETE' })
            },
            async getSettings() {
                const res = await http('/admin/ip-whitelist/settings')
                return res
            },
            async updateSettings(settings) {
                const res = await http('/admin/ip-whitelist/settings', { method: 'PATCH', body: settings })
                return res
            },
        },
        blockedIPs: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/admin/blocked-ips${q ? '?' + q : ''}`)
                return res
            },
            async get(ip) {
                const res = await http(`/admin/blocked-ips/${encodeURIComponent(ip)}`)
                return res.ip
            },
            async getAttempts(ip) {
                const res = await http(`/admin/blocked-ips/${encodeURIComponent(ip)}/attempts`)
                return res
            },
            async update(ip, action) {
                const res = await http(`/admin/blocked-ips/${encodeURIComponent(ip)}`, { 
                    method: 'PATCH', 
                    body: { action } 
                })
                return res.ip
            },
        },
        systemTools: {
            async fixUsdAmounts() {
                const res = await http('/admin/fix-usd-amounts', { method: 'POST' })
                return res
            },
        },
    },
    // Brand module
    brand: {
        profile: {
            async get() {
                const res = await http('/brand/profile')
                return res
            },
            async update(profileData) {
                const res = await http('/brand/profile', { method: 'PUT', body: profileData })
                return res
            },
        },
        dashboard: {
            async getStats(params) {
                const q = new URLSearchParams(params).toString()
                const res = await http(`/brand/dashboard/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        visits: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/visits${q ? '?' + q : ''}`)
                return res
            },
            async getStats(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/visits/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        links: {
            async list() {
                const res = await http('/brand/links', { cache: 'no-store' })
                return res
            },
            async create(linkData) {
                const res = await http('/brand/links', { method: 'POST', body: linkData })
                return res
            },
            async update(id, linkData) {
                const res = await http(`/brand/links/${encodeURIComponent(id)}`, { method: 'PUT', body: linkData })
                return res
            },
            async delete(id) {
                await http(`/brand/links/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
        },
        directPurchaseLinks: {
            async list() {
                const res = await http('/brand/direct-purchase-links')
                return res
            },
            async create(linkData) {
                const res = await http('/brand/direct-purchase-links', { method: 'POST', body: linkData })
                return res
            },
            async update(id, linkData) {
                const res = await http(`/brand/direct-purchase-links/${encodeURIComponent(id)}`, { method: 'PATCH', body: linkData })
                return res
            },
            async delete(id) {
                await http(`/brand/direct-purchase-links/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
        },
        orders: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/orders${q ? '?' + q : ''}`)
                return res
            },
        },
        network: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/network${q ? '?' + q : ''}`)
                return res
            },
            async create(partnerData) {
                const res = await http('/brand/network', { method: 'POST', body: partnerData })
                return res
            },
            async update(id, partnerData) {
                const res = await http(`/brand/network/${encodeURIComponent(id)}`, { method: 'PATCH', body: partnerData })
                return res
            },
            async delete(id) {
                await http(`/brand/network/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
        },
        analytics: {
            async get(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/analytics${q ? '?' + q : ''}`)
                return res
            },
        },
        commission: {
            async getStats(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/commission/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        childTransactions: {
            async list() {
                const res = await http('/brand/child-transactions')
                return res
            },
        },
        networkTransactions: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/network-transactions${q ? '?' + q : ''}`)
                return res
            },
        },
        allTransactions: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/brand/all-transactions${q ? '?' + q : ''}`)
                return res
            },
        },
            payouts: {
                async list(params) {
                    const q = params ? new URLSearchParams(params).toString() : ''
                    const res = await http(`/brand/payouts${q ? '?' + q : ''}`)
                    return res
                },
                async getUnpaid(params) {
                    const q = params ? new URLSearchParams(params).toString() : ''
                    const res = await http(`/brand/payouts/unpaid${q ? '?' + q : ''}`)
                    return res
                },
            },
    },
    // Reseller module (mirrors brand module with network additions)
    reseller: {
        profile: {
            async get() {
                const res = await http('/reseller/profile')
                return res
            },
            async update(profileData) {
                const res = await http('/reseller/profile', { method: 'PUT', body: profileData })
                return res
            },
        },
        dashboard: {
            async getStats(params) {
                const q = new URLSearchParams(params).toString()
                const res = await http(`/reseller/dashboard/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        visits: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/visits${q ? '?' + q : ''}`)
                return res
            },
            async getStats(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/visits/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        links: {
            async list() {
                const res = await http('/reseller/links')
                return res
            },
            async create(linkData) {
                const res = await http('/reseller/links', { method: 'POST', body: linkData })
                return res
            },
            async update(id, linkData) {
                const res = await http(`/reseller/links/${encodeURIComponent(id)}`, { method: 'PUT', body: linkData })
                return res
            },
            async delete(id) {
                await http(`/reseller/links/${encodeURIComponent(id)}`, { method: 'DELETE' })
            },
        },
        orders: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/orders${q ? '?' + q : ''}`)
                return res
            },
        },
        network: {
            async brands(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/network/brands${q ? '?' + q : ''}`)
                return res
            },
            async transactions(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/network/transactions${q ? '?' + q : ''}`)
                return res
            },
        },
        brands: {
            async create(brandData) {
                const res = await http('/reseller/brands', { method: 'POST', body: brandData })
                return res
            },
        },
        mids: {
            async list() {
                const res = await http('/reseller/mids')
                return res
            },
        },
        analytics: {
            async get(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/analytics${q ? '?' + q : ''}`)
                return res
            },
        },
        commission: {
            async getStats(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/commission/stats${q ? '?' + q : ''}`)
                return res
            },
        },
        networkTransactions: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/network-transactions${q ? '?' + q : ''}`)
                return res
            },
        },
        allTransactions: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/all-transactions${q ? '?' + q : ''}`)
                return res
            },
        },
        payouts: {
            async list(params) {
                const q = params ? new URLSearchParams(params).toString() : ''
                const res = await http(`/reseller/payouts${q ? '?' + q : ''}`)
                return res
            },
        },
    },
    // Public endpoints
    packages: {
        async listPublic() {
            const res = await http('/packages/public')
            return res
        },
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
    transaction: {
        async checkEligibility() {
            // Get client IP from window (set by LandingScripts.jsx via ip-api.com)
            const clientIp = typeof window !== 'undefined' ? (window.__clientIp || null) : null
            const ipInfo = typeof window !== 'undefined' ? (window.__ipInfo || null) : null
            
            // Use POST with cache: 'no-store' to ensure fresh evaluation every time
            // Send client_ip in body (obtained via ip-api.com, same method as homepage)
            const res = await http('/transaction/check-eligibility', { 
                method: 'POST',
                cache: 'no-store',
                body: {
                    ...(clientIp ? { client_ip: clientIp } : {}),
                    ...(ipInfo ? { ip_info: ipInfo } : {})
                }
            })
            return res
        },
    },
}


