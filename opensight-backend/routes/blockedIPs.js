import express from 'express'
import { ensureIpAttemptHistoryTable } from '../services/ipLimiter.js'
import { normalizeIp } from '../utils/ipUtils.js'
const DEFAULT_BACKFILL_INTERVAL_MS = 5 * 60 * 1000

async function backfillAttemptHistory(pool, ipRecord, existingAttemptsAsc = []) {
  const attemptCount = Number(ipRecord?.attempt_count || 0)
  const ipAddress = ipRecord?.ip_address
  if (!ipAddress || attemptCount <= 0) {
    return existingAttemptsAsc
  }

  const existingCount = existingAttemptsAsc.length
  if (existingCount >= attemptCount) {
    return existingAttemptsAsc
  }

  const missingCount = attemptCount - existingCount
  const insertTimes = []

  if (existingCount === 0) {
    const lastAttemptTime = ipRecord.last_attempt_time
      ? new Date(ipRecord.last_attempt_time)
      : new Date()
    let firstReferenceTime = ipRecord.created_at ? new Date(ipRecord.created_at) : null
    if (!firstReferenceTime || firstReferenceTime > lastAttemptTime) {
      firstReferenceTime = new Date(lastAttemptTime.getTime() - (attemptCount - 1) * DEFAULT_BACKFILL_INTERVAL_MS)
    }
    const totalSpanMs = Math.max(
      lastAttemptTime.getTime() - firstReferenceTime.getTime(),
      DEFAULT_BACKFILL_INTERVAL_MS * Math.max(attemptCount - 1, 1)
    )
    const stepMs = attemptCount > 1 ? totalSpanMs / (attemptCount - 1) : DEFAULT_BACKFILL_INTERVAL_MS

    for (let i = 0; i < attemptCount; i++) {
      const ts = new Date(lastAttemptTime.getTime() - (attemptCount - 1 - i) * stepMs)
      insertTimes.push(ts)
    }
  } else {
    const earliestExisting = new Date(existingAttemptsAsc[0].attempt_time)
    for (let i = missingCount; i >= 1; i--) {
      insertTimes.push(new Date(earliestExisting.getTime() - i * DEFAULT_BACKFILL_INTERVAL_MS))
    }
  }

  if (insertTimes.length > 0) {
    const values = insertTimes.map((_, idx) => `($1, $${idx + 2})`).join(', ')
    const params = [ipAddress, ...insertTimes]
    await pool.query(
      `INSERT INTO ip_attempt_history (ip_address, attempt_time)
       VALUES ${values}`,
      params
    )
  }

  const updatedAttempts = await pool.query(
    `SELECT attempt_time
     FROM ip_attempt_history
     WHERE ip_address = $1
     ORDER BY attempt_time ASC`,
    [ipAddress]
  )

  return updatedAttempts.rows
}

export default function createBlockedIPRoutes(pool, { requireAuth, requireAdmin } = {}) {
  if (!pool?.query) {
    throw new Error('[blockedIPsRoutes] PostgreSQL pool is required')
  }
  
  if (typeof requireAuth !== 'function' || typeof requireAdmin !== 'function') {
    throw new Error('[blockedIPsRoutes] requireAuth and requireAdmin middlewares are required')
  }
  
  const router = express.Router()
  
  router.get('/:ip/attempts', requireAuth, requireAdmin, async (req, res) => {
    try {
      await ensureIpAttemptHistoryTable(pool)
      
      const ipAddress = decodeURIComponent(req.params.ip || '')
      if (!ipAddress) {
        return res.status(400).json({ error: 'IP address is required' })
      }

      const ipRecordResult = await pool.query(
        `SELECT ip_address, attempt_count, last_attempt_time, created_at, updated_at
         FROM ip_attempt_limits
         WHERE ip_address = $1`,
        [ipAddress]
      )

      if (ipRecordResult.rows.length === 0) {
        return res.status(404).json({ error: 'IP not found' })
      }

      const ipRecord = ipRecordResult.rows[0]

      const attemptsResult = await pool.query(
        `SELECT attempt_time
         FROM ip_attempt_history
         WHERE ip_address = $1
         ORDER BY attempt_time ASC`,
        [ipAddress]
      )

      let attemptsAsc = attemptsResult.rows

      if ((attemptsAsc?.length || 0) < Number(ipRecord.attempt_count || 0)) {
        attemptsAsc = await backfillAttemptHistory(pool, ipRecord, attemptsAsc)
      }
      
      const chronologicalAttempts = attemptsAsc.map((row, index) => ({
        attempt_number: index + 1,
        attempt_time: row.attempt_time
      }))
      
      const attempts = chronologicalAttempts.slice().reverse()
      
      res.json({
        ip: normalizeIp(ipAddress),
        total: chronologicalAttempts.length,
        expected_total: Number(ipRecord.attempt_count || 0),
        attempts
      })
    } catch (err) {
      console.error('[blockedIPsRoutes] Failed to load attempts:', err)
      res.status(500).json({ error: 'Failed to load attempt history' })
    }
  })
  
  return router
};
