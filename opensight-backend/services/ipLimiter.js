import { extractClientIpWithApi, isValidIpFormat, isPrivateIp } from '../utils/ipUtils.js'

const FRONTEND_ROUTE_HEADER = 'x-frontend-route'
const BRAND_ROUTE_ALLOWLIST = new Set(['/brand-dashboard', '/brand-login'])

function normalizeFrontendRoute(value) {
  if (!value) return null
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  let pathname = trimmed
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      pathname = new URL(trimmed).pathname
    }
  } catch (_err) {
    // Ignore invalid URL and fall back to raw path
  }
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`
  }
  return pathname.toLowerCase()
}

function isBrandRouteBypass(req) {
  const headerValue = req.headers?.[FRONTEND_ROUTE_HEADER]
  const bodyValue = req.body?.frontend_route || req.body?.frontendRoute
  const normalized = normalizeFrontendRoute(headerValue || bodyValue)
  return normalized ? BRAND_ROUTE_ALLOWLIST.has(normalized) : false
}

/**
 * IP-Based Transaction Attempt Limiter Service
 * Tracks checkout attempts by IP address and implements progressive blocking
 */

/**
 * Get the required cooldown period in minutes based on attempt count
 * This is the time that must pass before the next attempt is allowed
 * @param {number} attemptCount - Current attempt count
 * @returns {number} - Cooldown duration in minutes
 */
function getCooldownMinutes(attemptCount) {
  switch (attemptCount) {
    case 0:
      return 5 // 5 minutes cooldown after first attempt (before second attempt)
    case 1:
      return 30 // 30 minutes cooldown after second attempt (before third attempt)
    case 2:
      return 120 // 2 hours cooldown after third attempt (before fourth attempt)
    case 3:
      return 1440 // 24 hours cooldown after fourth attempt (before fifth attempt)
    default:
      // For 4+ attempts, keep 24 hour cooldown
      return 1440
  }
}

/**
 * Get the message for the next attempt count (after incrementing)
 * @param {number} attemptCount - The attempt count after incrementing
 * @returns {string} - Message to display
 */
function getBlockMessage(attemptCount) {
  switch (attemptCount) {
    case 1:
      return "Please wait 5 minutes before trying again. This short delay helps us keep your payment secure."
    case 2:
      return "Too many attempts. Please try again in 30 minutes. This protects your card from potential misuse."
    case 3:
      return "For your security, you must wait 2 hours before making another attempt."
    case 4:
    default:
      // For 4+ attempts, use 24 hour message
      return "Your payment attempts are temporarily blocked for 24 hours due to multiple failed tries. Please try again later or contact support if you believe this is an error."
  }
}

/**
 * Ensure the ip_attempt_limits table exists
 * @param {Object} pool - PostgreSQL connection pool
 */
export async function ensureIpAttemptLimitsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ip_attempt_limits (
      ip_address TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_time TIMESTAMP WITH TIME ZONE,
      blocked_until TIMESTAMP WITH TIME ZONE,
      is_whitelisted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  
  // Create index on blocked_until for faster queries
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ip_attempt_limits_blocked_until 
      ON ip_attempt_limits(blocked_until);
    `)
  } catch (err) {
    // Index might already exist, ignore error
    console.warn('[ipLimiter] Index creation warning:', err.message)
  }
}

let ipAttemptHistoryInitialized = false

export async function ensureIpAttemptHistoryTable(db) {
  if (ipAttemptHistoryInitialized) {
    return
  }
  
  if (!db?.query) {
    throw new Error('[ipLimiter] Database client missing for ensureIpAttemptHistoryTable')
  }
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS ip_attempt_history (
      id BIGSERIAL PRIMARY KEY,
      ip_address TEXT NOT NULL REFERENCES ip_attempt_limits(ip_address) ON DELETE CASCADE,
      attempt_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `)
  
  try {
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ip_attempt_history_ip_time
      ON ip_attempt_history (ip_address, attempt_time DESC);
    `)
  } catch (err) {
    console.warn('[ipLimiter] ip_attempt_history index warning:', err.message)
  }
  
  ipAttemptHistoryInitialized = true
}

/**
 * Check if IP is whitelisted in the admin ip_whitelist table
 * @param {string} ipAddress - IP address to check
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<boolean>} - True if IP is whitelisted
 */
async function isIpWhitelisted(ipAddress, pool) {
  try {
    const result = await pool.query(
      'SELECT id FROM ip_whitelist WHERE ip_address = $1',
      [ipAddress]
    )
    return result.rows.length > 0
  } catch (err) {
    console.error('[ipLimiter] Error checking whitelist:', err)
    // On error, assume not whitelisted (fail closed for security)
    return false
  }
}

