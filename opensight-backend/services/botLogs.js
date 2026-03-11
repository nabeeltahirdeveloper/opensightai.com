/**
 * Bot Logs Service
 * Handles database operations for bot logging system
 */

let botLogsTableInitialized = false
let botApiKeysTableInitialized = false

/**
 * Ensure bot_logs table exists with all required columns and indexes
 * @param {Object} pool - PostgreSQL connection pool
 */
export async function ensureBotLogsTable(pool) {
  if (botLogsTableInitialized) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_logs (
      id BIGSERIAL PRIMARY KEY,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      log_level TEXT NOT NULL DEFAULT 'INFO',
      category TEXT,
      action TEXT,
      message TEXT,
      details JSONB,
      bot_identifier TEXT,
      screenshot_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  
  // Add screenshot_url column if it doesn't exist
  try {
    await pool.query(`ALTER TABLE bot_logs ADD COLUMN IF NOT EXISTS screenshot_url TEXT;`)
  } catch (_e) { /* ignore */ }

  // Create indexes for performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_bot_logs_timestamp ON bot_logs(timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON bot_logs(log_level)',
    'CREATE INDEX IF NOT EXISTS idx_bot_logs_bot_identifier ON bot_logs(bot_identifier)',
    'CREATE INDEX IF NOT EXISTS idx_bot_logs_category ON bot_logs(category)',
    'CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs(created_at DESC)'
  ]

  for (const indexQuery of indexes) {
    try {
      await pool.query(indexQuery)
    } catch (err) {
      // Ignore errors (index might already exist)
    }
  }

  botLogsTableInitialized = true
  console.log('[bot-logs] Table initialized with indexes')
}

/**
 * Ensure bot_api_keys table exists for API authentication
 * @param {Object} pool - PostgreSQL connection pool
 */
export async function ensureBotApiKeysTable(pool) {
  if (botApiKeysTableInitialized) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_api_keys (
      id BIGSERIAL PRIMARY KEY,
      api_key TEXT UNIQUE NOT NULL,
      label TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)

  // Create index on api_key for fast lookups
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bot_api_keys_key ON bot_api_keys(api_key)')
  } catch (err) {
    // Index might already exist
  }

  // Insert default API key from environment variable if set
  const defaultApiKey = process.env.BOT_API_KEY
  if (defaultApiKey) {
    try {
      await pool.query(
        `INSERT INTO bot_api_keys (api_key, label, is_active)
         VALUES ($1, 'Default API Key', true)
         ON CONFLICT (api_key) DO NOTHING`,
        [defaultApiKey]
      )
    } catch (err) {
      console.warn('[bot-logs] Could not insert default API key:', err.message)
    }
  }

  botApiKeysTableInitialized = true
  console.log('[bot-logs] API keys table initialized')
}

/**
 * Validate an API key
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} key - API key to validate
 * @returns {Promise<Object|null>} - Key info if valid, null otherwise
 */
export async function validateApiKey(pool, key) {
  if (!key) return null

  await ensureBotApiKeysTable(pool)

  const result = await pool.query(
    'SELECT id, label, is_active FROM bot_api_keys WHERE api_key = $1',
    [key]
  )

  if (result.rows.length === 0) return null

  const keyRecord = result.rows[0]
  if (!keyRecord.is_active) return null

  return {
    id: keyRecord.id,
    label: keyRecord.label
  }
}

/**
 * Sanitize and validate details JSONB field
 * @param {any} details - Details to sanitize
 * @returns {Object|null} - Sanitized details or null
 */
function sanitizeDetails(details) {
  if (details === null || details === undefined) return null

  if (typeof details === 'string') {
    try {
      return JSON.parse(details)
    } catch {
      // If it's not valid JSON, wrap it
      return { raw: details }
    }
  }

  if (typeof details === 'object') {
    try {
      // Test serialization to catch circular references
      JSON.stringify(details)
      return details
    } catch {
      return { error: 'Could not serialize details' }
    }
  }

  return { value: details }
}

/**
 * Insert a new bot log entry
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} logData - Log data to insert
 * @returns {Promise<Object>} - Inserted log record
 */
