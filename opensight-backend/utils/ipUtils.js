const FORWARDED_HEADER_REGEX = /for="?([^;"\s]+)"?/i

const IPV6_PREFIX = /^::ffff:/i

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
]

const PRIVATE_IPV6_RANGES = [
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
]

export function isPrivateIp(ip) {
  if (!ip) return true

  const normalized = ip.toLowerCase()

  if (normalized.includes('%')) {
    const [base] = normalized.split('%')
    return isPrivateIp(base)
  }

  if (normalized.includes(':')) {
    return PRIVATE_IPV6_RANGES.some((regex) => regex.test(normalized))
  }

  return PRIVATE_IPV4_RANGES.some((regex) => regex.test(normalized))
}

function sanitizeIp(ip) {
  if (!ip || typeof ip !== 'string') return ''
  return ip.replace(IPV6_PREFIX, '').trim()
}

/**
 * Validate if a string is a valid IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IP format
 */
export function isValidIpFormat(ip) {
  if (!ip || typeof ip !== 'string') return false
  
  const trimmed = ip.trim()
  if (!trimmed || trimmed === 'unknown' || trimmed === '') return false
  
  // Basic IPv4 validation (1.2.3.4)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(trimmed)) {
    const parts = trimmed.split('.')
    return parts.every(part => {
      const num = parseInt(part, 10)
      return num >= 0 && num <= 255
    })
  }
  
  // Basic IPv6 validation (simplified - just check for colons and valid chars)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (ipv6Regex.test(trimmed)) {
    return true
  }
  
  return false
}

function pickFirstIp(value) {
  if (!value || typeof value !== 'string') return ''
  return value.split(',')[0]?.trim() || ''
}

function fromForwardedHeader(value = '') {
  const match = value.match(FORWARDED_HEADER_REGEX)
  if (match && match[1]) {
    return match[1]
  }
  return ''
}

/**
 * Verify/enhance IP using ip-api.com (same method as homepage)
 * When called with an IP, ip-api.com returns geo info and confirms the IP
 * @param {string} candidateIp - IP address to verify
 * @returns {Promise<string>} - Verified IP address or 'unknown'
 */