/**
 * Check IP limit and update attempt count
 * @param {Object} req - Express request object
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Object>} - { allowed: boolean, message?: string }
 */
export async function checkIpLimit(req, pool) {
  try {
    if (isBrandRouteBypass(req)) {
      console.log('[ipLimiter:checkIpLimit] Bypassing limiter for brand route')
      return { allowed: true }
    }

    await ensureIpAttemptHistoryTable(pool)
    // Extract IP address using ip-api.com (same method as homepage)
    let ipAddress = await extractClientIpWithApi(req, { 
      logSource: 'ipLimiter:checkIpLimit',
      logMissingClientIp: false // Don't log missing client_ip for every rate limit check
    })
    
    // If IP is unknown, check for localhost/private IPs from connection (for development)
    if (!ipAddress || ipAddress === 'unknown' || ipAddress.trim() === '') {
      // Try to get IP from connection directly (for localhost/dev)
      const connectionIp = req.socket?.remoteAddress || 
                          req.connection?.remoteAddress || 
                          req.ip ||
                          req.realClientIp
      
      if (connectionIp && isValidIpFormat(connectionIp)) {
        // Allow localhost/private IPs in development
        if (isPrivateIp(connectionIp)) {
          console.warn('[ipLimiter:checkIpLimit] ⚠️ Using localhost/private IP from connection:', connectionIp, '- Allowing for development')
          ipAddress = connectionIp
        }
      }
    }
    
    // Detailed logging for rate limiting
    console.log('[ipLimiter:checkIpLimit] Resolved client IP:', ipAddress, {
      hasBodyClientIp: !!(req.body?.client_ip || req.body?.ip_info?.query),
      xForwardedFor: req.headers?.['x-forwarded-for'],
      xRealIp: req.headers?.['x-real-ip'],
      cfConnectingIp: req.headers?.['cf-connecting-ip'],
      reqIp: req.ip,
      socketRemote: req.socket?.remoteAddress
    })
    
    // CRITICAL: Fail closed - block if IP cannot be determined (unless it's localhost for dev)
    if (!ipAddress || ipAddress === 'unknown' || ipAddress.trim() === '') {
      // Check if this is localhost - allow it for development
      const connectionIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip
      if (connectionIp && (connectionIp === '::1' || connectionIp === '127.0.0.1' || connectionIp.startsWith('127.') || connectionIp.startsWith('::ffff:127.'))) {
        console.warn('[ipLimiter:checkIpLimit] ⚠️ Allowing localhost connection for development:', connectionIp)
        ipAddress = connectionIp === '::1' ? '127.0.0.1' : connectionIp // Normalize to IPv4 for consistency
      } else {
        console.error('[ipLimiter:checkIpLimit] ❌ BLOCKED - Cannot determine client IP address', {
          resolvedIp: ipAddress,
          headers: {
            'x-forwarded-for': req.headers?.['x-forwarded-for'],
            'x-real-ip': req.headers?.['x-real-ip'],
            'cf-connecting-ip': req.headers?.['cf-connecting-ip'],
            'x-client-ip': req.headers?.['x-client-ip'],
            forwarded: req.headers?.forwarded
          },
          connection: {
            reqIp: req.ip,
            socketRemote: req.socket?.remoteAddress,
            connectionRemote: req.connection?.remoteAddress
          },
          body: {
            hasClientIp: !!(req.body?.client_ip),
            clientIpValue: req.body?.client_ip,
            hasIpInfo: !!(req.body?.ip_info?.query),
            ipInfoQuery: req.body?.ip_info?.query
          }
        })
        // FAIL CLOSED: Block request when IP cannot be determined (security requirement)
        return { 
          allowed: false, 
          message: 'Unable to verify your connection. Please ensure your network is properly configured and try again. If this persists, contact support.',
          reason: 'ip_resolution_failed'
        }
      }
    }
    
    // Validate IP format - reject invalid IPs
    if (!isValidIpFormat(ipAddress)) {
      console.error('[ipLimiter:checkIpLimit] ❌ BLOCKED - Invalid IP format:', ipAddress)
      return { 
        allowed: false, 
        message: 'Invalid connection information detected. Please try again or contact support.',
        reason: 'invalid_ip_format'
      }
    }
    
    // Allow private IPs (localhost/dev) but log them - they should still be tracked
    // This prevents blocking legitimate local development
    if (isPrivateIp(ipAddress)) {
      console.warn('[ipLimiter:checkIpLimit] ⚠️ Private/localhost IP detected:', ipAddress, '- Allowing but tracking for dev purposes')
      // Continue with rate limiting even for private IPs
    }
    
    // Check if IP is whitelisted in admin whitelist table
    const whitelisted = await isIpWhitelisted(ipAddress, pool)
    if (whitelisted) {
      console.log('[ipLimiter] IP is whitelisted, allowing request:', ipAddress)
      return { allowed: true }
    }
    
    const now = new Date()
    
    // Use a transaction to prevent race conditions
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Get current record
      const result = await client.query(
        'SELECT * FROM ip_attempt_limits WHERE ip_address = $1',
        [ipAddress]
      )
      
      let record = result.rows[0]
      
      // If no record exists, this is the first attempt - allow it
      if (!record) {
        console.log('[ipLimiter:checkIpLimit] First attempt, creating record:', {
          ip: ipAddress
        })
        // First attempt: attempt_count = 0 (no restrictions yet)
        // After first successful attempt, it becomes 1 (5 min cooldown for next attempt)
        await client.query(
          `INSERT INTO ip_attempt_limits 
           (ip_address, attempt_count, last_attempt_time, blocked_until, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [ipAddress, 0, now, null, now]
        )
        await client.query(
          `INSERT INTO ip_attempt_history (ip_address, attempt_time)
           VALUES ($1, $2)`,
          [ipAddress, now]
        )
        await client.query('COMMIT')
        
        // Verify record was created in DB (before releasing client)
        const verifyResult = await client.query(
          'SELECT ip_address, attempt_count, last_attempt_time FROM ip_attempt_limits WHERE ip_address = $1',
          [ipAddress]
        )
        console.log('[ipLimiter:checkIpLimit] ✅ DB VERIFIED - Record created:', {
          ip: ipAddress,
          attempt_count: verifyResult.rows[0]?.attempt_count ?? 'NOT FOUND',
          last_attempt_time: verifyResult.rows[0]?.last_attempt_time,
          record_exists: verifyResult.rows.length > 0
        })
        
        console.log('[ipLimiter:checkIpLimit] Allowing first attempt:', {
          ip: ipAddress,
          attempt_count: 0,
          next_attempt_will_require_cooldown: '5 minutes'
        })
        return { allowed: true }
      }
      
      // Record exists - check cooldown period
      const lastAttemptTime = record.last_attempt_time ? new Date(record.last_attempt_time) : null
      const currentAttemptCount = record.attempt_count || 0
      
      // Special case: If attempt_count is 0 and last_attempt_time is NULL,
      // this means the IP was reset (e.g., after admin unblock from 24-hour block)
      // Allow this first attempt without incrementing attempt_count
      if (currentAttemptCount === 0 && !lastAttemptTime) {
        console.log('[ipLimiter:checkIpLimit] First attempt after reset (e.g., admin unblock from 24h block):', {
          ip: ipAddress,
          attempt_count: currentAttemptCount
        })
        
        // Update last_attempt_time to now, but keep attempt_count at 0
        // This allows the first attempt, and the next attempt will require 5 min cooldown
        await client.query(
          `UPDATE ip_attempt_limits 
           SET last_attempt_time = $1, 
               blocked_until = NULL, 
               updated_at = $1
           WHERE ip_address = $2`,
          [now, ipAddress]
        )
        
        await client.query(
          `INSERT INTO ip_attempt_history (ip_address, attempt_time)
           VALUES ($1, $2)`,
          [ipAddress, now]
        )
        
        await client.query('COMMIT')
        
        console.log('[ipLimiter:checkIpLimit] ✅ First attempt after reset - ALLOWED (attempt_count stays at 0):', {
          ip: ipAddress,
          attempt_count: 0,
          next_attempt_will_require_cooldown: '5 minutes'
        })
        
        return { allowed: true, attemptCount: 0 }
      }
      
      // Calculate time gap since last attempt
      let timeGapMinutes = 0
      if (lastAttemptTime) {
        timeGapMinutes = (now.getTime() - lastAttemptTime.getTime()) / (1000 * 60)
      }
      
      // Get required cooldown for current attempt level
      const requiredCooldownMinutes = getCooldownMinutes(currentAttemptCount)
      
      console.log('[ipLimiter:checkIpLimit] Cooldown check:', {
        ip: ipAddress,
        attempt_count: currentAttemptCount,
        last_attempt_time: lastAttemptTime?.toISOString(),
        time_gap_minutes: timeGapMinutes.toFixed(2),
        required_cooldown_minutes: requiredCooldownMinutes
      })
      
      // Check if cooldown period has elapsed
      if (timeGapMinutes >= requiredCooldownMinutes) {
        // Cooldown has elapsed - allow attempt
        // If this was a 24-hour block (attempt_count >= 4), reset escalation sequence to 0
        // Otherwise, increment to next tier
        const is24HourBlockCompleted = currentAttemptCount >= 4
        const newAttemptCount = is24HourBlockCompleted ? 0 : currentAttemptCount + 1
        const newLastAttemptTime = now
        
        await client.query(
          `UPDATE ip_attempt_limits 
           SET attempt_count = $1, 
               last_attempt_time = $2, 
               blocked_until = NULL, 
               updated_at = $2
           WHERE ip_address = $3`,
          [newAttemptCount, newLastAttemptTime, ipAddress]
        )
        
        await client.query(
          `INSERT INTO ip_attempt_history (ip_address, attempt_time)
           VALUES ($1, $2)`,
          [ipAddress, newLastAttemptTime]
        )
        
        await client.query('COMMIT')
        
        // Verify DB update - confirm attempt_count updated correctly
        const verifyResult = await client.query(
          'SELECT ip_address, attempt_count, last_attempt_time, blocked_until FROM ip_attempt_limits WHERE ip_address = $1',
          [ipAddress]
        )
        const verifiedRecord = verifyResult.rows[0]
        const attemptCountMatches = verifiedRecord?.attempt_count === newAttemptCount
        console.log('[ipLimiter:checkIpLimit] ✅ DB VERIFIED - Record updated:', {
          ip: ipAddress,
          previous_attempt_count: currentAttemptCount,
          expected_new_attempt_count: newAttemptCount,
          actual_attempt_count_in_db: verifiedRecord?.attempt_count ?? 'NOT FOUND',
          last_attempt_time_in_db: verifiedRecord?.last_attempt_time,
          blocked_until_in_db: verifiedRecord?.blocked_until,
          record_exists: verifyResult.rows.length > 0,
          attempt_count_updated: attemptCountMatches,
          ...(attemptCountMatches ? {} : { WARNING: 'ATTEMPT_COUNT_MISMATCH - DB value does not match expected!' })
        })
        
        if (is24HourBlockCompleted) {
          console.log('[ipLimiter:checkIpLimit] ✅ 24-hour block completed - RESETTING escalation sequence:', {
            ip: ipAddress,
            previous_attempt_count: currentAttemptCount,
            reset_attempt_count: newAttemptCount,
            time_gap_minutes: timeGapMinutes.toFixed(2),
            required_cooldown_minutes: requiredCooldownMinutes,
            next_cooldown_minutes: getCooldownMinutes(newAttemptCount),
            action: 'ALLOWED_AND_RESET'
          })
        } else {
          console.log('[ipLimiter:checkIpLimit] ✅ Cooldown expired - ALLOWING attempt and advancing tier:', {
            ip: ipAddress,
            previous_attempt_count: currentAttemptCount,
            new_attempt_count: newAttemptCount,
            time_gap_minutes: timeGapMinutes.toFixed(2),
            required_cooldown_minutes: requiredCooldownMinutes,
            next_cooldown_minutes: getCooldownMinutes(newAttemptCount),
            action: 'ALLOWED_AND_ADVANCED'
          })
        }
        
        return { allowed: true, attemptCount: newAttemptCount }
      } else {
        // Cooldown has NOT elapsed - block attempt but DO NOT increment attempt count
        // Keep same restriction level until cooldown expires
        const remainingCooldownMinutes = requiredCooldownMinutes - timeGapMinutes
        const blockedUntil = new Date(now.getTime() + (remainingCooldownMinutes * 60 * 1000))
        // Use message for the NEXT tier (currentAttemptCount + 1) - this is what will apply after successful attempt
        const message = getBlockMessage(currentAttemptCount + 1)
        
        // Update blocked_until but keep attempt_count the same (NO INCREMENT)
        await client.query(
          `UPDATE ip_attempt_limits 
           SET blocked_until = $1, 
               updated_at = $2
           WHERE ip_address = $3`,
          [blockedUntil, now, ipAddress]
        )
        
        await client.query('COMMIT')
        
        console.log('[ipLimiter:checkIpLimit] ❌ Cooldown not expired - BLOCKING attempt (NO increment):', {
          ip: ipAddress,
          attempt_count: currentAttemptCount,
          attempt_count_unchanged: true,
          time_gap_minutes: timeGapMinutes.toFixed(2),
          required_cooldown_minutes: requiredCooldownMinutes,
          remaining_cooldown_minutes: remainingCooldownMinutes.toFixed(2),
          blocked_until: blockedUntil.toISOString(),
          message: message,
          action: 'BLOCKED_NO_INCREMENT'
        })
        
        return {
          allowed: false,
          message: message
        }
      }
      
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    
  } catch (err) {
    console.error('[ipLimiter] Error checking IP limit:', err)
    // On error, allow the request (fail open) to avoid blocking legitimate users
    return { allowed: true }
  }
}

/**
 * Check IP eligibility and increment attempt count with blocking rules
 * @param {Object} req - Express request object
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Object>} - { allowed: boolean, message?: string }
 */
export async function checkIpEligibility(req, pool) {
  // This function now uses the same logic as checkIpLimit
  // It's kept for backward compatibility but delegates to checkIpLimit
  return await checkIpLimit(req, pool)
}

/**
 * Check IP block status without incrementing attempt count
 * Used by frontend to check if user can proceed to checkout
 * @param {Object} req - Express request object
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Object>} - { allowed: boolean, message?: string, attemptCount?: number }
 */
export async function checkIpStatus(req, pool) {
  try {
    if (isBrandRouteBypass(req)) {
      console.log('[ipLimiter:checkIpStatus] Bypassing limiter for brand route')
      return { allowed: true }
    }

    // Extract IP address using ip-api.com (same method as homepage)
    const ipAddress = await extractClientIpWithApi(req, { 
      logSource: 'ipLimiter:checkIpStatus',
      logMissingClientIp: false
    })
    
    console.log('[ipLimiter:checkIpStatus] Resolved client IP:', ipAddress)
    
    if (!ipAddress || ipAddress === 'unknown') {
      return { allowed: true }
    }
    
    // Check if IP is whitelisted in admin whitelist table
    const whitelisted = await isIpWhitelisted(ipAddress, pool)
    if (whitelisted) {
      return { allowed: true }
    }
    
    const now = new Date()
    
    // Get current record
    const result = await pool.query(
      'SELECT * FROM ip_attempt_limits WHERE ip_address = $1',
      [ipAddress]
    )
    
    const record = result.rows[0]
    
    if (!record) {
      // No record means first attempt, allowed
      return { allowed: true, attemptCount: 0 }
    }
    
    // Check cooldown status based on time gap
    const lastAttemptTime = record.last_attempt_time ? new Date(record.last_attempt_time) : null
    const currentAttemptCount = record.attempt_count || 0
    
    // Calculate time gap since last attempt
    let timeGapMinutes = 0
    if (lastAttemptTime) {
      timeGapMinutes = (now.getTime() - lastAttemptTime.getTime()) / (1000 * 60)
    }
    
    // Get required cooldown for current attempt level
    const requiredCooldownMinutes = getCooldownMinutes(currentAttemptCount)
    
    console.log('[ipLimiter:checkIpStatus] Status check:', {
      ip: ipAddress,
      attempt_count: currentAttemptCount,
      last_attempt_time: lastAttemptTime?.toISOString(),
      time_gap_minutes: timeGapMinutes.toFixed(2),
      required_cooldown_minutes: requiredCooldownMinutes
    })
    
    // Check if cooldown period has elapsed
    if (timeGapMinutes >= requiredCooldownMinutes) {
      // Cooldown has elapsed - user can proceed (next attempt will be allowed and advance tier)
      return { allowed: true, attemptCount: currentAttemptCount }
    } else {
      // Cooldown has NOT elapsed - user is still blocked (same restriction level)
      const remainingCooldownMinutes = requiredCooldownMinutes - timeGapMinutes
      // Message for next tier (currentAttemptCount + 1) - what will apply after successful attempt
      const message = getBlockMessage(currentAttemptCount + 1)
      
      console.log('[ipLimiter:checkIpStatus] Status: BLOCKED (cooldown not expired):', {
        ip: ipAddress,
        attempt_count: currentAttemptCount,
        remaining_cooldown_minutes: remainingCooldownMinutes.toFixed(2),
        message: message
      })
      
      return {
        allowed: false,
        message: message || "Your payment attempts are temporarily blocked. Please try again later.",
        attemptCount: currentAttemptCount,
        remainingCooldownMinutes: Math.ceil(remainingCooldownMinutes)
      }
    }
    
  } catch (err) {
    console.error('[ipLimiter] Error checking IP status:', err)
    // On error, allow the request (fail open)
    return { allowed: true }
  }
}