export async function insertBotLog(pool, logData) {
  await ensureBotLogsTable(pool)

  const {
    level = 'INFO',
    category = null,
    action = null,
    message = '',
    details = null,
    bot_identifier = null,
    timestamp = null,
    screenshot_url = null
  } = logData

  // Validate log level
  const validLevels = ['DEBUG', 'INFO', 'WARNING', 'ERROR']
  const normalizedLevel = validLevels.includes(level?.toUpperCase()) 
    ? level.toUpperCase() 
    : 'INFO'

  // Sanitize details
  const sanitizedDetails = sanitizeDetails(details)

  // Use provided timestamp or current time
  const logTimestamp = timestamp ? new Date(timestamp) : new Date()

  const result = await pool.query(
    `INSERT INTO bot_logs 
     (timestamp, log_level, category, action, message, details, bot_identifier, screenshot_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [
      logTimestamp,
      normalizedLevel,
      category?.substring(0, 100) || null,
      action?.substring(0, 200) || null,
      message?.substring(0, 10000) || '',
      sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
      bot_identifier?.substring(0, 100) || null,
      screenshot_url || null
    ]
  )

  return result.rows[0]
}

/**
 * Get bot logs with pagination and filters
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} - { logs: [], total: number, page: number, limit: number }
 */
export async function getBotLogs(pool, filters = {}) {
  await ensureBotLogsTable(pool)

  const {
    page = 1,
    limit = 50,
    level = null,
    category = null,
    bot_identifier = null,
    start_date = null,
    end_date = null,
    search = null
  } = filters

  const conditions = []
  const params = []
  let paramIndex = 1

  if (level) {
    conditions.push(`log_level = $${paramIndex}`)
    params.push(level.toUpperCase())
    paramIndex++
  }

  if (category) {
    conditions.push(`category ILIKE $${paramIndex}`)
    params.push(`%${category}%`)
    paramIndex++
  }

  if (bot_identifier) {
    conditions.push(`bot_identifier = $${paramIndex}`)
    params.push(bot_identifier)
    paramIndex++
  }

  if (start_date) {
    conditions.push(`timestamp >= $${paramIndex}`)
    params.push(new Date(start_date))
    paramIndex++
  }

  if (end_date) {
    conditions.push(`timestamp <= $${paramIndex}`)
    params.push(new Date(end_date))
    paramIndex++
  }

  if (search) {
    conditions.push(`(message ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`)
    params.push(`%${search}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM bot_logs ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].total, 10)

  // Get paginated results
  const offset = (page - 1) * limit
  const logsResult = await pool.query(
    `SELECT * FROM bot_logs ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  )

  return {
    logs: logsResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

/**
 * Delete a specific bot log by ID
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} id - Log ID to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteBotLog(pool, id) {
  await ensureBotLogsTable(pool)

  const result = await pool.query(
    'DELETE FROM bot_logs WHERE id = $1 RETURNING id',
    [id]
  )

  return result.rows.length > 0
}

/**
 * Delete bot logs older than a specific date
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Date|string} beforeDate - Delete logs before this date
 * @returns {Promise<number>} - Number of logs deleted
 */
export async function clearOldBotLogs(pool, beforeDate) {
  await ensureBotLogsTable(pool)

  const result = await pool.query(
    'DELETE FROM bot_logs WHERE timestamp < $1 RETURNING id',
    [new Date(beforeDate)]
  )

  return result.rows.length
}

/**
 * Get unique bot identifiers for filtering
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<string[]>} - Array of unique bot identifiers
 */
export async function getBotIdentifiers(pool) {
  await ensureBotLogsTable(pool)

  const result = await pool.query(
    `SELECT DISTINCT bot_identifier FROM bot_logs 
     WHERE bot_identifier IS NOT NULL 
     ORDER BY bot_identifier`
  )

  return result.rows.map(row => row.bot_identifier)
}

/**
 * Get unique categories for filtering
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<string[]>} - Array of unique categories
 */
export async function getCategories(pool) {
  await ensureBotLogsTable(pool)

  const result = await pool.query(
    `SELECT DISTINCT category FROM bot_logs 
     WHERE category IS NOT NULL 
     ORDER BY category`
  )

  return result.rows.map(row => row.category)
}