async function verifyIpWithApi(candidateIp) {
  if (!candidateIp || candidateIp === 'unknown') {
    return 'unknown'
  }
  
  try {
    const fetch = (await import('node-fetch')).default
    // Call ip-api.com with the candidate IP to verify it and get geo info
    // This is the same pattern used elsewhere in the codebase
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(candidateIp)}?fields=61439`, { 
      timeout: 3000
    })
    const json = await response.json()
    if (json && json.status === 'success' && json.query) {
      // Return the verified IP from the API response
      return sanitizeIp(json.query) || candidateIp
    }
    // If API call succeeded but no query, return original candidate
    return candidateIp
  } catch (_err) {
    // If API call fails, return original candidate IP
    return candidateIp
  }
}

export function extractClientIp(req = {}) {
  try {
    const headerCandidates = [
      pickFirstIp(req.headers?.['x-forwarded-for']),
      fromForwardedHeader(req.headers?.forwarded),
      req.headers?.['cf-connecting-ip'],
      req.headers?.['x-real-ip'],
      req.headers?.['x-client-ip'],
    ]

    for (const candidate of headerCandidates) {
      const sanitized = sanitizeIp(candidate)
      // Validate: must be valid IP format and not private
      if (sanitized && 
          sanitized !== 'unknown' && 
          isValidIpFormat(sanitized) && 
          !isPrivateIp(sanitized)) {
        return sanitized
      }
    }

    const connectionCandidates = [
      req.realClientIp,
      req.ip,
      req.connection?.remoteAddress,
      req.socket?.remoteAddress,
      req.connection?.socket?.remoteAddress,
    ]

    for (const candidate of connectionCandidates) {
      const sanitized = sanitizeIp(candidate)
      // Validate: must be valid IP format and not private
      if (sanitized && 
          sanitized !== 'unknown' && 
          isValidIpFormat(sanitized) && 
          !isPrivateIp(sanitized)) {
        return sanitized
      }
    }

    // Fallback: return first candidate even if private (for localhost/dev)
    const fallback = sanitizeIp(headerCandidates[0] || connectionCandidates[0])
    return fallback || 'unknown'
  } catch (_err) {
    return 'unknown'
  }
}

/**
 * Extract client IP with ip-api.com support (same method as homepage)
 * Prioritizes client_ip from request body ONLY if valid, then reliably falls back to headers
 * @param {Object} req - Express request object
 * @param {Object} options - Options for logging
 * @returns {Promise<string>} - Client IP address
 */
export async function extractClientIpWithApi(req = {}, options = {}) {
  const { logSource = 'extractClientIpWithApi' } = options
  const logPrefix = `[${logSource}]`
  
  // First priority: client_ip from request body (obtained via ip-api.com on frontend, same as homepage)
  // BUT only use it if it's present, valid format, and not private
  const bodyClientIp = req.body?.client_ip || req.body?.ip_info?.query
  if (bodyClientIp && typeof bodyClientIp === 'string') {
    const sanitized = sanitizeIp(bodyClientIp.trim())
    
    // Validate: must be valid IP format, not empty, not 'unknown', and not private
    if (sanitized && 
        sanitized !== 'unknown' && 
        isValidIpFormat(sanitized) && 
        !isPrivateIp(sanitized)) {
      console.log(`${logPrefix} ✅ Using client_ip from request body: ${sanitized}`)
      return sanitized
    } else {
      console.log(`${logPrefix} ⚠️ client_ip from body is invalid/private/empty: "${bodyClientIp}" (sanitized: "${sanitized}"), falling back to headers`)
    }
  } else {
    if (options.logMissingClientIp !== false) {
      console.log(`${logPrefix} ℹ️ No client_ip in request body, using headers`)
    }
  }
  
  // Second priority: ALWAYS try headers/connection (reliable fallback)
  const fromHeaders = extractClientIp(req)
  
  // Validate header IP: must be valid format, not empty, not 'unknown'
  // Allow private IPs (they'll be logged but still used for rate limiting)
  if (fromHeaders && 
      fromHeaders !== 'unknown' && 
      isValidIpFormat(fromHeaders)) {
    if (isPrivateIp(fromHeaders)) {
      console.log(`${logPrefix} ⚠️ Header IP is private/localhost: ${fromHeaders} - Using it anyway for rate limiting`)
    } else {
      console.log(`${logPrefix} ✅ Using IP from headers: ${fromHeaders}`)
    }
    return fromHeaders
  }
  
  // If we truly can't determine IP, log warning
  if (!fromHeaders || fromHeaders === 'unknown') {
    console.warn(`${logPrefix} ❌ Could not determine client IP from headers or body. Headers: ${JSON.stringify({
      'x-forwarded-for': req.headers?.['x-forwarded-for'],
      'x-real-ip': req.headers?.['x-real-ip'],
      'cf-connecting-ip': req.headers?.['cf-connecting-ip'],
      'x-client-ip': req.headers?.['x-client-ip'],
      forwarded: req.headers?.forwarded,
      req_ip: req.ip,
      socket_remote: req.socket?.remoteAddress
    })}`)
  }
  
  // Return what we have (even if 'unknown' - let the caller decide how to handle it)
  return fromHeaders || 'unknown'
}

export async function attachRealClientIp(req, _res, next) {
  // Use async version with ip-api.com fallback (same method as homepage)
  req.realClientIp = await extractClientIpWithApi(req, { 
    logSource: 'middleware:attachRealClientIp',
    logMissingClientIp: true // Log when client_ip is missing (useful for debugging)
  })
  
  // Log the resolved IP for important requests (admin, checkout, etc.)
  const importantPaths = ['/api/admin', '/api/checkout', '/api/cart', '/api/track']
  if (importantPaths.some(path => req.path?.startsWith(path))) {
    console.log(`[middleware:attachRealClientIp] Resolved IP for ${req.method} ${req.path}: ${req.realClientIp}`)
  }
  
  next()
}

export function normalizeIp(ip) {
  const sanitized = sanitizeIp(ip)
  return sanitized || 'unknown'
}

