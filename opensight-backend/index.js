console.log('[MARKER] Backend code updated with brand login split - Version 2.0')
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import sgMail from '@sendgrid/mail'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import cloudinaryPkg from 'cloudinary'
import * as solidPayment from './services/solidPayment.js'
import * as ngeniusPayment from './services/ngeniusPayment.js'
import * as neogatePayment from './services/neogatePayment.js'
import * as ipLimiter from './services/ipLimiter.js'
import * as orderService from './services/orderService.js'
import createBlockedIPRoutes from './routes/blockedIPs.js'
import createPayoutRoutes from './routes/payouts.js'
import createBotLogsRoutes from './routes/botLogs.js'
import createPaymentRoutes from './routes/payment.js'
import createBrandRoutes from './routes/brands.js'
import { initializeSocketIO } from './config/socketio.js'
import crypto from 'crypto'
import { attachRealClientIp, extractClientIp, extractClientIpWithApi, normalizeIp } from './utils/ipUtils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
app.disable('etag')
app.set('trust proxy', true)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'

// Allow multiple specific origins while supporting '*' fallback and server-to-server requests
const allowedOrigins = new Set([
  'https://OpenSightai.com',
  'https://www.OpenSightai.com',
  'https://pay.OpenSightai.com',
  'https://www.pay.OpenSightai.com',
  'http://localhost:5174'
])

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins for now (needed for N-Genius 3DS authentication)
    // TODO: Add N-Genius ACS domains to allowlist for production
    return callback(null, true)

    // Original CORS logic (commented out for now)
    /*
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true)

    if (FRONTEND_ORIGIN === '*') return callback(null, true)

    // If env provides a single origin, allow it in addition to list
    if (FRONTEND_ORIGIN && FRONTEND_ORIGIN !== '*') {
      if (origin === FRONTEND_ORIGIN) return callback(null, true)
    }

    // Check against the explicit allowlist
    if (allowedOrigins.has(origin)) return callback(null, true)

    return callback(new Error('CORS: Origin not allowed'))
    */
  },
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(morgan('dev'))
app.use(cookieParser())
app.use(attachRealClientIp)

const DATABASE_URL = process.env.DATABASE_URL
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@OpenSightai.com'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01'
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET
const SOLID_PAYMENT_WEBHOOK_SECRET = process.env.SOLID_PAYMENT_WEBHOOK_SECRET || '261E1E72A1D616A7200D559BBC5ED186510868EE71C97B8AB09407139C7D707D'
const NGENIUS_WEBHOOK_SECRET = process.env.NGENIUS_WEBHOOK_SECRET || '&vDE2TMXQZJAmWCURp1MPTxsAU2xem3K'

const cloudinary = cloudinaryPkg.v2
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  })
  console.log('[cloudinary] configured')
} else {
  console.warn('[cloudinary] not configured; image upload endpoint will be disabled')
}


if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
  console.log('[email] SendGrid initialized')
} else {
  console.warn('[email] SENDGRID_API_KEY not set; emails will not be sent')
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // return an error after 10 seconds if connection could not be established
})

// Handle pool errors to prevent crashes
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  // Don't exit the process, just log the error
})

// Add a flag to track if tables have been initialized
let tablesInitialized = false

// ===== UTILITY FUNCTIONS =====

// Generate a random secure password
function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  return Array.from({ length }, () => {
    const randomIndex = Math.floor(Math.random() * charset.length)
    return charset[randomIndex]
  }).join('')
}

// ===== ADMIN LOGGING SYSTEM =====

// Ensure admin_logs table exists
async function ensureAdminLogsTable() {
  // First, create the base table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      log_level VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL,
      message TEXT,
      details JSONB,
      user_id INTEGER,
      user_email VARCHAR(255),
      request_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `
  await pool.query(createTableQuery)

  // Add new columns if they don't exist (for existing tables)
  const alterQueries = [
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(10)',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS route TEXT',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS request_body JSONB',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS response_body JSONB',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS response_status INTEGER',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS query_params JSONB',
    'ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS headers JSONB'
  ]

  // Remove ip_address column if it exists (migration)
  try {
    await pool.query('ALTER TABLE admin_logs DROP COLUMN IF EXISTS ip_address')
  } catch (err) {
    // Ignore errors
  }

  for (const alterQuery of alterQueries) {
    try {
      await pool.query(alterQuery)
    } catch (err) {
      // Ignore errors (column might already exist)
    }
  }

  // Create indexes after columns exist
  const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_category ON admin_logs(category)',
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_level ON admin_logs(log_level)',
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_user_email ON admin_logs(user_email)',
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_route ON admin_logs(route)',
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_status ON admin_logs(response_status)'
  ]

  for (const indexQuery of indexQueries) {
    try {
      await pool.query(indexQuery)
    } catch (err) {
      // Ignore errors (index might already exist)
    }
  }

  console.log('[admin-logs] Table initialized with HTTP logging columns')
}

// Validate and ensure JSON compatibility for PostgreSQL JSONB columns
function ensureValidJSON(value) {
  if (value === null || value === undefined) {
    return null
  }

  // Handle strings specially - JSONB columns need valid JSON, not raw strings
  if (typeof value === 'string') {
    // Empty strings become null
    if (value.trim() === '') {
      return null
    }
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(value)
      // If parsing succeeds, recursively validate the parsed value
      return ensureValidJSON(parsed)
    } catch (err) {
      // If it's not valid JSON, wrap it in a safe structure
      // Truncate very long strings to prevent PostgreSQL errors (max 50KB for JSONB)
      const maxLength = 50000
      const truncated = value.length > maxLength 
        ? value.substring(0, maxLength) + `... [truncated ${value.length - maxLength} chars]`
        : value
      
      // Return as an object so PostgreSQL JSONB accepts it
      return { 
        _raw_string: truncated,
        _note: 'Value was a string, not JSON',
        _length: value.length
      }
    }
  }

  // If it's already a primitive (number, boolean), return as-is
  if (typeof value !== 'object') {
    return value
  }

  // If it's an object or array, try to validate it can be serialized
  try {
    // Test if it can be serialized to JSON
    JSON.stringify(value)
    return value
  } catch (err) {
    // If serialization fails, return a safe error indicator
    return { error: 'Invalid JSON structure', message: err.message }
  }
}

// Sanitize JSON data for logging (handles circular refs and large objects)
function sanitizeForJSON(obj, maxDepth = 5, maxStringLength = 1000, currentDepth = 0) {
  // Handle primitives and null
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') {
    // Truncate long strings
    if (typeof obj === 'string' && obj.length > maxStringLength) {
      return obj.substring(0, maxStringLength) + `... [truncated ${obj.length - maxStringLength} chars]`
    }
    return obj
  }

  // Prevent infinite recursion
  if (currentDepth >= maxDepth) {
    return '[MAX_DEPTH_REACHED]'
  }

  // Handle circular references using a WeakSet
  if (!sanitizeForJSON.seen) {
    sanitizeForJSON.seen = new WeakSet()
  }

  if (sanitizeForJSON.seen.has(obj)) {
    return '[CIRCULAR_REFERENCE]'
  }

  sanitizeForJSON.seen.add(obj)

  try {
    // Handle arrays
    if (Array.isArray(obj)) {
      const result = obj.map((item, index) => {
        // Limit array size in logs
        if (index >= 50) return '[...]'
        return sanitizeForJSON(item, maxDepth, maxStringLength, currentDepth + 1)
      })
      sanitizeForJSON.seen.delete(obj)
      return result.slice(0, 51) // Max 50 items + truncation marker
    }

    // Handle objects
    const result = {}
    let keyCount = 0
    for (const [key, value] of Object.entries(obj)) {
      // Limit object keys in logs
      if (keyCount >= 50) {
        result['[...]'] = `${Object.keys(obj).length - 50} more keys`
        break
      }
      result[key] = sanitizeForJSON(value, maxDepth, maxStringLength, currentDepth + 1)
      keyCount++
    }
    sanitizeForJSON.seen.delete(obj)
    return result
  } catch (err) {
    sanitizeForJSON.seen.delete(obj)
    return '[ERROR_SERIALIZING]'
  }
}

// Admin logging function
async function logToAdmin({
  level = 'INFO',
  category,
  action,
  message,
  details = null,
  userId = null,
  userEmail = null,
  requestId = null,
  httpMethod = null,
  route = null,
  requestBody = null,
  responseBody = null,
  responseStatus = null,
  responseTimeMs = null,
  queryParams = null,
  headers = null
}) {
  try {
    await ensureAdminLogsTable()

    // Sanitize all JSON data to prevent circular references and truncate large objects
    const sanitizedDetails = details ? sanitizeForJSON(details) : null
    const sanitizedRequestBody = requestBody ? sanitizeForJSON(requestBody) : null
    const sanitizedResponseBody = responseBody ? sanitizeForJSON(responseBody) : null
    const sanitizedQueryParams = queryParams ? sanitizeForJSON(queryParams) : null
    const sanitizedHeaders = headers ? sanitizeForJSON(headers) : null

    // Reset the WeakSet after sanitization
    if (sanitizeForJSON.seen) {
      sanitizeForJSON.seen = new WeakSet()
    }

    // Validate all JSONB values to ensure they're valid before PostgreSQL insertion
    const validatedDetails = ensureValidJSON(sanitizedDetails)
    const validatedRequestBody = ensureValidJSON(sanitizedRequestBody)
    const validatedResponseBody = ensureValidJSON(sanitizedResponseBody)
    const validatedQueryParams = ensureValidJSON(sanitizedQueryParams)
    const validatedHeaders = ensureValidJSON(sanitizedHeaders)

    // JSONB columns handle objects directly - don't stringify!
    // PostgreSQL automatically converts objects to JSON

    await pool.query(
      `INSERT INTO admin_logs 
       (log_level, category, action, message, details, user_id, user_email, request_id, 
        http_method, route, request_body, response_body, response_status, response_time_ms, query_params, headers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [level, category, action, message, validatedDetails, userId, userEmail, requestId,
        httpMethod, route, validatedRequestBody, validatedResponseBody, responseStatus, responseTimeMs,
        validatedQueryParams, validatedHeaders]
    )

    // Also log to console with appropriate formatting
    const logPrefix = `[${category}] [${level}]`
    const logMessage = `${logPrefix} ${action}: ${message}`

    switch (level) {
      case 'ERROR':
      case 'CRITICAL':
        console.error(logMessage, details || '')
        break
      case 'WARN':
        console.warn(logMessage, details || '')
        break
      default:
        console.log(logMessage, details || '')
    }
  } catch (err) {
    // Don't let logging failures break the app
    console.error('[admin-logs] Failed to write log:', err)
  }
}

// Initialize logs table on startup
ensureAdminLogsTable().catch(err => console.error('[admin-logs] Failed to initialize table:', err))

// Helper function to filter sensitive data from objects
function filterSensitiveData(obj, maxDepth = 3, currentDepth = 0) {
  if (!obj || typeof obj !== 'object' || currentDepth > maxDepth) return obj

  const sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret', 'apikey', 'api_key', 'auth']
  const filtered = Array.isArray(obj) ? [] : {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))

    if (isSensitive) {
      filtered[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      filtered[key] = filterSensitiveData(value, maxDepth, currentDepth + 1)
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

// Helper function to truncate large data
function truncateData(data, maxSize = 10000) {
  if (!data) return data

  const str = typeof data === 'string' ? data : JSON.stringify(data)

  if (str.length > maxSize) {
    return str.substring(0, maxSize) + `... [truncated ${str.length - maxSize} chars]`
  }

  return data
}

// Comprehensive HTTP request/response logging middleware
function httpLoggingMiddleware(req, res, next) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // Attach request ID to request for tracing
  req.requestId = requestId

  // Skip logging for health check and static files
  const skipPaths = ['/health', '/ping', '/favicon.ico', '/static/']
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path))

  if (shouldSkip) {
    return next()
  }

  // Capture response by intercepting the finish event
  const originalSend = res.send
  const originalJson = res.json
  let responseBody = null

  // Intercept res.send
  res.send = function (data) {
    responseBody = data
    return originalSend.call(this, data)
  }

  // Intercept res.json
  res.json = function (data) {
    responseBody = data
    return originalJson.call(this, data)
  }

  // Log when response finishes
  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime
      const clientIp = getRequestIp(req)

      // Get user info if authenticated
      let userId = null
      let userEmail = null

      // Try to extract from req.auth (set by requireAuth middleware)
      if (req.auth) {
        userId = req.auth.uid
        userEmail = req.auth.email
      }

      // Prepare request data
      const requestData = {
        body: req.body,
        query: req.query,
        params: req.params
      }

      // Filter sensitive data
      const filteredRequestBody = filterSensitiveData(requestData.body)
      const filteredQueryParams = filterSensitiveData(requestData.query)
      const filteredHeaders = filterSensitiveData(req.headers)

      // Determine log level based on status code
      let logLevel = 'INFO'
      if (res.statusCode >= 500) {
        logLevel = 'ERROR'
      } else if (res.statusCode >= 400) {
        logLevel = 'WARN'
      }

      // Create log message
      const message = `${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`

      // Log to admin_logs
      // Note: sanitizeForJSON in logToAdmin will handle truncation safely without breaking JSON structure
      await logToAdmin({
        level: logLevel,
        category: 'HTTP',
        action: `${req.method}_REQUEST`,
        message,
        details: {
          userAgent: req.get('user-agent'),
          referer: req.get('referer')
        },
        userId,
        userEmail,
        requestId,
        httpMethod: req.method,
        route: req.path,
        requestBody: filteredRequestBody,
        responseBody: responseBody,
        responseStatus: res.statusCode,
        responseTimeMs: responseTime,
        queryParams: filteredQueryParams,
        headers: filteredHeaders
      })
    } catch (err) {
      // Don't let logging failures break the app
      console.error('[http-logging] Failed to log request:', err)
    }
  })

  next()
}

const initializingTables = new Set()

// Helper function to safely initialize tables with caching
async function safeInitTable(tableName, initFunction) {
  // If already initialized, skip
  if (tablesInitialized) return

  // If currently initializing, wait
  if (initializingTables.has(tableName)) {
    // Wait for a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100))
    return safeInitTable(tableName, initFunction)
  }

  try {
    initializingTables.add(tableName)
    await initFunction()
  } catch (err) {
    console.error(`Error initializing ${tableName}:`, err.message)
    // Don't throw, just log the error
  } finally {
    initializingTables.delete(tableName)
  }
}

async function ensureVisitsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id BIGSERIAL PRIMARY KEY,
      ip TEXT UNIQUE NOT NULL,
      visits_count INTEGER NOT NULL DEFAULT 0,
      demo_tries INTEGER NOT NULL DEFAULT 0,
      first_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_demo_at TIMESTAMP WITH TIME ZONE,
      country TEXT,
      country_code TEXT,
      region TEXT,
      region_name TEXT,
      city TEXT,
      zip TEXT,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      timezone TEXT,
      isp TEXT,
      org TEXT,
      asn TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

async function ensureVisitsSchema() {
  await ensureVisitsTable()
  // Add columns if they don't exist (safe idempotent migrations)
  const alters = [
    "ADD COLUMN IF NOT EXISTS first_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
    "ADD COLUMN IF NOT EXISTS last_demo_at TIMESTAMP WITH TIME ZONE",
    "ADD COLUMN IF NOT EXISTS country TEXT",
    "ADD COLUMN IF NOT EXISTS country_code TEXT",
    "ADD COLUMN IF NOT EXISTS region TEXT",
    "ADD COLUMN IF NOT EXISTS region_name TEXT",
    "ADD COLUMN IF NOT EXISTS city TEXT",
    "ADD COLUMN IF NOT EXISTS zip TEXT",
    "ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION",
    "ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION",
    "ADD COLUMN IF NOT EXISTS timezone TEXT",
    "ADD COLUMN IF NOT EXISTS isp TEXT",
    "ADD COLUMN IF NOT EXISTS org TEXT",
    "ADD COLUMN IF NOT EXISTS is_vpn BOOLEAN DEFAULT false",
    "ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false",
    "ADD COLUMN IF NOT EXISTS vpn_check_attempted BOOLEAN DEFAULT false",
    "ADD COLUMN IF NOT EXISTS asn TEXT",
    "ADD COLUMN IF NOT EXISTS user_agent TEXT",
    "ADD COLUMN IF NOT EXISTS tutor_messages INTEGER NOT NULL DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS last_tutor_at TIMESTAMP WITH TIME ZONE",
    "ADD COLUMN IF NOT EXISTS tutor_history JSONB DEFAULT '[]'::jsonb"
  ]
  for (const clause of alters) {
    try {
      await pool.query(`ALTER TABLE visits ${clause};`)
    } catch (_e) { /* ignore */ }
  }
}

async function ensureIpWhitelistTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id BIGSERIAL PRIMARY KEY,
      ip_address TEXT UNIQUE NOT NULL,
      label TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by_admin_id BIGINT
    );
  `)
}

async function ensureIpWhitelistSettingsTable() {
  // First, create the base table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ip_whitelist_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN DEFAULT false,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)

  // Check if vpn_block_enabled column exists, add if not
  try {
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ip_whitelist_settings' 
      AND column_name = 'vpn_block_enabled';
    `)

    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE ip_whitelist_settings 
        ADD COLUMN vpn_block_enabled BOOLEAN DEFAULT true;
      `)
      console.log('[DB Migration] Added vpn_block_enabled column to ip_whitelist_settings')
    }
  } catch (err) {
    console.error('[DB Migration] Error adding vpn_block_enabled column:', err)
  }

  // Check if vpn_whitelist_exemption column exists, add if not
  try {
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ip_whitelist_settings' 
      AND column_name = 'vpn_whitelist_exemption';
    `)

    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE ip_whitelist_settings 
        ADD COLUMN vpn_whitelist_exemption BOOLEAN DEFAULT false;
      `)
      console.log('[DB Migration] Added vpn_whitelist_exemption column to ip_whitelist_settings')
    }
  } catch (err) {
    console.error('[DB Migration] Error adding vpn_whitelist_exemption column:', err)
  }

  // Ensure default settings row exists (only insert if not exists, don't overwrite)
  await pool.query(`
    INSERT INTO ip_whitelist_settings (id, enabled, vpn_block_enabled, vpn_whitelist_exemption)
    VALUES (1, false, true, false)
    ON CONFLICT (id) DO NOTHING;
  `)
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      user_type TEXT NOT NULL DEFAULT 'normal',
      password_hash TEXT NOT NULL,
      plan TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  // Ensure additional auth columns exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`)
  } catch (_e) { /* ignore */ }
  // Ensure credits columns exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_unlimited BOOLEAN NOT NULL DEFAULT FALSE;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_used_total INTEGER NOT NULL DEFAULT 0;`)
  } catch (_e) { /* ignore */ }
  // Ensure name columns exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;`)
  } catch (_e) { /* ignore */ }
  // Ensure notification preferences columns exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_weekly_summary BOOLEAN NOT NULL DEFAULT FALSE;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_payout_updates BOOLEAN NOT NULL DEFAULT FALSE;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_security_alerts BOOLEAN NOT NULL DEFAULT FALSE;`)
  } catch (_e) { /* ignore */ }
  // Ensure settlement columns exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_method TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_crypto_wallet TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_bank_holder TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_bank_iban TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_bank_swift TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_bank_name TEXT;`)
  } catch (_e) { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement_bank_address TEXT;`)
  } catch (_e) { /* ignore */ }
}

async function ensureChartAnalysisSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chart_analyses (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT,
      image_url TEXT,
      image_public_id TEXT,
      analysis_json JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

async function ensureOrdersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT UNIQUE,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      email TEXT,
      items JSONB NOT NULL,
      total_amount NUMERIC,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
      commission_amount NUMERIC DEFAULT 0,
      commission_status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  // Add new columns if they don't exist
  const alters = [
    "ADD COLUMN IF NOT EXISTS brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL",
    "ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'unpaid'",
    "ADD COLUMN IF NOT EXISTS commission_rate NUMERIC",
    "ADD COLUMN IF NOT EXISTS link_id BIGINT REFERENCES brand_links(id) ON DELETE SET NULL",
    "ADD COLUMN IF NOT EXISTS card_holder_name TEXT",
    "ADD COLUMN IF NOT EXISTS first_name TEXT",
    "ADD COLUMN IF NOT EXISTS last_name TEXT",
    "ADD COLUMN IF NOT EXISTS phone TEXT",
    "ADD COLUMN IF NOT EXISTS user_ip TEXT",
    "ADD COLUMN IF NOT EXISTS vpn_detected BOOLEAN DEFAULT false",
    "ADD COLUMN IF NOT EXISTS vpn_geo TEXT",
    "ADD COLUMN IF NOT EXISTS card_bin TEXT",
    "ADD COLUMN IF NOT EXISTS card_issuer TEXT",
    "ADD COLUMN IF NOT EXISTS payment_message TEXT",
    "ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'",
    "ADD COLUMN IF NOT EXISTS amount_usd NUMERIC",
    "ADD COLUMN IF NOT EXISTS billing_country TEXT",
    "ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card'",
    "ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'solid'",
    "ADD COLUMN IF NOT EXISTS ngenius_order_reference TEXT",
    "ADD COLUMN IF NOT EXISTS payment_brand TEXT",
    "ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT",
    "ADD COLUMN IF NOT EXISTS merchant_transaction_id TEXT"
  ]
  for (const clause of alters) {
    try {
      await pool.query(`ALTER TABLE orders ${clause};`)
    } catch (_e) { /* ignore */ }
  }

  // Migrate existing data: set NULL payment_method values to 'card'
  try {
    await pool.query(`UPDATE orders SET payment_method = 'card' WHERE payment_method IS NULL;`)
  } catch (_e) { /* ignore */ }
}

async function ensureBrandsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      website TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      slug TEXT UNIQUE,
      commission_rate NUMERIC DEFAULT 10.0,
      email TEXT,
      password_hash TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  // Add new columns if they don't exist
  const alters = [
    "ADD COLUMN IF NOT EXISTS website TEXT",
    "ADD COLUMN IF NOT EXISTS secondary_color TEXT",
    "ADD COLUMN IF NOT EXISTS description TEXT",
    "ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
    "ADD COLUMN IF NOT EXISTS slug TEXT",
    "ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10.0",
    "ADD COLUMN IF NOT EXISTS email TEXT",
    "ADD COLUMN IF NOT EXISTS password_hash TEXT",
    "ADD COLUMN IF NOT EXISTS parent_brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL",
    "ADD COLUMN IF NOT EXISTS username TEXT",
    "ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'brand'",
    "ADD COLUMN IF NOT EXISTS settlement_method TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_crypto_wallet TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_bank_holder TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_bank_iban TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_bank_swift TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_bank_name TEXT",
    "ADD COLUMN IF NOT EXISTS settlement_bank_address TEXT",
    "ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'active'",
    "ADD COLUMN IF NOT EXISTS reseller_commission NUMERIC DEFAULT 0"
  ]
  for (const clause of alters) {
    try {
      await pool.query(`ALTER TABLE brands ${clause};`)
    } catch (_e) { /* ignore */ }
  }
  // Create unique index on slug if not exists
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_unique ON brands(slug) WHERE slug IS NOT NULL;`)
  } catch (_e) { /* ignore */ }
  // Create unique index on username if not exists
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS brands_username_unique ON brands(username) WHERE username IS NOT NULL;`)
  } catch (_e) { /* ignore */ }
  // Create index on approval_status for filtering
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS brands_approval_status_idx ON brands(approval_status);`)
  } catch (_e) { /* ignore */ }
}

async function ensurePayoutsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payouts (
      id BIGSERIAL PRIMARY KEY,
      brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      amount NUMERIC NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      method TEXT DEFAULT 'Bank Transfer',
      reference_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      paid_at TIMESTAMP WITH TIME ZONE
    );
  `)
  // Create index on brand_id for faster lookups
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS payouts_brand_id_idx ON payouts(brand_id);`)
  } catch (_e) { /* ignore */ }
}

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

async function ensureWebhookEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id BIGSERIAL PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      event_name TEXT NOT NULL,
      order_reference TEXT,
      payload JSONB NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  // Create index on event_id for faster lookups
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS webhook_events_event_id_idx ON webhook_events(event_id);`)
  } catch (_e) { /* ignore */ }
}

async function ensureBotPaymentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_payments (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_link TEXT,
      items JSONB,
      payment_details JSONB,
      brand_slug TEXT,
      link_id TEXT,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      bot_response JSONB,
      screenshot_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  // Add screenshot_url column if it doesn't exist
  try {
    await pool.query(`ALTER TABLE bot_payments ADD COLUMN IF NOT EXISTS screenshot_url TEXT;`)
  } catch (_e) { /* ignore */ }
  // Create indexes for faster lookups
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS bot_payments_order_id_idx ON bot_payments(order_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS bot_payments_email_idx ON bot_payments(email);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS bot_payments_status_idx ON bot_payments(status);`)
  } catch (_e) { /* ignore */ }
}

// Initialize default conversion fee setting
async function ensureConversionFeeSetting() {
  await ensureSettingsTable()
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['conversion_fee_usd'])
  if (result.rows.length === 0) {
    // Set default conversion fee to 6.00 USD
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      ['conversion_fee_usd', JSON.stringify({ amount: 6.00 })]
    )
  }
}

// Helper function to get current conversion fee with caching
let cachedConversionFee = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // Cache for 1 minute

async function getConversionFee() {
  const now = Date.now()
  if (cachedConversionFee !== null && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedConversionFee
  }

  await ensureConversionFeeSetting()
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['conversion_fee_usd'])

  if (result.rows.length > 0 && result.rows[0].value) {
    const feeAmount = Number(result.rows[0].value.amount || 6.00)
    cachedConversionFee = feeAmount
    cacheTimestamp = now
    return feeAmount
  }

  return 6.00 // Default fallback
}

// Helper function to apply conversion fee to an amount
function applyConversionFee(amountUSD, conversionFee) {
  const amount = Number(amountUSD || 0)
  const fee = Number(conversionFee || 0)
  return Math.max(0, amount - fee) // Ensure never negative
}

async function seedPricesPagePackages() {
  await pool.query(`
    INSERT INTO packages (id, name, price, currency, type, credits, description, features, popular, active, color, sort_order)
    VALUES
      (
        'starter', 'Starter Package', 25, '$', 'package', 25,
        'Starter access to the OpenSight AI platform.',
        '[
          "Full access to OpenSight AI",
          "Credits for AI-powered analysis",
          "Credits for chat agent usage",
          "Secure dashboard & usage tracking",
          "Credits expiry – 6 months",
          "Best for: Light usage, testing the platform, quick analysis and insights."
        ]'::jsonb,
        false, true, 'blue', 1
      ),
      (
        'growth', 'Growth Package', 80, '$', 'package', 80,
        'Unlock more AI power with increased credits.',
        '[
          "Full access to OpenSight AI",
          "Higher credit balance for analysis",
          "Extended chat agent interactions",
          "Faster workflows for ongoing projects",
          "Credits expiry – 6 months",
          "Best for: Regular users, ongoing research, frequent AI interactions."
        ]'::jsonb,
        true, true, 'orange', 2
      ),
      (
        'pro', 'Pro Package', 129, '$', 'package', 129,
        'Maximum value for advanced users.',
        '[
          "Full access to OpenSight AI",
          "High-volume credits for analysis",
          "Unlimited-style chat agent usage (credit-based)",
          "Priority performance & advanced workflows",
          "Credits expiry – 6 months",
          "Best for: Professionals, power users, complex analysis, multiple projects."
        ]'::jsonb,
        false, true, 'purple', 3
      ),
      (
        'custom', 'Custom Credits', 0, '$', 'credits', 0,
        'Custom credits purchase option.',
        '[]'::jsonb,
        false, true, 'slate', 999
      )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      type = EXCLUDED.type,
      credits = EXCLUDED.credits,
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      popular = EXCLUDED.popular,
      active = EXCLUDED.active,
      color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order;
  `);
}


async function ensurePackagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT '$',
      type TEXT NOT NULL CHECK (type IN ('package','credits')),
      credits INTEGER NOT NULL DEFAULT 0,  -- ← Made NOT NULL with default
      description TEXT,
      features JSONB DEFAULT '[]'::jsonb,
      popular BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE packages ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'orange';`);
  await pool.query(`ALTER TABLE packages ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`);
}

async function ensureCurrenciesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      is_base BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
      last_synced TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

async function ensurePackageCurrencyPricesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS package_currency_prices (
      id BIGSERIAL PRIMARY KEY,
      package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      currency_code TEXT NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
      custom_price NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(package_id, currency_code)
    );
  `)
}

async function seedCurrencies() {
  const currencies = [
    { code: 'USD', symbol: '$', name: 'USA Dollar', is_base: true, active: true, exchange_rate: 1.0 },
    { code: 'EUR', symbol: '€', name: 'European Euro', is_base: false, active: true, exchange_rate: 0.92 },
    { code: 'GBP', symbol: '£', name: 'United Kingdom Pound', is_base: false, active: true, exchange_rate: 0.79 },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', is_base: false, active: true, exchange_rate: 1.36 },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', is_base: false, active: true, exchange_rate: 1.53 },
    { code: 'NZD', symbol: 'NZD$', name: 'New Zealand Dollar', is_base: false, active: true, exchange_rate: 1.68 },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', is_base: false, active: true, exchange_rate: 4.47 },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', is_base: false, active: true, exchange_rate: 1.34 },
    { code: 'AED', symbol: 'AED', name: 'UAE Dirham', is_base: false, active: true, exchange_rate: 3.67 },
    { code: 'BHD', symbol: 'ب.د.', name: 'Bahraini Dinar', is_base: false, active: true, exchange_rate: 0.38 },
    { code: 'SAR', symbol: 'SAR$', name: 'Saudi Riyal', is_base: false, active: true, exchange_rate: 3.75 },
    { code: 'QAR', symbol: 'ر.ق.', name: 'Qatari Riyal', is_base: false, active: true, exchange_rate: 3.64 },
    { code: 'KWD', symbol: 'د.ك.', name: 'Kuwaiti Dinar', is_base: false, active: true, exchange_rate: 0.31 },
    { code: 'PEN', symbol: 'S/.', name: 'Peruvian Sol', is_base: false, active: true, exchange_rate: 3.75 },
    { code: 'PYG', symbol: '₲', name: 'Paraguay Guarani', is_base: false, active: true, exchange_rate: 7456 },
    { code: 'HNL', symbol: 'L', name: 'Honduras Lempira', is_base: false, active: true, exchange_rate: 24.70 },
    { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', is_base: false, active: true, exchange_rate: 39.14 },
    { code: 'CRC', symbol: '₡', name: 'Costa Rican Colon', is_base: false, active: true, exchange_rate: 512 },
    { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', is_base: false, active: true, exchange_rate: 7.73 },
    { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', is_base: false, active: true, exchange_rate: 60.23 },
    { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso', is_base: false, active: true, exchange_rate: 977 },
    { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', is_base: false, active: true, exchange_rate: 20.19 },
    { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', is_base: false, active: true, exchange_rate: 23.65 },
    { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', is_base: false, active: true, exchange_rate: 4.03 },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', is_base: false, active: true, exchange_rate: 18.15 },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', is_base: false, active: true, exchange_rate: 83.12 },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', is_base: false, active: true, exchange_rate: 0.88 },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', exchange_rate: 150, is_base: false, active: true },
{ code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', exchange_rate: 7.8, is_base: false, active: true },
{ code: 'BRL', symbol: 'R$', name: 'Brazilian Real', exchange_rate: 5.0, is_base: false, active: true },
{ code: 'KRW', symbol: '₩', name: 'South Korean Won', exchange_rate: 1300, is_base: false, active: true },
{ code: 'TRY', symbol: '₺', name: 'Turkish Lira', exchange_rate: 30, is_base: false, active: true },
{ code: 'SEK', symbol: 'kr', name: 'Swedish Krona', exchange_rate: 10.5, is_base: false, active: true },
{ code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', exchange_rate: 10.8, is_base: false, active: true },
{ code: 'DKK', symbol: 'kr', name: 'Danish Krone', exchange_rate: 6.9, is_base: false, active: true },
{ code: 'ARS', symbol: '$', name: 'Argentine Peso', exchange_rate: 900, is_base: false, active: true },
{ code: 'COP', symbol: '$', name: 'Colombian Peso', exchange_rate: 3900, is_base: false, active: true },
{ code: 'RON', symbol: 'lei', name: 'Romanian Leu', exchange_rate: 4.6, is_base: false, active: true },
{ code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', exchange_rate: 1.8, is_base: false, active: true },

  ]

  for (const curr of currencies) {
    try {
      await pool.query(
        `INSERT INTO currencies (code, symbol, name, is_base, active, exchange_rate)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [curr.code, curr.symbol, curr.name, curr.is_base, curr.active, curr.exchange_rate]
      )
    } catch (error) {
      console.error(`Failed to seed currency ${curr.code}:`, error.message)
    }
  }
}

async function ensureCurrencyGeoMappingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS currency_geo_mappings (
      country_code VARCHAR(2) PRIMARY KEY,
      currency_code TEXT NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

async function seedCurrencyGeoMappings() {
  const mappings = [
    // North America
    { country_code: 'US', currency_code: 'USD' },
    { country_code: 'CA', currency_code: 'CAD' },
    { country_code: 'MX', currency_code: 'MXN' },

    // Europe
    { country_code: 'GB', currency_code: 'GBP' },
    { country_code: 'CH', currency_code: 'CHF' },
    { country_code: 'CZ', currency_code: 'CZK' },
    { country_code: 'PL', currency_code: 'PLN' },

    // Eurozone countries
    { country_code: 'AT', currency_code: 'EUR' }, // Austria
    { country_code: 'BE', currency_code: 'EUR' }, // Belgium
    { country_code: 'CY', currency_code: 'EUR' }, // Cyprus
    { country_code: 'EE', currency_code: 'EUR' }, // Estonia
    { country_code: 'FI', currency_code: 'EUR' }, // Finland
    { country_code: 'FR', currency_code: 'EUR' }, // France
    { country_code: 'DE', currency_code: 'EUR' }, // Germany
    { country_code: 'GR', currency_code: 'EUR' }, // Greece
    { country_code: 'IE', currency_code: 'EUR' }, // Ireland
    { country_code: 'IT', currency_code: 'EUR' }, // Italy
    { country_code: 'LV', currency_code: 'EUR' }, // Latvia
    { country_code: 'LT', currency_code: 'EUR' }, // Lithuania
    { country_code: 'LU', currency_code: 'EUR' }, // Luxembourg
    { country_code: 'MT', currency_code: 'EUR' }, // Malta
    { country_code: 'NL', currency_code: 'EUR' }, // Netherlands
    { country_code: 'PT', currency_code: 'EUR' }, // Portugal
    { country_code: 'SK', currency_code: 'EUR' }, // Slovakia
    { country_code: 'SI', currency_code: 'EUR' }, // Slovenia
    { country_code: 'ES', currency_code: 'EUR' }, // Spain

    // Oceania
    { country_code: 'AU', currency_code: 'AUD' },
    { country_code: 'NZ', currency_code: 'NZD' },

    // Asia
    { country_code: 'MY', currency_code: 'MYR' },
    { country_code: 'SG', currency_code: 'SGD' },
    { country_code: 'IN', currency_code: 'INR' },

    // Middle East
    { country_code: 'AE', currency_code: 'AED' },
    { country_code: 'BH', currency_code: 'BHD' },
    { country_code: 'SA', currency_code: 'SAR' },
    { country_code: 'QA', currency_code: 'QAR' },
    { country_code: 'KW', currency_code: 'KWD' },

    // Latin America
    { country_code: 'PE', currency_code: 'PEN' },
    { country_code: 'PY', currency_code: 'PYG' },
    { country_code: 'HN', currency_code: 'HNL' },
    { country_code: 'UY', currency_code: 'UYU' },
    { country_code: 'CR', currency_code: 'CRC' },
    { country_code: 'GT', currency_code: 'GTQ' },
    { country_code: 'DO', currency_code: 'DOP' },
    { country_code: 'CL', currency_code: 'CLP' },

    // Africa
    { country_code: 'ZA', currency_code: 'ZAR' }
  ]

  for (const mapping of mappings) {
    try {
      await pool.query(
        `INSERT INTO currency_geo_mappings (country_code, currency_code)
         VALUES ($1, $2)
         ON CONFLICT (country_code) DO NOTHING`,
        [mapping.country_code, mapping.currency_code]
      )
    } catch (error) {
      console.error(`Failed to seed geo mapping ${mapping.country_code}:`, error.message)
    }
  }
}

function mapDbUserToClient(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.user_type,
    subscription_tier: (function normalize(p) {
      if (!p) return null
      const v = String(p).trim().toLowerCase()
      if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
      if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
      if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
      return v
    })(u.plan) || null,
    credits_balance: Number(u.credits_balance || 0),
    credits_unlimited: Boolean(u.credits_unlimited),
    analyses_today: 0,
    last_analysis_date: null,
  }
}

async function ensureTutorSchema() {
  // Conversations and messages stored per user
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutor_conversations (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      topic TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutor_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES tutor_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}

function mapDbConversation(c) {
  return {
    id: c.id,
    title: c.title,
    topic: c.topic,
    created_at: c.created_at,
  }
}

function mapDbMessage(m) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.created_at,
  }
}

function buildTutorPrompt({ topic, previous, userMessage, language = 'en' }) {
  const style = `Write concise, conversational answers (3-6 sentences max). Use bullet points when listing. Ask a brief follow-up question when helpful.`
  const guardrails = `Avoid investment advice or guarantees. Use neutral language (e.g., "market data", "trends").`
  const domainRole = topic && typeof topic === 'string' && topic.trim() !== ''
    ? `You are an expert ${topic} teacher.`
    : `You are a helpful AI teacher. If the question is finance-related, focus on market analysis education; otherwise answer clearly as a general teacher.`
  
  // Add language instruction if Turkish is selected
  const languageInstruction = language === 'tr' || language === 'tr-TR'
    ? `\n\nIMPORTANT: The user is using the Turkish language interface. You MUST respond in Turkish (Türkçe). All your answers, explanations, and follow-up questions must be in Turkish.`
    : ''
  
  const prev = Array.isArray(previous) ? previous.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n') : ''
  return `${style}\n${guardrails}\n${domainRole}${languageInstruction}\n\nContext (last turns):\n${prev}\n\nUser: ${userMessage}\nAnswer:`
}

function signJwt(user) {
  const tokenVersion = Number(user.token_version || 0)
  const payload = {
    uid: user.id,
    email: user.email,
    role: user.user_type,
    tv: tokenVersion
  }

  // Include brand_username if present (for brand/reseller accounts)
  if (user.brand_username) {
    payload.brand_username = user.brand_username
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.token
    const authHeader = req.get('authorization') || req.get('Authorization')
    if (!token && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim()
    }
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const payload = jwt.verify(token, JWT_SECRET)
    // Check token version against DB to support logout invalidation
    await ensureUsersTable()
    const r = await pool.query('SELECT token_version FROM users WHERE id = $1', [payload.uid])
    if (r.rows.length === 0) return res.status(401).json({ error: 'unauthorized' })
    const currentVersion = Number(r.rows[0].token_version || 0)
    if (Number(payload.tv || 0) !== currentVersion) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    req.auth = payload
    next()
  } catch (_e) {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

async function requireBrand(req, res, next) {
  try {
    if (!req.auth || req.auth.role !== 'brand') {
      return res.status(403).json({ error: 'forbidden' })
    }

    await ensureBrandsTable()

    // Use brand_username from token if available (new method)
    if (req.auth.brand_username) {
      const brandResult = await pool.query(
        'SELECT id, name, slug, commission_rate, email, account_type, parent_brand_id FROM brands WHERE username = $1 AND account_type = $2',
        [req.auth.brand_username, 'brand']
      )
      if (brandResult.rows.length === 0) {
        return res.status(403).json({ error: 'brand_not_found' })
      }
      req.brand = brandResult.rows[0]
      return next()
    }

    // Fallback to old method for backward compatibility
    await ensureUsersTable()
    const userResult = await pool.query('SELECT id, email, user_type FROM users WHERE id = $1', [req.auth.uid])
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const brandResult = await pool.query('SELECT id, name, slug, commission_rate, email, account_type, parent_brand_id FROM brands WHERE email = $1 AND account_type = $2', [userResult.rows[0].email, 'brand'])
    if (brandResult.rows.length === 0) {
      return res.status(403).json({ error: 'brand_not_found' })
    }
    req.brand = brandResult.rows[0]
    next()
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}

async function requireReseller(req, res, next) {
  try {
    if (!req.auth || req.auth.role !== 'reseller') {
      return res.status(403).json({ error: 'forbidden' })
    }

    await ensureBrandsTable()

    // Use brand_username from token if available (new method)
    if (req.auth.brand_username) {
      const resellerResult = await pool.query(
        'SELECT id, name, slug, commission_rate, email, account_type, parent_brand_id FROM brands WHERE username = $1 AND account_type = $2',
        [req.auth.brand_username, 'reseller']
      )
      if (resellerResult.rows.length === 0) {
        return res.status(403).json({ error: 'reseller_not_found' })
      }
      req.brand = resellerResult.rows[0]
      req.reseller = resellerResult.rows[0]
      return next()
    }

    // Fallback to old method for backward compatibility
    await ensureUsersTable()
    const userResult = await pool.query('SELECT id, email, user_type FROM users WHERE id = $1', [req.auth.uid])
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const resellerResult = await pool.query('SELECT id, name, slug, commission_rate, email, account_type, parent_brand_id FROM brands WHERE email = $1 AND account_type = $2', [userResult.rows[0].email, 'reseller'])
    if (resellerResult.rows.length === 0) {
      return res.status(403).json({ error: 'reseller_not_found' })
    }
    req.brand = resellerResult.rows[0]
    req.reseller = resellerResult.rows[0]
    next()
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}

const blockedIPsRouter = createBlockedIPRoutes(pool, { requireAuth, requireAdmin })
app.use('/api/admin/blocked-ips', blockedIPsRouter)

const payoutsRouter = createPayoutRoutes(pool, { requireAuth, requireAdmin, ensurePayoutsTable, ensureOrdersTable, ensureBrandsTable })
app.use('/api/admin/payouts', payoutsRouter)

// Brand Routes
const brandRouter = createBrandRoutes(pool, { requireAuth, requireAdmin, ensureBrandsTable, ensureOrdersTable })
app.use('/api/admin/brands', brandRouter)

// Bot Logs Routes (API key auth for bots, admin auth for management)
const botLogsRouter = createBotLogsRoutes(pool, { requireAuth, requireAdmin })
app.use(botLogsRouter)

// Bot Payment Routes
const FRONTEND_CHECKOUT_URL = process.env.FRONTEND_CHECKOUT_URL || 'https://checkout.OpenSightai.com'
const paymentRouter = createPaymentRoutes(pool, {
  ensureBotPaymentsTable,
  ensureUsersTable,
  ensureOrdersTable,
  ensureBrandsTable,
  frontendCheckoutUrl: FRONTEND_CHECKOUT_URL
})
app.use('/api/payment', paymentRouter)

function getRequestIp(req) {
  const candidate = req?.realClientIp
  if (candidate && candidate !== 'unknown') {
    return candidate
  }
  return extractClientIp(req)
}

/**
 * Determine which payment gateway to use
 * ALL PAYMENTS USE NEOGATE ONLY
 * @param {string} billingCountry - Billing country code (e.g., 'FR', 'AU', 'US')
 * @param {string} ipCountryCode - IP-based country code from geolocation
 * @returns {string} - Always returns 'neogate'
 */
function determinePaymentGateway(billingCountry, ipCountryCode) {
  // 🔒 ALL OTHER PAYMENT GATEWAYS DISABLED - ONLY NEOGATE
  console.log(`[gateway-routing] ✅ Using Neogate for ALL payments (N-Genius and Solid Payment disabled)`)
  return 'neogate'
}

// ===== APPLY HTTP LOGGING MIDDLEWARE =====
// Apply comprehensive HTTP request/response logging middleware
// This must be after getRequestIp helper is defined and before routes
app.use(httpLoggingMiddleware)
console.log('[http-logging] Middleware applied - all HTTP requests will be logged')

// ===== API ROUTES =====

app.post('/api/users', async (req, res) => {
  try {
    const { email, full_name, plan } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })
    await ensureUsersTable()
    const existing = await pool.query('SELECT id, email FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.json({ user: existing.rows[0], already_exists: true })
    }
    const randomPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
    const password_hash = bcrypt.hashSync(randomPassword, 10)
    function normalizePlan(p) {
      if (!p) return null
      const v = String(p).trim().toLowerCase()
      if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
      if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
      if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
      return v
    }
    const text = `
      INSERT INTO users (email, full_name, user_type, password_hash, plan)
      VALUES ($1, $2, 'normal', $3, $4)
      RETURNING id, email, full_name, user_type, plan, created_at;
    `
    const values = [email, full_name || null, password_hash, normalizePlan(plan)]
    const result = await pool.query(text, values)
    const createdUser = result.rows[0]
    if (SENDGRID_API_KEY) {
      try {
        const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#f59e0b,#f97316);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">📈</span>
                OpenSightAI
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Welcome to OpenSightAI</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your account has been created after purchasing the <strong>${plan || 'selected'}</strong> plan.</p>
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#f59e0b;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Email:</strong> ${createdUser.email}</div>
                  <div><strong>Password:</strong> ${randomPassword}</div>
                  <div style="margin-top:8px;color:#94a3b8;">Please change your password after first login.</div>
                </div>
              </div>
              <a href="https://OpenSightai.com" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Go to OpenSightAI</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025</div>
          </div>
        </div>`
        await sgMail.send({ to: createdUser.email, from: EMAIL_FROM, subject: 'Your OpenSightAI account', html })
        console.log(`[email] Sent account email to ${createdUser.email}`)
      } catch (e) {
        const details = e?.response?.body || e
        console.error('[email] Failed to send account email:', details)
      }
    } else {
      console.warn('[email] Skipping email send because SENDGRID_API_KEY is not set')
    }
    res.json({ user: createdUser })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===== SOLID PAYMENT INTEGRATION ENDPOINTS =====
function getRealClientIP(req) {
  // Try various headers in order of reliability
  const xForwardedFor = req.headers['x-forwarded-for']
  const xRealIp = req.headers['x-real-ip']
  const cfConnectingIp = req.headers['cf-connecting-ip'] // Cloudflare
  const xClientIp = req.headers['x-client-ip']

  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2)
  // Take the first one (original client)
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim())
    const clientIp = ips[0]
    console.log('[getRealClientIP] From X-Forwarded-For:', clientIp)
    return clientIp
  }

  // Try other headers
  if (cfConnectingIp) {
    console.log('[getRealClientIP] From CF-Connecting-IP:', cfConnectingIp)
    return cfConnectingIp
  }
  if (xRealIp) {
    console.log('[getRealClientIP] From X-Real-IP:', xRealIp)
    return xRealIp
  }
  if (xClientIp) {
    console.log('[getRealClientIP] From X-Client-IP:', xClientIp)
    return xClientIp
  }

  // Fallback to req.ip (might be Docker internal IP)
  const fallbackIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown'
  console.log('[getRealClientIP] From req.ip/socket:', fallbackIp)
  return fallbackIp
}
// Helper function to get real client IP from headers

// Helper function to check VPN and get geo location
async function checkVpnAndGeo(ipAddress) {
  try {
    // For localhost/development, return meaningful fallback values
    if (!ipAddress || ipAddress === 'unknown' || ipAddress === '::1' || ipAddress.startsWith('127.') || ipAddress === '::ffff:127.0.0.1') {
      console.log('[checkVpnAndGeo] Localhost IP detected, using fallback values')
      return {
        vpnDetected: false,
        vpnGeo: 'LOCAL'
      }
    }

    // Call vpnapi.io for VPN detection and geo location
    const vpnApiKey = '2867120f50374c63bb98e7dce24b0b83'
    const vpnApiUrl = `https://vpnapi.io/api/${ipAddress}?key=${vpnApiKey}`

    console.log('[checkVpnAndGeo] Checking IP:', ipAddress)
    const fetch = (await import('node-fetch')).default
    const vpnResponse = await fetch(vpnApiUrl, { timeout: 5000 })
    const vpnData = await vpnResponse.json()

    console.log('[checkVpnAndGeo] API response:', JSON.stringify(vpnData))

    const isVpn = vpnData.security?.vpn || false
    const isProxy = vpnData.security?.proxy || false
    const isTor = vpnData.security?.tor || false
    const isRelay = vpnData.security?.relay || false
    const vpnDetected = isVpn || isProxy || isTor || isRelay

    // Get country code from location data
    const countryCode = vpnData.location?.country_code || vpnData.location?.country || 'UNKNOWN'

    console.log('[checkVpnAndGeo] Result - VPN:', vpnDetected, 'GEO:', countryCode)

    return {
      vpnDetected,
      vpnGeo: countryCode
    }
  } catch (error) {
    console.warn('[checkVpnAndGeo] Failed:', error.message)
    // Return fallback values instead of null
    return {
      vpnDetected: false,
      vpnGeo: 'ERROR'
    }
  }
}

function normalizeMerchantTransactionId(rawId) {
  if (!rawId) return ''
  return String(rawId).replace(/_(applepay|googlepay)$/i, '')
}

function detectPaymentMethodFromMerchantTransactionId(rawId) {
  if (!rawId) return null
  if (/_applepay$/i.test(rawId)) return 'applepay'
  if (/_googlepay$/i.test(rawId)) return 'googlepay'
  return 'card'
}

async function convertToUsd(amount, currencyCode) {
  const amt = Number(amount || 0)
  const code = String(currencyCode || 'USD').toUpperCase()

  if (!amt) return 0
  if (code === 'USD') return Number(amt.toFixed(2))

  // exchange_rate in your seed looks like: EUR=0.92, GBP=0.79, etc
  // meaning: 1 USD = exchange_rate * (currency)
  // so: amountUSD = amount / exchange_rate
  const r = await pool.query(
    `SELECT exchange_rate FROM currencies WHERE code = $1 LIMIT 1`,
    [code]
  )

  const rate = Number(r.rows?.[0]?.exchange_rate || 0)
  if (!rate) throw new Error(`No exchange_rate found for currency ${code}`)

  const usd = amt / rate
  return Number(usd.toFixed(2))
}



async function upsertPendingOrderRecord(orderId, checkoutContext = {}) {
  const normalizedOrderId = normalizeMerchantTransactionId(orderId)
  if (!normalizedOrderId) {
    console.warn('[checkout] Pending order upsert skipped - missing order ID')
    return
  }

  try {
    await ensureOrdersTable()
  } catch (err) {
    console.warn('[checkout] Failed to ensure orders table before pending upsert:', err?.message || err)
    return
  }

  const {
    items = [],
    totalAmount = 0,
    amountInSelectedCurrency = totalAmount,
    paymentDetails = {},
    currency,
    linkId = null,
    paymentGateway = 'solid',
    paymentMethod = 'pending',
    userIp = null,
    paymentBrand = null,
    paymentTransactionId = null,
    merchantTransactionId: pendingMerchantTransactionId = null
  } = checkoutContext || {}

  const email = paymentDetails?.email ? String(paymentDetails.email).trim().toLowerCase() : null
  const firstName = paymentDetails?.firstName || null
  const lastName = paymentDetails?.lastName || null
  const phone = paymentDetails?.phone || null
  const billingCountry = paymentDetails?.country || null
  const cardHolderName = paymentDetails?.cardholderName || paymentDetails?.cardHolderName || null
  const paymentMessage = 'Payment pending confirmation'
  const originalCurrency = currency || checkoutContext?.originalCurrency || 'USD'

  // Look up numeric brand link ID from string linkId (CRITICAL: link_id column is bigint, not string)
  // Also check for direct purchase links
  let brandLinkId = null
  let directPurchaseLinkId = null
  if (linkId) {
    try {
      // First check brand_links
      const linkResult = await pool.query('SELECT id FROM brand_links WHERE link_id = $1', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        console.log(`[checkout] Found brand link: ${linkId} -> DB ID: ${brandLinkId}`)
      } else {
        // Check direct_purchase_links
        await ensureDirectPurchaseLinksTable()
        const directLinkResult = await pool.query('SELECT id FROM direct_purchase_links WHERE link_id = $1', [linkId])
        if (directLinkResult.rows.length > 0) {
          directPurchaseLinkId = directLinkResult.rows[0].id
          console.log(`[checkout] Found direct purchase link: ${linkId} -> DB ID: ${directPurchaseLinkId}`)
        } else {
          console.warn(`[checkout] Link not found in brand_links or direct_purchase_links: ${linkId}`)
        }
      }
    } catch (err) {
      console.error(`[checkout] Link lookup failed for ${linkId}:`, err.message)
    }
  }

  const amountUsd = await convertToUsd(totalAmount, originalCurrency)


  const params = [
  normalizedOrderId,                                      // $1  order_id
  email,                                                  // $2  email
  JSON.stringify(Array.isArray(items) ? items : []),       // $3  items
  Number(totalAmount || 0),                                // $4  total_amount (selected currency)
  Number(amountUsd || 0),                                  // $5  amount_usd  ✅ NEW
  originalCurrency,                                       // $6  currency (selected currency code)
  paymentMethod || 'pending',                              // $7  payment_method
  paymentGateway || 'solid',                               // $8  payment_gateway
  brandLinkId,                                             // $9  link_id
  firstName,                                               // $10 first_name
  lastName,                                                // $11 last_name
  phone,                                                   // $12 phone
  cardHolderName,                                          // $13 card_holder_name
  billingCountry,                                          // $14 billing_country
  userIp,                                                  // $15 user_ip
  paymentMessage,                                          // $16 payment_message
  paymentBrand,                                            // $17 payment_brand
  paymentTransactionId,                                    // $18 payment_transaction_id
  pendingMerchantTransactionId || normalizedOrderId        // $19 merchant_transaction_id
]
  

  try {
    const result = await pool.query(
      `
      INSERT INTO orders (
        order_id,
        email,
        items,
        total_amount,
        amount_usd,
        currency,
        payment_status,
        commission_status,
        payment_method,
        payment_gateway,
        link_id,
        first_name,
        last_name,
        phone,
        card_holder_name,
        billing_country,
        user_ip,
        payment_message,
        payment_brand,
        payment_transaction_id,
        merchant_transaction_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        'pending',
        'pending',
        $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (order_id) DO UPDATE
      SET
        email = COALESCE(EXCLUDED.email, orders.email),
        items = EXCLUDED.items,
        total_amount = EXCLUDED.total_amount,
        amount_usd = EXCLUDED.amount_usd,
        currency = EXCLUDED.currency,
        payment_method = EXCLUDED.payment_method,
        payment_gateway = EXCLUDED.payment_gateway,
        link_id = EXCLUDED.link_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        card_holder_name = EXCLUDED.card_holder_name,
        billing_country = EXCLUDED.billing_country,
        user_ip = COALESCE(EXCLUDED.user_ip, orders.user_ip),
        payment_message = EXCLUDED.payment_message,
        payment_brand = EXCLUDED.payment_brand,
        payment_transaction_id = EXCLUDED.payment_transaction_id,
        merchant_transaction_id = EXCLUDED.merchant_transaction_id,
        payment_status = 'pending',
        commission_status = 'pending'
      RETURNING id
      ;
      `,
      params
    )
    console.log(`[checkout] ✅ Pending order recorded: order_id=${normalizedOrderId}, payment_method=${paymentMethod || 'pending'}, merchant_tx_id=${pendingMerchantTransactionId || normalizedOrderId}, db_id=${result.rows[0]?.id}`)
  } catch (err) {
    console.error('[checkout] ❌ Failed to upsert pending order:', err?.message || err)
    console.error('[checkout] Error details:', { normalizedOrderId, paymentMethod, params: params.slice(0, 6) })
  }
}

/**
 * Payment Checkout Preparation Endpoint
 * 
 * API ENDPOINT STRUCTURE:
 * - URL: POST /api/checkout/prepare
 * - Purpose: Creates payment session with gateway
 * - Required Body: items, totalAmount, paymentDetails, currency
 * - Returns: gateway info, checkout IDs, payment URLs
 * 
 * PAYMENT GATEWAY FLOW:
 * 1. Validate request (items, email, amount)
 * 2. Determine gateway based on country/IP
 * 3. Call gateway's createOrder/prepareCheckout API
 * 4. Store pending order in database
 * 5. Return checkout details to frontend
 * 
 * For gateway-specific implementation requirements, see:
 * - backend/services/solidPayment.js
 * - backend/services/ngeniusPayment.js
 * - docs/PAYMENT_GATEWAY_ONBOARDING.md
 */
// Prepare checkout with Solid Payment
app.post('/api/checkout/prepare', async (req, res) => {
  const requestId = `checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)

  // Check IP-based transaction attempt limiter
  try {
    const ipLimitCheck = await ipLimiter.checkIpLimit(req, pool)
    if (!ipLimitCheck.allowed) {
      return res.status(429).json({
        error: 'too_many_attempts',
        message: ipLimitCheck.message
      })
    }
  } catch (err) {
    console.error('[checkout/prepare] IP limiter error:', err)
    // Continue with checkout if limiter fails (fail open)
  }

  try {
    const { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency, redirect_url, client_orderid, control, server_callback_url } = req.body || {}    // Detect if this is a Neogate payload (has Neogate-specific fields)
    const isNeogatePayload = !!(redirect_url && client_orderid && control)
    
    if (isNeogatePayload) {
      console.log('[checkout/prepare] Detected Neogate payload, forwarding to neogate-prepare handler')
      // Forward to Neogate handler by calling it internally
      // We'll handle this by extracting the Neogate-specific data and processing it
      // For now, let's extract the necessary fields and continue with Neogate flow
      req.body.brandSlug = brandSlug
      req.body.linkId = linkId
      // The neogate-prepare endpoint will handle the rest
      // We'll process it inline here instead of forwarding
    }

    console.log('[checkout/prepare] Brand tracking received:', {
      brandSlug,
      referralCode,
      linkId,
      linkIdType: typeof linkId,
      linkIdValue: linkId,
      isNeogatePayload
    })

    if (!Array.isArray(items) || items.length === 0) {
      await logToAdmin({
        level: 'WARN',
        category: 'CHECKOUT',
        action: 'CHECKOUT_INVALID',
        message: 'Checkout attempted with empty cart',
        details: { items, email: paymentDetails?.email },
        userEmail: paymentDetails?.email,
        requestId
      })
      return res.status(400).json({ error: 'cart_empty' })
    }

    if (!paymentDetails || !paymentDetails.email) {
      await logToAdmin({
        level: 'WARN',
        category: 'CHECKOUT',
        action: 'CHECKOUT_INVALID',
        message: 'Checkout attempted without email',
        details: { hasPaymentDetails: !!paymentDetails },
        requestId
      })
      return res.status(400).json({ error: 'email_required' })
    }

    // Validate package + credits combo
    const hasPackage = items.some(i => i?.type === 'package')
    const hasCredits = items.some(i => i?.type === 'credits')
    if (!hasPackage || !hasCredits) {
      return res.status(400).json({ error: 'package_and_credits_required', message: 'Plan package and credits are required' })
    }

    // Extract real client IP (not Docker internal IP)
    const realClientIP = getRequestIp(req)
    console.log('[checkout/prepare] Client IP:', realClientIP, '(from headers:', req.headers['x-forwarded-for'] || 'none', ')')

    // 🔒 ALL PAYMENTS USE NEOGATE ONLY - No other gateways
    console.log('[checkout/prepare] ✅ Using Neogate for ALL payments (N-Genius and Solid Payment disabled)')
    
    // Generate client order ID if not provided
    const clientOrderId = client_orderid || `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const backendBaseUrl = process.env.BACKEND_URL || 'https://api-dev.OpenSightai.com'
    const neogateRedirectUrl = redirect_url || `${backendBaseUrl}/api/checkout/neogate-redirect/${clientOrderId}`
    const serverCallbackUrl = server_callback_url || `${backendBaseUrl}/api/neogate/callback`
    
    // Convert amount to EUR (Neogate requires EUR)
    const selectedCurrency = String(currency || 'USD').toUpperCase();
    const amount = Number(totalAmount)

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount')
    }

    // Create payment form with Neogate
    const paymentFormResult = await neogatePayment.createPaymentForm({
      amount: amount,     
      currency: selectedCurrency, 
      clientOrderId,
      email: paymentDetails.email,
      firstName: paymentDetails.firstName,
      lastName: paymentDetails.lastName,
      phone: paymentDetails.phone,
      address1: paymentDetails.address1,
      city: paymentDetails.city,
      state: paymentDetails.state,
      zipCode: paymentDetails.zipCode,
      country: paymentDetails.country,
      ipAddress: realClientIP,
      orderDesc: items.map(i => i.name).join(', '),
      redirectUrl: neogateRedirectUrl,
      serverCallbackUrl
    })

    console.log('[BE] About to call createPaymentForm with:')
console.log('[BE] amount:', amount)
console.log('[BE] currency:', currency)
console.log('[BE] clientOrderId:', clientOrderId)
console.log('[BE] email:', paymentDetails.email)
console.log('[BE] firstName:', paymentDetails.firstName)
console.log('[BE] lastName:', paymentDetails.lastName)
console.log('[BE] phone:', paymentDetails.phone)
console.log('[BE] address1:', paymentDetails.address1)
console.log('[BE] city:', paymentDetails.city)
console.log('[BE] state:', paymentDetails.state)
console.log('[BE] zipCode:', paymentDetails.zipCode)
console.log('[BE] country:', paymentDetails.country)
console.log('[BE] ipAddress:', realClientIP)
console.log('[BE] orderDesc:', items.map(i => i.name).join(', '))
console.log('[BE] redirectUrl:', neogateRedirectUrl)
console.log('[BE] serverCallbackUrl:', serverCallbackUrl)
console.log('[BE] =================================')

    
    if (!paymentFormResult.success || !paymentFormResult.paymentUrl) {
      console.error('[checkout/prepare] Failed to create Neogate payment form:', paymentFormResult.error)
      await logToAdmin({
        level: 'ERROR',
        category: 'NEOGATE',
        action: 'PAYMENT_FORM_FAILED',
        message: `Failed to create Neogate payment form: ${paymentFormResult.error}`,
        details: { clientOrderId, error: paymentFormResult.error },
        userEmail: paymentDetails.email,
        requestId
      })
      return res.status(500).json({
        error: 'payment_form_failed',
        message: paymentFormResult.error || 'Failed to initialize payment'
      })
    }
    
    // Store pending order data
    if (!global.pendingCheckouts) {
      global.pendingCheckouts = new Map()
    }
    
    const orderData = {
      items,
      totalAmount: totalAmount,
      amountInSelectedCurrency: amount,
      paymentDetails,
      brandSlug,
      linkId,
      originalCurrency: selectedCurrency,
      clientOrderId,
      timestamp: Date.now(),
      gateway: 'neogate',
      neogateOrderId: paymentFormResult.orderId
    }
    
    global.pendingCheckouts.set(clientOrderId, orderData)
    
    // Create pending order record
    await upsertPendingOrderRecord(clientOrderId, {
      ...orderData,
      currency: selectedCurrency,
      paymentGateway: 'neogate',
      paymentMethod: 'pending',
      userIp: realClientIP
    })
    
    await logToAdmin({
      level: 'INFO',
      category: 'NEOGATE',
      action: 'PAYMENT_FORM_CREATED',
      message: 'Neogate payment form created successfully',
      details: {
        clientOrderId,
        paymentUrl: paymentFormResult.paymentUrl,
        amount: amount,
        currency: selectedCurrency,
        brandSlug,
        linkId
      },
      userEmail: paymentDetails.email,
      requestId
    })
    
    return res.json({
      success: true,
      paymentUrl: paymentFormResult.paymentUrl,
      clientOrderId
    })
  } catch (err) {
    console.error('[checkout/prepare] Error:', err)

    await logToAdmin({
      level: 'ERROR',
      category: 'CHECKOUT',
      action: 'CHECKOUT_ERROR',
      message: `Failed to create checkout session`,
      details: {
        error: err.message,
        stack: err.stack,
        items: req.body?.items,
        email: req.body?.paymentDetails?.email,
        amount: req.body?.totalAmount,
        currency: req.body?.currency
      },
      userEmail: req.body?.paymentDetails?.email,
      requestId
    })

    res.status(500).json({ error: String(err?.message || err) })
  }
})

/* DISABLED - N-GENIUS GATEWAY FLOW
    if (gateway === 'ngenius') {
      console.log('[checkout/prepare] Using N-Genius gateway - frontend will collect card data directly')

      // Store order details for later use when payment is submitted
      if (!global.pendingCheckouts) {
        global.pendingCheckouts = new Map()
      }

      const orderData = {
        items,
        totalAmount: totalAmount, // Store ORIGINAL amount
        amountInUSD: amountInUSD, // Store USD amount separately
        paymentDetails,
        brandSlug,
        referralCode,
        linkId,
        originalCurrency: currency,
        merchantTransactionId,
        timestamp: Date.now(),
        gateway: 'ngenius'
      }

      // Store with merchant transaction ID as key
      global.pendingCheckouts.set(merchantTransactionId, orderData)

      await upsertPendingOrderRecord(merchantTransactionId, {
        ...orderData,
        currency: originalCurrency,
        paymentGateway: 'ngenius',
        paymentMethod: 'pending',
        userIp: realClientIP
      })

      await logToAdmin({
        level: 'INFO',
        category: 'CHECKOUT',
        action: 'CHECKOUT_CREATED',
        message: 'N-Genius checkout session prepared',
        details: {
          gateway: 'ngenius',
          merchantTransactionId,
          amount: totalAmount,
          amountUSD: amountInUSD,
          currency: originalCurrency,
          billingCountry,
          ipCountryCode,
          items: items.map(i => ({ name: i.name, type: i.type, quantity: i.quantity })),
          brandSlug,
          linkId,
          pendingOrderCreated: true
        },
        userEmail: paymentDetails.email,
        requestId
      })

      return res.json({
        success: true,
        gateway: 'ngenius',
        merchantTransactionId,
        amount: amountInUSD,
        currency: 'USD',
        originalCurrency: currency,
        originalAmount: totalAmount
      })
    }
    END OF DISABLED N-GENIUS CODE */

    /* DISABLED CODE - Kept for reference
    // SOLID PAYMENT GATEWAY FLOW (DEFAULT)
    console.log('[checkout/prepare] NOTE: Browser data will be collected automatically by COPYandPAY widget')
    
    // Prepare checkout parameters (shared between both payment methods)
    const checkoutParams = {
      amount: totalAmount,
      currency: originalCurrency,
      paymentType: 'DB', // Debit (immediate charge)
      customerEmail: paymentDetails.email,
      customerGivenName: paymentDetails.firstName || 'Customer',
      customerSurname: paymentDetails.lastName || 'User',
      customerPhone: paymentDetails.phone || '',
      customerIp: realClientIP,
      billingStreet: paymentDetails.address || '',
      billingCity: paymentDetails.city || '',
      billingPostcode: paymentDetails.zipCode || '',
      billingCountry: paymentDetails.country || '',
      billingState: paymentDetails.state || '',
      shippingStreet: paymentDetails.address || '', // Use same as billing if not provided
      shippingCity: paymentDetails.city || '',
      shippingPostcode: paymentDetails.zipCode || '',
      shippingCountry: paymentDetails.country || '',
      shippingState: paymentDetails.state || '',
      merchantTransactionId
    }
    
    console.log('[checkout/prepare] Creating THREE checkout sessions (Credit Card + Apple Pay + Google Pay)...')
    
    // Create checkout session for CREDIT CARDS (Entity ID: 8acda4c999c83f980199c866d6cb0241)
    const checkoutDataCard = await solidPayment.prepareCheckout({
      ...checkoutParams,
      isApplePay: false,
      isGooglePay: false
    })
    
    // Create checkout session for APPLE PAY (Entity ID: 8acda4cc99c87920019a2629104a3e29)
    const checkoutDataApplePay = await solidPayment.prepareCheckout({
      ...checkoutParams,
      merchantTransactionId: `${merchantTransactionId}_applepay`, // Different transaction ID
      isApplePay: true,
      isGooglePay: false
    })
    
    // Create checkout session for GOOGLE PAY (Entity ID: 8acda4c999c83f980199c866d6cb0241 for TEST)
    const checkoutDataGooglePay = await solidPayment.prepareCheckout({
      ...checkoutParams,
      merchantTransactionId: `${merchantTransactionId}_googlepay`, // Different transaction ID
      isApplePay: false,
      isGooglePay: true
    })
    
    // Store order details using checkoutId as key (this is what we get back in resourcePath)
    if (!global.pendingCheckouts) {
      global.pendingCheckouts = new Map()
    }
    
    const orderData = {
      items,
      totalAmount: totalAmount, // Store ORIGINAL amount, not converted
      amountInUSD: amountInUSD, // Store USD amount separately
      paymentDetails,
      brandSlug,
      referralCode,
      linkId,
      originalCurrency: currency,
      merchantTransactionId,
      timestamp: Date.now(),
      gateway: 'solid'
    }
    
    // Store all three checkout IDs with the same order data
    global.pendingCheckouts.set(checkoutDataCard.id, { ...orderData, paymentMethod: 'card' })
    global.pendingCheckouts.set(checkoutDataApplePay.id, { ...orderData, paymentMethod: 'applepay' })
    global.pendingCheckouts.set(checkoutDataGooglePay.id, { ...orderData, paymentMethod: 'googlepay' })

    // Create 3 separate pending order records - one for each checkout (each uses different entity ID)
    // Card checkout (order_id = checkoutId, merchant_transaction_id = base merchantTransactionId)
    await upsertPendingOrderRecord(checkoutDataCard.id, {
      ...orderData,
      currency: originalCurrency,
      paymentGateway: 'solid',
      paymentMethod: 'card',
      userIp: realClientIP,
      merchantTransactionId: merchantTransactionId  // Base ID without suffix
    })
    
    // Apple Pay checkout (order_id = checkoutId, merchant_transaction_id = merchantTransactionId_applepay)
    await upsertPendingOrderRecord(checkoutDataApplePay.id, {
      ...orderData,
      currency: originalCurrency,
      paymentGateway: 'solid',
      paymentMethod: 'applepay',
      userIp: realClientIP,
      merchantTransactionId: `${merchantTransactionId}_applepay`  // With _applepay suffix (matches what Solid Payment will send in webhook)
    })
    
    // Google Pay checkout (order_id = checkoutId, merchant_transaction_id = merchantTransactionId_googlepay)
    await upsertPendingOrderRecord(checkoutDataGooglePay.id, {
      ...orderData,
      currency: originalCurrency,
      paymentGateway: 'solid',
      paymentMethod: 'googlepay',
      userIp: realClientIP,
      merchantTransactionId: `${merchantTransactionId}_googlepay`  // With _googlepay suffix (matches what Solid Payment will send in webhook)
    })
    
    console.log('[checkout/prepare] ===== PENDING ORDERS CREATED =====')
    console.log('[checkout/prepare] Card Checkout ID:', checkoutDataCard.id, '| merchant_transaction_id:', merchantTransactionId)
    console.log('[checkout/prepare] Apple Pay Checkout ID:', checkoutDataApplePay.id, '| merchant_transaction_id:', `${merchantTransactionId}_applepay`)
    console.log('[checkout/prepare] Google Pay Checkout ID:', checkoutDataGooglePay.id, '| merchant_transaction_id:', `${merchantTransactionId}_googlepay`)
    console.log('[checkout/prepare] =====================================')
    
    await logToAdmin({
      level: 'INFO',
      category: 'CHECKOUT',
      action: 'CHECKOUT_CREATED',
      message: 'Checkout sessions created successfully',
      details: {
        gateway: 'solid',
        checkoutIdCard: checkoutDataCard.id,
        checkoutIdApplePay: checkoutDataApplePay.id,
        checkoutIdGooglePay: checkoutDataGooglePay.id,
        merchantTransactionId,
        merchantTransactionIdApplePay: `${merchantTransactionId}_applepay`,
        merchantTransactionIdGooglePay: `${merchantTransactionId}_googlepay`,
        amount: totalAmount,
        amountUSD: amountInUSD,
        currency: originalCurrency,
        items: items.map(i => ({ name: i.name, type: i.type, quantity: i.quantity })),
        brandSlug,
        linkId,
        pendingOrderCreated: true
      },
      userEmail: paymentDetails.email,
      ipAddress: clientIp,
      requestId
    })
    
    res.json({
      success: true,
      gateway: 'solid',
      checkoutId: checkoutDataCard.id, // Credit card checkout ID
      checkoutIdApplePay: checkoutDataApplePay.id, // Apple Pay checkout ID
      checkoutIdGooglePay: checkoutDataGooglePay.id, // Google Pay checkout ID
      integrity: checkoutDataCard.integrity, // Credit card integrity
      integrityApplePay: checkoutDataApplePay.integrity, // Apple Pay integrity
      integrityGooglePay: checkoutDataGooglePay.integrity, // Google Pay integrity
      googlePayEntityId: process.env.SOLID_PAYMENT_ENTITY_ID_GOOGLEPAY || "BCR2DN4TZDEPTQZS", // Entity ID for Google Pay
      amount: amountInUSD,
      currency: 'USD',
      merchantTransactionId
    })
    END OF DISABLED CODE */

// Check transaction attempt status without incrementing
app.get('/api/checkout/check-status', async (req, res) => {
  try {
    // Ensure JSON content type
    res.setHeader('Content-Type', 'application/json')

    const statusCheck = await ipLimiter.checkIpStatus(req, pool)
    const response = {
      allowed: statusCheck.allowed,
      message: statusCheck.message || null,
      attemptCount: statusCheck.attemptCount || 0
    }

    console.log('[checkout/check-status] Response:', response)
    res.json(response)
  } catch (err) {
    console.error('[checkout/check-status] Error:', err)
    // On error, allow the request (fail open) but still return JSON
    res.setHeader('Content-Type', 'application/json')
    res.json({ allowed: true, message: null, attemptCount: 0 })
  }
})

app.get("/", (req, res) => {
  res.send("OpenSightAI API running");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


// Verify payment and complete order (CREATE ORDER FOR ALL STATUSES)
app.get('/api/checkout/verify-payment', async (req, res) => {
  console.log('=== VERIFY PAYMENT ENDPOINT CALLED ===')
  console.log('[verify-payment] Query params:', req.query)
  console.log('[verify-payment] Timestamp:', new Date().toISOString())

  const requestId = `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`

  try {
    const { resourcePath } = req.query

    if (!resourcePath) {
      console.error('[verify-payment] ERROR: No resourcePath provided')
      return res.status(400).json({ error: 'resource_path_required' })
    }

    console.log('[verify-payment] Resource path received:', resourcePath)

    // Verify payment status with Solid Payment
    console.log('[verify-payment] Calling Solid Payment API to verify...')
    const paymentData = await solidPayment.verifyPayment(resourcePath)
    console.log('[verify-payment] Solid Payment API response received')

    const resultCode = paymentData.result?.code
    const description = paymentData.result?.description || ''
    const isSuccess = solidPayment.isPaymentSuccessful(resultCode)
    const isPending = solidPayment.isPaymentPending(resultCode)

    console.log('=== PAYMENT STATUS ANALYSIS ===')
    console.log('[verify-payment] Result code:', resultCode)
    console.log('[verify-payment] Description:', description)
    console.log('[verify-payment] Is success:', isSuccess)
    console.log('[verify-payment] Is pending:', isPending)
    console.log('[verify-payment] Amount:', paymentData.amount, paymentData.currency)
    console.log('[verify-payment] Payment type:', paymentData.paymentType)

    // Determine payment status for the order
    // unpaid = customer paid successfully, brand not yet paid (commission unpaid)
    // pending = payment still processing
    // failed = payment declined/rejected
    const paymentStatus = isSuccess ? 'unpaid' : (isPending ? 'pending' : 'failed')
    const failureReason = isSuccess ? '' : description

    console.log('[verify-payment] Determined payment status:', paymentStatus)
    if (failureReason) console.log('[verify-payment] Failure reason:', failureReason)

    // Extract checkout ID from resourcePath (e.g., /v1/checkouts/{id}/payment)
    // NOTE: paymentData.id is the TRANSACTION ID, not checkout ID!
    // Always use resourcePath to get the correct checkout ID
    const checkoutId = resourcePath.split('/')[3]

    console.log('=== LOOKING UP ORDER DATA ===')
    console.log('[verify-payment] Transaction ID:', paymentData.id)
    console.log('[verify-payment] Checkout ID to lookup:', checkoutId)
    console.log('[verify-payment] Pending checkouts map size:', global.pendingCheckouts?.size || 0)
    console.log('[verify-payment] Available checkout keys:', global.pendingCheckouts ? Array.from(global.pendingCheckouts.keys()) : 'none')

    if (!global.pendingCheckouts) {
      console.error('[verify-payment] No pending checkouts found')
      return res.status(400).json({ error: 'order_not_found' })
    }

    const orderData = global.pendingCheckouts.get(checkoutId)

    if (!orderData) {
      console.error('=== ORDER NOT FOUND ===')
      console.error('[verify-payment] Checkout ID:', checkoutId)
      console.error('[verify-payment] Available keys:', Array.from(global.pendingCheckouts.keys()))
      console.error('[verify-payment] Map contains', global.pendingCheckouts.size, 'entries')
      return res.status(400).json({ error: 'order_expired' })
    }

    console.log('=== ORDER DATA FOUND ===')
    console.log('[verify-payment] Order data:', {
      hasItems: !!orderData.items,
      itemsCount: orderData.items?.length || 0,
      totalAmount: orderData.totalAmount,
      email: orderData.paymentDetails?.email,
      brandSlug: orderData.brandSlug || 'none',
      linkId: orderData.linkId || 'none',
    })

    // Clear the pending checkout
    global.pendingCheckouts.delete(checkoutId)
    console.log('[verify-payment] Removed checkout from pending list')

    const { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, merchantTransactionId, originalCurrency, paymentMethod } = orderData

    // Use checkoutId as orderId since it's what we stored in DB (contains entity-specific info)
    const orderId = checkoutId

    // Get the actual merchant_transaction_id that was stored in DB for this specific checkout
    // (it has the suffix for applepay/googlepay)
    const storedOrderResult = await pool.query(
      'SELECT merchant_transaction_id FROM orders WHERE order_id = $1',
      [orderId]
    )
    const merchantTransactionIdRaw = storedOrderResult.rows[0]?.merchant_transaction_id ||
      paymentData.merchantTransactionId ||
      merchantTransactionId ||
      ''

    const paymentBrand = paymentData.paymentBrand || paymentData.card?.brand || null
    // Payment method is already known from which checkout/entity was used (stored in orderData)
    const resolvedPaymentMethod = paymentMethod || 'card'

    console.log('[verify-payment] Payment method from checkout:', paymentMethod, '| Checkout ID:', checkoutId, '| Merchant TX ID:', merchantTransactionIdRaw)

    
    // Get user IP and check VPN/GEO
    const userIp = getRequestIp(req)
    console.log('[verify-payment] User IP:', userIp)

    const { vpnDetected, vpnGeo } = await checkVpnAndGeo(userIp)
    console.log('[verify-payment] VPN detected:', vpnDetected, 'GEO:', vpnGeo)

    // Process the order (same logic as guest checkout)
    // Look up brand link or direct purchase link if linkId provided
    let brand = null
    let brandLinkId = null
    let directPurchaseLinkId = null
    if (linkId) {
      await ensureBrandLinksTable()
      await ensureDirectPurchaseLinksTable()
      const linkResult = await pool.query('SELECT id, brand_id FROM brand_links WHERE link_id = $1 AND is_active = true', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE id = $1 AND status = $2', [linkResult.rows[0].brand_id, 'active'])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      } else {
        // Check direct purchase links
        const directLinkResult = await pool.query('SELECT id, brand_id FROM direct_purchase_links WHERE link_id = $1 AND is_active = true', [linkId])
        if (directLinkResult.rows.length > 0) {
          directPurchaseLinkId = directLinkResult.rows[0].id
          const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE id = $1 AND status = $2', [directLinkResult.rows[0].brand_id, 'active'])
          if (brandResult.rows.length > 0) {
            brand = brandResult.rows[0]
          }
        }
      }
    }

    // Fallback: Look up brand by slug if provided and no link found
    const slug = brandSlug || referralCode
    if (!brand && slug) {
      await ensureBrandsTable()
      const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE slug = $1 AND status = $2', [String(slug).trim().toLowerCase(), 'active'])
      if (brandResult.rows.length > 0) {
        brand = brandResult.rows[0]
      }
    }

    const packageItem = items.find(i => i?.type === 'package')
    const planRaw = String(packageItem?.id || 'starter').toLowerCase()
    const planName = planRaw === 'professional' ? 'pro' : (planRaw === 'expert' ? 'expert' : 'starter')

    // Sum credits - handle "unlimited" as large number
    const creditsItem = items.find(i => i?.type === 'credits')
    let creditsGranted = creditsItem?.credits || 0
    if (typeof creditsGranted === 'string') {
      if (creditsGranted.toLowerCase() === 'unlimited') {
        creditsGranted = 999999999 // Use a very large number for unlimited
      } else {
        creditsGranted = parseInt(creditsGranted, 10) || 0
      }
    }
    creditsGranted = Number(creditsGranted) * Number(creditsItem?.quantity || 1)

    const email = paymentDetails.email
    const firstName = paymentDetails.firstName || ''
    const lastName = paymentDetails.lastName || ''

    // Variables for user and order creation
    let user = null
    let created = false
    let randomPassword = ''

    // Only process user/credits for SUCCESSFUL payments
    if (isSuccess) {
      await ensureUsersTable()

      // Check if user exists
      const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email])

      if (existingUserResult.rows.length === 0) {
        // Create new user
        randomPassword = Math.random().toString(36).slice(-10)
        const hashedPassword = await bcrypt.hash(randomPassword, 10)
        const result = await pool.query(
          `INSERT INTO users (email, password_hash, plan, credits_balance, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [email, hashedPassword, planName, creditsGranted, firstName, lastName]
        )
        user = result.rows[0]
        created = true
        console.log(`[verify-payment] Created user ${user.email} with plan=${planName}, credits=${creditsGranted}`)
      } else {
        // Update existing user
        user = existingUserResult.rows[0]
        const updatedResult = await pool.query(
          `UPDATE users SET plan = $1, credits_balance = COALESCE(credits_balance, 0) + $2, first_name = COALESCE(NULLIF($3, ''), first_name), last_name = COALESCE(NULLIF($4, ''), last_name)
           WHERE id = $5 RETURNING *`,
          [planName, creditsGranted || 0, firstName, lastName, user.id]
        )
        user = updatedResult.rows[0]
        console.log(`[verify-payment] Updated user ${user.email} with plan=${planName}, added credits=${creditsGranted}`)
      }
    }

    // CREATE ORDER FOR ALL STATUSES (success, failed, pending)
    try {
      await ensureOrdersTable()
      orderId = normalizedOrderId

      let commissionAmount = 0
      let brandId = null
      if (brand) {
        brandId = brand.id
        let commissionRate = Number(brand.commission_rate || 10) / 100

        // If this brand has a parent (is a child brand), use parent's commission rate
        if (brand.parent_brand_id) {
          const parentBrand = await pool.query('SELECT commission_rate FROM brands WHERE id = $1', [brand.parent_brand_id])
          if (parentBrand.rows.length > 0) {
            commissionRate = Number(parentBrand.rows[0].commission_rate || 10) / 100
            console.log(`[commission] Using parent brand commission rate: ${commissionRate * 100}% for child brand ${brandId}`)
          }
        }
        // Calculate commission based on USD amount
      }

      const firstName = paymentDetails.firstName || null
      const lastName = paymentDetails.lastName || null
      const cardHolderName = paymentDetails.cardHolderName || null
      const phone = paymentDetails.phone || null
      const cardBin = paymentData.card?.bin || null
      const cardIssuer = paymentData.card?.issuer || null
      const billingCountry = paymentDetails.country || null

      // Get the raw payment message
      let paymentMessage = paymentData.result?.description || (isSuccess ? 'Payment completed via Solid Payment' : `Payment failed: ${failureReason}`)

      // Transform "suspecting manipulation" message to user-friendly message before storing
      if (paymentMessage && paymentMessage.toLowerCase().includes('suspecting manipulation')) {
        paymentMessage = 'Bank verification required\n\nYour bank needs confirmation to complete this payment. Please check the SMS or email from your bank and confirm the transaction before retrying.'
        console.log('[verify-payment] Transformed "suspecting manipulation" message to user-friendly message')
      }

      const commissionStatus = paymentStatus === 'unpaid' ? 'unpaid' : paymentStatus === 'failed' ? 'cancelled' : 'pending'
      const updateResult = await pool.query(
        `UPDATE orders
         SET user_id = $2,
             email = $3,
             items = $4,
             total_amount = $5,
             payment_status = $6,
             brand_id = $7,
             commission_amount = $8,
             commission_status = $9,
             link_id = $10,
             first_name = $11,
             last_name = $12,
             card_holder_name = $13,
             phone = $14,
             user_ip = $15,
             vpn_detected = $16,
             vpn_geo = $17,
             card_bin = $18,
             card_issuer = $19,
             payment_message = $20,
             currency = $21,
             amount_usd = $22,
             billing_country = $23,
             payment_method = $24,
             payment_gateway = $25,
             payment_brand = $26,
             payment_transaction_id = $27,
             merchant_transaction_id = $28
         WHERE order_id = $1`,
        [
          orderId,
          user ? user.id : null,
          user ? (user.email || email) : email,
          JSON.stringify(items || []),
          Number(totalAmount || 0),
          paymentStatus,
          brandId,
          commissionAmount,
          commissionStatus,
          brandLinkId,
          firstName,
          lastName,
          cardHolderName,
          phone,
          userIp,
          vpnDetected,
          vpnGeo,
          cardBin,
          cardIssuer,
          paymentMessage,
          originalCurrency,
          billingCountry,
          resolvedPaymentMethod || 'card',
          'solid',
          paymentBrand,
          paymentData.id || null,
          merchantTransactionIdRaw || null
        ]
      )

      if (updateResult.rowCount === 0) {
        console.warn('[order] Pending order not found for update, attempting to insert fallback record', { orderId })
        await upsertPendingOrderRecord(orderId, {
          items,
          totalAmount,
          paymentDetails,
          brandSlug,
          referralCode,
          linkId,
          originalCurrency,
          paymentMethod: resolvedPaymentMethod,
          paymentGateway: 'solid',
          userIp,
          merchantTransactionId: merchantTransactionIdRaw,
          paymentBrand,
          paymentTransactionId: paymentData.id || null
        })
        await pool.query(
          `UPDATE orders
             SET total_amount = $2,
                 amount_usd = $3,
                 payment_status = $4,
                 payment_message = $5,
                 payment_method = $6,
                 payment_gateway = $7,
                 payment_brand = $8,
                 payment_transaction_id = $9,
                 merchant_transaction_id = $10
           WHERE order_id = $1`,
          [
            orderId,
            Number(totalAmount || 0),
            paymentStatus,
            paymentMessage,
            resolvedPaymentMethod || 'card',
            'solid',
            paymentBrand,
            paymentData.id || null,
            merchantTransactionIdRaw || null
          ]
        )
      }

      console.log(`[order] Updated order ${orderId} with status=${paymentStatus}, brand_id=${brandId}, link_id=${brandLinkId}, commission=${commissionAmount}`)

      const adminLogLevel = paymentStatus === 'failed' ? 'ERROR' : paymentStatus === 'pending' ? 'WARN' : 'INFO'
      await logToAdmin({
        level: adminLogLevel,
        category: 'CHECKOUT',
        action: 'PAYMENT_STATUS_UPDATED',
        message: `Verification updated order ${orderId} to ${paymentStatus}`,
        details: {
          orderId,
          normalizedOrderId,
          paymentId: paymentData.id || null,
          paymentTransactionId: paymentData.id || null,
          merchantTransactionId: merchantTransactionIdRaw,
          merchantTransactionIdNormalized: normalizedOrderId,
          paymentBrand,
          paymentMethod: resolvedPaymentMethod || 'card',
          paymentGateway: 'solid',
          amount: Number(paymentData.amount || 0),
          currency: paymentData.currency || originalCurrency,
          resultCode,
          resultDescription: description,
          isSuccess,
          isPending,
          isFailed: !isSuccess && !isPending,
          paymentStatus,
          commissionStatus: paymentStatus === 'unpaid' ? 'unpaid' : paymentStatus === 'failed' ? 'cancelled' : 'pending',
          orderUpdated: true
        },
        userEmail: user ? (user.email || email) : email,
        requestId
      })

      if (brandLinkId && isSuccess) {
        await pool.query('UPDATE brand_links SET transactions_count = transactions_count + 1 WHERE id = $1', [brandLinkId])
      }
      
      // Track direct purchase link transactions
      if (isSuccess && linkId) {
        try {
          await ensureDirectPurchaseLinksTable()
          const directLinkResult = await pool.query('SELECT id FROM direct_purchase_links WHERE link_id = $1 AND is_active = true', [linkId])
          if (directLinkResult.rows.length > 0) {
            await pool.query('UPDATE direct_purchase_links SET transactions_count = transactions_count + 1, updated_at = NOW() WHERE id = $1', [directLinkResult.rows[0].id])
            console.log(`[verify-payment] Incremented transactions_count for direct purchase link ${directLinkResult.rows[0].id}`)
          }
        } catch (err) {
          console.warn('[verify-payment] Failed to increment direct purchase link transactions:', err.message)
        }
      }
    } catch (e) {
      console.warn('[orders] Failed to persist order:', e?.message || e)
    }

    // Send welcome email for new users (only for successful payments)
    if (isSuccess && created && SENDGRID_API_KEY) {
      try {
        const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px 24px;text-align:center;">
            <div style="width:56px;height:56px;background:linear-gradient(90deg,#f59e0b,#f97316);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="color:#fff;font-size:28px;">📊</span>
            </div>
            <h1 style="color:#fff;margin:0;font-size:26px;">OpenSightAI</h1>
          </div>
          <div style="background:#fff;">
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Welcome to OpenSightAI</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your account has been created after purchasing the <strong>${planName || 'selected'}</strong> plan.</p>
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#f59e0b;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Email:</strong> ${user.email}</div>
                  <div><strong>Password:</strong> ${randomPassword}</div>
                  <div style="margin-top:8px;color:#94a3b8;">Please change your password after first login.</div>
                </div>
              </div>
              <a href="https://OpenSightai.com" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Go to OpenSightAI</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025</div>
          </div>
        </div>`
        await sgMail.send({ to: user.email, from: EMAIL_FROM, subject: 'Your OpenSightAI account', html })
        console.log(`[email] Sent account email to ${user.email}`)
      } catch (e) {
        const details = e?.response?.body || e
        console.error('[email] Failed to send account email:', details)
      }
    }

    // Return appropriate response based on payment status
    console.log('=== PREPARING RESPONSE ===')
    if (isSuccess) {
      console.log('[verify-payment] Payment was SUCCESSFUL')
      console.log('[verify-payment] User created:', created)
      console.log('[verify-payment] User ID:', user?.id)
      console.log('[verify-payment] Order ID:', orderId)

      res.json({
        success: true,
        status: 'success',
        created,
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          creditsRemaining: user.credits_balance
        },
        password: created ? randomPassword : undefined,
        orderId,
        message: 'Payment successful'
      })
      console.log('[verify-payment] Success response sent to client')
    } else {
      // Failed payment - order created but no credits assigned
      console.log('[verify-payment] Payment FAILED')
      console.log('[verify-payment] Order ID:', orderId)
      console.log('[verify-payment] Failure reason:', failureReason)
      console.log('[verify-payment] Result code:', resultCode)

      // Transform the failure message to user-friendly version if needed
      let responseMessage = failureReason || 'Payment was declined'
      if (responseMessage && responseMessage.toLowerCase().includes('suspecting manipulation')) {
        responseMessage = 'Bank verification required\n\nYour bank needs confirmation to complete this payment. Please check the SMS or email from your bank and confirm the transaction before retrying.'
      }

      res.json({
        success: false,
        status: 'failed',
        orderId,
        message: responseMessage,
        code: resultCode
      })
      console.log('[verify-payment] Failure response sent to client')
    }
  } catch (err) {
    console.error('=== VERIFY PAYMENT ERROR ===')
    console.error('[verify-payment] Error type:', err.constructor.name)
    console.error('[verify-payment] Error message:', err.message)
    console.error('[verify-payment] Error stack:', err.stack)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Check transaction eligibility based on IP limits
// Transaction eligibility check - CRITICAL: Never cache this endpoint
// Changed to POST to prevent caching and ensure fresh evaluation
app.post('/api/transaction/check-eligibility', async (req, res) => {
  const requestId = `eligibility_${Date.now()}_${Math.random().toString(36).substring(7)}`
  
  try {
    // Set strict no-cache headers to prevent any caching or 304 responses
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff'
    })
    
    console.log(`[transaction/check-eligibility:${requestId}] Request received - ${req.method} ${req.path}`)
    
    // Extract and log client IP with detailed information
    const ipAddress = await extractClientIpWithApi(req, { 
      logSource: `transaction/check-eligibility:${requestId}`,
      logMissingClientIp: true
    })
    
    console.log(`[transaction/check-eligibility:${requestId}] Resolved client IP: ${ipAddress}`, {
      hasBodyClientIp: !!(req.body?.client_ip || req.body?.ip_info?.query),
      xForwardedFor: req.headers?.['x-forwarded-for'],
      xRealIp: req.headers?.['x-real-ip'],
      cfConnectingIp: req.headers?.['cf-connecting-ip'],
      reqIp: req.ip,
      socketRemote: req.socket?.remoteAddress
    })
    
    // Check IP eligibility/rate limiting
    const eligibilityCheck = await ipLimiter.checkIpEligibility(req, pool)
    
    console.log(`[transaction/check-eligibility:${requestId}] Eligibility check result:`, {
      allowed: eligibilityCheck.allowed,
      message: eligibilityCheck.message,
      attemptCount: eligibilityCheck.attemptCount,
      ipAddress: ipAddress,
      bypassed: ipAddress === 'unknown' ? 'YES - IP unknown, should be BLOCKED' : 'NO - IP resolved'
    })

    if (!eligibilityCheck.allowed) {
      console.log(`[transaction/check-eligibility:${requestId}] ❌ BLOCKED - Rate limit exceeded. Message: ${eligibilityCheck.message}`)
      // Return 200 (not 429) to ensure no caching, but with allowed: false
      // Frontend checks json.allowed, not status code
      return res.status(200).json({
        allowed: false,
        message: eligibilityCheck.message,
        requestId: requestId
      })
    }

    console.log(`[transaction/check-eligibility:${requestId}] ✅ ALLOWED - User can proceed`)
    // Always return 200 (never 304) with fresh evaluation
    return res.status(200).json({
      allowed: true,
      requestId: requestId
    })
  } catch (err) {
    console.error(`[transaction/check-eligibility:${requestId}] ❌ ERROR:`, err)
    console.error(`[transaction/check-eligibility:${requestId}] Error stack:`, err.stack)
    // On error, return allowed: true (fail open) but always return 200 with fresh response
    return res.status(200).json({
      allowed: true,
      error: 'Eligibility check failed, allowing request',
      requestId: requestId
    })
  }
})

// 🔒 N-GENIUS PAYMENT ENDPOINT DISABLED - Only Neogate is active
// N-Genius payment endpoint (Direct API)
// N-Genius Hosted Payment Page - Create order and return payment URL
app.post('/api/checkout/ngenius-pay', async (req, res) => {
  console.error('[ngenius-pay] ❌ ERROR: N-Genius endpoint called but is disabled - only Neogate is active')
  return res.status(503).json({
    error: 'payment_gateway_disabled',
    message: 'N-Genius is disabled. Only Neogate is available.'
  })
  
  /* DISABLED CODE - Kept for reference
  const clientIp = getRequestIp(req)
  const requestId = `ngenius_${Date.now()}_${Math.random().toString(36).substring(7)}`

  try {
    const { merchantTransactionId } = req.body || {}

    console.log('[ngenius-pay] Creating N-Genius hosted payment order:', merchantTransactionId)

    if (!merchantTransactionId) {
      return res.status(400).json({ error: 'merchant_transaction_id_required' })
    }

    // Retrieve order data from pending checkouts
    if (!global.pendingCheckouts) {
      return res.status(400).json({ error: 'checkout_session_expired' })
    }

    const orderData = global.pendingCheckouts.get(merchantTransactionId)
    if (!orderData) {
      console.error('[ngenius-pay] Order data not found for:', merchantTransactionId)
      return res.status(400).json({ error: 'checkout_session_not_found' })
    }

    const { items, amountInUSD, paymentDetails, brandSlug, linkId, originalCurrency, totalAmount } = orderData

    console.log('[ngenius-pay] Order data retrieved:', {
      items: items.length,
      amountInUSD,
      email: paymentDetails.email
    })

    // Create N-Genius hosted payment order
    const orderResult = await ngeniusPayment.createOrder({
      amount: totalAmount,
      currency: originalCurrency,
      amountUSD: amountInUSD,
      customerEmail: paymentDetails.email,
      customerFirstName: paymentDetails.firstName || 'Customer',
      customerLastName: paymentDetails.lastName || 'User',
      merchantTransactionId,
      billingCountry: paymentDetails.country || 'US',
      billingCity: paymentDetails.city || 'City',
      billingAddress: paymentDetails.address || null
    })

    console.log('[ngenius-pay] Order creation result:', {
      success: orderResult.success,
      orderReference: orderResult.orderReference
    })

    if (!orderResult.success) {
      // Order creation failed
      await logToAdmin({
        level: 'WARN',
        category: 'NGENIUS',
        action: 'ORDER_CREATION_FAILED',
        message: 'N-Genius order creation failed',
        details: {
          merchantTransactionId,
          error: orderResult.error,
          email: paymentDetails.email
        },
        userEmail: paymentDetails.email,
        requestId
      })

      return res.status(400).json({
        success: false,
        error: orderResult.error || 'Failed to create payment order'
      })
    }

    // Store order reference for callback verification
    orderData.orderReference = orderResult.orderReference
    global.pendingCheckouts.set(merchantTransactionId, orderData)

    await logToAdmin({
      level: 'INFO',
      category: 'NGENIUS',
      action: 'ORDER_CREATED',
      message: 'N-Genius payment order created',
      details: {
        merchantTransactionId,
        orderReference: orderResult.orderReference,
        paymentUrl: orderResult.paymentUrl,
        email: paymentDetails.email
      },
      userEmail: paymentDetails.email,
      ipAddress: clientIp,
      requestId
    })

    // Return payment URL for redirect
    res.json({
      success: true,
      paymentUrl: orderResult.paymentUrl,
      orderReference: orderResult.orderReference,
      merchantTransactionId
    })
  } catch (err) {
    console.error('[ngenius-pay] Error:', err)

    await logToAdmin({
      level: 'ERROR',
      category: 'NGENIUS',
      action: 'PAYMENT_ERROR',
      message: 'N-Genius payment processing error',
      details: {
        error: err.message,
        stack: err.stack,
        merchantTransactionId: req.body?.merchantTransactionId
      },
      userEmail: req.body?.email,
      requestId
    })

    res.status(500).json({ error: String(err?.message || err) })
  }
  END OF DISABLED CODE */
})

// 🔒 N-GENIUS CALLBACK ENDPOINT DISABLED - Only Neogate is active
// N-Genius callback endpoint - handles redirect from Hosted Payment Page
app.get('/api/checkout/ngenius-callback', async (req, res) => {
  console.error('[ngenius-callback] ❌ ERROR: N-Genius callback called but is disabled - only Neogate is active')
  return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=gateway_disabled`)
  
  /* DISABLED CODE - Kept for reference
  const clientIp = getRequestIp(req)
  const requestId = `ngenius_callback_${Date.now()}_${Math.random().toString(36).substring(7)}`

  console.log('[ngenius-callback] ===== CALLBACK RECEIVED =====')
  console.log('[ngenius-callback] Full query params:', req.query)
  console.log('[ngenius-callback] Headers:', req.headers)

  try {
    const { merchantTransactionId, ref } = req.query

    console.log('[ngenius-callback] Processing callback:', { merchantTransactionId, ref })
    console.log('[ngenius-callback] FRONTEND_URL env:', process.env.FRONTEND_URL)

    if (!merchantTransactionId) {
      console.error('[ngenius-callback] Missing merchantTransactionId')
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=missing_transaction_id`)
    }

    if (!ref) {
      console.error('[ngenius-callback] Missing order reference')
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=missing_order_reference`)
    }

    // Retrieve order data from pending checkouts
    if (!global.pendingCheckouts) {
      console.error('[ngenius-callback] No pending checkouts found')
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=session_expired`)
    }

    const orderData = global.pendingCheckouts.get(merchantTransactionId)
    if (!orderData) {
      console.error('[ngenius-callback] Order data not found for:', merchantTransactionId)
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=session_not_found`)
    }

    const { items, amountInUSD, paymentDetails, brandSlug, linkId, originalCurrency, totalAmount } = orderData

    // Verify payment status with N-Genius using the ref (order reference)
    console.log('[ngenius-callback] Verifying payment status for order:', ref)
    const verificationResult = await ngeniusPayment.verifyPayment(ref)

    console.log('[ngenius-callback] Verification result:', {
      success: verificationResult.success,
      status: verificationResult.status,
      state: verificationResult.state,
      failureReason: verificationResult.failureReason
    })

    // Check for successful payment states (matching PHP NetworkIntPaymentController.php)
    // Successful states: CAPTURED, PURCHASED, AUTHORISED
    const successfulStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED']
    const isPaymentSuccessful = verificationResult.success && successfulStates.includes(verificationResult.state)

    if (!isPaymentSuccessful) {
      // Payment failed or not in successful state
      const failureReason = verificationResult.failureReason || `Payment ${verificationResult.state}`
      const errorCode = verificationResult.errorCode || null

      console.error('[ngenius-callback] Payment verification failed or not successful:', {
        state: verificationResult.state,
        errorCode,
        failureReason,
        merchantTransactionId,
        orderReference: ref
      })

      // Create failed order record for tracking (matching PHP behavior with enhanced tracking)
      try {
        const { email, firstName, lastName, cardholderName, phone, country: billingCountry } = paymentDetails

        // Look up brand and link for failed transaction tracking
        let brand = null
        let brandLinkId = null

        if (brandSlug) {
          try {
            const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
            if (brandResult.rows.length > 0) {
              brand = brandResult.rows[0]
            }
          } catch (err) {
            console.warn('[ngenius-callback] Brand lookup failed:', err.message)
          }
        }

        if (linkId) {
          try {
            const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
            if (linkResult.rows.length > 0) {
              brandLinkId = linkResult.rows[0].id
              console.log(`[ngenius-callback] Found brand link for failed payment: ${linkId} -> DB ID: ${brandLinkId}`)
            }
          } catch (err) {
            console.warn('[ngenius-callback] Brand link lookup failed:', err.message)
          }
        }

        // Check if user exists (don't create user for failed payment)
        let userId = null
        try {
          const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email])
          if (existingUserResult.rows.length > 0) {
            userId = existingUserResult.rows[0].id
          }
        } catch (err) {
          console.warn('[ngenius-callback] User lookup failed:', err.message)
        }

        // Create failed order record
        const orderId = `order_${Date.now()}_failed`
        const paymentMessage = failureReason || `Payment ${verificationResult.state}`
        const brandId = brand?.id || null

        await ensureOrdersTable()
        await pool.query(
          `INSERT INTO orders (
            order_id, user_id, email, items, total_amount, 
            payment_status, brand_id, commission_amount, commission_status, 
            link_id, first_name, last_name, card_holder_name, phone, 
            user_ip, vpn_detected, vpn_geo, payment_message, 
            currency, amount_usd, billing_country, 
            payment_method, payment_gateway, ngenius_order_reference
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
          [
            orderId,
            userId,
            email,
            JSON.stringify(items || []),
            Number(totalAmount || 0),
            'failed', // Payment status
            brandId,
            0, // No commission for failed payment
            'unpaid',
            brandLinkId,
            firstName,
            lastName,
            cardholderName,
            phone,
            clientIp,
            false, // VPN detection not needed for failed payment
            null,
            paymentMessage,
            originalCurrency,
            amountInUSD,
            billingCountry,
            'card',
            'ngenius',
            ref
          ]
        )

        console.log(`[ngenius-callback] Created failed order record: ${orderId} for ${email}`)
      } catch (orderErr) {
        console.error('[ngenius-callback] Failed to create failed order record:', orderErr)
        // Continue even if failed order creation fails
      }

      await logToAdmin({
        level: 'WARN',
        category: 'NGENIUS',
        action: 'PAYMENT_FAILED',
        message: `N-Genius payment failed: ${failureReason}`,
        details: {
          merchantTransactionId,
          orderReference: ref,
          state: verificationResult.state,
          errorCode: verificationResult.errorCode,
          failureReason: verificationResult.failureReason,
          email: paymentDetails.email
        },
        userEmail: paymentDetails.email,
        requestId
      })

      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=payment_not_captured`)
    }

    // Payment successful - Create user and order
    const { email, firstName, lastName, cardholderName, phone, country: billingCountry } = paymentDetails

    // Perform VPN check
    let vpnDetected = false
    let vpnGeo = null
    try {
      const vpnCheck = await checkVPN(clientIp)
      vpnDetected = vpnCheck.vpnDetected
      vpnGeo = vpnCheck.vpnGeo
    } catch (err) {
      console.warn('[ngenius-callback] VPN check failed:', err.message)
    }

    // Look up brand and track link references
    let brand = null
    let brandLinkId = null
    let directPurchaseLinkId = null
    if (brandSlug) {
      try {
        const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      } catch (err) {
        console.warn('[ngenius-callback] Brand lookup failed:', err.message)
      }
    }

    // Look up brand link or direct purchase link (linkId is the short string)
    if (linkId) {
      try {
        const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
        if (linkResult.rows.length > 0) {
          brandLinkId = linkResult.rows[0].id
          console.log(`[ngenius-callback] Found brand link: ${linkId} -> DB ID: ${brandLinkId}`)
        } else {
          await ensureDirectPurchaseLinksTable()
          const directLinkResult = await pool.query('SELECT * FROM direct_purchase_links WHERE link_id = $1', [linkId])
          if (directLinkResult.rows.length > 0) {
            directPurchaseLinkId = directLinkResult.rows[0].id
            console.log(`[ngenius-callback] Found direct purchase link: ${linkId} -> DB ID: ${directPurchaseLinkId}`)

            if (!brand && directLinkResult.rows[0].brand_id) {
              try {
                const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [directLinkResult.rows[0].brand_id])
                if (brandResult.rows.length > 0) {
                  brand = brandResult.rows[0]
                  console.log(`[ngenius-callback] Loaded brand ${brand.id} for direct purchase link ${linkId}`)
                }
              } catch (brandErr) {
                console.warn('[ngenius-callback] Direct purchase brand lookup failed:', brandErr.message)
              }
            }
          } else {
            console.warn(`[ngenius-callback] Link not found in brand_links or direct_purchase_links: ${linkId}`)
          }
        }
      } catch (err) {
        console.warn('[ngenius-callback] Link lookup failed:', err.message)
      }
    }

    // Create or update user
    await ensureUsersTable()

    // Check if user exists
    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    let user, created = false, randomPassword = null
    const planName = items?.[0]?.planName || 'Free'

    // Handle credits - convert "unlimited" to a large number (999999999) or keep as integer
    let creditsGranted = items?.[0]?.credits || 0
    if (typeof creditsGranted === 'string') {
      if (creditsGranted.toLowerCase() === 'unlimited') {
        creditsGranted = 999999999 // Use a very large number for unlimited
      } else {
        creditsGranted = parseInt(creditsGranted, 10) || 0
      }
    }

    const brandId = brand?.id || null

    if (existingUserResult.rows.length === 0) {
      // Create new user (brand_id is tracked in orders table, not users table)
      randomPassword = generateRandomPassword()
      const hashedPassword = await bcrypt.hash(randomPassword, 10)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, plan, credits_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [email, hashedPassword, firstName || null, lastName || null, planName, creditsGranted]
      )
      user = result.rows[0]
      created = true
      console.log(`[ngenius-callback] Created user ${user.email} with plan=${planName}, credits=${creditsGranted}`)
    } else {
      // Update existing user
      user = existingUserResult.rows[0]
      const updatedResult = await pool.query(
        `UPDATE users SET plan = $1, credits_balance = COALESCE(credits_balance, 0) + $2, first_name = COALESCE(NULLIF($3, ''), first_name), last_name = COALESCE(NULLIF($4, ''), last_name)
        WHERE id = $5 RETURNING *`,
        [planName, creditsGranted, firstName || null, lastName || null, user.id]
      )
      user = updatedResult.rows[0]
      console.log(`[ngenius-callback] Updated user ${user.email} with plan=${planName}, added credits=${creditsGranted}`)
    }

    // Calculate commission
    let commissionAmount = 0
    let commissionRatePercent = null
    if (brand && brand.commission_rate) {
      const commissionRate = parseFloat(brand.commission_rate)
      commissionRatePercent = commissionRate * 100
      commissionAmount = amountInUSD * commissionRate
      console.log(`[ngenius-callback] Brand ${brandId} commission: ${commissionAmount} (${commissionRatePercent}% of ${amountInUSD})`)
    }

    // Create order
    const orderId = `order_${Date.now()}_${user.id}`
    const paymentMessage = `Payment ${verificationResult.state} - N-Genius Hosted Payment`
    await ensureOrdersTable()
    await pool.query(
      `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, user_ip, vpn_detected, vpn_geo, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway, ngenius_order_reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [orderId, user.id, user.email, JSON.stringify(items || []), Number(totalAmount || 0), 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, cardholderName, phone, clientIp, vpnDetected, vpnGeo, paymentMessage, originalCurrency, amountInUSD, billingCountry, 'card', 'ngenius', ref]
    )
    console.log(`[ngenius-callback] Created order ${orderId} with status=unpaid, gateway=ngenius, brand_id=${brandId}, link_id=${brandLinkId}, ngenius_ref=${ref}`)

    // Increment transactions count for the link
    if (brandLinkId) {
      try {
        await pool.query('UPDATE brand_links SET transactions_count = COALESCE(transactions_count, 0) + 1 WHERE id = $1', [brandLinkId])
        console.log(`[ngenius-callback] Incremented transactions_count for link ${brandLinkId}`)
      } catch (err) {
        console.warn('[ngenius-callback] Failed to increment link transactions:', err.message)
      }
    }

    
    // Track direct purchase link transactions
    if (directPurchaseLinkId) {
      try {
        await ensureDirectPurchaseLinksTable()
        await pool.query('UPDATE direct_purchase_links SET transactions_count = COALESCE(transactions_count, 0) + 1, updated_at = NOW() WHERE id = $1', [directPurchaseLinkId])
        console.log(`[ngenius-callback] Incremented transactions_count for direct purchase link ${directPurchaseLinkId}`)
      } catch (err) {
        console.warn('[ngenius-callback] Failed to increment direct purchase link transactions:', err.message)
      }
    }
    
    // Send welcome email
    if (created && randomPassword) {
      try {
        await sendWelcomeEmail(user.email, randomPassword)
        console.log(`[ngenius-callback] Welcome email sent to ${user.email}`)
      } catch (err) {
        console.error(`[ngenius-callback] Failed to send welcome email to ${user.email}:`, err.message)
      }
    }

    // Log success
    await logToAdmin({
      level: 'INFO',
      category: 'NGENIUS',
      action: 'PAYMENT_SUCCESS',
      message: 'N-Genius payment successful',
      details: {
        merchantTransactionId,
        orderReference: ref,
        orderId,
        email: user.email,
        amount: amountInUSD,
        currency: originalCurrency,
        planName,
        creditsGranted
      },
      userEmail: user.email,
      ipAddress: clientIp,
      requestId
    })

    // Clean up pending checkout
    global.pendingCheckouts.delete(merchantTransactionId)

    // Redirect to success page with email
    const successUrl = `${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-success?orderId=${orderId}&email=${encodeURIComponent(user.email)}`
    console.log(`[ngenius-callback] Redirecting to success page: ${successUrl}`)
    return res.redirect(successUrl)

  } catch (err) {
    console.error('[ngenius-callback] CRITICAL ERROR:', err)
    console.error('[ngenius-callback] Error stack:', err.stack)
    console.error('[ngenius-callback] Error details:', {
      message: err.message,
      name: err.name,
      merchantTransactionId: req.query?.merchantTransactionId,
      ref: req.query?.ref
    })

    // Try to log to admin panel (but don't fail if this errors)
    try {
      await logToAdmin({
        level: 'ERROR',
        category: 'NGENIUS',
        action: 'CALLBACK_ERROR',
        message: `N-Genius callback error: ${err.message}`,
        details: {
          error: err.message,
          errorName: err.name,
          stack: err.stack,
          merchantTransactionId: req.query?.merchantTransactionId,
          ref: req.query?.ref
        },
        requestId
      })
    } catch (logErr) {
      console.error('[ngenius-callback] Failed to log error:', logErr)
    }

    return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=server_error`)
  }
  END OF DISABLED CODE */
})

// Neogate Payment Preparation Endpoint
// Frontend should POST to: http://localhost:3001/api/checkout/neogate-prepare (for local development)
app.post('/api/checkout/neogate-prepare', async (req, res) => {
  console.log('[BE] ===== NEOGATE PREPARE START =====')
console.log('[BE] Raw request body:', req.body)
console.log('[BE] Currency from frontend:', req.body.currency)
console.log('[BE] Amount from frontend:', req.body.totalAmount)
console.log('[BE] Items from frontend:', req.body.items)
console.log('[BE] =================================')

  const requestId = `neogate_prepare_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)
  
  // Log that endpoint is receiving requests (helps verify localhost connectivity)
  const backendPort = process.env.PORT || 3001
  
  console.log(`[neogate-prepare] ✅ Endpoint ready - POST http://localhost:${backendPort}/api/checkout/neogate-prepare`)
  console.log(`[neogate-prepare] Request received from: ${req.headers.origin || 'no-origin'} (IP: ${clientIp})`)

  // Check IP-based transaction attempt limiter
  try {
    const ipLimitCheck = await ipLimiter.checkIpLimit(req, pool)
    if (!ipLimitCheck.allowed) {
      // Allow localhost/unknown IPs in development (fail open for dev)
      const isLocalhost = clientIp === 'unknown' || clientIp === '::1' || clientIp.startsWith('127.') || clientIp === 'localhost'
      const isDevelopment = process.env.NODE_ENV !== 'production'
      
      if (isLocalhost && isDevelopment) {
        console.warn('[neogate-prepare] IP limiter blocked localhost request, but allowing in development mode')
      } else {
        return res.status(429).json({
          error: 'too_many_attempts',
          message: ipLimitCheck.message
        })
      }
    }
  } catch (err) {
    console.error('[neogate-prepare] IP limiter error:', err)
    // Continue with checkout if limiter fails (fail open)
  }

  try {
    const {
      items, totalAmount, paymentDetails, brandSlug, linkId, currency, redirect_url, client_orderid,
    
      creditCardNumber, expireMonth, expireYear, cvv2
    } = req.body || {}
    

    console.log('[neogate-prepare] Request received:', {
      email: paymentDetails?.email,
      brandSlug,
      linkId,
      currency,
      hasRedirectUrl: !!redirect_url,
      hasClientOrderId: !!client_orderid
    })

    if (!Array.isArray(items) || items.length === 0) {
      await logToAdmin({
        level: 'WARN',
        category: 'CHECKOUT',
        action: 'CHECKOUT_INVALID',
        message: 'Neogate checkout attempted with empty cart',
        details: { items, email: paymentDetails?.email },
        userEmail: paymentDetails?.email,
        requestId
      })
      return res.status(400).json({ error: 'cart_empty' })
    }

    if (!paymentDetails || !paymentDetails.email) {
      return res.status(400).json({ error: 'email_required' })
    }

    // Validate required address fields
    if (!paymentDetails.address1 || !paymentDetails.city || !paymentDetails.state) {
      return res.status(400).json({ error: 'address_fields_required' })
    }

    
    const selectedCurrency = String(currency || 'USD').toUpperCase()

    const totalAmountUsd = Number(req.body.totalAmountUsd ?? req.body.totalAmount ?? 0)
    if (!Number.isFinite(totalAmountUsd) || totalAmountUsd <= 0) {
      return res.status(400).json({ error: 'invalid_amount' })
    }
    
    // ✅ get rate from DB (units per 1 USD)
    let unitsPerUsd = 1
    
    if (selectedCurrency !== 'USD') {
      const rateRes = await pool.query(
        'SELECT exchange_rate FROM currencies WHERE UPPER(code) = $1 LIMIT 1',
        [selectedCurrency]
      )
      const dbRate = Number(rateRes.rows?.[0]?.exchange_rate)
    
      if (!Number.isFinite(dbRate) || dbRate <= 0) {
        return res.status(400).json({
          error: 'currency_rate_missing',
          message: `No exchange rate for ${selectedCurrency}`
        })
      }
    
      unitsPerUsd = dbRate
    }
    
    // ✅ convert USD -> selected currency
    const amountInSelectedCurrency = totalAmountUsd * unitsPerUsd
    
    const clientOrderId = client_orderid || `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Look up brand and link for tracking
    let brand = null
    let brandLinkId = null
    let directPurchaseLinkId = null

    if (brandSlug) {
      try {
        const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      } catch (err) {
        console.warn('[neogate-prepare] Brand lookup failed:', err.message)
      }
    }

    if (linkId) {
      try {
        const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
        if (linkResult.rows.length > 0) {
          brandLinkId = linkResult.rows[0].id
          if (!brand) {
            brand = await pool.query('SELECT * FROM brands WHERE id = $1', [linkResult.rows[0].brand_id]).then(r => r.rows[0] || null)
          }
        } else {
          await ensureDirectPurchaseLinksTable()
          const directLinkResult = await pool.query('SELECT * FROM direct_purchase_links WHERE link_id = $1', [linkId])
          if (directLinkResult.rows.length > 0) {
            directPurchaseLinkId = directLinkResult.rows[0].id
            if (!brand) {
              brand = await pool.query('SELECT * FROM brands WHERE id = $1', [directLinkResult.rows[0].brand_id]).then(r => r.rows[0] || null)
            }
          }
        }
      } catch (err) {
        console.warn('[neogate-prepare] Link lookup failed:', err.message)
      }
    }

    // Build redirect and callback URLs
    // Use redirect_url from request if provided (frontend generates it dynamically), otherwise use backend default
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'
    const backendBaseUrl = process.env.BACKEND_URL || 'https://api-dev.OpenSightai.com'
    const redirectUrl = redirect_url || `${backendBaseUrl}/api/checkout/neogate-redirect/${clientOrderId}`
    const serverCallbackUrl = `${backendBaseUrl}/api/neogate/callback`
    
    console.log('[neogate-prepare] Using redirect_url:', redirectUrl, redirect_url ? '(from frontend)' : '(generated by backend)')

    // Create payment form with Neogate
    console.log('[neogate-prepare] ⚠️ Frontend sent currency:', selectedCurrency)
    console.log('[neogate-prepare] ✅ Sending to Neogate with currency: ', selectedCurrency)
    const paymentFormResult = await neogatePayment.createPaymentForm({
      amount: amountInSelectedCurrency,
      currency: selectedCurrency,
      clientOrderId,
      email: paymentDetails.email,
      firstName: paymentDetails.firstName,
      lastName: paymentDetails.lastName,
      phone: paymentDetails.phone,
      address1: paymentDetails.address1,
      city: paymentDetails.city,
      state: paymentDetails.state,
      zipCode: paymentDetails.zipCode,
      country: paymentDetails.country,
      ipAddress: clientIp,
      orderDesc: items.map(i => i.name).join(', '),
      redirectUrl,
      serverCallbackUrl
    })

    if (!paymentFormResult.success || !paymentFormResult.paymentUrl) {
      console.error('[neogate-prepare] Failed to create payment form:', paymentFormResult.error)
      await logToAdmin({
        level: 'ERROR',
        category: 'NEOGATE',
        action: 'PAYMENT_FORM_FAILED',
        message: `Failed to create Neogate payment form: ${paymentFormResult.error}`,
        details: { clientOrderId, error: paymentFormResult.error },
        userEmail: paymentDetails.email,
        requestId
      })
      return res.status(500).json({
        error: 'payment_form_failed',
        message: paymentFormResult.error || 'Failed to initialize payment'
      })
    }

    // Store pending order data
    if (!global.pendingCheckouts) {
      global.pendingCheckouts = new Map()
    }

    const orderData = {
      items,
      totalAmount: amountInSelectedCurrency,
      paymentDetails,
      brandSlug,
      linkId,
      originalCurrency: selectedCurrency,
      clientOrderId,
      timestamp: Date.now(),
      gateway: 'neogate',
      neogateOrderId: paymentFormResult.orderId
    }

    global.pendingCheckouts.set(clientOrderId, orderData)

    // Create pending order record
    await upsertPendingOrderRecord(clientOrderId, {
      ...orderData,
      currency: selectedCurrency,
      paymentGateway: 'neogate',
      paymentMethod: 'pending',
      userIp: clientIp
    })

    await logToAdmin({
      level: 'INFO',
      category: 'NEOGATE',
      action: 'PAYMENT_FORM_CREATED',
      message: 'Neogate payment form created successfully',
      details: {
        clientOrderId,
        paymentUrl: paymentFormResult.paymentUrl,
        amount: amountInSelectedCurrency,
        currency: selectedCurrency,
        brandSlug,
        linkId
      },
      userEmail: paymentDetails.email,
      requestId
    })

    return res.json({
      success: true,
      paymentUrl: paymentFormResult.paymentUrl,
      clientOrderId
    })
  } catch (err) {
    console.error('[neogate-prepare] Error:', err)
    await logToAdmin({
      level: 'ERROR',
      category: 'NEOGATE',
      action: 'PREPARE_ERROR',
      message: `Neogate prepare error: ${err.message}`,
      details: { error: err.message, stack: err.stack },
      requestId
    })
    return res.status(500).json({ error: 'server_error', message: err.message })
  }
})

// Neogate Callback Handler (GET - User Redirect)
app.get('/api/neogate/callback', async (req, res) => {
  const clientIp = getRequestIp(req)
  const requestId = `neogate_callback_${Date.now()}_${Math.random().toString(36).substring(7)}`

  console.log('[neogate-callback] ===== CALLBACK RECEIVED =====')
  console.log('[neogate-callback] Full query params:', req.query)

  try {
    // Neogate may send client_orderid or merchant_order in query params
    const clientOrderId = req.query.client_orderid || req.query.merchant_order
    const neogateOrderId = req.query.orderid || orderData?.neogateOrderId


    if (!clientOrderId) {
      console.error('[neogate-callback] Missing client_orderid')
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=missing_order_id`)
    }

    // Retrieve order data from pending checkouts
    if (!global.pendingCheckouts) {
      console.error('[neogate-callback] No pending checkouts found')
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=session_expired`)
    }

    const orderData = global.pendingCheckouts.get(clientOrderId)
    if (!orderData) {
      console.error('[neogate-callback] Order data not found for:', clientOrderId)
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=session_not_found`)
    }

    const { items, amountInSelectedCurrency, paymentDetails, brandSlug, linkId, originalCurrency } = orderData

    // Verify payment status with Neogate
    console.log('[neogate-callback] Verifying payment status for:', clientOrderId)
    const verificationResult = await neogatePayment.verifyPaymentStatus(clientOrderId, neogateOrderId)


    console.log('[neogate-callback] Verification result:', {
      success: verificationResult.success,
      status: verificationResult.status,
      orderId: verificationResult.orderId
    })

    const isPaymentSuccessful = verificationResult.success && verificationResult.status === 'approved'

    if (!isPaymentSuccessful) {
      // Payment failed
      const failureReason = verificationResult.errorMessage || `Payment ${verificationResult.status}`
      const errorCode = verificationResult.errorCode || null
      const neogateStatus = verificationResult.status || 'declined' // Get status from verification result

      console.error('[neogate-callback] Payment verification failed:', {
        status: neogateStatus,
        errorCode,
        failureReason,
        clientOrderId
      })

      // Update or create failed order record
      try {
        const { email, firstName, lastName, phone, country: billingCountry } = paymentDetails

        // Look up brand and link
        let brand = null
        let brandLinkId = null

        if (brandSlug) {
          const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
          if (brandResult.rows.length > 0) {
            brand = brandResult.rows[0]
          }
        }

        if (linkId) {
          const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
          if (linkResult.rows.length > 0) {
            brandLinkId = linkResult.rows[0].id
          }
        }

        // Check if user exists
        let userId = null
        try {
          const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email])
          if (existingUserResult.rows.length > 0) {
            userId = existingUserResult.rows[0].id
          }
        } catch (err) {
          console.warn('[neogate-callback] User lookup failed:', err.message)
        }

        // Map Neogate status to payment_status
        // 'declined', 'failed', 'cancelled' -> 'failed' in DB
        const paymentStatus = (neogateStatus === 'declined' || neogateStatus === 'failed' || neogateStatus === 'cancelled') 
          ? 'failed' 
          : 'failed' // Default to 'failed' for any non-approved status

        const paymentMessage = failureReason || `Payment ${neogateStatus}`
        const brandId = brand?.id || null

        await ensureOrdersTable()
        
        // Check if order already exists (pending order created during checkout)
        const existingOrderResult = await pool.query('SELECT order_id FROM orders WHERE order_id = $1', [clientOrderId])
        
        if (existingOrderResult.rows.length > 0) {
          // Update existing order
          await pool.query(
            `UPDATE orders SET 
              payment_status = $1, 
              payment_message = $2,
              commission_status = $3
            WHERE order_id = $4`,
            [paymentStatus, paymentMessage, 'unpaid', clientOrderId]
          )
          console.log(`[neogate-callback] Updated existing order ${clientOrderId} with status: ${paymentStatus}`)
        } else {
          // Create new failed order record
          await pool.query(
            `INSERT INTO orders (
              order_id, user_id, email, items, total_amount, 
              payment_status, brand_id, commission_amount, commission_status, 
              link_id, first_name, last_name, phone, 
              user_ip, vpn_detected, vpn_geo, payment_message, 
              currency, amount_usd, billing_country, 
              payment_method, payment_gateway
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
            [
              clientOrderId,
              userId,
              email,
              JSON.stringify(items || []),
              Number(amountInSelectedCurrency || 0),
              paymentStatus,
              brandId,
              0,
              'unpaid',
              brandLinkId,
              firstName,
              lastName,
              phone,
              clientIp,
              false,
              null,
              paymentMessage,
              selectedCurrency,
              Number(amountInSelectedCurrency || 0),
              billingCountry,
              'card',
              'neogate'
            ]
          )
          console.log(`[neogate-callback] Created failed order record: ${clientOrderId}`)
        }
      } catch (orderErr) {
        console.error('[neogate-callback] Failed to update/create failed order record:', orderErr)
      }

      await logToAdmin({
        level: 'WARN',
        category: 'NEOGATE',
        action: 'PAYMENT_FAILED',
        message: `Neogate payment failed: ${failureReason}`,
        details: {
          clientOrderId,
          neogateOrderId: verificationResult.orderId,
          status: neogateStatus,
          errorCode,
          failureReason,
          email: paymentDetails.email
        },
        userEmail: paymentDetails.email,
        requestId
      })

      // Build redirect URL with orderId, paynetOrderId, and status parameters
      const redirectParams = new URLSearchParams()
      redirectParams.set('orderId', clientOrderId)
      if (neogateOrderId) {
        redirectParams.set('paynetOrderId', neogateOrderId)
      }
      redirectParams.set('status', neogateStatus)
      
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?${redirectParams.toString()}`)
    }

    // Payment successful - Create user and order
    const { email, firstName, lastName, phone, country: billingCountry } = paymentDetails

    // Perform VPN check
    let vpnDetected = false
    let vpnGeo = null
    try {
      const vpnCheck = await checkVpnAndGeo(clientIp)
      vpnDetected = vpnCheck.vpnDetected
      vpnGeo = vpnCheck.vpnGeo
    } catch (err) {
      console.warn('[neogate-callback] VPN check failed:', err.message)
    }

    // Look up brand and link
    let brand = null
    let brandLinkId = null
    let directPurchaseLinkId = null

    if (brandSlug) {
      try {
        const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      } catch (err) {
        console.warn('[neogate-callback] Brand lookup failed:', err.message)
      }
    }

    if (linkId) {
      try {
        const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
        if (linkResult.rows.length > 0) {
          brandLinkId = linkResult.rows[0].id
        } else {
          await ensureDirectPurchaseLinksTable()
          const directLinkResult = await pool.query('SELECT * FROM direct_purchase_links WHERE link_id = $1', [linkId])
          if (directLinkResult.rows.length > 0) {
            directPurchaseLinkId = directLinkResult.rows[0].id
            if (!brand && directLinkResult.rows[0].brand_id) {
              const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [directLinkResult.rows[0].brand_id])
              if (brandResult.rows.length > 0) {
                brand = brandResult.rows[0]
              }
            }
          }
        }
      } catch (err) {
        console.warn('[neogate-callback] Link lookup failed:', err.message)
      }
    }

    // Create or update user
    await ensureUsersTable()
    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    let user, created = false, randomPassword = null
    const planName = items?.[0]?.planName || 'Free'

    let creditsGranted = items?.[0]?.credits || 0
    if (typeof creditsGranted === 'string') {
      if (creditsGranted.toLowerCase() === 'unlimited') {
        creditsGranted = 999999999
      } else {
        creditsGranted = parseInt(creditsGranted, 10) || 0
      }
    }

    const brandId = brand?.id || null

    if (existingUserResult.rows.length === 0) {
      // Create new user
      randomPassword = generateRandomPassword()
      const hashedPassword = await bcrypt.hash(randomPassword, 10)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, plan, credits_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [email, hashedPassword, firstName || null, lastName || null, planName, creditsGranted]
      )
      user = result.rows[0]
      created = true
      console.log(`[neogate-callback] Created user ${user.email}`)
    } else {
      // Update existing user
      user = existingUserResult.rows[0]
      const updatedResult = await pool.query(
        `UPDATE users SET plan = $1, credits_balance = COALESCE(credits_balance, 0) + $2, first_name = COALESCE(NULLIF($3, ''), first_name), last_name = COALESCE(NULLIF($4, ''), last_name)
        WHERE id = $5 RETURNING *`,
        [planName, creditsGranted, firstName || null, lastName || null, user.id]
      )
      user = updatedResult.rows[0]
      console.log(`[neogate-callback] Updated user ${user.email}`)
    }

    const amountToStore =
  Number(orderData?.amountInEUR ?? orderData?.amountInSelectedCurrency ?? amount ?? 0)


    // Calculate commission
    let commissionAmount = 0
    let commissionRatePercent = null
    if (brand && brand.commission_rate) {
      const commissionRate = parseFloat(brand.commission_rate)
      commissionRatePercent = commissionRate * 100
      commissionAmount = amountInEUR * commissionRate
      console.log(`[neogate-callback] Brand ${brandId} commission: ${commissionAmount} (${commissionRatePercent}% of ${amountInEUR})`)
    }

    // Check if order already exists (pending order created during checkout)
    //const paymentMessage = `Payment approved - Neogate`
    const paymentMessage = verificationResult.paymentMessage || `Payment approved - Neogate`
    await ensureOrdersTable()
    const existingOrderResult = await pool.query('SELECT order_id FROM orders WHERE order_id = $1', [clientOrderId])
    
    let orderId
    if (existingOrderResult.rows.length > 0) {
      // Update existing order
      orderId = clientOrderId
      await pool.query(
        `UPDATE orders SET 
          user_id = $1,
          email = $2,
          items = $3,
          total_amount = $4,
          payment_status = $5,
          brand_id = $6,
          commission_amount = $7,
          commission_status = $8,
          commission_rate = $9,
          link_id = $10,
          first_name = $11,
          last_name = $12,
          phone = $13,
          user_ip = $14,
          vpn_detected = $15,
          vpn_geo = $16,
          payment_message = $17,
          currency = $18,
          amount_usd = $19,
          billing_country = $20,
          payment_method = $21,
          payment_gateway = $22
        WHERE order_id = $23`,
        [user.id, user.email, JSON.stringify(items || []), amountToStore, 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, phone, clientIp, vpnDetected, vpnGeo, paymentMessage, selectedCurrency, amountToStore, billingCountry, 'card', 'neogate', orderId]
      )
      console.log(`[neogate-callback] Updated existing order ${orderId} with approved status`)
    } else {
      // Create new order
      orderId = `order_${Date.now()}_${user.id}`
      await pool.query(
        `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, phone, user_ip, vpn_detected, vpn_geo, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [orderId, user.id, user.email, JSON.stringify(items || []), amountToStore, 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, phone, clientIp, vpnDetected, vpnGeo, paymentMessage, selectedCurrency, amountToStore, billingCountry, 'card', 'neogate']
      )
      console.log(`[neogate-callback] Created order ${orderId}`)
    }

    // Increment transactions count for the link
    if (brandLinkId) {
      try {
        await pool.query('UPDATE brand_links SET transactions_count = COALESCE(transactions_count, 0) + 1 WHERE id = $1', [brandLinkId])
      } catch (err) {
        console.warn('[neogate-callback] Failed to increment link transactions:', err.message)
      }
    }

    if (directPurchaseLinkId) {
      try {
        await ensureDirectPurchaseLinksTable()
        await pool.query('UPDATE direct_purchase_links SET transactions_count = COALESCE(transactions_count, 0) + 1, updated_at = NOW() WHERE id = $1', [directPurchaseLinkId])
      } catch (err) {
        console.warn('[neogate-callback] Failed to increment direct purchase link transactions:', err.message)
      }
    }

    // Send welcome email if new user (if sendWelcomeEmail function exists)
    if (created && randomPassword && typeof sendWelcomeEmail === 'function') {
      try {
        await sendWelcomeEmail(user.email, randomPassword)
        console.log(`[neogate-callback] Welcome email sent to ${user.email}`)
      } catch (err) {
        console.error(`[neogate-callback] Failed to send welcome email:`, err.message)
      }
    }

    // Log success
    await logToAdmin({
      level: 'INFO',
      category: 'NEOGATE',
      action: 'PAYMENT_SUCCESS',
      message: 'Neogate payment successful',
      details: {
        clientOrderId,
        neogateOrderId: verificationResult.orderId,
        orderId,
        email: user.email,
        amount: amountInEUR,
        currency: selectedCurrency
      },
      userEmail: user.email,
      ipAddress: clientIp,
      requestId
    })

    // Clean up pending checkout
    global.pendingCheckouts.delete(clientOrderId)

    // Build redirect URL with orderId, paynetOrderId, and status parameters
    const redirectParams = new URLSearchParams()
    redirectParams.set('orderId', orderId)
    if (neogateOrderId) {
      redirectParams.set('paynetOrderId', neogateOrderId)
    }
    redirectParams.set('status', 'approved')
    redirectParams.set('email', user.email)
    
    // Redirect to success page
    const successUrl = `${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-success?${redirectParams.toString()}`
    return res.redirect(successUrl)

  } catch (err) {
    console.error('[neogate-callback] CRITICAL ERROR:', err)
    await logToAdmin({
      level: 'ERROR',
      category: 'NEOGATE',
      action: 'CALLBACK_ERROR',
      message: `Neogate callback error: ${err.message}`,
      details: { error: err.message, stack: err.stack },
      requestId
    })
    return res.redirect(`${process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'}/payment-failed?error=server_error`)
  }
})

// Neogate Webhook Handler (POST - Server Callback)
app.post('/api/neogate/callback', express.urlencoded({ extended: true }), async (req, res) => {
  const requestId = `neogate_webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`

  console.log('[neogate-webhook] ===== WEBHOOK RECEIVED =====')
  console.log('[neogate-webhook] Body:', req.body)

  try {
    // Parse callback parameters
    const status = req.body.status
    const orderId = req.body.orderid
    const merchantOrder = req.body.merchant_order || req.body.client_orderid
    const control = req.body.control
    const serialNumber = req.body['serial-number'] || req.body.serial_number || null
    const amount = parseFloat(req.body.amount || 0)
    const currency = req.body.currency
    const errorMessage =
  req.body['error-message'] ||
  req.body.error_message ||
  req.body.errorMessage ||
  null

const errorCode =
  req.body['error-code'] ||
  req.body.error_code ||
  req.body.errorCode ||
  null

    if (!status || !orderId || !merchantOrder) {
      console.error('[neogate-webhook] Missing required fields')
      return res.status(400).send('Missing required fields')
    }

    console.log('[neogate-webhook] Currency:', currency)
    // Verify control signature
    const NEOGATE_CONTROL_KEY = process.env.NEOGATE_CONTROL_KEY || '15A321A6-DBE2-48CA-A815-EFE1C412E273'
    const expectedControl = neogatePayment.calculateCallbackControl(status, orderId, merchantOrder, NEOGATE_CONTROL_KEY)

    if (control !== expectedControl) {
      console.error('[neogate-webhook] Control signature mismatch')
      await logToAdmin({
        level: 'ERROR',
        category: 'NEOGATE',
        action: 'WEBHOOK_SIGNATURE_FAILED',
        message: 'Neogate webhook signature verification failed',
        details: { received: control, expected: expectedControl.substring(0, 10) + '...' },
        requestId
      })
      return res.status(400).send('Invalid signature')
    }

    // Check for duplicate callbacks (idempotency)
    await ensureWebhookEventsTable()
    if (serialNumber) {
      const existingEvent = await pool.query(
        'SELECT id FROM webhook_events WHERE event_id = $1',
        [serialNumber]
      )
      if (existingEvent.rows.length > 0) {
        console.log('[neogate-webhook] Event already processed (idempotent), skipping')
        return res.status(200).send('OK')
      }
    }

    // Store webhook event for idempotency
    if (serialNumber) {
      await pool.query(
        `INSERT INTO webhook_events (event_id, event_name, order_reference, payload)
         VALUES ($1, $2, $3, $4)`,
        [serialNumber, 'neogate_callback', orderId, JSON.stringify(req.body)]
      )
    }

    // Retrieve order data from pending checkouts
    let orderData = null
    if (global.pendingCheckouts) {
      orderData = global.pendingCheckouts.get(merchantOrder)
    }

    const isPaymentSuccessful = status === 'approved'

    if (isPaymentSuccessful) {
      // Payment successful - create/update order
      if (orderData) {
        const { items, amountInEUR, paymentDetails, brandSlug, linkId } = orderData
        const { email, firstName, lastName, phone, country: billingCountry } = paymentDetails

        // Look up brand and link
        let brand = null
        let brandLinkId = null

        if (brandSlug) {
          const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
          if (brandResult.rows.length > 0) {
            brand = brandResult.rows[0]
          }
        }

        if (linkId) {
          const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
          if (linkResult.rows.length > 0) {
            brandLinkId = linkResult.rows[0].id
          }
        }

        // Check if order already exists
        await ensureOrdersTable()
        const existingOrder = await pool.query('SELECT * FROM orders WHERE order_id = $1', [merchantOrder])

        if (existingOrder.rows.length === 0) {
          // Create new order
          const orderId = `order_${Date.now()}_${merchantOrder}`
          const brandId = brand?.id || null
          let commissionAmount = 0
          let commissionRatePercent = null

          if (brand && brand.commission_rate) {
            const commissionRate = parseFloat(brand.commission_rate)
            commissionRatePercent = commissionRate * 100
            commissionAmount = amountInEUR * commissionRate
          }

          await pool.query(
            `INSERT INTO orders (order_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, phone, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [orderId, email, JSON.stringify(items || []), amountToStore, 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, phone, 'Payment approved - Neogate webhook', selectedCurrency, amountToStore, billingCountry, 'card', 'neogate']
          )

          console.log(`[neogate-webhook] Created order ${orderId}`)
        } else {
          // Update existing order
          await pool.query(
            `UPDATE orders SET payment_status = $1, payment_message = $2 WHERE order_id = $3`,
            ['unpaid', 'Payment approved - Neogate webhook', merchantOrder]
          )
          console.log(`[neogate-webhook] Updated order ${merchantOrder}`)
        }
      }
    } else {
      // Payment failed - create/update failed order
      if (orderData) {
        const { items, amountInEUR, paymentDetails, brandSlug, linkId } = orderData
        const { email, firstName, lastName, phone, country: billingCountry } = paymentDetails

        let brand = null
        let brandLinkId = null

        if (brandSlug) {
          const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
          if (brandResult.rows.length > 0) {
            brand = brandResult.rows[0]
          }
        }

        if (linkId) {
          const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
          if (linkResult.rows.length > 0) {
            brandLinkId = linkResult.rows[0].id
          }
        }

        // Map Neogate status to payment_status
        // 'declined', 'failed', 'cancelled' -> 'failed' in DB
        const paymentStatus = (status === 'declined' || status === 'failed' || status === 'cancelled') 
          ? 'failed' 
          : 'failed' // Default to 'failed' for any non-approved status

        const paymentMessage = errorMessage || `Payment ${status}`
        const brandId = brand?.id || null

        await ensureOrdersTable()
        const existingOrder = await pool.query('SELECT * FROM orders WHERE order_id = $1', [merchantOrder])

        if (existingOrder.rows.length === 0) {
          // Create new failed order record
          await pool.query(
            `INSERT INTO orders (order_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, link_id, first_name, last_name, phone, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
              [merchantOrder, email, JSON.stringify(items || []), amountToStore, paymentStatus, brandId, 0, 'unpaid', brandLinkId, firstName, lastName, phone, paymentMessage, selectedCurrency, amountToStore, billingCountry, 'card', 'neogate']
          )

          console.log(`[neogate-webhook] Created failed order ${merchantOrder} with status: ${paymentStatus}`)
        } else {
          // Update existing order
          await pool.query(
            `UPDATE orders SET 
              payment_status = $1, 
              payment_message = $2,
              commission_status = $3
            WHERE order_id = $4`,
            [paymentStatus, paymentMessage, 'unpaid', merchantOrder]
          )
          console.log(`[neogate-webhook] Updated existing order ${merchantOrder} with status: ${paymentStatus}`)
        }
      }
    }

    await logToAdmin({
      level: isPaymentSuccessful ? 'INFO' : 'WARN',
      category: 'NEOGATE',
      action: isPaymentSuccessful ? 'WEBHOOK_SUCCESS' : 'WEBHOOK_FAILED',
      message: `Neogate webhook: ${status}`,
      details: {
        status,
        orderId,
        merchantOrder,
        amount,
        currency,
        errorMessage,
        errorCode
      },
      requestId
    })

    return res.status(200).send('OK')
  } catch (err) {
    console.error('[neogate-webhook] Error:', err)
    await logToAdmin({
      level: 'ERROR',
      category: 'NEOGATE',
      action: 'WEBHOOK_ERROR',
      message: `Neogate webhook error: ${err.message}`,
      details: { error: err.message, stack: err.stack },
      requestId
    })
    return res.status(500).send('Internal Server Error')
  }
})

// Neogate POST Redirect Handler
// Handles POST requests from Neogate when they redirect users back after payment
// Shared handler function for both routes
async function handleNeogatePostRedirect(req, res) {
  const clientIp = getRequestIp(req)
  const requestId = `neogate_redirect_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const transactionId = req.params.transactionId

  console.log('[neogate-redirect] ===== POST REDIRECT RECEIVED =====')
  console.log('[neogate-redirect] Transaction ID:', transactionId)
  console.log('[neogate-redirect] Request body:', req.body)
  console.log('[neogate-redirect] Request from IP:', clientIp)

  try {
    // Extract POST body data (Neogate sends form-urlencoded data)
    const postData = req.body || {}

    // Extract payment information (handle both kebab-case and camelCase)
    const merchantOrderId = postData['merchant-order-id'] || 
                          postData.merchantOrderId || 
                          postData['client_orderid'] ||
                          postData.client_orderid ||
                          transactionId
    const paynetOrderId = postData['paynet-order-id'] || 
                         postData.paynetOrderId || 
                         postData.orderid ||
                         postData.orderId
    const status = postData.status || postData.paymentStatus
    const error = postData.error || postData.errorCode || postData['error-code']
    const errorMessage = postData['error-message'] || postData.errorMessage

    console.log('[neogate-redirect] Extracted data:', {
      transactionId,
      merchantOrderId,
      paynetOrderId,
      status,
      error,
      errorMessage
    })

    // Update database status based on response
    const orderIdToUpdate = merchantOrderId || transactionId
    if (orderIdToUpdate && status) {
      try {
        await ensureOrdersTable()
        
        // Map Neogate status to payment_status
        let paymentStatus = 'pending'
        let paymentMessage = `Payment ${status}`
        
        if (status === 'approved' || status === 'success') {
          paymentStatus = 'unpaid' // Success but commission not yet paid
          paymentMessage = 'Payment approved - Neogate'
        } else if (status === 'declined' || status === 'failed' || status === 'cancelled') {
          paymentStatus = 'failed'
          paymentMessage = errorMessage || `Payment ${status}`
        }
        
        // Check if order exists
        const existingOrderResult = await pool.query('SELECT order_id FROM orders WHERE order_id = $1', [orderIdToUpdate])
        
        if (existingOrderResult.rows.length > 0) {
          // Update existing order
          await pool.query(
            `UPDATE orders SET 
              payment_status = $1, 
              payment_message = $2
            WHERE order_id = $3`,
            [paymentStatus, paymentMessage, orderIdToUpdate]
          )
          console.log(`[neogate-redirect] Updated order ${orderIdToUpdate} with status: ${paymentStatus}`)
        } else {
          // Try to get order data from pending checkouts if available
          let orderData = null
          if (global.pendingCheckouts) {
            orderData = global.pendingCheckouts.get(orderIdToUpdate)
          }
          
          if (orderData) {
            // Create order record from pending checkout data
            const { items, amountInEUR, paymentDetails, brandSlug, linkId } = orderData
            const { email, firstName, lastName, phone, country: billingCountry } = paymentDetails || {}
            
            // Look up brand and link
            let brand = null
            let brandLinkId = null
            
            if (brandSlug) {
              const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
              if (brandResult.rows.length > 0) {
                brand = brandResult.rows[0]
              }
            }
            
            if (linkId) {
              const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
              if (linkResult.rows.length > 0) {
                brandLinkId = linkResult.rows[0].id
              }
            }
            
            // Check if user exists
            let userId = null
            if (email) {
              try {
                const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email])
                if (existingUserResult.rows.length > 0) {
                  userId = existingUserResult.rows[0].id
                }
              } catch (err) {
                console.warn('[neogate-redirect] User lookup failed:', err.message)
              }
            }
            
            const brandId = brand?.id || null
            
            await pool.query(
              `INSERT INTO orders (
                order_id, user_id, email, items, total_amount, 
                payment_status, brand_id, commission_amount, commission_status, 
                link_id, first_name, last_name, phone, 
                user_ip, vpn_detected, vpn_geo, payment_message, 
                currency, amount_usd, billing_country, 
                payment_method, payment_gateway
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
              [
                orderIdToUpdate,
                userId,
                email || null,
                JSON.stringify(items || []),
                amountToStore,
                paymentStatus,
                brandId,
                0,
                paymentStatus === 'unpaid' ? 'unpaid' : 'unpaid',
                brandLinkId,
                firstName || null,
                lastName || null,
                phone || null,
                clientIp,
                false,
                null,
                paymentMessage,
                selectedCurrency,
                amountToStore,
                billingCountry || null,
                'card',
                'neogate'
              ]
            )
            console.log(`[neogate-redirect] Created order record ${orderIdToUpdate} with status: ${paymentStatus}`)
          } else {
            console.warn(`[neogate-redirect] Order ${orderIdToUpdate} not found in database or pending checkouts`)
          }
        }
      } catch (dbErr) {
        console.error('[neogate-redirect] Failed to update database:', dbErr)
        // Continue with redirect even if DB update fails
      }
    }

    // Log the redirect attempt
    await logToAdmin({
      level: 'INFO',
      category: 'NEOGATE',
      action: 'POST_REDIRECT_RECEIVED',
      message: 'Neogate POST redirect received',
      details: {
        transactionId,
        merchantOrderId,
        paynetOrderId,
        status,
        error,
        errorMessage,
        body: postData
      },
      requestId
    })

    // Build redirect URL with query parameters
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'
    const params = new URLSearchParams()

    if (merchantOrderId) {
      params.set('orderId', merchantOrderId)
    }

    if (paynetOrderId) {
      params.set('paynetOrderId', paynetOrderId)
    }

    if (status) {
      params.set('status', status)
    }

    if (error) {
      params.set('error', error)
    }

    if (errorMessage) {
      params.set('errorMessage', errorMessage)
    }

    // If no merchantOrderId but we have transactionId, use it as fallback
    if (!merchantOrderId && transactionId) {
      params.set('orderId', transactionId)
    }

    // Determine success or failure page
    const isSuccess = status === 'approved' || status === 'success'
    const redirectPath = isSuccess ? '/success' : '/payment-failed'
    const redirectUrl = `${frontendBaseUrl}${redirectPath}?${params.toString()}`
    //const redirectUrl = `${process.env.CHECKOUT_BASE_URL || 'https://checkout.OpenSightai.com'}/pay/${clientOrderId}`

    console.log('[neogate-redirect] Redirecting to:', redirectUrl)
    console.log('[neogate-redirect] Status:', status, '| Success:', isSuccess)

    // Return HTML redirect (works better for POST -> GET conversion)
    // This ensures browsers properly redirect even when coming from a POST request
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${redirectUrl}">
          <script>window.location.href = "${redirectUrl}";</script>
          <title>Redirecting...</title>
        </head>
        <body>
          <p>Redirecting to payment ${isSuccess ? 'success' : 'result'} page...</p>
          <p>If you are not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('[neogate-redirect] Error:', error)
    
    await logToAdmin({
      level: 'ERROR',
      category: 'NEOGATE',
      action: 'POST_REDIRECT_ERROR',
      message: `Neogate POST redirect error: ${error.message}`,
      details: { 
        transactionId,
        error: error.message, 
        stack: error.stack 
      },
      requestId
    })

    // Redirect to error page on failure
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://pay.OpenSightai.com'
    const errorRedirectUrl = `${frontendBaseUrl}/payment-failed?error=callback_error&orderId=${transactionId}`
    
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${errorRedirectUrl}">
          <script>window.location.href = "${errorRedirectUrl}";</script>
          <title>Redirecting...</title>
        </head>
        <body>
          <p>An error occurred processing your payment. Redirecting...</p>
          <p>If you are not redirected automatically, <a href="${errorRedirectUrl}">click here</a>.</p>
        </body>
      </html>
    `)
  }
}

// Route: POST /api/checkout/neogate-redirect/:transactionId
app.post('/api/checkout/neogate-redirect/:transactionId', express.urlencoded({ extended: true }), handleNeogatePostRedirect)

// Alternative route: POST /pay/pay_:transactionId (for Apache proxying)
// This allows Apache to proxy POST requests from /pay/pay_* to this endpoint
app.post('/pay/pay_:transactionId', express.urlencoded({ extended: true }), handleNeogatePostRedirect)

// Admin: Recover failed N-Genius callback transactions
app.post('/api/admin/ngenius/recover-transaction', requireAuth, requireAdmin, async (req, res) => {
  const requestId = `ngenius_recovery_${Date.now()}_${Math.random().toString(36).substring(7)}`

  try {
    const { orderReference, merchantTransactionId, email, items, selectedCurrency, totalAmount, paymentDetails, brandSlug, linkId } = req.body

    console.log('[ngenius-recovery] Recovery request:', { orderReference, merchantTransactionId, email })

    // Validate required fields
    if (!orderReference) {
      return res.status(400).json({ error: 'Order reference (ref) is required' })
    }

    // Verify payment with N-Genius
    console.log('[ngenius-recovery] Verifying payment with N-Genius...')
    const verificationResult = await ngeniusPayment.verifyPayment(orderReference)

    if (!verificationResult.success || verificationResult.state !== 'CAPTURED') {
      return res.status(400).json({
        error: 'Payment not captured',
        state: verificationResult.state,
        failureReason: verificationResult.failureReason
      })
    }

    console.log('[ngenius-recovery] Payment verified as CAPTURED')

    // Extract payment details from verification result or request body
    const finalPaymentDetails = paymentDetails || {
      email: email || verificationResult.email,
      firstName: verificationResult.customerName?.split(' ')[0] || '',
      lastName: verificationResult.customerName?.split(' ').slice(1).join(' ') || '',
      cardholderName: verificationResult.cardholderName || '',
      phone: verificationResult.phone || '',
      country: verificationResult.billingCountry || ''
    }

    const finalEmail = (finalPaymentDetails.email || '').toLowerCase()
    if (!finalEmail) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const finalAmountUSD = selectedCurrency || verificationResult.amountInSelectedCurrency || 0
    const finalCurrency = originalCurrency || verificationResult.currency || 'USD'
    const finalTotalAmount = totalAmount || verificationResult.amount || finalAmountUSD

    // Look up brand
    let brand = null
    let brandLinkId = null
    if (brandSlug) {
      const brandResult = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
      if (brandResult.rows.length > 0) {
        brand = brandResult.rows[0]
      }
    }

    // Look up brand link
    if (linkId) {
      // linkId is the string identifier (e.g., 'mSrcAQfv'), not the numeric ID
      const linkResult = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        console.log(`[solid-callback] Found brand link: ${linkId} -> DB ID: ${brandLinkId}`)
      } else {
        console.warn(`[solid-callback] Brand link not found: ${linkId}`)
      }
    }

    // Create or update user
    await ensureUsersTable()
    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [finalEmail])

    let user, created = false, randomPassword = null
    const planName = items?.[0]?.planName || 'Free'

    // Handle credits
    let creditsGranted = items?.[0]?.credits || 0
    if (typeof creditsGranted === 'string') {
      if (creditsGranted.toLowerCase() === 'unlimited') {
        creditsGranted = 999999999
      } else {
        creditsGranted = parseInt(creditsGranted, 10) || 0
      }
    }

    const brandId = brand?.id || null

    if (existingUserResult.rows.length === 0) {
      // Create new user (brand_id is tracked in orders table, not users table)
      randomPassword = generateRandomPassword()
      const hashedPassword = await bcrypt.hash(randomPassword, 10)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, plan, credits_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [finalEmail, hashedPassword, finalPaymentDetails.firstName || null, finalPaymentDetails.lastName || null, planName, creditsGranted]
      )
      user = result.rows[0]
      created = true
      console.log(`[ngenius-recovery] Created user ${user.email} with plan=${planName}, credits=${creditsGranted}`)
    } else {
      // Update existing user
      user = existingUserResult.rows[0]
      const updatedResult = await pool.query(
        `UPDATE users SET plan = $1, credits_balance = COALESCE(credits_balance, 0) + $2, first_name = COALESCE(NULLIF($3, ''), first_name), last_name = COALESCE(NULLIF($4, ''), last_name)
        WHERE id = $5 RETURNING *`,
        [planName, creditsGranted, finalPaymentDetails.firstName || null, finalPaymentDetails.lastName || null, user.id]
      )
      user = updatedResult.rows[0]
      console.log(`[ngenius-recovery] Updated user ${user.email} with plan=${planName}, added credits=${creditsGranted}`)
    }

    // Calculate commission
    let commissionAmount = 0
    let commissionRatePercent = null
    if (brand && brand.commission_rate) {
      const commissionRate = parseFloat(brand.commission_rate)
      commissionRatePercent = commissionRate * 100
      commissionAmount = finalAmountUSD * commissionRate
    }

    // Check if order already exists
    const existingOrderCheck = await pool.query(
      'SELECT * FROM orders WHERE ngenius_order_reference = $1',
      [orderReference]
    )

    if (existingOrderCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Order already exists for this N-Genius reference',
        orderId: existingOrderCheck.rows[0].order_id
      })
    }

    // Create order
    const orderId = `order_${Date.now()}_${user.id}`
    const paymentMessage = `Payment ${verificationResult.state} - Recovered by Admin`
    await ensureOrdersTable()
    await pool.query(
      `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, vpn_detected, vpn_geo, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway, ngenius_order_reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [orderId, user.id, user.email, JSON.stringify(items || []), Number(finalTotalAmount || 0), 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, finalPaymentDetails.firstName, finalPaymentDetails.lastName, finalPaymentDetails.cardholderName, finalPaymentDetails.phone, false, null, paymentMessage, finalCurrency, finalAmountUSD, finalPaymentDetails.country, 'card', 'ngenius', orderReference]
    )

    console.log(`[ngenius-recovery] Created order ${orderId}`)

    // Increment transactions count for the link
    if (brandLinkId) {
      await pool.query('UPDATE brand_links SET transactions_count = COALESCE(transactions_count, 0) + 1 WHERE id = $1', [brandLinkId])
    }

    
    // Track direct purchase link transactions
    if (linkId) {
      try {
        await ensureDirectPurchaseLinksTable()
        const directLinkResult = await pool.query('SELECT id FROM direct_purchase_links WHERE link_id = $1 AND is_active = true', [linkId])
        if (directLinkResult.rows.length > 0) {
          await pool.query('UPDATE direct_purchase_links SET transactions_count = COALESCE(transactions_count, 0) + 1, updated_at = NOW() WHERE id = $1', [directLinkResult.rows[0].id])
          console.log(`[ngenius-recovery] Incremented transactions_count for direct purchase link ${directLinkResult.rows[0].id}`)
        }
      } catch (err) {
        console.warn('[ngenius-recovery] Failed to increment direct purchase link transactions:', err.message)
      }
    }
    
    // Send welcome email if user was just created
    if (created && randomPassword) {
      try {
        await sendWelcomeEmail(user.email, randomPassword)
        console.log(`[ngenius-recovery] Welcome email sent to ${user.email}`)
      } catch (err) {
        console.error(`[ngenius-recovery] Failed to send welcome email:`, err.message)
      }
    }

    // Log success
    await logToAdmin({
      level: 'INFO',
      category: 'NGENIUS',
      action: 'TRANSACTION_RECOVERED',
      message: 'Successfully recovered failed N-Genius transaction',
      details: {
        merchantTransactionId,
        orderReference,
        orderId,
        email: user.email,
        amount: finalAmountUSD,
        currency: finalCurrency,
        planName,
        creditsGranted,
        userCreated: created,
        recoveredBy: req.auth?.email
      },
      userEmail: user.email,
      requestId
    })

    res.json({
      success: true,
      orderId,
      userId: user.id,
      userEmail: user.email,
      userCreated: created,
      creditsGranted,
      message: 'Transaction recovered successfully'
    })

  } catch (err) {
    console.error('[ngenius-recovery] Error:', err)

    await logToAdmin({
      level: 'ERROR',
      category: 'NGENIUS',
      action: 'RECOVERY_ERROR',
      message: `Failed to recover N-Genius transaction: ${err.message}`,
      details: {
        error: err.message,
        stack: err.stack,
        orderReference: req.body?.orderReference
      },
      requestId
    })

    res.status(500).json({ error: err.message })
  }
})

// Bulk recover all pending N-Genius transactions
app.post('/api/admin/ngenius/bulk-recover-pending', requireAuth, requireAdmin, async (req, res) => {
  const requestId = `bulk_recovery_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const recoveredOrders = []
  const failedOrders = []
  const alreadyProcessed = []

  try {
    console.log('[bulk-recovery] Starting bulk recovery of pending N-Genius orders')

    // Find all pending orders with ngenius_order_reference
    await ensureOrdersTable()
    const pendingOrdersResult = await pool.query(
      `SELECT * FROM orders 
       WHERE payment_gateway = 'ngenius' 
       AND payment_status = 'pending' 
       AND ngenius_order_reference IS NOT NULL 
       ORDER BY created_at DESC
       LIMIT 100`
    )

    console.log(`[bulk-recovery] Found ${pendingOrdersResult.rows.length} pending N-Genius orders`)

    if (pendingOrdersResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No pending N-Genius orders found',
        recovered: 0,
        failed: 0,
        alreadyProcessed: 0
      })
    }

    // Check each order with N-Genius API
    for (const order of pendingOrdersResult.rows) {
      try {
        console.log(`[bulk-recovery] Checking order ${order.order_id}, ref: ${order.ngenius_order_reference}`)

        // Verify payment status with N-Genius
        const verificationResult = await ngeniusPayment.verifyPayment(order.ngenius_order_reference)

        console.log(`[bulk-recovery] Order ${order.order_id} status: ${verificationResult.state}`)

        // Check if payment was successful
        const successfulStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED']
        if (verificationResult.success && successfulStates.includes(verificationResult.state)) {
          console.log(`[bulk-recovery] ✅ Order ${order.order_id} is SUCCESSFUL, updating status`)

          // Update order status to unpaid (customer paid, commission pending)
          await pool.query(
            `UPDATE orders 
             SET payment_status = 'unpaid', 
                 payment_message = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [`Payment ${verificationResult.state} - Recovered from pending`, order.id]
          )

          // If user doesn't have credits yet, grant them
          if (order.user_id && order.items) {
            try {
              const items = JSON.parse(order.items)
              let creditsGranted = items?.[0]?.credits || 0
              if (typeof creditsGranted === 'string') {
                if (creditsGranted.toLowerCase() === 'unlimited') {
                  creditsGranted = 999999999
                } else {
                  creditsGranted = parseInt(creditsGranted, 10) || 0
                }
              }

              if (creditsGranted > 0) {
                const planName = items?.[0]?.planName || 'Free'
                await pool.query(
                  `UPDATE users 
                   SET plan = $1, 
                       credits_balance = COALESCE(credits_balance, 0) + $2
                   WHERE id = $3`,
                  [planName, creditsGranted, order.user_id]
                )
                console.log(`[bulk-recovery] Granted ${creditsGranted} credits to user ${order.user_id}`)
              }
            } catch (creditErr) {
              console.warn(`[bulk-recovery] Failed to grant credits for order ${order.order_id}:`, creditErr.message)
            }
          }

          recoveredOrders.push({
            orderId: order.order_id,
            email: order.email,
            amount: order.amount_usd,
            reference: order.ngenius_order_reference,
            state: verificationResult.state
          })
        } else if (verificationResult.state === 'FAILED' || verificationResult.state === 'DECLINED') {
          console.log(`[bulk-recovery] ❌ Order ${order.order_id} FAILED, updating status`)

          // Update order status to failed
          await pool.query(
            `UPDATE orders 
             SET payment_status = 'failed', 
                 payment_message = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [verificationResult.failureReason || 'Payment declined', order.id]
          )

          failedOrders.push({
            orderId: order.order_id,
            email: order.email,
            reference: order.ngenius_order_reference,
            reason: verificationResult.failureReason
          })
        } else {
          console.log(`[bulk-recovery] ⏳ Order ${order.order_id} still pending (state: ${verificationResult.state})`)
          alreadyProcessed.push({
            orderId: order.order_id,
            email: order.email,
            reference: order.ngenius_order_reference,
            state: verificationResult.state
          })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (orderErr) {
        console.error(`[bulk-recovery] Error processing order ${order.order_id}:`, orderErr.message)
        failedOrders.push({
          orderId: order.order_id,
          email: order.email,
          reference: order.ngenius_order_reference,
          error: orderErr.message
        })
      }
    }

    // Log summary
    await logToAdmin({
      level: 'INFO',
      category: 'NGENIUS',
      action: 'BULK_RECOVERY_COMPLETED',
      message: `Bulk recovery completed: ${recoveredOrders.length} recovered, ${failedOrders.length} failed`,
      details: {
        totalProcessed: pendingOrdersResult.rows.length,
        recovered: recoveredOrders.length,
        failed: failedOrders.length,
        stillPending: alreadyProcessed.length,
        recoveredBy: req.auth?.email
      },
      requestId
    })

    console.log('[bulk-recovery] Bulk recovery completed')
    console.log(`[bulk-recovery] Recovered: ${recoveredOrders.length}, Failed: ${failedOrders.length}, Still pending: ${alreadyProcessed.length}`)

    res.json({
      success: true,
      message: 'Bulk recovery completed',
      summary: {
        totalProcessed: pendingOrdersResult.rows.length,
        recovered: recoveredOrders.length,
        failed: failedOrders.length,
        stillPending: alreadyProcessed.length
      },
      recoveredOrders,
      failedOrders,
      stillPending: alreadyProcessed
    })

  } catch (err) {
    console.error('[bulk-recovery] Error:', err)

    await logToAdmin({
      level: 'ERROR',
      category: 'NGENIUS',
      action: 'BULK_RECOVERY_ERROR',
      message: `Bulk recovery failed: ${err.message}`,
      details: {
        error: err.message,
        stack: err.stack,
        recoveredSoFar: recoveredOrders.length
      },
      requestId
    })

    res.status(500).json({ error: String(err?.message || err) })
  }
})

// N-Genius 3DS return endpoint - handles POST from ACS after 3DS authentication
app.post('/api/checkout/ngenius-3ds-return', async (req, res) => {
  const clientIp = getRequestIp(req)
  const requestId = `ngenius_3ds_return_${Date.now()}_${Math.random().toString(36).substring(7)}`

  try {
    const { PaRes, MD } = req.body

    console.log('[ngenius-3ds-return] Processing 3DS return:', { hasPaRes: !!PaRes, MD })

    // MD contains the merchantTransactionId we sent
    const merchantTransactionId = MD

    console.log('[ngenius-3ds-return] MerchantTransactionId from MD:', merchantTransactionId)

    if (!merchantTransactionId) {
      console.error('[ngenius-3ds-return] Missing merchantTransactionId')
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=missing_transaction_id`)
    }

    // Retrieve order data from pending checkouts
    if (!global.pendingCheckouts) {
      console.error('[ngenius-3ds-return] No pending checkouts found')
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=session_expired`)
    }

    const orderData = global.pendingCheckouts.get(merchantTransactionId)
    if (!orderData) {
      console.error('[ngenius-3ds-return] Order data not found for:', merchantTransactionId)
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=session_not_found`)
    }

    const { items, paymentDetails, brandSlug, linkId, originalCurrency, totalAmount } = orderData
    const orderRef = orderData.orderReference

    if (!orderRef) {
      console.error('[ngenius-3ds-return] No order reference available')
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=missing_order_reference`)
    }

    // Verify payment status with N-Genius
    console.log('[ngenius-3ds-return] Verifying payment status for order:', orderRef)
    const verificationResult = await ngeniusPayment.verifyPayment(orderRef)

    console.log('[ngenius-3ds-return] Verification result:', {
      success: verificationResult.success,
      state: verificationResult.state
    })

    if (!verificationResult.success) {
      await logToAdmin({
        level: 'WARN',
        category: 'NGENIUS',
        action: '3DS_VERIFICATION_FAILED',
        message: 'N-Genius 3DS verification failed',
        details: {
          merchantTransactionId,
          orderReference: orderRef,
          state: verificationResult.state,
          email: paymentDetails.email
        },
        userEmail: paymentDetails.email,
        requestId
      })

      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=verification_failed`)
    }

    // Payment verified successfully - create user and order
    const email = paymentDetails.email
    const firstName = paymentDetails.firstName || ''
    const lastName = paymentDetails.lastName || ''
    const cardHolderName = paymentDetails.cardholderName || ''
    const phone = paymentDetails.phone || ''
    const billingCountry = paymentDetails.country || ''

    // Get package and credits info
    const packageItem = items.find(i => i.type === 'package')
    const creditsItem = items.find(i => i.type === 'credits')
    const planName = packageItem?.name?.toLowerCase() || 'starter'

    // Handle credits - convert "unlimited" to a large number or keep as integer
    let creditsGranted = creditsItem?.credits || 0
    if (typeof creditsGranted === 'string') {
      if (creditsGranted.toLowerCase() === 'unlimited') {
        creditsGranted = 999999999 // Use a very large number for unlimited
      } else {
        creditsGranted = parseInt(creditsGranted, 10) || 0
      }
    }

    // Check VPN and geo
    let vpnDetected = false
    let vpnGeo = 'UNKNOWN'
    try {
      const vpnCheck = await checkVpnAndGeo(clientIp)
      vpnDetected = vpnCheck.vpnDetected
      vpnGeo = vpnCheck.vpnGeo
    } catch (err) {
      console.warn('[ngenius-3ds-return] VPN check failed:', err.message)
    }

    // Look up brand
    let brand = null
    let brandLinkId = null
    if (brandSlug) {
      try {
        await ensureBrandsTable()
        const brandRes = await pool.query('SELECT * FROM brands WHERE slug = $1', [brandSlug])
        if (brandRes.rows.length > 0) {
          brand = brandRes.rows[0]
        }
      } catch (err) {
        console.warn('[ngenius-3ds-return] Brand lookup failed:', err.message)
      }
    }

    // Look up brand link
    if (linkId) {
      try {
        await ensureBrandLinksTable()
        // linkId is the string identifier (e.g., 'mSrcAQfv'), not the numeric ID
        const linkRes = await pool.query('SELECT * FROM brand_links WHERE link_id = $1', [linkId])
        if (linkRes.rows.length > 0 && linkRes.rows[0].brand_id === brand?.id) {
          brandLinkId = linkRes.rows[0].id // Use the numeric ID, not the string identifier
          console.log(`[ngenius-3ds-return] Found brand link: ${linkId} -> DB ID: ${brandLinkId}`)
        } else if (linkRes.rows.length > 0) {
          console.warn(`[ngenius-3ds-return] Brand link ${linkId} exists but doesn't match brand ${brand?.id}`)
        } else {
          console.warn(`[ngenius-3ds-return] Brand link not found: ${linkId}`)
        }
      } catch (err) {
        console.warn('[ngenius-3ds-return] Brand link lookup failed:', err.message)
      }
    }

    // Create or update user
    await ensureUsersTable()
    let user = null
    let created = false
    let randomPassword = ''

    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    if (existingUserResult.rows.length === 0) {
      // Create new user
      randomPassword = Math.random().toString(36).slice(-10)
      const hashedPassword = await bcrypt.hash(randomPassword, 10)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, plan, credits_balance, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [email, hashedPassword, planName, creditsGranted, firstName, lastName]
      )
      user = result.rows[0]
      created = true
      console.log(`[ngenius-3ds-return] Created user ${user.email} with plan=${planName}, credits=${creditsGranted}`)
    } else {
      // Update existing user
      user = existingUserResult.rows[0]
      const updatedResult = await pool.query(
        `UPDATE users SET plan = $1, credits_balance = COALESCE(credits_balance, 0) + $2, first_name = COALESCE(NULLIF($3, ''), first_name), last_name = COALESCE(NULLIF($4, ''), last_name)
         WHERE id = $5 RETURNING *`,
        [planName, creditsGranted || 0, firstName, lastName, user.id]
      )
      user = updatedResult.rows[0]
      console.log(`[ngenius-3ds-return] Updated user ${user.email} with plan=${planName}, added credits=${creditsGranted}`)
    }

    // Calculate commission
    let commissionAmount = 0
    let commissionRatePercent = null
    let brandId = null
    if (brand) {
      brandId = brand.id
      let commissionRate = Number(brand.commission_rate || 10) / 100
      commissionRatePercent = commissionRate * 100
      commissionAmount = amountInUSD * commissionRate
      console.log(`[ngenius-3ds-return] Brand ${brandId} commission: ${commissionAmount} (${commissionRatePercent}% of ${amountInUSD})`)
    }

    // Create order
    const orderId = `order_${Date.now()}_${user.id}`
    const paymentMessage = 'Payment CAPTURED - 3DS verified'

    await ensureOrdersTable()
    await pool.query(
      `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, user_ip, vpn_detected, vpn_geo, card_bin, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway, ngenius_order_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
      [orderId, user.id, user.email, JSON.stringify(items || []), Number(totalAmount || 0), 'unpaid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, cardHolderName, phone, clientIp, vpnDetected, vpnGeo, null, paymentMessage, originalCurrency, amountInUSD, billingCountry, 'card', 'ngenius', orderRef]
    )
    console.log(`[ngenius-3ds-return] Created order ${orderId} with status=unpaid, gateway=ngenius, brand_id=${brandId}, link_id=${brandLinkId}, ngenius_ref=${orderRef}`)

    // Increment transactions count for the link
    if (brandLinkId) {
      try {
        await pool.query('UPDATE brand_links SET transactions_count = COALESCE(transactions_count, 0) + 1 WHERE id = $1', [brandLinkId])
        console.log(`[ngenius-3ds-return] Incremented transactions_count for link ${brandLinkId}`)
      } catch (err) {
        console.warn('[ngenius-3ds-return] Failed to increment link transactions:', err.message)
      }
    }

    // Send welcome email
    if (created && randomPassword) {
      try {
        await sendWelcomeEmail(user.email, randomPassword)
        console.log(`[ngenius-3ds-return] Welcome email sent to ${user.email}`)
      } catch (err) {
        console.error(`[ngenius-3ds-return] Failed to send welcome email to ${user.email}:`, err.message)
      }
    }

    // Log success
    await logToAdmin({
      level: 'INFO',
      category: 'NGENIUS',
      action: 'PAYMENT_SUCCESS_3DS',
      message: 'N-Genius payment completed successfully after 3DS',
      details: {
        merchantTransactionId,
        orderReference: orderRef,
        orderId,
        userId: user.id,
        email: user.email,
        plan: planName,
        credits: creditsGranted,
        amount: amountInUSD,
        currency: originalCurrency,
        brandId,
        linkId: brandLinkId
      },
      userEmail: user.email,
      ipAddress: clientIp,
      requestId
    })

    // Clear pending checkout
    global.pendingCheckouts.delete(merchantTransactionId)

    // Redirect to success page
    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-success?orderId=${orderId}`
    console.log(`[ngenius-3ds-return] Redirecting to success page: ${successUrl}`)
    return res.redirect(successUrl)

  } catch (err) {
    console.error('[ngenius-3ds-return] Error:', err)

    await logToAdmin({
      level: 'ERROR',
      category: 'NGENIUS',
      action: '3DS_CALLBACK_ERROR',
      message: 'N-Genius 3DS callback error',
      details: {
        error: err.message,
        stack: err.stack,
        merchantTransactionId: req.query?.merchantTransactionId
      },
      userEmail: req.query?.email,
      requestId
    })

    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-failed?error=callback_error`)
  }
})

// Public checkout for new users: simulate payment, create user, set plan + credits, email credentials
app.post('/api/checkout/guest', async (req, res) => {
  try {
    const { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency } = req.body || {}
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'cart_empty' })
    }
    if (!paymentDetails || !paymentDetails.email) {
      return res.status(400).json({ error: 'email_required' })
    }

    // Validate package + credits combo
    const hasPackage = items.some(i => i?.type === 'package')
    const hasCredits = items.some(i => i?.type === 'credits')
    if (!hasPackage || !hasCredits) {
      return res.status(400).json({ error: 'package_and_credits_required', message: 'Plan package and credits are required' })
    }

    // Convert to USD for consistent storage
    let amountInUSD = Number(totalAmount || 0)
    const originalCurrency = currency || 'USD'

    // If currency is not USD, convert using exchange rate
    if (originalCurrency !== 'USD') {
      try {
        await ensureCurrenciesTable()
        const currencyResult = await pool.query('SELECT exchange_rate FROM currencies WHERE code = $1 AND active = true', [originalCurrency])
        if (currencyResult.rows.length > 0) {
          const exchangeRate = Number(currencyResult.rows[0].exchange_rate || 1)
          // Exchange rate represents: 1 USD = X units of foreign currency
          // So to convert from foreign currency to USD, we DIVIDE
          amountInUSD = amountInUSD / exchangeRate
          amountInUSD = Math.ceil(amountInUSD) // Round up to whole number (no decimals)
          console.log(`[currency-conversion] ${totalAmount} ${originalCurrency} ÷ ${exchangeRate} = ${amountInUSD} USD`)
        }
      } catch (err) {
        console.warn('[checkout/guest] Currency conversion failed, using original amount:', err.message)
      }
    }

    // Get user IP and check VPN/GEO
    const userIp = getRequestIp(req)
    const { vpnDetected, vpnGeo } = await checkVpnAndGeo(userIp)

    // Look up brand link if linkId provided
    let brand = null
    let brandLinkId = null
    if (linkId) {
      await ensureBrandLinksTable()
      const linkResult = await pool.query('SELECT id, brand_id FROM brand_links WHERE link_id = $1 AND is_active = true', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE id = $1 AND status = $2', [linkResult.rows[0].brand_id, 'active'])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      }
    }

    // Fallback: Look up brand by slug if provided and no link found
    const slug = brandSlug || referralCode
    if (!brand && slug) {
      await ensureBrandsTable()
      const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE slug = $1 AND status = $2', [String(slug).trim().toLowerCase(), 'active'])
      if (brandResult.rows.length > 0) {
        brand = brandResult.rows[0]
      }
    }

    const packageItem = items.find(i => i?.type === 'package')
    const planRaw = String(packageItem?.id || 'starter').toLowerCase()
    const planName = planRaw === 'professional' ? 'pro' : (planRaw === 'expert' ? 'expert' : 'starter')

    // Sum credits
    let creditsToAdd = 0
    let creditsUnlimited = false
    for (const it of items) {
      if (it?.type === 'credits') {
        if (it?.unlimited || String(it?.id || '').toLowerCase().includes('unlimited') || String(it?.credits).toLowerCase() === 'unlimited') {
          creditsUnlimited = true
        } else if (typeof it?.credits === 'number') {
          const qty = Number(it?.quantity || 1)
          creditsToAdd += Math.max(0, Math.floor(it.credits * (Number.isFinite(qty) ? qty : 1)))
        }
      }
    }

    await ensureUsersTable()
    const email = String(paymentDetails.email).trim().toLowerCase()
    const full_name = [paymentDetails.firstName, paymentDetails.lastName].filter(Boolean).join(' ') || null
    const existing = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE email = $1', [email])
    let user
    let created = false
    let randomPassword
    if (existing.rows.length > 0) {
      user = existing.rows[0]
      // Update plan and credits
      const newUnlimited = Boolean(user.credits_unlimited) || creditsUnlimited
      const newBalance = newUnlimited ? user.credits_balance : Number(user.credits_balance || 0) + Number(creditsToAdd || 0)
      await pool.query(
        'UPDATE users SET plan = $1, full_name = COALESCE($2, full_name), credits_balance = $3, credits_unlimited = $4 WHERE id = $5',
        [planName, full_name, newBalance, newUnlimited, user.id]
      )
      const r = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [user.id])
      user = r.rows[0]
    } else {
      // Create user with random password
      created = true
      randomPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
      const password_hash = bcrypt.hashSync(randomPassword, 10)
      const insert = await pool.query(
        `INSERT INTO users (email, full_name, user_type, password_hash, plan, credits_balance, credits_unlimited)
         VALUES ($1, $2, 'normal', $3, $4, $5, $6)
         RETURNING id, email, full_name, user_type, plan, credits_balance, credits_unlimited, created_at`,
        [email, full_name, password_hash, planName, creditsUnlimited ? 0 : Math.max(0, Number(creditsToAdd || 0)), creditsUnlimited]
      )
      user = insert.rows[0]

      // Send email with credentials
      if (SENDGRID_API_KEY) {
        try {
          const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#f59e0b,#f97316);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">📈</span>
                OpenSightAI
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Welcome to OpenSightAI</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your account has been created after purchasing the <strong>${planName}</strong> plan.</p>
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#f59e0b;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Email:</strong> ${user.email}</div>
                  <div><strong>Password:</strong> ${randomPassword}</div>
                  <div style="margin-top:8px;color:#94a3b8;">Please change your password after first login.</div>
                </div>
              </div>
              <div style="font-size:14px;color:#0f172a;margin:8px 0;">Credits: ${user.credits_unlimited ? 'Unlimited' : Number(user.credits_balance || 0)}</div>
              <a href="https://OpenSightai.com" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Go to OpenSightAI</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025</div>
          </div>
        </div>`
          await sgMail.send({ to: user.email, from: EMAIL_FROM, subject: 'Your OpenSightAI account', html })
          console.log(`[email] Sent account email to ${user.email}`)
        } catch (e) {
          const details = e?.response?.body || e
          console.error('[email] Failed to send account email:', details)
        }
      } else {
        console.warn('[email] Skipping email send because SENDGRID_API_KEY is not set')
      }
    }

    // Persist order details for guest checkout
    let createdOrderIdGuest
    try {
      await ensureOrdersTable()
      const orderId = `order_${Date.now()}_${user.id}`

      // Calculate commission if brand referral
      let commissionAmount = 0
      let commissionRatePercent = null
      let brandId = null
      if (brand) {
        brandId = brand.id
        // Use the brand's OWN commission rate, not parent's
        let commissionRate = Number(brand.commission_rate || 10) / 100

        // Store commission rate as percentage for historical record
        commissionRatePercent = commissionRate * 100

        // Calculate commission based on USD amount
        commissionAmount = amountInUSD * commissionRate

        console.log(`[commission] Guest checkout - Brand ${brandId} commission: ${commissionAmount} (${commissionRatePercent}% of ${amountInUSD})`)
      }

      // Extract payment details
      const firstName = paymentDetails.firstName || null
      const lastName = paymentDetails.lastName || null
      const cardHolderName = paymentDetails.cardHolderName || null
      const phone = paymentDetails.phone || null
      const billingCountry = paymentDetails.country || null
      const cardNumber = (paymentDetails.cardNumber || '').replace(/\s/g, '')
      const cardBin = cardNumber.length >= 6 ? cardNumber.substring(0, 6) : null
      const paymentMessage = 'Transaction completed successfully'

      // Log currency amounts for debugging
      console.log('[checkout/guest] Storing order amounts:', {
        originalCurrency: originalCurrency,
        totalAmount: totalAmount,
        amountInUSD: amountInUSD
      })

      await pool.query(
        `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, user_ip, vpn_detected, vpn_geo, card_bin, payment_message, currency, amount_usd, billing_country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [orderId, user.id, user.email || email, JSON.stringify(items || []), Number(totalAmount || 0), 'paid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, cardHolderName, phone, userIp, vpnDetected, vpnGeo, cardBin, paymentMessage, originalCurrency, amountInUSD, billingCountry]
      )
      createdOrderIdGuest = orderId
      console.log(`[order] Created order ${orderId} with brand_id=${brandId}, link_id=${brandLinkId}, commission=${commissionAmount}`)

      // Increment transactions count for the link
      if (brandLinkId) {
        await pool.query('UPDATE brand_links SET transactions_count = transactions_count + 1 WHERE id = $1', [brandLinkId])
      }
    } catch (e) {
      console.warn('[orders] guest checkout persist failed:', e?.message || e)
    }

    res.json({ success: true, created, user: mapDbUserToClient(user), totalAmount: Number(totalAmount || 0), orderId: createdOrderIdGuest })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Bot Payment API Proxy Endpoint
// This endpoint proxies requests to the bot API exactly as test.py does
app.post('/api/checkout/bot-payment', async (req, res) => {
  const requestId = `bot_payment_${Date.now()}_${Math.random().toString(36).substring(7)}`
  
  try {
    // Get the payload directly from request body - no transformations
    const payload = req.body || {}

    // Validate required fields
    if (!payload.amount || !payload.email || !payload.card_number || !payload.expiry || !payload.cvc) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log('[bot-payment] Calling bot API with payload:', { ...payload, card_number: '***' })

    // Call bot API exactly as test.py does: POST with json payload, 120s timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120 second timeout

    try {
      const response = await fetch('https://bot.OpenSightai.com/fill-payment-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Get response data
      let responseData
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        const text = await response.text()
        try {
          responseData = JSON.parse(text)
        } catch {
          responseData = { error: text }
        }
      }

      console.log('[bot-payment] Bot API response:', {
        status: response.status,
        data: responseData
      })

      // Handle screenshot_file if present - upload to Cloudinary
      // Following exact logic from test.py
      let screenshotUrl = null
      if (responseData.screenshot_file && typeof responseData.screenshot_file === 'string' && responseData.screenshot_file) {
        try {
          let b64 = responseData.screenshot_file
          
          // Handle data URL format (data:image/png;base64,...) - exactly as test.py
          if (b64.startsWith('data:')) {
            const comma = b64.indexOf(',')
            if (comma !== -1) {
              b64 = b64.substring(comma + 1)
            }
          }
          
          // Strip whitespace - exactly as test.py
          b64 = b64.trim()
          
          // Convert to data URL for Cloudinary upload
          const dataUrl = `data:image/png;base64,${b64}`
          
          // Upload to Cloudinary
          if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
            const uploadResult = await cloudinary.uploader.upload(dataUrl, {
              folder: 'OpenSight/bot-payments',
              overwrite: false,
              resource_type: 'image',
              context: {
                alt: `Payment screenshot for ${payload.email || 'unknown'}`,
                caption: `Email: ${payload.email || 'unknown'}`
              },
              tags: [`email-${payload.email?.replace(/[^a-zA-Z0-9]/g, '-') || 'unknown'}`]
            })
            screenshotUrl = uploadResult.secure_url
            console.log('[bot-payment] Screenshot uploaded to Cloudinary:', screenshotUrl, 'with email:', payload.email)
          } else {
            console.warn('[bot-payment] Cloudinary not configured, skipping screenshot upload')
          }
        } catch (screenshotError) {
          console.error('[bot-payment] Failed to upload screenshot to Cloudinary:', screenshotError)
          // Continue without screenshot - don't fail the request
        }
      }

      // Return response with screenshot URL if uploaded
      const responseToSend = {
        status: response.status,
        success: response.status === 200 && responseData.success === true,
        ...responseData
      }
      
      if (screenshotUrl) {
        responseToSend.screenshot_url = screenshotUrl
      }

      res.status(response.status).json(responseToSend)
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('[bot-payment] Bot API error:', error)
      
      if (error.name === 'AbortError') {
        res.status(408).json({ error: 'Request timeout', success: false })
      } else {
        res.status(500).json({ error: error.message || 'Payment processing failed', success: false })
      }
    }
  } catch (err) {
    console.error('[bot-payment] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Bot Payment Order Creation Endpoint
app.post('/api/checkout/bot-payment-order', async (req, res) => {
  const requestId = `bot_payment_order_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)

  try {
    const { items, totalAmount, amountUSD, email, paymentDetails, paymentStatus, paymentMessage, brandSlug, linkId, currency, screenshot_url, botResponse } = req.body || {}

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'cart_empty' })
    }
    if (!email) {
      return res.status(400).json({ error: 'email_required' })
    }
    if (!paymentStatus) {
      return res.status(400).json({ error: 'payment_status_required' })
    }

    // Convert to USD if not provided
    let amountInUSD = Number(amountUSD || totalAmount || 0)
    const originalCurrency = currency || 'USD'

    // If currency is not USD, convert using exchange rate
    if (originalCurrency !== 'USD' && !amountUSD) {
      try {
        await ensureCurrenciesTable()
        const currencyResult = await pool.query('SELECT exchange_rate FROM currencies WHERE code = $1 AND active = true', [originalCurrency])
        if (currencyResult.rows.length > 0) {
          const exchangeRate = Number(currencyResult.rows[0].exchange_rate || 1)
          amountInUSD = Number(totalAmount || 0) / exchangeRate
          amountInUSD = Math.ceil(amountInUSD)
        }
      } catch (err) {
        console.warn('[bot-payment-order] Currency conversion failed:', err.message)
      }
    }

    // Get user IP and check VPN/GEO
    const userIp = clientIp
    const { vpnDetected, vpnGeo } = await checkVpnAndGeo(userIp)

    // Look up brand link if linkId provided
    let brand = null
    let brandLinkId = null
    if (linkId) {
      await ensureBrandLinksTable()
      const linkResult = await pool.query('SELECT id, brand_id FROM brand_links WHERE link_id = $1 AND is_active = true', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE id = $1 AND status = $2', [linkResult.rows[0].brand_id, 'active'])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      }
    }

    // Fallback: Look up brand by slug if provided and no link found
    if (!brand && brandSlug) {
      await ensureBrandsTable()
      const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE slug = $1 AND status = $2', [String(brandSlug).trim().toLowerCase(), 'active'])
      if (brandResult.rows.length > 0) {
        brand = brandResult.rows[0]
      }
    }

    // Calculate commission if brand referral
    let commissionAmount = 0
    let commissionRatePercent = null
    let brandId = null
    if (brand) {
      brandId = brand.id
      let commissionRate = Number(brand.commission_rate || 10) / 100
      commissionRatePercent = commissionRate * 100
      commissionAmount = amountInUSD * commissionRate
    }

    // Extract payment details
    const firstName = paymentDetails?.firstName || null
    const lastName = paymentDetails?.lastName || null
    const cardHolderName = paymentDetails?.cardHolderName || null
    const phone = paymentDetails?.phone || null
    const billingCountry = paymentDetails?.country || null
    const cardNumber = (paymentDetails?.cardNumber || '').replace(/\s/g, '')
    const cardBin = cardNumber.length >= 6 ? cardNumber.substring(0, 6) : null

    // Determine commission status based on payment status
    let commissionStatus = 'pending'
    if (paymentStatus === 'unpaid') {
      commissionStatus = 'unpaid'
    } else if (paymentStatus === 'declined' || paymentStatus === 'failed') {
      commissionStatus = 'cancelled'
    }

    await ensureOrdersTable()
    await ensureBotPaymentsTable()
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Create order
    await pool.query(
      `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, user_ip, vpn_detected, vpn_geo, card_bin, payment_message, currency, amount_usd, billing_country, payment_method, payment_gateway)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [orderId, null, String(email).trim().toLowerCase(), JSON.stringify(items || []), Number(totalAmount || 0), paymentStatus, brandId, commissionAmount, commissionStatus, commissionRatePercent, brandLinkId, firstName, lastName, cardHolderName, phone, userIp, vpnDetected, vpnGeo, cardBin, paymentMessage || null, originalCurrency, amountInUSD, billingCountry, 'credit_card', 'bot']
    )

    console.log(`[bot-payment-order] Created order ${orderId} with status=${paymentStatus}, brand_id=${brandId}, link_id=${brandLinkId}, commission=${commissionAmount}`)

    // Create or update bot_payments record with screenshot
    try {
      await pool.query(`
        INSERT INTO bot_payments (
          order_id,
          email,
          amount,
          currency,
          status,
          items,
          payment_details,
          brand_slug,
          link_id,
          bot_response,
          screenshot_url,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (order_id) DO UPDATE SET
          status = EXCLUDED.status,
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, bot_payments.screenshot_url),
          bot_response = EXCLUDED.bot_response,
          updated_at = NOW()
      `, [
        orderId,
        String(email).trim().toLowerCase(),
        Number(totalAmount || 0),
        originalCurrency,
        paymentStatus,
        JSON.stringify(items || []),
        JSON.stringify(paymentDetails || {}),
        brandSlug || null,
        linkId || null,
        JSON.stringify(botResponse || {}),
        screenshot_url || null
      ])
      console.log(`[bot-payment-order] Created/updated bot_payments record for ${orderId} with screenshot_url: ${screenshot_url || 'none'}`)
      
      // Create bot log entry if screenshot exists
      if (screenshot_url) {
        try {
          const { insertBotLog } = await import('./services/botLogs.js')
          const { emitBotLog } = await import('./config/socketio.js')
          
          const logEntry = await insertBotLog(pool, {
            level: paymentStatus === 'unpaid' ? 'INFO' : paymentStatus === 'declined' ? 'ERROR' : 'WARNING',
            category: 'PAYMENT',
            action: 'BOT_PAYMENT_PROCESSED',
            message: `Bot payment ${paymentStatus} for order ${orderId}`,
            details: {
              orderId,
              email,
              amount: totalAmount,
              currency: originalCurrency,
              paymentStatus,
              paymentMessage,
              screenshot_url
            },
            bot_identifier: 'payment-bot',
            screenshot_url
          })
          
          console.log(`[bot-payment-order] Created bot log entry for ${orderId} with screenshot_url: ${screenshot_url}`)
          console.log(`[bot-payment-order] Bot log ID: ${logEntry?.id}, screenshot_url in log: ${logEntry?.screenshot_url}`)
          
          // Emit to socket.io for real-time updates
          if (logEntry) {
            emitBotLog(logEntry)
            console.log(`[bot-payment-order] Emitted bot log via socket.io`)
          }
        } catch (logError) {
          console.warn('[bot-payment-order] Failed to create bot log entry:', logError)
          console.warn('[bot-payment-order] Error details:', logError.message, logError.stack)
          // Don't fail the request if bot log creation fails
        }
      } else {
        console.log(`[bot-payment-order] No screenshot_url provided (${screenshot_url}), skipping bot log creation`)
      }
    } catch (botPaymentError) {
      console.warn('[bot-payment-order] Failed to create bot_payments record:', botPaymentError)
      // Don't fail the request if bot_payments insert fails
    }

    // Increment transactions count for the link
    if (brandLinkId) {
      await pool.query('UPDATE brand_links SET transactions_count = transactions_count + 1 WHERE id = $1', [brandLinkId])
    }

    res.json({ success: true, orderId, paymentStatus, screenshot_url: screenshot_url || null })
  } catch (err) {
    console.error('[bot-payment-order] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

async function bootstrapAdminUser() {
  try {
    await ensureUsersTable()
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminEmail || !adminPassword) return
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail])
    if (existing.rows.length > 0) return
    const password_hash = bcrypt.hashSync(String(adminPassword), 10)
    await pool.query(
      `INSERT INTO users (email, full_name, user_type, password_hash, plan)
       VALUES ($1, $2, 'admin', $3, $4)`,
      [adminEmail, 'Admin', password_hash, 'expert']
    )
    console.log(`[bootstrap] Created admin user ${adminEmail}`)
  } catch (e) {
    console.warn('[bootstrap] Failed to create admin user', e?.message || e)
  }
}

// Auth: register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, full_name, password, plan } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    await ensureUsersTable()
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) return res.status(409).json({ error: 'email already in use' })
    const password_hash = bcrypt.hashSync(String(password), 10)
    function normalizePlan(p) {
      if (!p) return null
      const v = String(p).trim().toLowerCase()
      if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
      if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
      if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
      return v
    }
    const text = `
      INSERT INTO users (email, full_name, user_type, password_hash, plan)
      VALUES ($1, $2, 'normal', $3, $4)
      RETURNING id, email, full_name, user_type, plan, created_at, token_version;
    `
    const values = [email, full_name || null, password_hash, normalizePlan(plan)]
    const result = await pool.query(text, values)
    const user = result.rows[0]
    const token = signJwt(user)
    setAuthCookie(res, token)
    res.json({ user: mapDbUserToClient(user), token })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

/**
 * Solid Payment Webhook Endpoint
 * 
 * WEBHOOK CONFIGURATION FOR PROVIDERS:
 * - URL: POST /api/webhook (or /api/webhooks/{provider-name})
 * - Authentication: Webhook secret used for AES-256-GCM decryption
 * - Encryption: AES-256-GCM with hex-encoded payload
 * - Required Headers: X-Initialization-Vector, X-Authentication-Tag
 * - Payload: Encrypted JSON or {"encryptedBody": "hex_string"}
 * - Events: PAYMENT notifications with result codes
 * - Idempotency: Based on merchantTransactionId lookup
 * 
 * Expected Payload Format:
 * {
 *   "type": "PAYMENT",
 *   "payload": {
 *     "id": "transaction_id",
 *     "merchantTransactionId": "order_xxx",
 *     "result": { "code": "000.000.000", "description": "..." },
 *     "amount": "10.50",
 *     "currency": "USD"
 *   }
 * }
 * 
 * Response: { "acknowledged": true } or 200 OK
 * 
 * For complete webhook requirements, see: docs/PAYMENT_GATEWAY_ONBOARDING.md
 */
// Solid Payment Webhook - Handles encrypted payment notifications
app.post('/api/webhook', express.text({ type: ['text/plain', 'application/json'] }), async (req, res) => {
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)

  await logToAdmin({
    level: 'INFO',
    category: 'WEBHOOK',
    action: 'WEBHOOK_RECEIVED',
    message: 'Solid Payment webhook notification received',
    details: {
      headers: req.headers,
      bodyLength: req.body?.length,
      ip: clientIp
    },
    requestId
  })

  try {
    console.log('[webhook] All headers:', JSON.stringify(req.headers, null, 2))
    console.log('[webhook] Body type:', typeof req.body)
    console.log('[webhook] Body length:', req.body?.length)

    // Handle both string and object body (in case express.json() parsed it first)
    let bodyAsString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    console.log('[webhook] Body preview:', bodyAsString?.substring(0, 100))

    // Check if body is JSON wrapper format: {"encryptedBody": "hex_string"}
    let encryptedBody = bodyAsString
    try {
      const parsedBody = JSON.parse(bodyAsString)
      if (parsedBody.encryptedBody) {
        console.log('[webhook] Detected JSON wrapper format')
        encryptedBody = parsedBody.encryptedBody
      }
    } catch (e) {
      // Not JSON, use raw body (default None format)
      console.log('[webhook] Using raw hex format (None wrapper)')
    }

    // Get encryption headers
    const iv = req.headers['x-initialization-vector']
    const authTag = req.headers['x-authentication-tag']

    console.log('[webhook] IV:', iv)
    console.log('[webhook] Auth Tag:', authTag)
    console.log('[webhook] Has encrypted body:', !!encryptedBody)

    if (!iv || !authTag || !encryptedBody) {
      const errorDetails = {
        hasIv: !!iv,
        hasAuthTag: !!authTag,
        hasBody: !!encryptedBody,
        headers: req.headers,
        bodyType: typeof req.body,
        bodyLength: req.body?.length
      }

      console.error('[webhook] Missing encryption data:', errorDetails)

      await logToAdmin({
        level: 'ERROR',
        category: 'WEBHOOK',
        action: 'DECRYPTION_FAILED',
        message: 'Missing required encryption headers or body',
        details: errorDetails,
        requestId
      })
      return res.status(400).send('Missing encryption data')
    }

    // Decrypt the payload
    let decryptedPayload
    try {
      // Convert hex strings to buffers
      const keyBuffer = Buffer.from(SOLID_PAYMENT_WEBHOOK_SECRET, 'hex')
      const ivBuffer = Buffer.from(iv, 'hex')
      const authTagBuffer = Buffer.from(authTag, 'hex')
      const encryptedBuffer = Buffer.from(encryptedBody, 'hex')

      console.log('[webhook] Key length:', keyBuffer.length, 'bytes')
      console.log('[webhook] IV length:', ivBuffer.length, 'bytes')
      console.log('[webhook] Auth Tag length:', authTagBuffer.length, 'bytes')
      console.log('[webhook] Encrypted data length:', encryptedBuffer.length, 'bytes')

      // Create decipher with AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer)
      decipher.setAuthTag(authTagBuffer)

      // Decrypt
      let decrypted = decipher.update(encryptedBuffer)
      decrypted = Buffer.concat([decrypted, decipher.final()])

      // Convert to string and parse JSON
      const decryptedString = decrypted.toString('utf8')
      console.log('[webhook] Decrypted payload:', decryptedString)

      decryptedPayload = JSON.parse(decryptedString)

      await logToAdmin({
        level: 'INFO',
        category: 'WEBHOOK',
        action: 'DECRYPTION_SUCCESS',
        message: 'Successfully decrypted webhook payload',
        details: { payloadType: decryptedPayload?.type, payloadId: decryptedPayload?.payload?.id },
        requestId
      })
    } catch (decryptError) {
      console.error('[webhook] Decryption error:', decryptError)
      console.error('[webhook] Error details:', {
        message: decryptError.message,
        stack: decryptError.stack,
        webhookSecretLength: SOLID_PAYMENT_WEBHOOK_SECRET?.length,
        ivPresent: !!iv,
        authTagPresent: !!authTag,
        bodyPresent: !!encryptedBody
      })

      await logToAdmin({
        level: 'ERROR',
        category: 'WEBHOOK',
        action: 'DECRYPTION_FAILED',
        message: 'Failed to decrypt webhook payload',
        details: {
          error: decryptError.message,
          stack: decryptError.stack,
          webhookSecretConfigured: !!SOLID_PAYMENT_WEBHOOK_SECRET,
          webhookSecretLength: SOLID_PAYMENT_WEBHOOK_SECRET?.length,
          headers: req.headers,
          bodyLength: encryptedBody?.length
        },
        requestId
      })
      return res.status(400).send('Decryption failed')
    }

    // Process the notification based on type
    const { type, action, payload } = decryptedPayload

    const isApplePayPayment = payload?.paymentBrand === 'APPLEPAY'
    const isPaymentSuccessful = payload?.result?.code && solidPayment.isPaymentSuccessful(payload.result.code)
    const isPaymentFailed = payload?.result?.code && !isPaymentSuccessful && !solidPayment.isPaymentPending(payload.result.code)

    await logToAdmin({
      level: isPaymentFailed ? 'ERROR' : 'INFO',
      category: isApplePayPayment ? 'APPLEPAY' : 'WEBHOOK',
      action: isPaymentFailed ? 'PAYMENT_FAILED' : (isApplePayPayment ? 'APPLEPAY_PAYMENT' : 'NOTIFICATION_RECEIVED'),
      message: isApplePayPayment
        ? `Apple Pay ${isPaymentSuccessful ? 'SUCCESS' : isPaymentFailed ? 'FAILED' : 'PENDING'}`
        : `${type} notification received`,
      details: {
        type,
        action,
        paymentId: payload?.id,
        resultCode: payload?.result?.code,
        resultDescription: payload?.result?.description,
        paymentBrand: payload?.paymentBrand,
        amount: payload?.amount,
        currency: payload?.currency,
        customerEmail: payload?.customer?.email,
        timestamp: payload?.timestamp,
        paymentType: payload?.paymentType,
        isApplePay: isApplePayPayment,
        isSuccess: isPaymentSuccessful,
        isFailed: isPaymentFailed
      },
      userEmail: payload?.customer?.email,
      requestId
    })

    // Handle PAYMENT notifications
    if (type === 'PAYMENT' && payload) {
      const paymentId = payload.id
      const resultCode = payload.result?.code
      const isSuccess = solidPayment.isPaymentSuccessful(resultCode)
      const isPending = solidPayment.isPaymentPending(resultCode)

      console.log('[webhook] Payment Status - Success:', isSuccess, 'Pending:', isPending)

      // Log failed payments separately
      if (isPaymentFailed) {
        await logToAdmin({
          level: 'ERROR',
          category: isApplePayPayment ? 'APPLEPAY' : 'PAYMENT',
          action: 'PAYMENT_FAILED',
          message: `${isApplePayPayment ? 'Apple Pay' : 'Card'} payment failed: ${payload.result.description}`,
          details: {
            paymentId,
            resultCode,
            resultDescription: payload.result.description,
            paymentBrand: payload.paymentBrand,
            amount: payload.amount,
            currency: payload.currency,
            customerEmail: payload.customer?.email,
            timestamp: payload.timestamp,
            parameterErrors: payload.result.parameterErrors
          },
          userEmail: payload.customer?.email,
          requestId
        })
      }

      await ensureOrdersTable()

      const merchantTransactionIdRaw = payload.merchantTransactionId || payload.merchantTransactionID || payload.merchant_id || null
      const paymentBrand = payload.paymentBrand || null
      const customerEmail = payload.customer?.email ? String(payload.customer.email).trim().toLowerCase() : null
      const amountOriginal = Number(payload.amount || payload.presentationAmount || 0)
      const currencyOriginal = payload.currency || payload.presentationCurrency || null

      if (!merchantTransactionIdRaw) {
        console.warn('[webhook] ⚠️ Missing merchantTransactionId in payload; cannot update order', { paymentId })
        await logToAdmin({
          level: 'WARN',
          category: 'WEBHOOK',
          action: 'ORDER_LOOKUP_FAILED',
          message: 'Webhook payload missing merchantTransactionId',
          details: {
            paymentId,
            paymentTransactionId: paymentId,
            merchantTransactionId: merchantTransactionIdRaw,
            paymentBrand,
            customerEmail,
            amount: amountOriginal,
            currency: currencyOriginal,
            resultCode,
            isApplePay: isApplePayPayment,
            fullPayload: payload
          },
          userEmail: customerEmail,
          requestId
        })
        return res.json({ acknowledged: true })
      }

      // Find order by merchant_transaction_id (which includes suffix for applepay/googlepay)
      // This way we know exactly which payment method was used based on which entity ID processed it
      let existingOrderResult = await pool.query(
        `SELECT id, order_id, payment_status, commission_status, payment_method FROM orders WHERE merchant_transaction_id = $1`,
        [merchantTransactionIdRaw]
      )

      console.log('[webhook] Looking for order with merchant_transaction_id:', merchantTransactionIdRaw)

      if (existingOrderResult.rows.length === 0) {
        console.warn('[webhook] ⚠️ No order found for merchant transaction', { merchantTransactionIdRaw, paymentId })
        await logToAdmin({
          level: 'WARN',
          category: 'WEBHOOK',
          action: 'ORDER_NOT_FOUND',
          message: 'Could not locate order with merchantTransactionId from webhook',
          details: {
            paymentId,
            paymentTransactionId: paymentId,
            merchantTransactionId: merchantTransactionIdRaw,
            paymentBrand,
            customerEmail,
            amount: amountOriginal,
            currency: currencyOriginal,
            resultCode,
            isApplePay: isApplePayPayment,
            note: 'Order should have been created during checkout/prepare with this merchant_transaction_id'
          },
          userEmail: customerEmail,
          requestId
        })
        return res.json({ acknowledged: true })
      }

      const existingOrder = existingOrderResult.rows[0]
      const orderId = existingOrder.order_id
      // Payment method is already stored in DB from entity ID selection during checkout
      const storedPaymentMethod = existingOrder.payment_method

      console.log('[webhook] Found order:', orderId, '| Stored payment method:', storedPaymentMethod)

      // unpaid = customer paid successfully, brand not yet paid
      // pending = payment still processing  
      // failed = payment declined/rejected
      const newPaymentStatus = isSuccess ? 'unpaid' : (isPending ? 'pending' : 'failed')
      const paymentMessage =
        payload.result?.description || (isSuccess ? 'Payment captured successfully' : isPending ? 'Payment pending confirmation' : 'Payment failed')

      // Don't update payment_method - it's already correct from entity ID used during checkout
      const updateClauses = [
        `payment_status = $1`,
        `payment_message = $2`,
        `payment_gateway = $3`,
        `payment_brand = $4`,
        `payment_transaction_id = $5`
      ]
      const updateValues = [
        newPaymentStatus,
        paymentMessage,
        'solid',
        paymentBrand,
        paymentId
      ]

      if (customerEmail) {
        updateClauses.push(`email = COALESCE($${updateValues.length + 1}, email)`)
        updateValues.push(customerEmail)
      }

      if (amountOriginal > 0) {
        updateClauses.push(`total_amount = COALESCE(total_amount, $${updateValues.length + 1})`)
        updateValues.push(amountOriginal)
      }

      if (currencyOriginal) {
        updateClauses.push(`currency = COALESCE(currency, $${updateValues.length + 1})`)
        updateValues.push(currencyOriginal)
      }

      const amountUsd = Number(payload.amountUsd || payload.amount_usd || payload.amountUSD || 0)
      if (amountUsd > 0) {
        updateClauses.push(`amount_usd = COALESCE(amount_usd, $${updateValues.length + 1})`)
        updateValues.push(amountUsd)
      }

      let commissionStatus = existingOrder.commission_status || 'pending'
      if (newPaymentStatus === 'unpaid') {
        commissionStatus = 'unpaid'
      } else if (newPaymentStatus === 'failed') {
        commissionStatus = 'cancelled'
      } else if (newPaymentStatus === 'pending') {
        commissionStatus = 'pending'
      }

      updateClauses.push(`commission_status = $${updateValues.length + 1}`)
      updateValues.push(commissionStatus)

      updateValues.push(orderId)

      await pool.query(
        `UPDATE orders
         SET ${updateClauses.join(', ')}
         WHERE order_id = $${updateValues.length}`,
        updateValues
      )

      console.log('[webhook] ✅ Order status updated via webhook', { orderId, merchantTransactionId: merchantTransactionIdRaw, paymentMethod: storedPaymentMethod, newPaymentStatus })

      const logLevel = newPaymentStatus === 'failed' ? 'ERROR' : newPaymentStatus === 'pending' ? 'WARN' : 'INFO'
      const isApplePayOrder = storedPaymentMethod === 'applepay'
      const isGooglePayOrder = storedPaymentMethod === 'googlepay'

      await logToAdmin({
        level: logLevel,
        category: isApplePayOrder ? 'APPLEPAY' : isGooglePayOrder ? 'GOOGLEPAY' : 'PAYMENT',
        action: 'PAYMENT_STATUS_UPDATED',
        message: `Webhook updated ${storedPaymentMethod} order ${orderId} to ${newPaymentStatus}`,
        details: {
          orderId,
          paymentId,
          paymentTransactionId: paymentId,
          merchantTransactionId: merchantTransactionIdRaw,
          paymentBrand,
          paymentMethod: storedPaymentMethod,
          paymentGateway: 'solid',
          amount: amountOriginal,
          amountUSD: amountUsd > 0 ? amountUsd : amountOriginal,
          currency: currencyOriginal,
          resultCode,
          resultDescription: paymentMessage,
          isSuccess,
          isPending,
          isFailed: !isSuccess && !isPending,
          isApplePay: isApplePayOrder,
          isGooglePay: isGooglePayOrder,
          paymentStatus: newPaymentStatus,
          commissionStatus,
          orderUpdatedViaWebhook: true,
          entityIdUsed: isApplePayOrder ? 'Apple Pay Entity' : isGooglePayOrder ? 'Google Pay Entity' : 'Card Entity'
        },
        userEmail: customerEmail,
        requestId
      })
    }

    // Handle REGISTRATION notifications
    else if (type === 'REGISTRATION') {
      console.log('[webhook] Registration notification received - Action:', action)
      console.log('[webhook] Registration ID:', payload?.id)
      // Handle registration events (token created/updated/deleted)
    }

    // Handle SCHEDULE notifications
    else if (type === 'SCHEDULE') {
      console.log('[webhook] Schedule notification received')
      console.log('[webhook] Schedule ID:', payload?.id)
      // Handle scheduled payment events
    }

    // Handle RISK notifications
    else if (type === 'RISK') {
      console.log('[webhook] Risk notification received')
      console.log('[webhook] Risk ID:', payload?.id)
      // Handle risk assessment events
    }

    // Return 200 OK to acknowledge receipt
    console.log('[webhook] ✅ Webhook processed successfully')
    res.status(200).send('OK')

  } catch (err) {
    console.error('[webhook] ❌ Error processing webhook:', err)
    // Still return 200 to prevent retries for non-recoverable errors
    res.status(200).send('Error logged')
  }
})

/**
 * N-Genius Webhook Endpoint
 * 
 * WEBHOOK CONFIGURATION FOR PROVIDERS:
 * - URL: POST /api/webhooks/ngenius (provider-specific endpoint)
 * - Authentication: X-Webhook-Secret header
 * - Encryption: AES-256-CBC (Base64) OR plain JSON
 * - Required Fields: eventId, eventName, order.reference
 * - Events: CAPTURED, DECLINED, REFUNDED, ORDER_CLOSED, etc.
 * - Idempotency: Based on eventId stored in webhook_events table
 * 
 * Expected Payload Format:
 * {
 *   "eventId": "evt_xxx",
 *   "eventName": "CAPTURED",
 *   "order": {
 *     "reference": "ORD-12345",
 *     "_embedded": { "payment": [{ "state": "CAPTURED", ... }] }
 *   }
 * }
 * 
 * Response: 200 OK or {"acknowledged": true}
 * 
 * For complete webhook requirements, see: docs/PAYMENT_GATEWAY_ONBOARDING.md
 */
// N-Genius Online Webhook - Handles encrypted payment notifications
app.post('/api/webhooks/ngenius', express.text({ type: ['text/plain', 'application/json'] }), async (req, res) => {
  const requestId = `ngenius_webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)

  console.log('[ngenius-webhook] Webhook received')
  console.log('[ngenius-webhook] Request ID:', requestId)
  console.log('[ngenius-webhook] Client IP:', clientIp)

  try {
    // Ensure tables exist
    await ensureOrdersTable()
    await ensureWebhookEventsTable()

    // Validate webhook secret from header
    const webhookSecret = req.headers['x-webhook-secret']
    if (!webhookSecret || webhookSecret !== NGENIUS_WEBHOOK_SECRET) {
      console.error('[ngenius-webhook] ❌ Invalid or missing webhook secret')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('[ngenius-webhook] ✅ Webhook secret validated')

    // Get raw body
    const bodyAsString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    console.log('[ngenius-webhook] Body type:', typeof req.body)
    console.log('[ngenius-webhook] Body length:', bodyAsString.length)

    let payload

    // Try to decrypt if body appears to be encrypted (Base64)
    if (bodyAsString && bodyAsString.length > 16 && !bodyAsString.trim().startsWith('{')) {
      console.log('[ngenius-webhook] Attempting to decrypt encrypted payload')

      try {
        // Decode Base64
        const encryptedBuffer = Buffer.from(bodyAsString, 'base64')

        // Extract IV (first 16 bytes)
        const iv = encryptedBuffer.slice(0, 16)

        // Extract encrypted data (remaining bytes)
        const encryptedData = encryptedBuffer.slice(16)

        console.log('[ngenius-webhook] IV length:', iv.length)
        console.log('[ngenius-webhook] Encrypted data length:', encryptedData.length)

        // Create decipher (AES-256-CBC)
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(NGENIUS_WEBHOOK_SECRET, 'ascii'), iv)
        decipher.setAutoPadding(true) // PKCS5 padding

        // Decrypt
        let decrypted = decipher.update(encryptedData)
        decrypted = Buffer.concat([decrypted, decipher.final()])

        const decryptedString = decrypted.toString('utf8')
        console.log('[ngenius-webhook] ✅ Decryption successful')
        console.log('[ngenius-webhook] Decrypted payload preview:', decryptedString.substring(0, 200))

        // Parse JSON
        payload = JSON.parse(decryptedString)
      } catch (decryptError) {
        console.error('[ngenius-webhook] ❌ Decryption failed:', decryptError.message)
        console.error('[ngenius-webhook] Body preview:', bodyAsString.substring(0, 100))
        return res.status(400).json({ error: 'Decryption failed' })
      }
    } else {
      // Body is plain JSON
      console.log('[ngenius-webhook] Processing plain JSON payload')
      try {
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      } catch (parseError) {
        console.error('[ngenius-webhook] ❌ JSON parsing failed:', parseError.message)
        return res.status(400).json({ error: 'Invalid JSON' })
      }
    }

    // Extract event details
    const eventId = payload.eventId
    const eventName = payload.eventName
    const order = payload.order
    const outletId = payload.outletId

    console.log('[ngenius-webhook] Event ID:', eventId)
    console.log('[ngenius-webhook] Event Name:', eventName)
    console.log('[ngenius-webhook] Order Reference:', order?.reference)
    console.log('[ngenius-webhook] Outlet ID:', outletId)

    if (!eventId || !eventName || !order) {
      console.error('[ngenius-webhook] ❌ Missing required fields in payload')
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check for idempotency - has this event already been processed?
    const existingEvent = await pool.query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [eventId]
    )

    if (existingEvent.rows.length > 0) {
      console.log('[ngenius-webhook] ⚠️ Event already processed (idempotent), skipping')
      return res.status(200).send('OK')
    }

    // Store webhook event for idempotency
    await pool.query(
      `INSERT INTO webhook_events (event_id, event_name, order_reference, payload)
       VALUES ($1, $2, $3, $4)`,
      [eventId, eventName, order.reference, JSON.stringify(payload)]
    )

    console.log('[ngenius-webhook] ✅ Webhook event stored for idempotency')

    // Extract order reference
    const orderReference = order.reference
    const ngeniusOrderId = order._id?.replace('urn:order:', '')

    // Extract payment details from embedded payment
    const payment = order._embedded?.payment?.[0]
    const paymentState = payment?.state
    const paymentMethod = payment?.paymentMethod
    const authResponse = payment?.authResponse

    console.log('[ngenius-webhook] Payment State:', paymentState)
    console.log('[ngenius-webhook] Payment Method:', paymentMethod?.name)

    // Determine new payment status based on event
    let newPaymentStatus = null
    let paymentMessage = ''

    // Success events - customer paid successfully, brand not yet paid (unpaid)
    if (['AUTHORISED', 'CAPTURED', 'PURCHASED', 'APM_PAYMENT_ACCEPTED'].includes(eventName)) {
      newPaymentStatus = 'unpaid'
      paymentMessage = `Payment ${eventName.toLowerCase()} successfully`
      console.log('[ngenius-webhook] ✅ Success event detected')
    }
    // Failure events
    else if (['DECLINED', 'AUTHORISATION_FAILED', 'PURCHASE_DECLINED', 'PURCHASE_FAILED'].includes(eventName)) {
      newPaymentStatus = 'failed'
      const resultMessage = authResponse?.resultMessage || payment?.['3ds']?.status || 'Payment declined'
      paymentMessage = `Payment failed: ${resultMessage}`
      console.log('[ngenius-webhook] ❌ Failure event detected')
    }
    // Reversal events
    else if (['FULL_AUTH_REVERSED', 'PURCHASE_REVERSED'].includes(eventName)) {
      newPaymentStatus = 'reversed'
      paymentMessage = `Payment reversed: ${eventName}`
      console.log('[ngenius-webhook] ⚠️ Reversal event detected')
    }
    // Refund events
    else if (['REFUNDED'].includes(eventName)) {
      newPaymentStatus = 'refunded'
      paymentMessage = 'Payment fully refunded'
      console.log('[ngenius-webhook] 💰 Refund event detected')
    }
    else if (['PARTIALLY_REFUNDED'].includes(eventName)) {
      newPaymentStatus = 'partially_refunded'
      paymentMessage = 'Payment partially refunded'
      console.log('[ngenius-webhook] 💰 Partial refund event detected')
    }
    // Order closed
    else if (eventName === 'ORDER_CLOSED') {
      newPaymentStatus = 'closed'
      paymentMessage = 'Order closed'
      console.log('[ngenius-webhook] 🔒 Order closed event detected')
    }
    else {
      console.log('[ngenius-webhook] ℹ️ Unhandled event type, logging only')
      paymentMessage = `Webhook event: ${eventName}`
    }

    // Find order in database by N-Genius order reference
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE ngenius_order_reference = $1',
      [orderReference]
    )

    if (orderResult.rows.length === 0) {
      console.warn('[ngenius-webhook] ⚠️ Order not found in database with reference:', orderReference)
      console.log('[ngenius-webhook] This might be a webhook for a payment not yet recorded')
      // Still return 200 OK to acknowledge receipt
      return res.status(200).send('OK')
    }

    const dbOrder = orderResult.rows[0]
    console.log('[ngenius-webhook] ✅ Found order in database:', dbOrder.order_id)
    console.log('[ngenius-webhook] Current status:', dbOrder.payment_status)

    // Prepare update fields
    const updateFields = []
    const updateValues = []
    let paramCount = 1

    if (newPaymentStatus) {
      updateFields.push(`payment_status = $${paramCount++}`)
      updateValues.push(newPaymentStatus)
    }

    if (paymentMessage) {
      updateFields.push(`payment_message = $${paramCount++}`)
      updateValues.push(paymentMessage)
    }

    // Extract and update card details if available
    if (paymentMethod) {
      if (paymentMethod.name) {
        updateFields.push(`card_issuer = $${paramCount++}`)
        updateValues.push(paymentMethod.name) // VISA, MASTERCARD, etc.
      }

      if (paymentMethod.cardholderName) {
        updateFields.push(`card_holder_name = $${paramCount++}`)
        updateValues.push(paymentMethod.cardholderName)
      }

      // Store masked PAN if available (e.g., "411111******1111")
      if (paymentMethod.pan) {
        const maskedPan = paymentMethod.pan
        // Extract last 4 digits if possible
        const last4 = maskedPan.replace(/\*/g, '').slice(-4)
        if (last4) {
          updateFields.push(`card_bin = $${paramCount++}`)
          updateValues.push(last4)
        }
      }
    }

    // Update authorization code if available
    if (authResponse?.authorizationCode) {
      // Store in payment_message or create a new field if needed
      const authCode = authResponse.authorizationCode
      const updatedMessage = paymentMessage + ` (Auth: ${authCode})`
      // Update the payment_message that was already added
      if (paymentMessage) {
        updateValues[updateValues.length - 1] = updatedMessage
      }
    }

    // Update commission status for successful payments
    if (newPaymentStatus === 'unpaid' && dbOrder.commission_amount > 0) {
      updateFields.push(`commission_status = $${paramCount++}`)
      updateValues.push('unpaid')
    }

    // Perform update if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(dbOrder.id)
      const updateQuery = `
        UPDATE orders
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `

      await pool.query(updateQuery, updateValues)
      console.log('[ngenius-webhook] ✅ Order updated in database')
      console.log('[ngenius-webhook] Updated fields:', updateFields)
    } else {
      console.log('[ngenius-webhook] ℹ️ No fields to update')
    }

    // Log successful processing
    await logToAdmin({
      level: 'INFO',
      category: 'WEBHOOK',
      action: 'NGENIUS_WEBHOOK_PROCESSED',
      message: `N-Genius webhook processed: ${eventName}`,
      details: {
        eventId,
        eventName,
        orderReference,
        orderId: dbOrder.order_id,
        newStatus: newPaymentStatus,
        paymentState
      },
      requestId
    })

    console.log('[ngenius-webhook] ✅ Webhook processed successfully')
    res.status(200).send('OK')

  } catch (err) {
    console.error('[ngenius-webhook] ❌ Error processing webhook:', err)
    console.error('[ngenius-webhook] Error stack:', err.stack)

    await logToAdmin({
      level: 'ERROR',
      category: 'WEBHOOK',
      action: 'NGENIUS_WEBHOOK_ERROR',
      message: 'Failed to process N-Genius webhook',
      details: {
        error: err.message,
        stack: err.stack
      },
      requestId
    })

    res.status(500).json({ error: String(err?.message || err) })
  }
})

// TEST ENDPOINT - DELETE THIS
app.get('/api/test-brand-check', (req, res) => {
  console.log('[TEST] Test endpoint hit!')
  res.json({ message: 'Brand login enforcement is active', version: '2.0' })
})

// Auth: login
app.post('/api/auth/login', async (req, res) => {
  console.log('[LOGIN] Endpoint called with email:', req.body?.email)
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    await ensureUsersTable()
    const result = await pool.query('SELECT id, email, full_name, user_type, password_hash, plan, token_version, credits_balance, credits_unlimited FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' })
    const user = result.rows[0]
    const ok = bcrypt.compareSync(String(password), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })
    // Reject brand users - they must use /brand-login
    if (user.user_type === 'brand') {
      console.log(`[LOGIN] Rejecting brand user ${email} - must use /brand-login`)
      return res.status(403).json({ error: 'Brand users must login at /brand-login' })
    }
    console.log(`[LOGIN] Allowing user ${email} with type ${user.user_type}`)
    const token = signJwt(user)
    setAuthCookie(res, token)
    res.json({ user: mapDbUserToClient(user), token })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Auth: brand login
app.post('/api/auth/brand-login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
    await ensureBrandsTable()
    await ensureUsersTable()

    const normalizedUsername = String(username).trim().toLowerCase()

    // First, find the brand by username to get the associated email, account_type, password, and approval_status
    const brandResult = await pool.query(
      'SELECT email, account_type, password_hash, approval_status FROM brands WHERE username = $1',
      [normalizedUsername]
    )
    if (brandResult.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' })

    const brand = brandResult.rows[0]
    const brandEmail = brand.email
    const accountType = brand.account_type || 'brand'
    const brandPasswordHash = brand.password_hash

    // Check approval status - only allow active brands to login
    if (brand.approval_status !== 'active') {
      if (brand.approval_status === 'pending') {
        return res.status(403).json({
          error: 'account_pending_approval',
          message: 'Your brand account is pending admin approval. You will receive an email once it is approved.'
        })
      } else if (brand.approval_status === 'rejected') {
        return res.status(403).json({
          error: 'account_rejected',
          message: 'Your brand account application was not approved. Please contact support for more information.'
        })
      } else {
        return res.status(403).json({
          error: 'account_inactive',
          message: 'Your brand account is not active. Please contact support.'
        })
      }
    }

    // Verify this is a brand account (not reseller)
    if (accountType !== 'brand') {
      console.log(`[BRAND-LOGIN] Rejecting reseller account ${username} attempting brand login`)
      return res.status(403).json({ error: 'This account is not a brand account. Please use reseller login.' })
    }

    // Verify password against brand's password (not users table)
    const ok = bcrypt.compareSync(String(password), brandPasswordHash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    // Now get user info from users table for token generation
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, token_version, credits_balance, credits_unlimited FROM users WHERE email = $1', [brandEmail])
    if (result.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' })
    const user = result.rows[0]

    console.log(`[BRAND-LOGIN] Allowing brand user ${username} (${brandEmail})`)

    // Set user_type to 'brand' and include brand username in token
    const tokenUser = { ...user, user_type: 'brand', brand_username: normalizedUsername }
    const token = signJwt(tokenUser)
    setAuthCookie(res, token)
    res.json({ user: mapDbUserToClient(tokenUser), token })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Auth: Reseller login
app.post('/api/auth/reseller-login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
    await ensureBrandsTable()
    await ensureUsersTable()

    const normalizedUsername = String(username).trim().toLowerCase()

    // First, find the reseller by username to get the associated email, account_type, and password
    const resellerResult = await pool.query('SELECT email, account_type, password_hash FROM brands WHERE username = $1', [normalizedUsername])
    if (resellerResult.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' })

    const resellerEmail = resellerResult.rows[0].email
    const accountType = resellerResult.rows[0].account_type || 'brand'
    const resellerPasswordHash = resellerResult.rows[0].password_hash

    // Verify account_type is reseller (not brand)
    if (accountType !== 'reseller') {
      console.log(`[RESELLER-LOGIN] Rejecting brand account ${username} attempting reseller login`)
      return res.status(403).json({ error: 'This account is not a reseller account. Please use brand login.' })
    }

    // Verify password against reseller's password (not users table)
    const ok = bcrypt.compareSync(String(password), resellerPasswordHash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    // Now get user info from users table for token generation
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, token_version, credits_balance, credits_unlimited FROM users WHERE email = $1', [resellerEmail])
    if (result.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' })
    const user = result.rows[0]

    console.log(`[RESELLER-LOGIN] Allowing reseller user ${username} (${resellerEmail})`)

    // Set user_type to 'reseller' and include reseller username in token
    const tokenUser = { ...user, user_type: 'reseller', brand_username: normalizedUsername }
    const token = signJwt(tokenUser)
    setAuthCookie(res, token)
    res.json({ user: mapDbUserToClient(tokenUser), token })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Auth: me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [uid])
    if (result.rows.length === 0) return res.status(401).json({ error: 'unauthorized' })
    const user = mapDbUserToClient(result.rows[0])

    // CRITICAL: Use role from JWT token, not from database
    // This ensures brand/reseller with same email get correct role
    if (req.auth.role) {
      user.role = req.auth.role
    }

    // Include brand_username from token if present
    if (req.auth.brand_username) {
      user.brand_username = req.auth.brand_username
    }

    // For brand/reseller users, also fetch account_type from brands table
    if (user.role === 'brand' || user.role === 'reseller') {
      try {
        await ensureBrandsTable()
        // Use brand_username from token if available
        if (req.auth.brand_username) {
          const brandResult = await pool.query('SELECT account_type, name FROM brands WHERE username = $1', [req.auth.brand_username])
          if (brandResult.rows.length > 0) {
            user.account_type = brandResult.rows[0].account_type
            user.brand_name = brandResult.rows[0].name
          }
        } else {
          // Fallback to email-based query
          const brandResult = await pool.query('SELECT account_type FROM brands WHERE email = $1', [result.rows[0].email])
          if (brandResult.rows.length > 0) {
            user.account_type = brandResult.rows[0].account_type
          }
        }
      } catch (e) {
        console.error('Error fetching account_type:', e)
      }
    }

    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Auth: update me
app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const { full_name, plan, password } = req.body || {}
    await ensureUsersTable()
    if (password) {
      const password_hash = bcrypt.hashSync(String(password), 10)
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, uid])
    }
    if (typeof full_name !== 'undefined' || typeof plan !== 'undefined') {
      function normalizePlan(p) {
        if (!p) return null
        const v = String(p).trim().toLowerCase()
        if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
        if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
        if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
        return v
      }
      await pool.query('UPDATE users SET full_name = COALESCE($1, full_name), plan = COALESCE($2, plan) WHERE id = $3', [full_name ?? null, normalizePlan(plan), uid])
    }
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [uid])
    res.json({ user: mapDbUserToClient(result.rows[0]) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Auth: logout (invalidate current token by bumping token_version)
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    await ensureUsersTable()
    await pool.query('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1', [uid])
  } catch (_e) { /* ignore */ }
  res.clearCookie('token', { path: '/' })
  res.json({ ok: true })
})

// Auth: change password (requires current password verification)
app.patch('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const { currentPassword, newPassword } = req.body || {}

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' })
    }

    await ensureUsersTable()

    // Verify current password
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [uid])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    const isValid = bcrypt.compareSync(String(currentPassword), result.rows[0].password_hash)
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Update to new password
    const newPasswordHash = bcrypt.hashSync(String(newPassword), 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, uid])

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// User Settings: Get all settings
app.get('/api/user/settings', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    await ensureUsersTable()
    await ensureBrandsTable()

    // Get user info first
    const userResult = await pool.query('SELECT email, user_type FROM users WHERE id = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = userResult.rows[0]

    // If user is a brand or reseller, get settlement data from brands table
    if (user.user_type === 'brand' || user.user_type === 'reseller') {
      let brandResult

      // Use brand_username from token if available (new method)
      if (req.auth.brand_username) {
        const accountType = req.auth.role === 'reseller' ? 'reseller' : 'brand'
        brandResult = await pool.query(`
          SELECT 
            settlement_method,
            settlement_crypto_wallet,
            settlement_bank_holder,
            settlement_bank_iban,
            settlement_bank_swift,
            settlement_bank_name,
            settlement_bank_address
          FROM brands WHERE username = $1 AND account_type = $2
        `, [req.auth.brand_username, accountType])
      } else {
        // Fallback to email-based query for old tokens
        const accountType = user.user_type === 'reseller' ? 'reseller' : 'brand'
        brandResult = await pool.query(`
          SELECT 
            settlement_method,
            settlement_crypto_wallet,
            settlement_bank_holder,
            settlement_bank_iban,
            settlement_bank_swift,
            settlement_bank_name,
            settlement_bank_address
          FROM brands WHERE email = $1 AND account_type = $2
        `, [user.email, accountType])
      }

      const notifResult = await pool.query(`
        SELECT 
          notification_weekly_summary,
          notification_payout_updates,
          notification_security_alerts
        FROM users WHERE id = $1
      `, [uid])

      const settings = {
        notification_weekly_summary: notifResult.rows[0]?.notification_weekly_summary,
        notification_payout_updates: notifResult.rows[0]?.notification_payout_updates,
        notification_security_alerts: notifResult.rows[0]?.notification_security_alerts,
        settlement_method: brandResult.rows[0]?.settlement_method,
        settlement_crypto_wallet: brandResult.rows[0]?.settlement_crypto_wallet,
        settlement_bank_holder: brandResult.rows[0]?.settlement_bank_holder,
        settlement_bank_iban: brandResult.rows[0]?.settlement_bank_iban,
        settlement_bank_swift: brandResult.rows[0]?.settlement_bank_swift,
        settlement_bank_name: brandResult.rows[0]?.settlement_bank_name,
        settlement_bank_address: brandResult.rows[0]?.settlement_bank_address
      }

      return res.json({ settings })
    }

    // For regular users, get from users table
    const result = await pool.query(`
      SELECT 
        notification_weekly_summary,
        notification_payout_updates,
        notification_security_alerts,
        settlement_method,
        settlement_crypto_wallet,
        settlement_bank_holder,
        settlement_bank_iban,
        settlement_bank_swift,
        settlement_bank_name,
        settlement_bank_address
      FROM users WHERE id = $1
    `, [uid])

    res.json({ settings: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// User Settings: Update notification preferences
app.patch('/api/user/settings/notifications', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const {
      notification_weekly_summary,
      notification_payout_updates,
      notification_security_alerts
    } = req.body || {}

    await ensureUsersTable()

    const updates = []
    const values = []
    let paramIndex = 1

    if (typeof notification_weekly_summary !== 'undefined') {
      updates.push(`notification_weekly_summary = $${paramIndex++}`)
      values.push(Boolean(notification_weekly_summary))
    }
    if (typeof notification_payout_updates !== 'undefined') {
      updates.push(`notification_payout_updates = $${paramIndex++}`)
      values.push(Boolean(notification_payout_updates))
    }
    if (typeof notification_security_alerts !== 'undefined') {
      updates.push(`notification_security_alerts = $${paramIndex++}`)
      values.push(Boolean(notification_security_alerts))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No notification preferences provided' })
    }

    values.push(uid)
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values)

    const result = await pool.query(`
      SELECT 
        notification_weekly_summary,
        notification_payout_updates,
        notification_security_alerts
      FROM users WHERE id = $1
    `, [uid])

    res.json({ success: true, notifications: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// User Settings: Update settlement preferences
app.patch('/api/user/settings/settlement', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const {
      settlement_method,
      settlement_crypto_wallet,
      settlement_bank_holder,
      settlement_bank_iban,
      settlement_bank_swift,
      settlement_bank_name,
      settlement_bank_address
    } = req.body || {}

    await ensureUsersTable()
    await ensureBrandsTable()

    // Get user info first
    const userResult = await pool.query('SELECT email, user_type FROM users WHERE id = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = userResult.rows[0]

    const updates = []
    const values = []
    let paramIndex = 1

    if (typeof settlement_method !== 'undefined') {
      updates.push(`settlement_method = $${paramIndex++}`)
      values.push(settlement_method || null)
    }
    if (typeof settlement_crypto_wallet !== 'undefined') {
      updates.push(`settlement_crypto_wallet = $${paramIndex++}`)
      values.push(settlement_crypto_wallet || null)
    }
    if (typeof settlement_bank_holder !== 'undefined') {
      updates.push(`settlement_bank_holder = $${paramIndex++}`)
      values.push(settlement_bank_holder || null)
    }
    if (typeof settlement_bank_iban !== 'undefined') {
      updates.push(`settlement_bank_iban = $${paramIndex++}`)
      values.push(settlement_bank_iban || null)
    }
    if (typeof settlement_bank_swift !== 'undefined') {
      updates.push(`settlement_bank_swift = $${paramIndex++}`)
      values.push(settlement_bank_swift || null)
    }
    if (typeof settlement_bank_name !== 'undefined') {
      updates.push(`settlement_bank_name = $${paramIndex++}`)
      values.push(settlement_bank_name || null)
    }
    if (typeof settlement_bank_address !== 'undefined') {
      updates.push(`settlement_bank_address = $${paramIndex++}`)
      values.push(settlement_bank_address || null)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settlement preferences provided' })
    }

    // If user is a brand or reseller, update brands table
    if (user.user_type === 'brand' || user.user_type === 'reseller') {
      // Use brand_username from token if available (new method)
      if (req.auth.brand_username) {
        const accountType = req.auth.role === 'reseller' ? 'reseller' : 'brand'

        values.push(req.auth.brand_username)
        values.push(accountType)
        await pool.query(`UPDATE brands SET ${updates.join(', ')}, updated_at = NOW() WHERE username = $${paramIndex} AND account_type = $${paramIndex + 1}`, values)

        const result = await pool.query(`
          SELECT 
            settlement_method,
            settlement_crypto_wallet,
            settlement_bank_holder,
            settlement_bank_iban,
            settlement_bank_swift,
            settlement_bank_name,
            settlement_bank_address
          FROM brands WHERE username = $1 AND account_type = $2
        `, [req.auth.brand_username, accountType])

        return res.json({ success: true, settlement: result.rows[0] })
      }

      // Fallback to email-based update for old tokens
      const accountType = user.user_type === 'reseller' ? 'reseller' : 'brand'

      values.push(user.email)
      values.push(accountType)
      await pool.query(`UPDATE brands SET ${updates.join(', ')}, updated_at = NOW() WHERE email = $${paramIndex} AND account_type = $${paramIndex + 1}`, values)

      const result = await pool.query(`
        SELECT 
          settlement_method,
          settlement_crypto_wallet,
          settlement_bank_holder,
          settlement_bank_iban,
          settlement_bank_swift,
          settlement_bank_name,
          settlement_bank_address
        FROM brands WHERE email = $1 AND account_type = $2
      `, [user.email, accountType])

      return res.json({ success: true, settlement: result.rows[0] })
    }

    // For regular users, update users table
    values.push(uid)
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values)

    const result = await pool.query(`
      SELECT 
        settlement_method,
        settlement_crypto_wallet,
        settlement_bank_holder,
        settlement_bank_iban,
        settlement_bank_swift,
        settlement_bank_name,
        settlement_bank_address
      FROM users WHERE id = $1
    `, [uid])

    res.json({ success: true, settlement: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Demo visits tracking: increment visits per IP and return state
app.get('/api/demo/visit', async (req, res) => {
  try {
    const ip = getRequestIp(req) || 'unknown'
    await ensureVisitsSchema()
    const existing = await pool.query('SELECT ip, visits_count, demo_tries, last_visit_at FROM visits WHERE ip = $1', [ip])
    let row
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        'UPDATE visits SET visits_count = visits_count + 1, last_visit_at = NOW() WHERE ip = $1 RETURNING ip, visits_count, demo_tries, last_visit_at',
        [ip]
      )
      row = updated.rows[0]
    } else {
      const inserted = await pool.query(
        'INSERT INTO visits (ip, visits_count, demo_tries) VALUES ($1, 1, 0) RETURNING ip, visits_count, demo_tries, last_visit_at',
        [ip]
      )
      row = inserted.rows[0]
    }
    const limit = 3
    res.json({ ip: row.ip, visits_count: row.visits_count, demo_tries: row.demo_tries, remaining: Math.max(0, limit - row.demo_tries), limit })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Demo visits tracking via POST with client-provided IP info (from ip-api.com)
app.post('/api/demo/visit', async (req, res) => {
  try {
    await ensureVisitsSchema()
    const userAgent = req.get('user-agent') || null
    const body = req.body || {}
    let ipInfo = body.ip_info || null
    const clientIp = (typeof body.client_ip === 'string' && body.client_ip.trim() !== '') ? body.client_ip.trim() : (ipInfo?.query || getRequestIp(req) || 'unknown')
    // If no ip_info provided, try server-side fetch from ip-api.com
    if (!ipInfo && clientIp && clientIp !== 'unknown') {
      try {
        const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=61439`)
        const j = await r.json()
        if (j && j.status === 'success') ipInfo = j
      } catch (_e) { /* ignore */ }
    }
    const existing = await pool.query('SELECT ip, visits_count, demo_tries FROM visits WHERE ip = $1', [clientIp])
    const fields = {
      country: ipInfo && ipInfo.country ? ipInfo.country : null,
      country_code: ipInfo && ipInfo.countryCode ? ipInfo.countryCode : null,
      region: ipInfo && ipInfo.region ? ipInfo.region : null,
      region_name: ipInfo && ipInfo.regionName ? ipInfo.regionName : null,
      city: ipInfo && ipInfo.city ? ipInfo.city : null,
      zip: ipInfo && ipInfo.zip ? ipInfo.zip : null,
      lat: ipInfo && typeof ipInfo.lat === 'number' ? ipInfo.lat : null,
      lon: ipInfo && typeof ipInfo.lon === 'number' ? ipInfo.lon : null,
      timezone: ipInfo && ipInfo.timezone ? ipInfo.timezone : null,
      isp: ipInfo && ipInfo.isp ? ipInfo.isp : null,
      org: ipInfo && ipInfo.org ? ipInfo.org : null,
      asn: ipInfo && ipInfo.as ? ipInfo.as : null,
      user_agent: userAgent,
    }
    let row
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE visits SET 
          visits_count = visits_count + 1,
          last_visit_at = NOW(),
          country = COALESCE($2, country),
          country_code = COALESCE($3, country_code),
          region = COALESCE($4, region),
          region_name = COALESCE($5, region_name),
          city = COALESCE($6, city),
          zip = COALESCE($7, zip),
          lat = COALESCE($8, lat),
          lon = COALESCE($9, lon),
          timezone = COALESCE($10, timezone),
          isp = COALESCE($11, isp),
          org = COALESCE($12, org),
          asn = COALESCE($13, asn),
          user_agent = COALESCE($14, user_agent)
        WHERE ip = $1
        RETURNING ip, visits_count, demo_tries, last_visit_at`,
        [clientIp, fields.country, fields.country_code, fields.region, fields.region_name, fields.city, fields.zip, fields.lat, fields.lon, fields.timezone, fields.isp, fields.org, fields.asn, fields.user_agent]
      )
      row = updated.rows[0]
    } else {
      const inserted = await pool.query(
        `INSERT INTO visits (
          ip, visits_count, demo_tries, first_visit_at, last_visit_at,
          country, country_code, region, region_name, city, zip, lat, lon, timezone, isp, org, asn, user_agent
        ) VALUES (
          $1, 1, 0, NOW(), NOW(),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING ip, visits_count, demo_tries, last_visit_at`,
        [clientIp, fields.country, fields.country_code, fields.region, fields.region_name, fields.city, fields.zip, fields.lat, fields.lon, fields.timezone, fields.isp, fields.org, fields.asn, fields.user_agent]
      )
      row = inserted.rows[0]
    }
    const limit = 3
    res.json({ ip: clientIp, visits_count: row.visits_count, demo_tries: row.demo_tries, remaining: Math.max(0, limit - row.demo_tries), limit })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Tutor: get remaining credits (20 messages per IP)
app.post('/api/tutor/visit', async (req, res) => {
  try {
    await ensureVisitsSchema()
    const userAgent = req.get('user-agent') || null
    let ipInfo = req.body?.ip_info || null
    const clientIp = (typeof req.body?.client_ip === 'string' && req.body.client_ip.trim() !== '') ? req.body.client_ip.trim() : (ipInfo?.query || getRequestIp(req) || 'unknown')
    if (!ipInfo && clientIp && clientIp !== 'unknown') {
      try {
        const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=61439`)
        const j = await r.json()
        if (j && j.status === 'success') ipInfo = j
      } catch (_e) { }
    }
    const existing = await pool.query('SELECT ip, tutor_messages FROM visits WHERE ip = $1', [clientIp])
    const limit = 20
    let row
    const geo = {
      country: ipInfo?.country || null,
      country_code: ipInfo?.countryCode || null,
      region: ipInfo?.region || null,
      region_name: ipInfo?.regionName || null,
      city: ipInfo?.city || null,
      zip: ipInfo?.zip || null,
      lat: typeof ipInfo?.lat === 'number' ? ipInfo.lat : null,
      lon: typeof ipInfo?.lon === 'number' ? ipInfo.lon : null,
      timezone: ipInfo?.timezone || null,
      isp: ipInfo?.isp || null,
      org: ipInfo?.org || null,
      asn: ipInfo?.as || null,
      user_agent: userAgent,
    }
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE visits SET 
          visits_count = visits_count + 1,
          last_visit_at = NOW(),
          country = COALESCE($2, country), country_code = COALESCE($3, country_code), region = COALESCE($4, region), region_name = COALESCE($5, region_name), city = COALESCE($6, city), zip = COALESCE($7, zip), lat = COALESCE($8, lat), lon = COALESCE($9, lon), timezone = COALESCE($10, timezone), isp = COALESCE($11, isp), org = COALESCE($12, org), asn = COALESCE($13, asn), user_agent = COALESCE($14, user_agent)
        WHERE ip = $1 RETURNING ip, tutor_messages`,
        [clientIp, geo.country, geo.country_code, geo.region, geo.region_name, geo.city, geo.zip, geo.lat, geo.lon, geo.timezone, geo.isp, geo.org, geo.asn, geo.user_agent]
      )
      row = updated.rows[0]
    } else {
      const inserted = await pool.query(
        `INSERT INTO visits (ip, visits_count, demo_tries, tutor_messages, first_visit_at, last_visit_at, country, country_code, region, region_name, city, zip, lat, lon, timezone, isp, org, asn, user_agent)
         VALUES ($1, 1, 0, 0, NOW(), NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING ip, tutor_messages`,
        [clientIp, geo.country, geo.country_code, geo.region, geo.region_name, geo.city, geo.zip, geo.lat, geo.lon, geo.timezone, geo.isp, geo.org, geo.asn, geo.user_agent]
      )
      row = inserted.rows[0]
    }
    res.json({ ip: clientIp, tutor_messages_used: row.tutor_messages, limit, remaining: Math.max(0, limit - Number(row.tutor_messages || 0)) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Tutor: send message with 20-credit limit per IP
app.post('/api/tutor/send', async (req, res) => {
  try {
    await ensureVisitsSchema()
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured on server' })
    const userAgent = req.get('user-agent') || null
    const { message, ip_info, client_ip, previous_messages } = req.body || {}
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message_required' })
    let ipInfo = ip_info || null
    const ip = (typeof client_ip === 'string' && client_ip.trim() !== '') ? client_ip.trim() : (ipInfo?.query || getRequestIp(req) || 'unknown')
    const limit = 20

    // Ensure visit row
    const existing = await pool.query('SELECT ip, tutor_messages, tutor_history FROM visits WHERE ip = $1', [ip])
    let record
    if (existing.rows.length === 0) {
      const inserted = await pool.query('INSERT INTO visits (ip, visits_count, demo_tries, tutor_messages, first_visit_at, last_visit_at) VALUES ($1, 1, 0, 0, NOW(), NOW()) RETURNING ip, tutor_messages', [ip])
      record = inserted.rows[0]
    } else {
      record = existing.rows[0]
    }
    if (Number(record.tutor_messages || 0) >= limit) {
      return res.status(429).json({ error: 'tutor_limit_reached', message: 'You have reached your 20 free tutor messages. Please purchase a package to get premium account.' })
    }

    // Get or fetch IP info
    if (!ipInfo && ip && ip !== 'unknown') {
      try {
        const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=61439`)
        const j = await r.json()
        if (j && j.status === 'success') ipInfo = j
      } catch (_e) { }
    }

    // Build prompt
    const context = Array.isArray(previous_messages) ? previous_messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n') : ''
    const prompt = `You are an expert market analysis and data educator. Your role is to teach concepts about chart analysis, risk management, and general market knowledge.

IMPORTANT RULES:
1. ONLY discuss topics related to market analysis, chart patterns, data interpretation, and risk management.
2. DO NOT mention 'crypto', 'trading', 'profit', 'loss', or any speculative financial advice. Use neutral terms like 'market data', 'chart patterns', 'upward trend', 'downward trend', 'data points'.
3. If asked about non-approved topics, politely redirect to educational analysis topics.
4. Be educational and explain concepts clearly. Use examples when helpful.
5. Always emphasize careful data interpretation and risk assessment.

Previous conversation context:
${context}

Student question: ${message}

Provide a helpful, educational response focused on market analysis.`

    const payload = {
      model: ANTHROPIC_MODEL,
      max_tokens: 768,
      temperature: 0.2,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    if (!r.ok) return res.status(r.status).send(text)
    const json = JSON.parse(text)
    const reply = Array.isArray(json?.content) ? json.content.filter(c => c?.type === 'text').map(c => c.text).join('\n') : ''

    // Update credits and geo fields
    const fields = {
      country: ipInfo?.country || null,
      country_code: ipInfo?.countryCode || null,
      region: ipInfo?.region || null,
      region_name: ipInfo?.regionName || null,
      city: ipInfo?.city || null,
      zip: ipInfo?.zip || null,
      lat: typeof ipInfo?.lat === 'number' ? ipInfo.lat : null,
      lon: typeof ipInfo?.lon === 'number' ? ipInfo.lon : null,
      timezone: ipInfo?.timezone || null,
      isp: ipInfo?.isp || null,
      org: ipInfo?.org || null,
      asn: ipInfo?.as || null,
      user_agent: userAgent,
    }
    let history = []
    try { history = Array.isArray(record.tutor_history) ? record.tutor_history : [] } catch (_e) { }
    history = [...history, { role: 'user', content: String(message || '') }, { role: 'assistant', content: String(reply || '') }]
    if (history.length > 100) history = history.slice(history.length - 100)

    await pool.query(
      `UPDATE visits SET tutor_messages = tutor_messages + 1, last_visit_at = NOW(), last_tutor_at = NOW(), tutor_history = $15::jsonb,
        country = COALESCE($2, country), country_code = COALESCE($3, country_code), region = COALESCE($4, region), region_name = COALESCE($5, region_name), city = COALESCE($6, city), zip = COALESCE($7, zip), lat = COALESCE($8, lat), lon = COALESCE($9, lon), timezone = COALESCE($10, timezone), isp = COALESCE($11, isp), org = COALESCE($12, org), asn = COALESCE($13, asn), user_agent = COALESCE($14, user_agent)
       WHERE ip = $1`,
      [ip, fields.country, fields.country_code, fields.region, fields.region_name, fields.city, fields.zip, fields.lat, fields.lon, fields.timezone, fields.isp, fields.org, fields.asn, fields.user_agent, JSON.stringify(history)]
    )

    const after = await pool.query('SELECT tutor_messages FROM visits WHERE ip = $1', [ip])
    const used = Number(after.rows?.[0]?.tutor_messages || 0)

    res.json({ reply, meta: { ip, tutor_messages_used: used, remaining: Math.max(0, limit - used), limit }, history })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Conversations: list
app.get('/api/tutor/conversations', requireAuth, async (req, res) => {
  try {
    await ensureUsersTable();
    await ensureTutorSchema();
    const { uid } = req.auth;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const result = await pool.query(
      'SELECT id, user_id, title, topic, created_at FROM tutor_conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [uid, limit]
    );
    res.json({ conversations: result.rows.map(mapDbConversation) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Conversations: create
app.post('/api/tutor/conversations', requireAuth, async (req, res) => {
  try {
    await ensureUsersTable();
    await ensureTutorSchema();
    const { uid } = req.auth;
    const { title, topic } = req.body || {};
    const result = await pool.query(
      'INSERT INTO tutor_conversations (user_id, title, topic) VALUES ($1, $2, $3) RETURNING id, user_id, title, topic, created_at',
      [uid, title || null, topic || null]
    );
    res.json({ conversation: mapDbConversation(result.rows[0]) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

async function assertConversationAccess(userId, conversationId) {
  const r = await pool.query('SELECT id FROM tutor_conversations WHERE id = $1 AND user_id = $2', [conversationId, userId])
  if (r.rows.length === 0) {
    const e = new Error('not found')
    e.status = 404
    throw e
  }
}

// Messages: list
app.get('/api/tutor/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    await ensureUsersTable();
    await ensureTutorSchema();
    const { uid } = req.auth;
    const conversationId = Number(req.params.id);
    if (!conversationId) return res.status(400).json({ error: 'invalid id' })
    await assertConversationAccess(uid, conversationId)
    const result = await pool.query(
      'SELECT id, role, content, created_at FROM tutor_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )
    res.json({ messages: result.rows.map(mapDbMessage) })
  } catch (err) {
    const status = Number(err?.status || 500)
    res.status(status).json({ error: String(err?.message || err) })
  }
})

// Messages: create user message, generate assistant reply, persist both
app.post('/api/tutor/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    await ensureUsersTable();
    await ensureTutorSchema();
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured on server' })
    const { uid } = req.auth;
    const conversationId = Number(req.params.id);
    if (!conversationId) return res.status(400).json({ error: 'invalid id' })
    const { content, temperature, language } = req.body || {}
    const userContent = typeof content === 'string' ? content.trim() : ''
    if (!userContent) return res.status(400).json({ error: 'message_required' })

    await assertConversationAccess(uid, conversationId)

    // Enforce credits (admins bypass)
    const ures = await pool.query('SELECT user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [uid])
    if (ures.rows.length === 0) return res.status(401).json({ error: 'unauthorized' })
    const u = ures.rows[0]
    const isAdmin = u.user_type === 'admin'
    const hasUnlimited = Boolean(u.credits_unlimited) || String(u.plan || '').toLowerCase() === 'expert'
    if (!isAdmin && !hasUnlimited) {
      const bal = Number(u.credits_balance || 0)
      if (bal <= 0) return res.status(402).json({ error: 'insufficient_credits', message: 'You have no credits remaining. Please purchase a credit package.' })
    }

    const conv = await pool.query('SELECT id, topic FROM tutor_conversations WHERE id = $1', [conversationId])
    const topic = conv.rows?.[0]?.topic || null

    // Insert user message
    await pool.query(
      'INSERT INTO tutor_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversationId, 'user', userContent]
    )

    // Load previous messages for context
    const previous = await pool.query(
      'SELECT role, content FROM tutor_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )
    const prevMsgs = previous.rows.map(r => ({ role: r.role, content: r.content }))
    const prompt = buildTutorPrompt({ topic, previous: prevMsgs, userMessage: userContent, language: language || 'en' })

    const payload = {
      model: ANTHROPIC_MODEL,
      max_tokens: 768,
      temperature: typeof temperature === 'number' ? Number(temperature) : 0.5,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    if (!r.ok) return res.status(r.status).send(text)
    const json = JSON.parse(text)
    const reply = Array.isArray(json?.content) ? json.content.filter(c => c?.type === 'text').map(c => c.text).join('\n') : ''

    // Persist assistant message
    const inserted = await pool.query(
      'INSERT INTO tutor_messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at',
      [conversationId, 'assistant', reply]
    )

    // Decrement one credit if required (after success)
    if (!isAdmin && !hasUnlimited) {
      await pool.query('UPDATE users SET credits_balance = GREATEST(0, COALESCE(credits_balance,0) - 1), credits_used_total = COALESCE(credits_used_total,0) + 1 WHERE id = $1', [uid])
    }

    res.json({ assistant_message: mapDbMessage(inserted.rows[0]) })
  } catch (err) {
    const status = Number(err?.status || 500)
    res.status(status).json({ error: String(err?.message || err) })
  }
})

// Tutor: load previous history for this IP
app.get('/api/tutor/history', async (req, res) => {
  try {
    await ensureVisitsSchema()
    const ip = getRequestIp(req) || 'unknown'
    const existing = await pool.query('SELECT tutor_history FROM visits WHERE ip = $1', [ip])
    if (existing.rows.length === 0) return res.json({ history: [] })
    const history = Array.isArray(existing.rows[0]?.tutor_history) ? existing.rows[0].tutor_history : []
    res.json({ history })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Tutor: load history (POST variant honors client_ip/ip_info like sender)
app.post('/api/tutor/history', async (req, res) => {
  try {
    await ensureVisitsSchema()
    let ipInfo = req.body?.ip_info || null
    const clientIp = (typeof req.body?.client_ip === 'string' && req.body.client_ip.trim() !== '') ? req.body.client_ip.trim() : (ipInfo?.query || getRequestIp(req) || 'unknown')
    const existing = await pool.query('SELECT tutor_history FROM visits WHERE ip = $1', [clientIp])
    if (existing.rows.length === 0) return res.json({ history: [] })
    const history = Array.isArray(existing.rows[0]?.tutor_history) ? existing.rows[0].tutor_history : []
    res.json({ history })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Demo chart analysis with 3-try limit per IP
app.post('/api/demo/analyze', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured on server' })
    await ensureVisitsSchema()
    const userAgent = req.get('user-agent') || null
    const { image_data_url, image_url, symbol, ip_info, client_ip } = req.body || {}
    let ipInfo = ip_info || null
    const ip = (typeof client_ip === 'string' && client_ip.trim() !== '') ? client_ip.trim() : (ipInfo?.query || getRequestIp(req) || 'unknown')
    if (!image_data_url && !image_url) return res.status(400).json({ error: 'image_data_url or image_url is required' })
    const existing = await pool.query('SELECT ip, visits_count, demo_tries FROM visits WHERE ip = $1', [ip])
    let record
    if (existing.rows.length === 0) {
      const inserted = await pool.query('INSERT INTO visits (ip, visits_count, demo_tries, first_visit_at, last_visit_at) VALUES ($1, 1, 0, NOW(), NOW()) RETURNING ip, visits_count, demo_tries', [ip])
      record = inserted.rows[0]
    } else {
      record = existing.rows[0]
    }
    const limit = 3
    if (Number(record.demo_tries || 0) >= limit) {
      return res.status(429).json({ error: 'demo_limit_reached', message: 'You have reached your 3 free demo analyses for today. Please purchase a package to get premium account.' })
    }

    // Prepare prompt and schema same as frontend ChartAnalysis.jsx, enforcing JSON-only output
    const basePrompt = `
        You are an expert market analyst. Analyze this chart image and provide detailed insights.
        
        Please analyze:
        1. Current trend direction (upward, downward, or sideways)
        2. Key support and resistance levels
        3. Potential entry price recommendation
        4. Suggested stop level
        5. Potential target levels (2 levels)
        6. Risk/reward ratio assessment
        7. Overall confidence level (0-1)
        8. Time frame analysis
        9. Potential strategy recommendation
        10. Detailed summary of the analysis
        
        Be specific with price levels and provide actionable insights.
        Symbol: ${symbol || 'Unknown dataset'}
      `

    const response_json_schema = {
      type: 'object',
      properties: {
        trend_direction: { type: 'string', enum: ['bullish', 'bearish', 'sideways'] },
        confidence_level: { type: 'number', minimum: 0, maximum: 1 },
        entry_price: { type: 'number' },
        stop_loss: { type: 'number' },
        take_profit_1: { type: 'number' },
        take_profit_2: { type: 'number' },
        risk_reward_ratio: { type: 'number' },
        key_levels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              price: { type: 'number' },
              type: { type: 'string' },
              strength: { type: 'string' },
            },
          },
        },
        analysis_summary: { type: 'string' },
        time_frame: { type: 'string' },
        trading_strategy: { type: 'string' },
      },
    }

    // Build anthropic content with image
    const jsonInstruction =
      "\n\nReturn ONLY a valid JSON object matching this JSON Schema. Do not include any extra text or explanations. " +
      "Do not use markdown or code fences. Output must be raw JSON only. " +
      "If a numeric value is unknown, return null for that field. JSON Schema:\n" +
      JSON.stringify(response_json_schema)
    const finalPrompt = `${basePrompt}${jsonInstruction}`

    const content = []
    if (finalPrompt) content.push({ type: 'text', text: finalPrompt })

    async function toBase64AndMimeFromInput() {
      if (typeof image_data_url === 'string' && image_data_url.startsWith('data:')) {
        const [meta, data] = image_data_url.split(',')
        const mime = meta.split(':')[1].split(';')[0] || 'image/png'
        return { base64: data, mime }
      }
      if (typeof image_url === 'string' && image_url.length > 0) {
        try {
          const r = await fetch(image_url)
          const ab = await r.arrayBuffer()
          const b64 = Buffer.from(ab).toString('base64')
          const ct = r.headers.get('content-type') || 'image/png'
          return { base64: b64, mime: ct }
        } catch (_e) {
          return null
        }
      }
      return null
    }

    const img = await toBase64AndMimeFromInput()
    if (img) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mime || 'image/png', data: img.base64 },
      })
    }

    // Build request
    const payload = {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    if (!r.ok) {
      return res.status(r.status).send(text)
    }
    const json = JSON.parse(text)
    const allText = Array.isArray(json?.content)
      ? json.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n')
      : undefined

    function tryParseJson(s) {
      if (!s) return null
      const fenced = s.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
      if (fenced && fenced[1]) s = fenced[1]
      s = s.trim()
      try { return JSON.parse(s) } catch (_e) { }
      const extractBalancedJson = (input) => {
        let depth = 0; let start = -1; let inStr = false; let esc = false
        for (let i = 0; i < input.length; i++) {
          const ch = input[i]
          if (inStr) {
            if (esc) { esc = false; continue }
            if (ch === '\\') { esc = true; continue }
            if (ch === '"') { inStr = false }
            continue
          }
          if (ch === '"') { inStr = true; continue }
          if (ch === '{') { if (depth === 0) start = i; depth++ }
          else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return input.slice(start, i + 1) }
        }
        return null
      }
      const extracted = extractBalancedJson(s)
      if (extracted) { try { return JSON.parse(extracted) } catch (_e) { } }
      return null
    }

    const parsed = tryParseJson(allText)
    if (!parsed) {
      return res.status(500).json({ error: 'parse_error', message: 'Failed to parse JSON response from model', raw: allText })
    }

    // Increment demo tries and update geo/user-agent details atomically
    // If no ip_info provided, try server-side fetch from ip-api.com
    if (!ipInfo && ip && ip !== 'unknown') {
      try {
        const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=61439`)
        const j = await r.json()
        if (j && j.status === 'success') ipInfo = j
      } catch (_e) { /* ignore */ }
    }
    const fields = {
      country: ipInfo && ipInfo.country ? ipInfo.country : null,
      country_code: ipInfo && ipInfo.countryCode ? ipInfo.countryCode : null,
      region: ipInfo && ipInfo.region ? ipInfo.region : null,
      region_name: ipInfo && ipInfo.regionName ? ipInfo.regionName : null,
      city: ipInfo && ipInfo.city ? ipInfo.city : null,
      zip: ipInfo && ipInfo.zip ? ipInfo.zip : null,
      lat: ipInfo && typeof ipInfo.lat === 'number' ? ipInfo.lat : null,
      lon: ipInfo && typeof ipInfo.lon === 'number' ? ipInfo.lon : null,
      timezone: ipInfo && ipInfo.timezone ? ipInfo.timezone : null,
      isp: ipInfo && ipInfo.isp ? ipInfo.isp : null,
      org: ipInfo && ipInfo.org ? ipInfo.org : null,
      asn: ipInfo && ipInfo.as ? ipInfo.as : null,
      user_agent: userAgent,
    }
    await pool.query(
      `UPDATE visits SET 
        demo_tries = demo_tries + 1,
        last_visit_at = NOW(),
        last_demo_at = NOW(),
        country = COALESCE($2, country),
        country_code = COALESCE($3, country_code),
        region = COALESCE($4, region),
        region_name = COALESCE($5, region_name),
        city = COALESCE($6, city),
        zip = COALESCE($7, zip),
        lat = COALESCE($8, lat),
        lon = COALESCE($9, lon),
        timezone = COALESCE($10, timezone),
        isp = COALESCE($11, isp),
        org = COALESCE($12, org),
        asn = COALESCE($13, asn),
        user_agent = COALESCE($14, user_agent)
      WHERE ip = $1`,
      [ip, fields.country, fields.country_code, fields.region, fields.region_name, fields.city, fields.zip, fields.lat, fields.lon, fields.timezone, fields.isp, fields.org, fields.asn, fields.user_agent]
    )
    const after = await pool.query('SELECT visits_count, demo_tries FROM visits WHERE ip = $1', [ip])
    const state = after.rows[0]

    return res.json({ analysis: parsed, meta: { ip, visits_count: state.visits_count, demo_tries: state.demo_tries, remaining: Math.max(0, limit - state.demo_tries), limit } })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Chart: upload to Cloudinary (base64 data URL) → returns image_url, public_id
app.post('/api/chart/upload', requireAuth, async (req, res) => {
  try {
    if (!CLOUDINARY_CLOUD_NAME) return res.status(500).json({ error: 'cloudinary_not_configured' })
    const { file_data_url, folder } = req.body || {}
    if (typeof file_data_url !== 'string' || !file_data_url.startsWith('data:')) {
      return res.status(400).json({ error: 'invalid_file_data_url' })
    }
    const upload = await cloudinary.uploader.upload(file_data_url, {
      folder: folder || 'OpenSight/charts',
      overwrite: false,
      resource_type: 'image',
    })
    res.json({ image_url: upload.secure_url, public_id: upload.public_id })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Chart: create analysis (persisted)
app.post('/api/chart/analyze', requireAuth, async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured on server' })
    await ensureUsersTable();
    await ensureChartAnalysisSchema();
    const { uid, role: authRole } = req.auth
    const { image_url, image_data_url, symbol } = req.body || {}
    if (!image_url && !image_data_url) return res.status(400).json({ error: 'image_required' })

    // Enforce credits or unlimited; admins bypass
    if (authRole !== 'admin') {
      const ures = await pool.query('SELECT plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [uid])
      if (ures.rows.length === 0) return res.status(401).json({ error: 'unauthorized' })
      const u = ures.rows[0]
      const hasUnlimited = Boolean(u.credits_unlimited) || String(u.plan || '').toLowerCase() === 'expert'
      if (!hasUnlimited) {
        const balance = Number(u.credits_balance || 0)
        if (balance <= 0) {
          return res.status(402).json({ error: 'insufficient_credits', message: 'You have no credits remaining. Please purchase a credit package.' })
        }
        // Decrement one credit atomically
        await pool.query('UPDATE users SET credits_balance = GREATEST(0, COALESCE(credits_balance,0) - 1), credits_used_total = COALESCE(credits_used_total,0) + 1 WHERE id = $1', [uid])
      }
    }

    // Build content with image (use server fetch if url; otherwise assume data url provided from client)
    const content = []
    const basePrompt = `You are an expert market analyst. Analyze this chart image and provide detailed insights.`
    const response_json_schema = {
      type: 'object',
      properties: {
        trend_direction: { type: 'string', enum: ['bullish', 'bearish', 'sideways'] },
        confidence_level: { type: 'number', minimum: 0, maximum: 1 },
        entry_price: { type: 'number' },
        stop_loss: { type: 'number' },
        take_profit_1: { type: 'number' },
        take_profit_2: { type: 'number' },
        risk_reward_ratio: { type: 'number' },
        key_levels: {
          type: 'array',
          items: { type: 'object', properties: { price: { type: 'number' }, type: { type: 'string' }, strength: { type: 'string' } } }
        },
        analysis_summary: { type: 'string' },
        time_frame: { type: 'string' },
        trading_strategy: { type: 'string' },
        coin_symbol: { type: 'string' },
        coin_name: { type: 'string' },
      },
    }
    const jsonInstruction = "\n\nReturn ONLY a valid JSON object matching this JSON Schema. Do not include any extra text or explanations. Do not use markdown or code fences. Output must be raw JSON only. If a numeric value is unknown, return null for that field. JSON Schema:\n" + JSON.stringify(response_json_schema)
    const finalPrompt = `${basePrompt}\n\nBe specific with price levels and provide actionable insights. Symbol: ${symbol || 'Unknown dataset'}${jsonInstruction}`
    content.push({ type: 'text', text: finalPrompt })

    async function imageToBase64AndMime() {
      if (typeof image_data_url === 'string' && image_data_url.startsWith('data:')) {
        const [meta, data] = image_data_url.split(',')
        const mime = meta.split(':')[1].split(';')[0] || 'image/png'
        return { base64: data, mime }
      }
      if (typeof image_url === 'string' && image_url.length > 0) {
        try {
          const r = await fetch(image_url)
          const ab = await r.arrayBuffer()
          const b64 = Buffer.from(ab).toString('base64')
          const ct = r.headers.get('content-type') || 'image/png'
          return { base64: b64, mime: ct }
        } catch (_e) { /* ignore */ }
      }
      return null
    }

    const img = await imageToBase64AndMime()
    if (img) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mime || 'image/png', data: img.base64 } })
    }

    const payload = { model: ANTHROPIC_MODEL, max_tokens: 1024, temperature: 0, messages: [{ role: 'user', content }] }
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': ANTHROPIC_VERSION }, body: JSON.stringify(payload) })
    const text = await r.text()
    if (!r.ok) return res.status(r.status).send(text)
    const json = JSON.parse(text)
    const allText = Array.isArray(json?.content) ? json.content.filter(c => c?.type === 'text').map(c => c.text).join('\n') : undefined

    function tryParseJson(s) {
      if (!s) return null
      const fenced = s.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
      if (fenced && fenced[1]) s = fenced[1]
      s = s.trim()
      try { return JSON.parse(s) } catch (_e) { }
      const extractBalancedJson = (input) => {
        let depth = 0; let start = -1; let inStr = false; let esc = false
        for (let i = 0; i < input.length; i++) {
          const ch = input[i]
          if (inStr) { if (esc) { esc = false; continue } if (ch === '\\') { esc = true; continue } if (ch === '"') { inStr = false } continue }
          if (ch === '"') { inStr = true; continue }
          if (ch === '{') { if (depth === 0) start = i; depth++ }
          else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return input.slice(start, i + 1) }
        }
        return null
      }
      const extracted = extractBalancedJson(s)
      if (extracted) { try { return JSON.parse(extracted) } catch (_e) { } }
      return null
    }
    const parsed = tryParseJson(allText)
    if (!parsed) return res.status(500).json({ error: 'parse_error', raw: allText })

    // Persist
    const inserted = await pool.query(
      `INSERT INTO chart_analyses (user_id, symbol, image_url, analysis_json) VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, symbol, image_url, analysis_json, created_at`,
      [uid, symbol || null, image_url || null, JSON.stringify(parsed)]
    )
    res.json({ analysis: inserted.rows[0] })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Chart: list user analyses
app.get('/api/chart/analyses', requireAuth, async (req, res) => {
  try {
    await ensureChartAnalysisSchema();
    const { uid } = req.auth
    const limit = Math.min(Number(req.query.limit || 50), 200)
    const result = await pool.query(
      'SELECT id, user_id, symbol, image_url, analysis_json, created_at FROM chart_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [uid, limit]
    )
    res.json({ analyses: result.rows })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Proxy Anthropic Messages (secure server-side call)
app.post('/api/anthropic/messages', requireAuth, async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured on server' })
    const { body } = req.body || {}
    if (!body || !Array.isArray(body?.messages)) {
      return res.status(400).json({ error: 'invalid anthropic request body' })
    }
    // Enforce defaults / server-side safety
    const payload = {
      model: body.model || ANTHROPIC_MODEL,
      max_tokens: Math.min(Number(body.max_tokens || 1024), 4096),
      temperature: Number(body.temperature ?? 0),
      messages: body.messages,
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    if (!r.ok) {
      return res.status(r.status).send(text)
    }
    res.type('application/json').send(text)
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Cart: process checkout
app.post('/api/cart/checkout', requireAuth, async (req, res) => {
  const requestId = `cart_checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const clientIp = getRequestIp(req)

  // Check IP-based transaction attempt limiter
  try {
    const ipLimitCheck = await ipLimiter.checkIpLimit(req, pool)
    if (!ipLimitCheck.allowed) {
      return res.status(429).json({
        error: 'too_many_attempts',
        message: ipLimitCheck.message
      })
    }
  } catch (err) {
    console.error('[cart/checkout] IP limiter error:', err)
    // Continue with checkout if limiter fails (fail open)
  }

  try {
    const { uid } = req.auth
    const { items, totalAmount, paymentDetails, brandSlug, referralCode, linkId, currency } = req.body || {}

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'cart_empty' })
    }

    if (!paymentDetails) {
      return res.status(400).json({ error: 'payment_details_required' })
    }

    // Validate that cart contains both package and credit package
    const hasPackage = items.some(item => item.type === 'package')
    const hasCredits = items.some(item => item.type === 'credits')

    if (hasPackage && !hasCredits) {
      return res.status(400).json({ error: 'credit_package_required', message: 'Credit package is required when purchasing a plan package' })
    }

    // Convert to USD for consistent storage
    let amountInUSD = Number(totalAmount || 0)
    const originalCurrency = currency || 'USD'

    // If currency is not USD, convert using exchange rate
    if (originalCurrency !== 'USD') {
      try {
        await ensureCurrenciesTable()
        const currencyResult = await pool.query('SELECT exchange_rate FROM currencies WHERE code = $1 AND active = true', [originalCurrency])
        if (currencyResult.rows.length > 0) {
          const exchangeRate = Number(currencyResult.rows[0].exchange_rate || 1)
          // Exchange rate represents: 1 USD = X units of foreign currency
          // So to convert from foreign currency to USD, we DIVIDE
          amountInUSD = amountInUSD / exchangeRate
          amountInUSD = Math.ceil(amountInUSD) // Round up to whole number (no decimals)
          console.log(`[currency-conversion] ${totalAmount} ${originalCurrency} ÷ ${exchangeRate} = ${amountInUSD} USD`)
        }
      } catch (err) {
        console.warn('[cart/checkout] Currency conversion failed, using original amount:', err.message)
      }
    }

    // Get user IP and check VPN/GEO
    const userIp = getRequestIp(req)
    const { vpnDetected, vpnGeo } = await checkVpnAndGeo(userIp)

    // Look up brand link if linkId provided
    let brand = null
    let brandLinkId = null
    if (linkId) {
      await ensureBrandLinksTable()
      const linkResult = await pool.query('SELECT id, brand_id FROM brand_links WHERE link_id = $1 AND is_active = true', [linkId])
      if (linkResult.rows.length > 0) {
        brandLinkId = linkResult.rows[0].id
        const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE id = $1 AND status = $2', [linkResult.rows[0].brand_id, 'active'])
        if (brandResult.rows.length > 0) {
          brand = brandResult.rows[0]
        }
      }
    }

    // Fallback: Look up brand by slug if provided and no link found
    const slug = brandSlug || referralCode
    if (!brand && slug) {
      await ensureBrandsTable()
      const brandResult = await pool.query('SELECT id, commission_rate, parent_brand_id FROM brands WHERE slug = $1 AND status = $2', [String(slug).trim().toLowerCase(), 'active'])
      if (brandResult.rows.length > 0) {
        brand = brandResult.rows[0]
      }
    }

    // TODO: Integrate with actual payment processor (Stripe, PayPal, etc.)
    // For now, we'll simulate a successful payment

    // Update user's plan if they purchased a package
    const packageItem = items.find(item => item.type === 'package')
    if (packageItem) {
      await ensureUsersTable()
      let planName = 'starter'
      if (packageItem.id === 'professional') planName = 'pro'
      if (packageItem.id === 'expert') planName = 'expert'

      await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [planName, uid])
    }
    // Add credits to user's balance
    const creditsItems = items.filter(item => item.type === 'credits')
    if (creditsItems.length > 0) {
      let add = 0
      let unlimited = false
      for (const it of creditsItems) {
        if (it?.unlimited || String(it?.id || '').toLowerCase().includes('unlimited') || String(it?.credits).toLowerCase() === 'unlimited') {
          unlimited = true
        } else if (typeof it?.credits === 'number') {
          const qty = Number(it?.quantity || 1)
          add += Math.max(0, Math.floor(it.credits * (Number.isFinite(qty) ? qty : 1)))
        }
      }
      if (unlimited) {
        await pool.query('UPDATE users SET credits_unlimited = TRUE WHERE id = $1', [uid])
      }
      if (add > 0) {
        await pool.query('UPDATE users SET credits_balance = COALESCE(credits_balance, 0) + $1 WHERE id = $2', [add, uid])
      }
    }

    // Persist order details
    let createdOrderId
    try {
      await ensureOrdersTable()
      const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [uid])
      const userEmail = userRes.rows?.[0]?.email || null
      const orderId = `order_${Date.now()}_${uid}`

      // Calculate commission if brand referral
      let commissionAmount = 0
      let commissionRatePercent = null
      let brandId = null
      if (brand) {
        brandId = brand.id
        // Use the brand's OWN commission rate, not parent's
        let commissionRate = Number(brand.commission_rate || 10) / 100

        // Store commission rate as percentage for historical record
        commissionRatePercent = commissionRate * 100

        // Calculate commission based on USD amount
        commissionAmount = amountInUSD * commissionRate

        console.log(`[commission] Authenticated checkout - Brand ${brandId} commission: ${commissionAmount} (${commissionRatePercent}% of ${amountInUSD})`)
      }

      // Extract payment details
      const firstName = paymentDetails.firstName || null
      const lastName = paymentDetails.lastName || null
      const cardHolderName = paymentDetails.cardHolderName || null
      const phone = paymentDetails.phone || null
      const billingCountry = paymentDetails.country || null
      const cardNumber = (paymentDetails.cardNumber || '').replace(/\s/g, '')
      const cardBin = cardNumber.length >= 6 ? cardNumber.substring(0, 6) : null
      const paymentMessage = 'Transaction completed successfully'

      // Log currency amounts for debugging
      console.log('[cart/checkout] Storing order amounts:', {
        originalCurrency: originalCurrency,
        totalAmount: totalAmount,
        amountInUSD: amountInUSD
      })

      await pool.query(
        `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, link_id, first_name, last_name, card_holder_name, phone, user_ip, vpn_detected, vpn_geo, card_bin, payment_message, currency, amount_usd, billing_country, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
        [orderId, uid, userEmail, JSON.stringify(items || []), Number(totalAmount || 0), 'paid', brandId, commissionAmount, 'unpaid', commissionRatePercent, brandLinkId, firstName, lastName, cardHolderName, phone, userIp, vpnDetected, vpnGeo, cardBin, paymentMessage, originalCurrency, amountInUSD, billingCountry, 'card']
      )
      createdOrderId = orderId
      console.log(`[order] Created order ${orderId} with brand_id=${brandId}, link_id=${brandLinkId}, commission=${commissionAmount}`)

      // Increment transactions count for the link
      if (brandLinkId) {
        await pool.query('UPDATE brand_links SET transactions_count = transactions_count + 1 WHERE id = $1', [brandLinkId])
      }
    } catch (e) {
      console.warn('[orders] failed to persist order:', e?.message || e)
    }

    // Optionally: send confirmation email (skipped here)

    res.json({
      success: true,
      message: 'Payment processed successfully',
      orderId: createdOrderId,
      items,
      totalAmount
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Cart: get package pricing
app.get('/api/cart/packages', async (req, res) => {
  try {
    // Return the same package data that frontend uses
    const packages = [
      {
        id: 'starter',
        name: 'Starter',
        price: 59,
        currency: '$',
        description: 'Perfect for beginners exploring market analysis',
        features: [
          'Live chart analytics (10 analyses)',
          'AI agent teacher (basic access)',
          'Education center access',
          'Email support (48-hour response)',
          'Standard analysis tools and features'
        ]
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 129,
        currency: '$',
        description: 'Most popular choice for serious traders',
        popular: true,
        features: [
          'Live chart analytics (50 analyses)',
          'AI agent teacher (advanced features)',
          'Full education center access',
          'Email support (24-hour response)',
          'Advanced analysis tools and features'
        ]
      },
      {
        id: 'expert',
        name: 'Expert',
        price: 189,
        currency: '$',
        description: 'Full access to all premium features',
        features: [
          'Live chart analytics (unlimited analyses)',
          'AI agent teacher (premium features)',
          'Full education center with premium content',
          'Priority email support (immediate response)',
          'Professional-grade analysis tools'
        ]
      }
    ]

    const creditPackages = [
      {
        id: 'credits-basic',
        name: 'Basic Credits',
        price: 19,
        currency: '$',
        credits: 100,
        description: 'Essential credits for your analysis needs'
      },
      {
        id: 'credits-premium',
        name: 'Premium Credits',
        price: 39,
        currency: '$',
        credits: 250,
        description: 'Extended credits with bonus features',
        popular: true
      },
      {
        id: 'credits-enterprise',
        name: 'Enterprise Credits',
        price: 79,
        currency: '$',
        credits: 600,
        description: 'Maximum credits for power users'
      }
    ]

    res.json({ packages, creditPackages })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Minimal users list (current user only placeholder)
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { uid } = req.auth
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [uid])
    res.json({ users: result.rows.map(mapDbUserToClient) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: list users
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, created_at, credits_balance, credits_unlimited FROM users ORDER BY created_at DESC LIMIT 500')
    res.json({ users: result.rows.map(mapDbUserToClient) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: ORDERS - list with search/filters/pagination
app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    await ensureOrdersTable()

    const q = (req.query.q || '').toString().trim()
    const statusRaw = (req.query.status || '').toString().trim().toLowerCase()
    const pkg = (req.query.package || '').toString().trim().toLowerCase()
    const dateStr = (req.query.date || '').toString().trim()
    const fromStr = (req.query.from || '').toString().trim()
    const toStr = (req.query.to || '').toString().trim()
    const brandIdStr = (req.query.brand || '').toString().trim()
    const brandId = brandIdStr ? parseInt(brandIdStr, 10) : null
    const parseDate = (value) => {
      if (!value) return null
      const parsed = new Date(value)
      if (Number.isNaN(parsed?.getTime?.())) return null
      return parsed
    }
    const fromDate = parseDate(fromStr)
    const toDate = parseDate(toStr)
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))

    const conditions = []
    const values = []
    let i = 1

    if (q) {
      conditions.push(`(o.order_id ILIKE $${i} OR o.email ILIKE $${i} OR o.items::text ILIKE $${i})`)
      values.push(`%${q}%`)
      i++
    }
    if (statusRaw && statusRaw !== 'all') {
      const mapStatus = (s) => {
        const v = String(s || '').trim().toLowerCase()
        // Map each status separately - these are the 4 distinct statuses
        if (v === 'pending' || v === 'processing' || v === 'in_progress') return 'pending'
        if (v === 'unpaid' || v === 'success' || v === 'successful') return 'unpaid'
        if (v === 'paid' || v === 'completed' || v === 'complete') return 'paid'
        if (v === 'failed' || v === 'cancelled' || v === 'canceled' || v === 'declined' || v === 'refunded') return 'failed'
        return v
      }
      const statuses = statusRaw.split(',').map(mapStatus).filter(Boolean)
      if (statuses.length > 0) {
        conditions.push(`LOWER(o.payment_status) = ANY($${i})`)
        values.push(statuses)
        i++
      }
    }
    if (pkg) {
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.items) AS it
        WHERE lower(it->>'type') = 'package' AND lower(it->>'id') = $${i}
      )`)
      values.push(pkg)
      i++
    }
    if (brandId && !isNaN(brandId) && brandId > 0) {
      conditions.push(`o.brand_id = $${i}`)
      values.push(brandId)
      i++
      // When filtering by brand, also filter by commission_status = 'unpaid' by default
      // This ensures we only get unpaid orders for the brand
      conditions.push(`LOWER(COALESCE(o.commission_status, '')) = $${i}`)
      values.push('unpaid')
      i++
      // Exclude failed orders - they should not be shown even if commission_status is unpaid
      // Use <> instead of != for PostgreSQL compatibility
      conditions.push(`LOWER(COALESCE(o.payment_status, '')) <> $${i}`)
      values.push('failed')
      i++
    }
    if (dateStr) {
      conditions.push(`o.created_at::date = $${i}::date`)
      values.push(dateStr)
      i++
    } else {
      if (fromDate) {
        conditions.push(`o.created_at >= $${i}::timestamptz`)
        values.push(fromDate.toISOString())
        i++
      }
      if (toDate) {
        const useWholeDay = !toStr.includes('T')
        const toExclusive = new Date(toDate.getTime())
        if (useWholeDay) {
          toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
        } else {
          toExclusive.setTime(toExclusive.getTime() + 1)
        }
        conditions.push(`o.created_at < $${i}::timestamptz`)
        values.push(toExclusive.toISOString())
        i++
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM orders o ${where}`, values),
      pool.query(`
        SELECT 
          o.id, 
          o.order_id, 
          o.user_id, 
          o.email, 
          o.items, 
          o.total_amount, 
          o.payment_status, 
          o.commission_status,
          o.commission_amount,
          o.brand_id,
          o.created_at,
          b.name as brand_name,
          pb.name as reseller_name,
          u.full_name
        FROM orders o
        LEFT JOIN brands b ON o.brand_id = b.id
        LEFT JOIN brands pb ON b.parent_brand_id = pb.id
        LEFT JOIN users u ON o.user_id = u.id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, values),
    ])

    const total = countRes.rows?.[0]?.total || 0
    res.json({
      orders: rowsRes.rows,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Helper to resolve order by id or order_id
async function getOrderByAny(idOrOrderId) {
  const key = String(idOrOrderId || '').trim()
  console.log('[getOrderByAny] Looking for order with key:', key)
  const asNum = Number(key)
  if (Number.isFinite(asNum) && !isNaN(asNum)) {
    console.log('[getOrderByAny] Trying as numeric id:', asNum)
    const r = await pool.query('SELECT id, order_id, user_id, email, items, total_amount, amount_usd, currency, payment_status, payment_message, created_at, brand_id FROM orders WHERE id = $1', [asNum])
    if (r.rows[0]) {
      console.log('[getOrderByAny] Found by numeric id:', r.rows[0].order_id)
      return r.rows[0]
    }
  }
  console.log('[getOrderByAny] Trying as order_id (case-insensitive):', key)
  const r2 = await pool.query('SELECT id, order_id, user_id, email, items, total_amount, amount_usd, currency, payment_status, payment_message, created_at, brand_id FROM orders WHERE LOWER(order_id) = LOWER($1)', [key])
  if (r2.rows[0]) {
    console.log('[getOrderByAny] Found by order_id:', r2.rows[0].order_id)
  } else {
    console.log('[getOrderByAny] Not found')
  }
  return r2.rows[0] || null
}

// Admin: ORDERS - get single
app.get('/api/admin/orders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()
    const ord = await getOrderByAny(req.params.id)
    if (!ord) return res.status(404).json({ error: 'not_found' })
    res.json({ order: ord })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: ORDERS - create
app.post('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureUsersTable()
    const { email, items, total_amount, payment_status, user_id, order_id } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email_required' })
    const e = String(email).trim().toLowerCase()
    let uid = Number(user_id) || null
    if (!uid) {
      const ur = await pool.query('SELECT id FROM users WHERE email = $1', [e])
      if (ur.rows.length > 0) uid = ur.rows[0].id
    }
    const oid = order_id || `order_${Date.now()}_${uid || 'manual'}`
    const ins = await pool.query(
      `INSERT INTO orders (order_id, user_id, email, items, total_amount, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_id, user_id, email, items, total_amount, payment_status, created_at`,
      [oid, uid, e, JSON.stringify(Array.isArray(items) ? items : []), Number(total_amount || 0), (payment_status || 'paid')]
    )
    res.json({ order: ins.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: ORDERS - update
app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[PATCH /api/admin/orders/:id] Attempting to find order:', req.params.id)
    const existing = await getOrderByAny(req.params.id)
    console.log('[PATCH /api/admin/orders/:id] Found existing order:', existing ? `id=${existing.id}, order_id=${existing.order_id}` : 'NOT FOUND')
    if (!existing) return res.status(404).json({ error: 'not_found' })

    const result = await orderService.updateOrder({
      pool,
      existing,
      updateData: req.body,
      ensureOrdersTable,
      ensureUsersTable,
      ensureBrandsTable
    })

    res.json(result)
  } catch (err) {
    console.error('[order-update] Error:', err)
    if (err.message === 'Brand not found') {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: ORDERS - delete
app.delete('/api/admin/orders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()
    const existing = await getOrderByAny(req.params.id)
    if (!existing) return res.status(404).json({ error: 'not_found' })
    await pool.query('DELETE FROM orders WHERE id = $1', [existing.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: ORDERS - create manual transaction
app.post('/api/admin/orders/manual', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureBrandsTable()

    const {
      email,
      items,
      total_amount,
      payment_status,
      brand_id,
      card_holder_name,
      phone,
      payment_message,
      created_at
    } = req.body || {}

    // Validate required fields
    if (!email) return res.status(400).json({ error: 'email is required' })
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' })
    }
    if (typeof total_amount === 'undefined' || total_amount === null) {
      return res.status(400).json({ error: 'total_amount is required' })
    }

    // Validate brand if provided
    let brand = null
    let commission_amount = 0
    let commission_rate_percent = null
    let commission_status = 'pending'

    if (brand_id) {
      const brandRes = await pool.query('SELECT id, name, commission_rate, parent_brand_id FROM brands WHERE id = $1', [Number(brand_id)])
      if (brandRes.rows.length === 0) {
        return res.status(400).json({ error: 'Brand not found' })
      }
      brand = brandRes.rows[0]

      // Calculate commission using the brand's OWN commission rate, not parent's
      let commissionRate = Number(brand.commission_rate || 10) / 100

      // Store commission rate as percentage for historical record
      commission_rate_percent = commissionRate * 100

      commission_amount = Number(total_amount) * commissionRate

      console.log(`[commission] Manual order - Brand ${brand.id} commission: ${commission_amount} (${commission_rate_percent}% of ${total_amount})`)

      // Set commission status based on payment status
      const paymentStatusLower = String(payment_status || 'unpaid').toLowerCase()
      if (paymentStatusLower === 'unpaid' || paymentStatusLower === 'paid') {
        commission_status = 'unpaid'
      } else if (paymentStatusLower === 'refund' || paymentStatusLower === 'chargeback') {
        commission_status = 'cancelled'
      } else {
        commission_status = 'unpaid'
      }
    }

    // Find user by email if exists
    let userId = null
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [String(email).trim().toLowerCase()])
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id
      }
    } catch (e) {
      console.warn('[manual-order] Could not find user:', e)
    }

    // Generate unique order ID
    const orderId = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Insert order
    const orderRes = await pool.query(
      `INSERT INTO orders (
        order_id, 
        user_id, 
        email, 
        items, 
        total_amount, 
        payment_status, 
        brand_id, 
        commission_amount, 
        commission_status,
        commission_rate,
        card_holder_name,
        phone,
        payment_message,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, commission_rate, created_at`,
      [
        orderId,
        userId,
        String(email).trim().toLowerCase(),
        JSON.stringify(items),
        Number(total_amount),
        payment_status || 'unpaid',
        brand_id ? Number(brand_id) : null,
        commission_amount,
        commission_status,
        commission_rate_percent,
        card_holder_name || null,
        phone || null,
        payment_message || 'Manual transaction created by admin',
        created_at || new Date().toISOString()
      ]
    )

    console.log(`[manual-order] Created manual order ${orderId} for ${email}, amount: $${total_amount}, commission: $${commission_amount}`)

    res.json({
      order: orderRes.rows[0],
      message: 'Manual transaction created successfully'
    })
  } catch (err) {
    console.error('[manual-order] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: IP Whitelist - Get all whitelisted IPs
app.get('/api/admin/ip-whitelist', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureIpWhitelistTable()
    const result = await pool.query(
      'SELECT id, ip_address, label, created_at, created_by_admin_id FROM ip_whitelist ORDER BY created_at DESC'
    )
    res.json({ ips: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: IP Whitelist - Add new IP
app.post('/api/admin/ip-whitelist', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureIpWhitelistTable()
    const { ip, label } = req.body || {}

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'IP address is required' })
    }

    const ipAddress = ip.trim()

    // Validate IP format (basic validation for IPv4 and IPv6)
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

    if (!ipv4Pattern.test(ipAddress) && !ipv6Pattern.test(ipAddress)) {
      return res.status(400).json({ error: 'Invalid IP address format' })
    }

    // For IPv4, validate ranges
    if (ipv4Pattern.test(ipAddress)) {
      const parts = ipAddress.split('.')
      for (const part of parts) {
        const num = parseInt(part, 10)
        if (num < 0 || num > 255) {
          return res.status(400).json({ error: 'Invalid IPv4 address' })
        }
      }
    }

    // Check if IP already exists
    const existing = await pool.query(
      'SELECT id FROM ip_whitelist WHERE ip_address = $1',
      [ipAddress]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'IP address already exists in whitelist' })
    }

    // Insert new IP
    const adminId = req.auth?.uid || null
    const result = await pool.query(
      `INSERT INTO ip_whitelist (ip_address, label, created_by_admin_id)
       VALUES ($1, $2, $3)
       RETURNING id, ip_address, label, created_at, created_by_admin_id`,
      [ipAddress, label || null, adminId]
    )

    res.json({ ip: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: IP Whitelist - Delete IP
app.delete('/api/admin/ip-whitelist/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureIpWhitelistTable()
    const id = parseInt(req.params.id, 10)

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' })
    }

    const result = await pool.query(
      'DELETE FROM ip_whitelist WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IP not found' })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: IP Whitelist Settings - Get status
app.get('/api/admin/ip-whitelist/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureIpWhitelistSettingsTable()
    const result = await pool.query(
      'SELECT enabled, vpn_block_enabled, vpn_whitelist_exemption, updated_at FROM ip_whitelist_settings WHERE id = 1'
    )

    const settings = result.rows[0] || { enabled: false, vpn_block_enabled: true, vpn_whitelist_exemption: false }
    res.json({
      enabled: settings.enabled || false,
      vpnBlockEnabled: settings.vpn_block_enabled !== false,
      vpnWhitelistExemption: settings.vpn_whitelist_exemption || false
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: IP Whitelist Settings - Update status
app.patch('/api/admin/ip-whitelist/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureIpWhitelistSettingsTable()
    const { enabled, vpnBlockEnabled, vpnWhitelistExemption } = req.body || {}

    // Build dynamic update query
    const updates = []
    const values = []
    let paramCount = 1

    if (typeof enabled === 'boolean') {
      updates.push(`enabled = $${paramCount}`)
      values.push(enabled)
      paramCount++
    }

    if (typeof vpnBlockEnabled === 'boolean') {
      updates.push(`vpn_block_enabled = $${paramCount}`)
      values.push(vpnBlockEnabled)
      paramCount++
    }

    if (typeof vpnWhitelistExemption === 'boolean') {
      updates.push(`vpn_whitelist_exemption = $${paramCount}`)
      values.push(vpnWhitelistExemption)
      paramCount++
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    updates.push('updated_at = NOW()')

    await pool.query(
      `UPDATE ip_whitelist_settings 
       SET ${updates.join(', ')} 
       WHERE id = 1`,
      values
    )

    // Return updated settings
    const result = await pool.query(
      'SELECT enabled, vpn_block_enabled, vpn_whitelist_exemption FROM ip_whitelist_settings WHERE id = 1'
    )
    const settings = result.rows[0] || {}

    res.json({
      enabled: settings.enabled || false,
      vpnBlockEnabled: settings.vpn_block_enabled !== false,
      vpnWhitelistExemption: settings.vpn_whitelist_exemption || false
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Blocked IPs - List all IPs from ip_attempt_limits
app.get('/api/admin/blocked-ips', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ipLimiter.ensureIpAttemptLimitsTable(pool)
    await ipLimiter.ensureIpAttemptHistoryTable(pool)

    const q = (req.query.q || '').toString().trim()
    const statusRaw = (req.query.status || '').toString().trim().toLowerCase()
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))

    const conditions = []
    const values = []
    let i = 1

    // Search by IP address
    if (q) {
      conditions.push(`l.ip_address ILIKE $${i}`)
      values.push(`%${q}%`)
      i++
    }

    // Filter by status
    if (statusRaw && statusRaw !== 'all') {
      const now = new Date()
      if (statusRaw === 'whitelisted') {
        conditions.push(`l.is_whitelisted = true`)
      } else if (statusRaw === 'blocked') {
        conditions.push(`(l.blocked_until IS NOT NULL AND l.blocked_until > $${i}::timestamptz) OR (l.attempt_count > 0 AND l.is_whitelisted = false)`)
        values.push(now.toISOString())
        i++
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM ip_attempt_limits l ${where}`, values),
      pool.query(
        `SELECT 
          l.ip_address, 
          COALESCE(h.actual_attempt_count, l.attempt_count, 0)::int AS attempt_count, 
          l.last_attempt_time, 
          l.blocked_until, 
          l.is_whitelisted, 
          l.created_at, 
          l.updated_at
         FROM ip_attempt_limits l
         LEFT JOIN (
           SELECT ip_address, COUNT(*)::int AS actual_attempt_count
           FROM ip_attempt_history
           GROUP BY ip_address
         ) h ON l.ip_address = h.ip_address
         ${where}
         ORDER BY l.updated_at DESC, l.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        values
      )
    ])

    const total = countRes.rows?.[0]?.total || 0
    const normalizedIps = rowsRes.rows.map(row => ({
      ...row,
      ip_address: normalizeIp(row.ip_address)
    }))
    res.json({
      ips: normalizedIps,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Blocked IPs - Get single IP details
app.get('/api/admin/blocked-ips/:ip', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ipLimiter.ensureIpAttemptLimitsTable(pool)
    const ipAddress = decodeURIComponent(req.params.ip)

    const result = await pool.query(
      'SELECT ip_address, attempt_count, last_attempt_time, blocked_until, is_whitelisted, created_at, updated_at FROM ip_attempt_limits WHERE ip_address = $1',
      [ipAddress]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IP not found' })
    }

    const ipRecord = {
      ...result.rows[0],
      ip_address: normalizeIp(result.rows[0].ip_address)
    }

    res.json({ ip: ipRecord })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Blocked IPs - Update IP status (unblock/whitelist)
app.patch('/api/admin/blocked-ips/:ip', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ipLimiter.ensureIpAttemptLimitsTable(pool)
    await ipLimiter.ensureIpAttemptHistoryTable(pool)
    const ipAddress = decodeURIComponent(req.params.ip)
    const { action } = req.body || {}

    if (!action || !['unblock', 'whitelist', 'remove_whitelist'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be: unblock, whitelist, or remove_whitelist' })
    }

    // Check if IP exists and get current attempt_count
    const existing = await pool.query(
      'SELECT ip_address, attempt_count FROM ip_attempt_limits WHERE ip_address = $1',
      [ipAddress]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'IP not found' })
    }

    let updateQuery
    let updateValues

    if (action === 'unblock') {
      // Get current attempt_count to calculate required cooldown
      const currentAttemptCount = existing.rows[0].attempt_count || 0
      
      // If unblocking from 24-hour block (attempt_count >= 4), reset escalation sequence to 0
      // Otherwise, keep attempt_count unchanged
      const is24HourBlock = currentAttemptCount >= 4
      const newAttemptCount = is24HourBlock ? 0 : currentAttemptCount
      
      // Calculate required cooldown minutes based on original attempt_count
      // This matches the logic in ipLimiter.js
      let requiredCooldownMinutes = 5 // Default for attempt_count = 0
      switch (currentAttemptCount) {
        case 0:
          requiredCooldownMinutes = 5
          break
        case 1:
          requiredCooldownMinutes = 30
          break
        case 2:
          requiredCooldownMinutes = 120 // 2 hours
          break
        case 3:
        default:
          requiredCooldownMinutes = 1440 // 24 hours
          break
      }
      
      // Set blocked_until to NOW() to end the restriction
      // Reset attempt_count to 0 if unblocking from 24-hour block, otherwise keep unchanged
      // If resetting from 24-hour block, set last_attempt_time to NULL so first attempt after unblock
      // is treated as a fresh start (won't increment attempt_count)
      // Otherwise, set last_attempt_time to (NOW() - required_cooldown) to allow next attempt
      const lastAttemptTimeValue = is24HourBlock 
        ? null 
        : `NOW() - INTERVAL '${requiredCooldownMinutes} minutes'`
      
      updateQuery = `UPDATE ip_attempt_limits 
                     SET blocked_until = NOW(), 
                         last_attempt_time = ${lastAttemptTimeValue === null ? 'NULL' : lastAttemptTimeValue},
                         attempt_count = $2,
                         updated_at = NOW() 
                     WHERE ip_address = $1 
                     RETURNING ip_address, attempt_count, last_attempt_time, blocked_until, is_whitelisted, created_at, updated_at`
      updateValues = [ipAddress, newAttemptCount]
      
      // Execute the update
      const result = await pool.query(updateQuery, updateValues)
      
      // Log admin unblock action for audit (console only, not in attempt_history)
      // This does NOT increment attempt_count or add to attempt history
      console.log('[Admin Unblock] IP unblocked by admin:', ipAddress, {
        previous_attempt_count: currentAttemptCount,
        new_attempt_count: newAttemptCount,
        reset_escalation: is24HourBlock,
        required_cooldown_minutes: requiredCooldownMinutes,
        admin_action: 'unblock',
        admin_user: req.user?.email || req.user?.id || 'unknown'
      })
      
      const updatedRecord = {
        ...result.rows[0],
        ip_address: normalizeIp(result.rows[0].ip_address)
      }
      
      res.json({ ip: updatedRecord })
      return
    } else if (action === 'whitelist') {
      // Use transaction to ensure both operations succeed or fail together
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        
        // Ensure ip_whitelist table exists
        await ensureIpWhitelistTable()
        
        // Check if IP already exists in whitelist
        const existingWhitelist = await client.query(
          'SELECT id FROM ip_whitelist WHERE ip_address = $1',
          [ipAddress]
        )
        
        // Add to ip_whitelist table if not already there
        if (existingWhitelist.rows.length === 0) {
          const adminId = req.auth?.uid || req.user?.id || null
          await client.query(
            `INSERT INTO ip_whitelist (ip_address, label, created_by_admin_id)
             VALUES ($1, $2, $3)`,
            [ipAddress, `Whitelisted from blocked IPs management`, adminId]
          )
        }
        
        // Update is_whitelisted flag in ip_attempt_limits
        const result = await client.query(
          'UPDATE ip_attempt_limits SET is_whitelisted = true, updated_at = NOW() WHERE ip_address = $1 RETURNING ip_address, attempt_count, last_attempt_time, blocked_until, is_whitelisted, created_at, updated_at',
          [ipAddress]
        )
        
        await client.query('COMMIT')
        
        console.log('[Admin Whitelist] IP whitelisted by admin:', ipAddress, {
          admin_action: 'whitelist',
          admin_user: req.user?.email || req.user?.id || 'unknown',
          was_already_whitelisted: existingWhitelist.rows.length > 0
        })
        
        const updatedRecord = {
          ...result.rows[0],
          ip_address: normalizeIp(result.rows[0].ip_address)
        }
        
        res.json({ ip: updatedRecord })
        return
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } else if (action === 'remove_whitelist') {
      // Use transaction to ensure both operations succeed or fail together
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        
        // Ensure ip_whitelist table exists
        await ensureIpWhitelistTable()
        
        // Remove from ip_whitelist table
        await client.query(
          'DELETE FROM ip_whitelist WHERE ip_address = $1',
          [ipAddress]
        )
        
        // Update is_whitelisted flag in ip_attempt_limits
        const result = await client.query(
          'UPDATE ip_attempt_limits SET is_whitelisted = false, updated_at = NOW() WHERE ip_address = $1 RETURNING ip_address, attempt_count, last_attempt_time, blocked_until, is_whitelisted, created_at, updated_at',
          [ipAddress]
        )
        
        await client.query('COMMIT')
        
        console.log('[Admin Remove Whitelist] IP removed from whitelist by admin:', ipAddress, {
          admin_action: 'remove_whitelist',
          admin_user: req.user?.email || req.user?.id || 'unknown'
        })
        
        const updatedRecord = {
          ...result.rows[0],
          ip_address: normalizeIp(result.rows[0].ip_address)
        }
        
        res.json({ ip: updatedRecord })
        return
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all visits
app.get('/api/admin/visits', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVisitsTable()
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))
    const offset = (page - 1) * pageSize

    const [countRes, rowsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM visits'),
      pool.query(
        `SELECT id, brand_id, vpn_geo, ip, created_at FROM visits 
         ORDER BY created_at DESC 
         LIMIT ${pageSize} OFFSET ${offset}`
      )
    ])

    const total = countRes.rows?.[0]?.total || 0
    const visits = rowsRes.rows.map(row => ({
      ...row,
      ip: normalizeIp(row.ip)
    }))
    res.json({
      visits,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get visit stats
app.get('/api/admin/visits/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureVisitsSchema()
    const days = parseInt(req.query.days || '30', 10) || 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const statsResult = await pool.query(
      `SELECT COUNT(*)::int AS total_visits FROM visits WHERE created_at >= $1`,
      [cutoff.toISOString()]
    )

    // Get VPN/Proxy counts
    const vpnProxyResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE is_vpn = true)::int AS vpn_count,
        COUNT(*) FILTER (WHERE is_proxy = true)::int AS proxy_count,
        COUNT(*) FILTER (WHERE is_vpn = true OR is_proxy = true)::int AS total_blocked
       FROM visits 
       WHERE created_at >= $1`,
      [cutoff.toISOString()]
    )

    res.json({
      total_visits: statsResult.rows[0]?.total_visits || 0,
      total_clicks: statsResult.rows[0]?.total_visits || 0,
      period_days: days,
      vpn_blocks: vpnProxyResult.rows[0]?.vpn_count || 0,
      proxy_blocks: vpnProxyResult.rows[0]?.proxy_count || 0,
      total_vpn_proxy_blocks: vpnProxyResult.rows[0]?.total_blocked || 0
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all transactions
app.get('/api/admin/all-transactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()

    const fromStr = (req.query.fromDate || req.query.from || '').toString().trim()
    const toStr = (req.query.toDate || req.query.to || '').toString().trim()
    const statusFilter = req.query.status || null
    const brandFilter = req.query.brand || null
    const geoFilter = req.query.geo || null
    const parseDate = (value) => {
      if (!value) return null
      const parsed = new Date(value)
      if (Number.isNaN(parsed?.getTime?.())) return null
      return parsed
    }
    const fromDate = parseDate(fromStr)
    const toDate = parseDate(toStr)

    const conditions = []
    const values = []
    let i = 1

    if (fromDate) {
      conditions.push(`created_at >= $${i}::timestamptz`)
      values.push(fromDate.toISOString())
      i++
    }

    if (toDate) {
      const useWholeDay = !toStr.includes('T')
      const toExclusive = new Date(toDate.getTime())
      if (useWholeDay) {
        toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
      } else {
        toExclusive.setTime(toExclusive.getTime() + 1)
      }
      conditions.push(`created_at < $${i}::timestamptz`)
      values.push(toExclusive.toISOString())
      i++
    }

    if (statusFilter && statusFilter !== 'all') {
      conditions.push(`LOWER(payment_status) = $${i}`)
      values.push(statusFilter.toLowerCase())
      i++
    }

    if (brandFilter && brandFilter !== 'all') {
      conditions.push(`brand_id = $${i}`)
      values.push(Number(brandFilter))
      i++
    }

    if (geoFilter && geoFilter !== 'all') {
      conditions.push(`vpn_geo = $${i}`)
      values.push(geoFilter)
      i++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count of transactions matching filters
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM orders ${where}`,
      values
    )
    const totalCount = countResult.rows[0]?.total || 0

    // Get all transactions without limit
    const ordersResult = await pool.query(
      `SELECT id, order_id, brand_id, user_id, email, first_name, last_name, phone, items, 
              total_amount, payment_status, commission_amount, commission_status, 
              vpn_geo, user_ip, billing_country, created_at, card_holder_name, payment_message, currency, amount_usd, payment_method
       FROM orders ${where}
       ORDER BY created_at DESC`,
      values
    )

    res.json({
      transactions: ordersResult.rows,
      total: totalCount,
      stats: {
        total_order_amount: 0,
        rolling_reserve: 0,
        final_payout: 0,
        total_paid: 0
      }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all payouts
app.get('/api/admin/payouts', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePayoutsTable()

    // Support both from_date/to_date and from/to for backward compatibility
    const fromStr = req.query.from_date || req.query.from || ''
    const toStr = req.query.to_date || req.query.to || ''
    const parseDate = (value) => {
      if (!value) return null
      const parsed = new Date(value)
      if (Number.isNaN(parsed?.getTime?.())) return null
      return parsed
    }
    const fromDate = parseDate(fromStr)
    const toDate = parseDate(toStr)
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))

    const conditions = []
    const values = []
    let i = 1

    if (fromDate) {
      conditions.push(`created_at >= $${i}::timestamptz`)
      values.push(fromDate.toISOString())
      i++
    }

    if (toDate) {
      // Add 1 day to toDate and use < to capture the entire selected day
      // This ensures payouts from the entire day are included
      const useWholeDay = !toStr.includes('T')
      const toExclusive = new Date(toDate.getTime())
      if (useWholeDay) {
        toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
      } else {
        toExclusive.setTime(toExclusive.getTime() + 1)
      }
      conditions.push(`created_at < $${i}::timestamptz`)
      values.push(toExclusive.toISOString())
      i++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const [countRes, rowsRes, statsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM payouts ${where}`, values),
      pool.query(
        `SELECT id, brand_id, amount, period_start, period_end, status, created_at, paid_at
         FROM payouts ${where}
         ORDER BY created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        values
      ),
      pool.query(`SELECT SUM(amount) AS total_paid, AVG(amount) AS average_payout FROM payouts ${where}`, values)
    ])

    const total = countRes.rows?.[0]?.total || 0
    const stats = statsRes.rows[0] || {}

    res.json({
      payouts: rowsRes.rows,
      stats: {
        total_paid: Number(stats.total_paid || 0),
        average_payout: Number(stats.average_payout || 0),
        last_payout: rowsRes.rows[0] || null
      },
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Bulk mark payouts as paid
// Payouts routes moved to routes/payouts.js

// Admin: update user
app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id)
    const { full_name, plan, role, password } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'invalid id' })
    await ensureUsersTable()
    if (password) {
      const password_hash = bcrypt.hashSync(String(password), 10)
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId])
    }
    if (typeof full_name !== 'undefined' || typeof plan !== 'undefined' || typeof role !== 'undefined') {
      function normalizePlan(p) {
        if (!p) return null
        const v = String(p).trim().toLowerCase()
        if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
        if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
        if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
        return v
      }
      await pool.query('UPDATE users SET full_name = COALESCE($1, full_name), plan = COALESCE($2, plan), user_type = COALESCE($3, user_type) WHERE id = $4', [full_name ?? null, normalizePlan(plan), role ?? null, userId])
    }
    const result = await pool.query('SELECT id, email, full_name, user_type, plan, credits_balance, credits_unlimited FROM users WHERE id = $1', [userId])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ user: mapDbUserToClient(result.rows[0]) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: create user with full control
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, full_name, password, user_type, plan, credits_balance, credits_unlimited } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })
    if (!password) return res.status(400).json({ error: 'password is required' })

    await ensureUsersTable()

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' })
    }

    // Hash password
    const password_hash = bcrypt.hashSync(String(password), 10)

    // Normalize plan
    function normalizePlan(p) {
      if (!p) return null
      const v = String(p).trim().toLowerCase()
      if (v === 'starter' || v === 'essential' || v === '250' || v === '€250' || v === 'e250') return 'starter'
      if (v === 'pro' || v === 'professional' || v === '500' || v === '€500' || v === 'e500') return 'pro'
      if (v === 'expert' || v === '750' || v === '€750' || v === 'e750') return 'expert'
      return v
    }

    const normalizedPlan = normalizePlan(plan)
    const userType = user_type || 'user'
    const creditsBalance = credits_unlimited ? 0 : (credits_balance || 0)
    const creditsUnlimited = !!credits_unlimited

    const text = `
      INSERT INTO users (email, full_name, user_type, password_hash, plan, credits_balance, credits_unlimited)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, full_name, user_type, plan, created_at, credits_balance, credits_unlimited;
    `
    const values = [
      email.toLowerCase(),
      full_name || null,
      userType,
      password_hash,
      normalizedPlan,
      creditsBalance,
      creditsUnlimited
    ]

    const result = await pool.query(text, values)
    const createdUser = result.rows[0]

    // Send welcome email (optional)
    if (SENDGRID_API_KEY) {
      try {
        const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#f59e0b,#f97316);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">📈</span>
                OpenSightAI
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Welcome to OpenSightAI</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your account has been created by an administrator.</p>
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#f59e0b;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Email:</strong> ${createdUser.email}</div>
                  <div><strong>Password:</strong> [Use the password provided by your administrator]</div>
                  ${normalizedPlan ? `<div><strong>Plan:</strong> ${normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1)}</div>` : ''}
                  ${creditsUnlimited ? `<div><strong>Credits:</strong> Unlimited</div>` : (creditsBalance > 0 ? `<div><strong>Credits:</strong> ${creditsBalance}</div>` : '')}
                </div>
              </div>
              <a href="https://OpenSightai.com/login" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Go to OpenSightAI</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025</div>
          </div>
        </div>`
        await sgMail.send({ to: createdUser.email, from: EMAIL_FROM, subject: 'Your OpenSightAI Account', html })
        console.log(`[admin] Sent welcome email to ${createdUser.email}`)
      } catch (e) {
        const details = e?.response?.body || e
        console.error('[admin] Failed to send welcome email:', details)
      }
    }

    res.json({ user: mapDbUserToClient(createdUser) })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: analytics overview
app.get('/api/admin/analytics/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureUsersTable();
    await ensureOrdersTable();
    await ensureChartAnalysisSchema();
    await ensureVisitsTable();
    await ensureVisitsSchema();

    // Ensure currencies table exists for exchange rate lookups
    await ensureCurrenciesTable();
    
    const [usersTotalRes, proUsersRes, analysesTotalRes, ordersAggRes, recentOrdersRes, creditsUsedRes, vpnProxyRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_users FROM users'),
      pool.query("SELECT COUNT(*)::int AS pro_users FROM users WHERE LOWER(plan) IN ('pro','professional')"),
      pool.query('SELECT COUNT(*)::int AS total_analyses FROM chart_analyses'),
      pool.query(`
        SELECT 
          COUNT(*)::int AS total_orders,
          COALESCE(SUM(
            CASE WHEN o.payment_status = 'unpaid' THEN
              CASE 
                -- If USD or no currency, use total_amount directly (matches frontend logic)
                WHEN COALESCE(o.currency, 'USD') = 'USD' THEN COALESCE(o.total_amount, 0)::numeric
                -- For other currencies, apply correction logic (matches getCorrectUSDAmount)
                ELSE
                  CASE
                    -- Calculate correct USD: total_amount / exchange_rate
                    WHEN c.exchange_rate IS NOT NULL AND c.exchange_rate > 0 AND o.total_amount > 0 THEN
                      CASE
                        -- Calculate correct USD value
                        WHEN (o.total_amount / c.exchange_rate) > 0 THEN
                          CASE
                            -- If stored amount_usd is off by more than 10%, use corrected value
                            WHEN ABS(COALESCE(o.amount_usd, o.total_amount) - (o.total_amount / c.exchange_rate)) / (o.total_amount / c.exchange_rate) > 0.10
                            THEN (o.total_amount / c.exchange_rate)::numeric
                            -- Otherwise use stored amount_usd (matches frontend: return storedUSD)
                            ELSE COALESCE(o.amount_usd, o.total_amount)::numeric
                          END
                        -- Fallback if calculation results in zero or negative
                        ELSE COALESCE(o.amount_usd, o.total_amount)::numeric
                      END
                    -- Fallback if no exchange rate found or invalid
                    ELSE COALESCE(o.amount_usd, o.total_amount)::numeric
                  END
              END
            ELSE 0 
            END
          ), 0)::numeric AS total_revenue
        FROM orders o
        LEFT JOIN currencies c ON o.currency = c.code AND c.active = true
      `),
      pool.query("SELECT order_id, email, total_amount, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 10"),
      pool.query('SELECT COALESCE(SUM(credits_used_total),0)::bigint AS credits_used FROM users'),
      pool.query('SELECT COUNT(*) FILTER (WHERE is_vpn = true OR is_proxy = true)::int AS total_blocked FROM visits'),
    ])

    // Get brand breakdown metrics
    // For resellers (account_type='reseller'), aggregate their own orders + child brand orders
    // For independent brands, show only their own orders
    const brandBreakdownRes = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.account_type,
        b.parent_brand_id,
        COUNT(o.id)::int AS total_orders,
        COALESCE(SUM(COALESCE(o.amount_usd, o.total_amount)), 0)::numeric AS total_revenue,
        COALESCE(SUM(o.commission_amount), 0)::numeric AS total_commission,
        COALESCE(SUM(CASE WHEN o.commission_status = 'paid' THEN o.commission_amount ELSE 0 END), 0)::numeric AS paid_commission,
        COALESCE(SUM(CASE WHEN o.commission_status = 'unpaid' THEN o.commission_amount ELSE 0 END), 0)::numeric AS unpaid_commission
      FROM brands b
      LEFT JOIN orders o ON (
        (o.brand_id = b.id) OR 
        (b.account_type = 'reseller' AND o.brand_id IN (SELECT id FROM brands WHERE parent_brand_id = b.id))
      ) AND o.payment_status IN ('paid', 'unpaid')
      WHERE b.parent_brand_id IS NULL OR b.account_type = 'reseller'
      GROUP BY b.id, b.name, b.account_type, b.parent_brand_id
      ORDER BY total_revenue DESC
    `)

    const totals = {
      users: usersTotalRes.rows?.[0]?.total_users || 0,
      analyses: analysesTotalRes.rows?.[0]?.total_analyses || 0,
      orders: ordersAggRes.rows?.[0]?.total_orders || 0,
      revenue: Number(ordersAggRes.rows?.[0]?.total_revenue || 0),
      credits_used: Number(creditsUsedRes.rows?.[0]?.credits_used || 0),
      vpn_proxy_blocks: vpnProxyRes.rows?.[0]?.total_blocked || 0,
    }

    const brandBreakdown = brandBreakdownRes.rows.map(brand => ({
      id: brand.id,
      name: brand.name,
      total_orders: brand.total_orders,
      total_revenue: Number(brand.total_revenue),
      total_commission: Number(brand.total_commission),
      paid_commission: Number(brand.paid_commission),
      unpaid_commission: Number(brand.unpaid_commission),
      rolling_reserve: Number(brand.total_revenue) * 0.1,
      final_payout_amount: Math.max(0, Number(brand.total_commission) - (Number(brand.total_revenue) * 0.1))
    }))
    const users = { pro: proUsersRes.rows?.[0]?.pro_users || 0 }
    const recent_orders = recentOrdersRes.rows || []

    res.json({ totals, users, recent_orders, brand_breakdown: brandBreakdown })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Admin: analytics time series (revenue by day, user registrations by day, analyses by day)
app.get('/api/admin/analytics/timeseries', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureUsersTable();
    await ensureOrdersTable();
    await ensureChartAnalysisSchema();

    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365)

    const [revenueSeries, usersSeries, analysesSeries] = await Promise.all([
      pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount::numeric ELSE 0 END),0)::numeric AS revenue
         FROM orders
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY 1
         ORDER BY 1`
      ),
      pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                COUNT(*)::int AS users
         FROM users
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY 1
         ORDER BY 1`
      ),
      pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                COUNT(*)::int AS analyses
         FROM chart_analyses
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY 1
         ORDER BY 1`
      ),
    ])

    res.json({
      revenue: revenueSeries.rows,
      users: usersSeries.rows,
      analyses: analysesSeries.rows,
      days,
    })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// Admin: recent activities feed (orders, users, analyses)
app.get('/api/admin/analytics/activities', requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureUsersTable();
    await ensureOrdersTable();
    await ensureChartAnalysisSchema();

    const [orders, users, analyses] = await Promise.all([
      pool.query(`SELECT 'order' AS type, order_id, email, total_amount, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 15`),
      pool.query(`SELECT 'user' AS type, id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 15`),
      pool.query(`SELECT 'analysis' AS type, id, user_id, symbol, created_at FROM chart_analyses ORDER BY created_at DESC LIMIT 15`),
    ])

    // Merge and sort by created_at desc (convert to uniform objects)
    const list = []
    for (const r of orders.rows) list.push({ type: 'order', created_at: r.created_at, data: r })
    for (const r of users.rows) list.push({ type: 'user', created_at: r.created_at, data: r })
    for (const r of analyses.rows) list.push({ type: 'analysis', created_at: r.created_at, data: r })
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    res.json({ activities: list.slice(0, 30) })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

function buildDestinationUrl({ type, packageId, brandSlug }) {
  if (type === 'package') {
    return `https://OpenSightai.com/package/${encodeURIComponent(packageId)}?b=${brandSlug}`;
  }
  return `https://OpenSightai.com/credits/${encodeURIComponent(packageId)}?b=${brandSlug}`;
}

async function resolvePackageIdOrNull(packageId) {
  if (!packageId) return null;
  const raw = String(packageId).trim();
  if (!raw) return null;
  const result = await pool.query(
    `SELECT id FROM packages WHERE LOWER(id) = LOWER($1) LIMIT 1`,
    [raw]
  );
  return result.rows[0]?.id || null;
}

async function ensureBrandPackageLinksForBrand(brandId) {
  console.log('ensureBrandPackageLinksForBrand called for brand:', brandId);
  try {
    await ensureBrandLinksTable();
    await ensurePackagesTable();

    const brandRes = await pool.query(`SELECT id, slug FROM brands WHERE id = $1`, [brandId]);
    const brand = brandRes.rows[0];
    if (!brand?.slug) return;

    const brandSlug = String(brand.slug).trim().toLowerCase();
    console.log('Brand slug:', brandSlug);

    // Adopt legacy links: Extract package_id from destination_url for links without package_id
    const legacyLinks = await pool.query(
      `SELECT id, destination_url, name
       FROM brand_links
       WHERE brand_id = $1
         AND is_active = true
         AND package_id IS NULL
         AND (custom_url IS NULL OR TRIM(custom_url) = '')
         AND destination_url LIKE '%/package/%'`,
      [brandId]
    );

    for (const legacyLink of legacyLinks.rows) {
      const url = legacyLink.destination_url || '';
      const match = url.match(/\/package\/([^/?]+)/i);
      if (match && match[1]) {
        const extractedPackageId = match[1].toLowerCase();
        const pkgCheck = await pool.query(
          `SELECT id FROM packages WHERE LOWER(id) = $1 AND active = true LIMIT 1`,
          [extractedPackageId]
        );
        if (pkgCheck.rows.length > 0) {
          const actualPackageId = pkgCheck.rows[0].id;
          await pool.query(
            `UPDATE brand_links
             SET package_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [actualPackageId, legacyLink.id]
          );
        }
      }
    }

    const mainRes = await pool.query(
      `SELECT id FROM brand_links WHERE brand_id = $1 AND is_main_link = true LIMIT 1`,
      [brandId]
    );

    if (mainRes.rows.length === 0) {
      let linkId = generateLinkId();
      await pool.query(
        `INSERT INTO brand_links (brand_id, link_id, name, destination_url, is_main_link, is_active)
         VALUES ($1, $2, 'Main Link', $3, true, true)`,
        [brandId, linkId, `https://OpenSightai.com/?b=${brandSlug}`]
      );
      console.log('Created Main Link');
    }

    // 1.5) Ensure "All Packages" link exists
    const allPackagesRes = await pool.query(
      `SELECT id FROM brand_links 
       WHERE brand_id = $1 
       AND (destination_url LIKE '%/prices%' OR destination_url LIKE '%prices?%' OR custom_url LIKE '%/prices%')
       AND is_active = true
       LIMIT 1`,
      [brandId]
    );

    if (allPackagesRes.rows.length === 0) {
      let linkId = generateLinkId();
      let attempts = 0;
      while (attempts < 10) {
        const check = await pool.query(`SELECT id FROM brand_links WHERE link_id = $1`, [linkId]);
        if (check.rows.length === 0) break;
        linkId = generateLinkId();
        attempts++;
      }
      if (attempts < 10) {
        const pricesUrl = `https://OpenSightai.com/prices?b=${brandSlug}`;
        await pool.query(
          `INSERT INTO brand_links (brand_id, link_id, name, destination_url, is_active, is_main_link)
           VALUES ($1, $2, 'All Packages', $3, true, false)`,
          [brandId, linkId, pricesUrl]
        );
      }
    } else {
      const existingId = allPackagesRes.rows[0].id;
      const pricesUrl = `https://OpenSightai.com/prices?b=${brandSlug}`;
      await pool.query(
        `UPDATE brand_links 
         SET custom_url = $1, destination_url = $2, is_active = true
         WHERE id = $3`,
        [pricesUrl, pricesUrl, existingId]
      );
    }

    // 2) Fetch ALL active packages + credits
    const pkgRes = await pool.query(
      `SELECT id, name, type
       FROM packages
       WHERE active = true
       ORDER BY
         CASE type WHEN 'package' THEN 1 WHEN 'credits' THEN 2 END,
         sort_order ASC,
         price ASC`
    );

    const activeRows = pkgRes.rows || [];
    const activeIds = new Set(activeRows.map(r => r.id.toLowerCase()));
    console.log('Active packages from DB:', activeRows.map(r => r.id));

    console.log('Total packages to process:', activeRows.map(r => r.id));

    // 3) Create/Update links for all active rows
    for (const p of activeRows) {
      const pkgId = p.id;
      const type = p.type;
      const name = p.name || pkgId;

      console.log('Processing:', pkgId, type);

      const destinationUrl = buildDestinationUrl({ type, packageId: pkgId, brandSlug });

      const existing = await pool.query(
        `SELECT id, destination_url, name, package_id
         FROM brand_links
         WHERE brand_id = $1 AND LOWER(package_id) = LOWER($2)
         LIMIT 1`,
        [brandId, pkgId]
      );

      if (existing.rows.length === 0) {
        let linkId = generateLinkId();
        let attempts = 0;
        while (attempts < 10) {
          const check = await pool.query(`SELECT id FROM brand_links WHERE link_id = $1`, [linkId]);
          if (check.rows.length === 0) break;
          linkId = generateLinkId();
          attempts++;
        }

        await pool.query(
          `INSERT INTO brand_links (brand_id, link_id, name, destination_url, package_id, is_active, is_main_link)
           VALUES ($1, $2, $3, $4, $5, true, false)`,
          [brandId, linkId, name, destinationUrl, pkgId]
        );
        console.log('Created link:', pkgId, destinationUrl);
      } else {
        await pool.query(
          `UPDATE brand_links
           SET name = $1,
               destination_url = $2,
               package_id = $3,
               is_active = true,
               updated_at = NOW()
           WHERE id = $4`,
          [name, destinationUrl, pkgId, existing.rows[0].id]
        );
        console.log('Updated link:', pkgId);
      }
    }

    // 4) Deactivate old auto links
    await pool.query(
      `UPDATE brand_links
       SET is_active = false, updated_at = NOW()
       WHERE brand_id = $1
         AND is_main_link = false
         AND package_id IS NOT NULL
         AND LOWER(package_id) NOT IN (SELECT LOWER(id) FROM packages WHERE active = true)
         AND LOWER(package_id) NOT IN ('custom', 'starter', 'growth', 'pro')`,
      [brandId]
    );
    console.log('ensureBrandPackageLinksForBrand completed');
  } catch (err) {
    console.error('ensureBrandPackageLinksForBrand error:', err);
    throw err;
  }
}

app.get('/api/debug/links', async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, package_id, is_active, destination_url 
     FROM brand_links 
     WHERE brand_id = 129 
     ORDER BY id DESC`
  );
  res.json(result.rows);
});

app.get('/api/debug/packages', async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, type, active FROM packages ORDER BY id`
  );
  res.json(result.rows);
});

// Admin: BRANDS - list with search/filters/pagination
// Admin: Get pending brands (for approval) - MUST come before /:id route
app.get('/api/admin/brands/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureUsersTable()

    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))
    const offset = (page - 1) * pageSize

    // Get pending brands with parent brand info
    const [countRes, brandsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total 
         FROM brands 
         WHERE approval_status = 'pending'`
      ),
      pool.query(
        `SELECT 
          b.id, b.name, b.logo_url, b.email, b.username, b.slug, 
          b.commission_rate, b.description, b.created_at,
          b.parent_brand_id,
          parent.name as parent_brand_name
         FROM brands b
         LEFT JOIN brands parent ON b.parent_brand_id = parent.id
         WHERE b.approval_status = 'pending'
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      )
    ])

    const total = countRes.rows[0]?.total || 0

    res.json({
      brands: brandsRes.rows,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

app.get('/api/admin/brands', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()

    const q = (req.query.q || '').toString().trim()

    const conditions = []
    const values = []
    let i = 1

    if (q) {
      conditions.push(`(name ILIKE $${i} OR website ILIKE $${i} OR description ILIKE $${i})`)
      values.push(`%${q}%`)
      i++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM brands ${where}`, values),
      pool.query(`SELECT id, name, logo_url, website, primary_color, secondary_color, description, status, username, account_type, created_at, updated_at
                  FROM brands ${where}
                  ORDER BY created_at DESC`, values),
    ])

    const total = countRes.rows?.[0]?.total || 0
    res.json({
      brands: rowsRes.rows,
      meta: { total }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRANDS - get single
app.get('/api/admin/brands/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureBrandLinksTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    // Get brand data including parent_brand_id
    const result = await pool.query('SELECT id, name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, account_type, parent_brand_id, created_at, updated_at FROM brands WHERE id = $1', [brandId])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })

    // Get custom links for this brand
    const linksResult = await pool.query('SELECT id, name, package_id, is_main_link, custom_url, created_at FROM brand_links WHERE brand_id = $1 ORDER BY is_main_link DESC, created_at ASC', [brandId])

    
    // Get direct purchase links for this brand
    await ensureDirectPurchaseLinksTable()
    const directPurchaseLinksResult = await pool.query(
      'SELECT id, link_id, name, total_amount, package_price, credits_price, package_id, credits_amount, is_active, visits_count, transactions_count, created_at FROM direct_purchase_links WHERE brand_id = $1 ORDER BY total_amount ASC',
      [brandId]
    )
    
    const brand = result.rows[0]
    brand.custom_links = linksResult.rows || []
    brand.direct_purchase_links = directPurchaseLinksResult.rows || []
    
    res.json({ brand })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRANDS - get dashboard (view any brand's dashboard)
app.get('/api/admin/brands/:id/dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureOrdersTable()
    await ensureVisitsTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    // Verify brand exists
    const brandResult = await pool.query('SELECT id, name FROM brands WHERE id = $1', [brandId])
    if (brandResult.rows.length === 0) return res.status(404).json({ error: 'brand_not_found' })

    // Get brand statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
        COALESCE(SUM(commission_amount), 0)::numeric AS total_commission,
        COALESCE(SUM(CASE WHEN commission_status = 'paid' THEN commission_amount ELSE 0 END), 0)::numeric AS paid_commission,
        COALESCE(SUM(CASE WHEN commission_status = 'unpaid' THEN commission_amount ELSE 0 END), 0)::numeric AS unpaid_commission
       FROM orders
       WHERE brand_id = $1`,
      [brandId]
    )

    // Get visit statistics
    const visitsResult = await pool.query(
      'SELECT SUM(visits_count)::int AS total_visits FROM visits WHERE brand_id = $1',
      [brandId]
    )

    res.json({
      stats: {
        ...statsResult.rows[0],
        total_visits: visitsResult.rows[0]?.total_visits || 0
      }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRANDS - create
app.post('/api/admin/brands', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureUsersTable()
    await ensureBrandLinksTable()
    await ensurePackagesTable()
    const { name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, custom_links, account_type, reseller_commission } = req.body || {}

    if (!name) return res.status(400).json({ error: 'name_required' })
    if (!slug) return res.status(400).json({ error: 'slug_required' })
    if (!email) return res.status(400).json({ error: 'email_required' })
    if (!username) return res.status(400).json({ error: 'username_required' })

    // Validate slug format (alphanumeric + hyphens, lowercase)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    const normalizedSlug = String(slug).trim().toLowerCase()
    if (!slugRegex.test(normalizedSlug)) {
      return res.status(400).json({ error: 'invalid_slug_format', message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    }

    // Validate username format (alphanumeric + underscores + hyphens, lowercase)
    const usernameRegex = /^[a-z0-9_-]+$/
    const normalizedUsername = String(username).trim().toLowerCase()
    if (!usernameRegex.test(normalizedUsername)) {
      return res.status(400).json({ error: 'invalid_username_format', message: 'Username must contain only lowercase letters, numbers, underscores, and hyphens' })
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: 'username_too_short', message: 'Username must be at least 3 characters long' })
    }

    // Check if slug already exists
    const slugCheck = await pool.query('SELECT id FROM brands WHERE slug = $1', [normalizedSlug])
    if (slugCheck.rows.length > 0) {
      return res.status(409).json({ error: 'slug_already_exists', message: 'This slug is already in use' })
    }

    // Check if username already exists
    const usernameCheck = await pool.query('SELECT id FROM brands WHERE username = $1', [normalizedUsername])
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'username_already_exists', message: 'This username is already in use' })
    }

    // Validate parent_brand_id if provided
    const parentBrandId = parent_brand_id ? Number(parent_brand_id) : null
    if (parentBrandId) {
      const parentCheck = await pool.query('SELECT id FROM brands WHERE id = $1', [parentBrandId])
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'invalid_parent_brand', message: 'Parent brand does not exist' })
      }
    }

    // Validate custom_links package_ids (prevents FK errors on brand_links.package_id)
    const resolvedPackageIds = new Map()
    if (Array.isArray(custom_links)) {
      for (const link of custom_links) {
        if (!link?.package_id) continue
        const key = String(link.package_id).trim()
        if (!key) continue
        if (resolvedPackageIds.has(key)) continue
        const resolved = await resolvePackageIdOrNull(key)
        if (!resolved) {
          return res.status(400).json({ error: 'invalid_package_id', package_id: key })
        }
        resolvedPackageIds.set(key, resolved)
      }
    }

    // Generate random secure password
    const randomPassword = Array.from({ length: 12 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
      return chars[Math.floor(Math.random() * chars.length)]
    }).join('')

    const password_hash = bcrypt.hashSync(randomPassword, 10)
    const commissionRate = commission_rate !== undefined ? Number(commission_rate) : 10.0
    const accountType = account_type === 'reseller' ? 'reseller' : 'brand'
    const resellerCommission = reseller_commission !== undefined ? Number(reseller_commission) : 0

    // Create brand record
    const brandResult = await pool.query(
      `INSERT INTO brands (name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, password_hash, parent_brand_id, account_type, reseller_commission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, account_type, reseller_commission, created_at, updated_at`,
      [name, logo_url || null, website || null, primary_color || null, secondary_color || null, description || null, status || 'active', normalizedSlug, commissionRate, String(email).trim().toLowerCase(), normalizedUsername, password_hash, parentBrandId, accountType, resellerCommission]
    )

    const brand = brandResult.rows[0]

    // Create custom brand links if provided
    if (Array.isArray(custom_links) && custom_links.length > 0) {
      for (const link of custom_links) {
        const { package_id, name: linkName, is_main_link, custom_url } = link
        const resolvedPackageId = package_id ? (resolvedPackageIds.get(String(package_id).trim()) || null) : null

        // Generate unique link ID
        let linkId = generateLinkId()
        let attempts = 0
        while (attempts < 10) {
          const existing = await pool.query('SELECT id FROM brand_links WHERE link_id = $1', [linkId])
          if (existing.rows.length === 0) break
          linkId = generateLinkId()
          attempts++
        }

        // Determine destination URL
        let destinationUrl
        if (custom_url && custom_url.trim()) {
          // Use custom URL provided by admin and append brand parameter
          const customUrlTrimmed = custom_url.trim()
          const separator = customUrlTrimmed.includes('?') ? '&' : '?'
          destinationUrl = `${customUrlTrimmed}${separator}b=${brand.slug}`
        } else if (resolvedPackageId) {
          // Package-specific landing page with brand parameter
          destinationUrl = `https://OpenSightai.com/package/${resolvedPackageId}?b=${brand.slug}`
        } else {
          // Default URL - goes to homepage with brand parameter
          destinationUrl = `https://OpenSightai.com/?b=${brand.slug}`
        }

        await pool.query(
          `INSERT INTO brand_links (brand_id, link_id, name, destination_url, package_id, custom_url, is_main_link)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [brand.id, linkId, linkName, destinationUrl, resolvedPackageId, custom_url || null, is_main_link || false]
        )
      }
    }
    
    // Automatically create all predefined direct purchase links for the new brand
    await ensureDirectPurchaseLinksTable()
    for (const [amount, combo] of Object.entries(PREDEFINED_COMBINATIONS)) {
      try {
        // Generate unique link ID
        let linkId = generateLinkId()
        let attempts = 0
        while (attempts < 10) {
          const existing = await pool.query('SELECT id FROM direct_purchase_links WHERE link_id = $1', [linkId])
          if (existing.rows.length === 0) break
          linkId = generateLinkId()
          attempts++
        }
        
        if (attempts < 10) {
          const linkName = `$${amount} - ${combo.packageId.charAt(0).toUpperCase() + combo.packageId.slice(1)} + ${combo.creditsAmount === 'unlimited' ? 'Unlimited' : combo.creditsAmount} Credits`
          const creditsAmountValue = combo.creditsAmount === 'unlimited' ? 'unlimited' : String(combo.creditsAmount)
          
          await pool.query(
            `INSERT INTO direct_purchase_links (brand_id, link_id, name, total_amount, package_price, credits_price, package_id, credits_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              brand.id,
              linkId,
              linkName,
              Number(amount),
              combo.packagePrice,
              combo.creditsPrice,
              combo.packageId,
              creditsAmountValue
            ]
          )
          console.log(`[CREATE-BRAND] Created direct purchase link: $${amount} for brand ${brand.id}`)
        }
      } catch (linkErr) {
        console.error(`[CREATE-BRAND] Failed to create direct purchase link $${amount}:`, linkErr.message)
        // Continue with other links even if one fails
      }
    }
    
    // Create corresponding user account with user_type='brand' (if it doesn't exist)
    // Multiple brands can share the same email, so we only create the user once
    const existingUser = await pool.query(
      'SELECT id, user_type FROM users WHERE email = $1',
      [brand.email]
    )

    if (existingUser.rows.length === 0) {
      // No user exists with this email, create new brand/reseller user
      const userType = accountType === 'reseller' ? 'reseller' : 'brand'
      await pool.query(
        `INSERT INTO users (email, full_name, user_type, password_hash, plan)
         VALUES ($1, $2, $3, $4, 'starter')`,
        [brand.email, name, userType, password_hash]
      )
    } else {
      // User exists - DO NOT update user_type (preserve existing type)
      // Password is stored in brands table, so no need to update users table password
      console.log(`[CREATE-BRAND] User exists with email ${brand.email}, preserving existing user_type`)
    }

    // Send welcome email with login credentials
    if (SENDGRID_API_KEY) {
      try {
        const referralUrl = `https://OpenSightai.com/pricing?ref=${normalizedSlug}`
        const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#00d4ff,#7c3aed);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">🤝</span>
                OpenSightAI Brand Partner
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Welcome to OpenSightAI Brand Partnership</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your brand partner account has been created successfully! You can now share your referral link and track your earnings.</p>
              
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#00d4ff;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Username:</strong> ${brand.username}</div>
                  <div><strong>Password:</strong> ${randomPassword}</div>
                  <div style="margin-top:8px;color:#94a3b8;">Please change your password after first login. Login at: https://OpenSightai.com/brand-login</div>
                </div>
              </div>
              
              <div style="background:#f8fafc;border-radius:10px;padding:18px 16px;margin:16px 0;border:1px solid #e2e8f0;">
                <div style="font-weight:600;margin-bottom:8px;color:#0f172a;">Your Referral Details</div>
                <div style="font-size:14px;line-height:1.6;color:#334155;">
                  <div><strong>Referral Slug:</strong> ${normalizedSlug}</div>
                  <div><strong>Commission Rate:</strong> ${commissionRate}%</div>
                  <div style="margin-top:12px;"><strong>Your Referral Link:</strong></div>
                  <div style="background:#fff;padding:12px;border-radius:6px;margin-top:6px;border:1px solid #cbd5e1;word-break:break-all;font-family:monospace;font-size:13px;color:#7c3aed;">
                    ${referralUrl}
                  </div>
                </div>
              </div>
              
              <a href="https://OpenSightai.com/brand-login" style="display:inline-block;background:linear-gradient(90deg,#00d4ff,#7c3aed);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px;">Access Your Dashboard</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025 - Brand Partner Program</div>
          </div>
        </div>`

        await sgMail.send({
          to: brand.email,
          from: EMAIL_FROM,
          subject: 'Your OpenSightAI Brand Partner Account',
          html
        })
        console.log(`[brand] Sent welcome email to ${brand.email}`)
      } catch (e) {
        const details = e?.response?.body || e
        console.error('[brand] Failed to send welcome email:', details)
      }
    } else {
      console.warn('[brand] Skipping email send because SENDGRID_API_KEY is not set')
    }

    // Return brand data without password_hash but include generated password for admin
    const { password_hash: _, ...brandData } = brand
    res.json({ brand: brandData, generated_password: randomPassword })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRANDS - update
app.patch('/api/admin/brands/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureBrandLinksTable()
    await ensurePackagesTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    const existing = await pool.query('SELECT id, slug FROM brands WHERE id = $1', [brandId])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'not_found' })

    const fields = []
    const values = []
    let i = 1
    const { name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, custom_links, account_type, reseller_commission } = req.body || {}

    // Username cannot be changed after creation
    if (typeof username !== 'undefined') {
      return res.status(400).json({ error: 'username_cannot_be_changed', message: 'Username cannot be changed after creation' })
    }

    if (typeof name !== 'undefined') { fields.push(`name = $${i++}`); values.push(String(name).trim()) }
    if (typeof logo_url !== 'undefined') { fields.push(`logo_url = $${i++}`); values.push(logo_url || null) }
    if (typeof website !== 'undefined') { fields.push(`website = $${i++}`); values.push(website || null) }
    if (typeof primary_color !== 'undefined') { fields.push(`primary_color = $${i++}`); values.push(primary_color || null) }
    if (typeof secondary_color !== 'undefined') { fields.push(`secondary_color = $${i++}`); values.push(secondary_color || null) }
    if (typeof description !== 'undefined') { fields.push(`description = $${i++}`); values.push(description || null) }
    if (typeof status !== 'undefined') { fields.push(`status = $${i++}`); values.push(String(status)) }
    if (typeof commission_rate !== 'undefined') { fields.push(`commission_rate = $${i++}`); values.push(Number(commission_rate)) }
    if (typeof email !== 'undefined') { fields.push(`email = $${i++}`); values.push(String(email).trim().toLowerCase()) }
    if (typeof reseller_commission !== 'undefined') { fields.push(`reseller_commission = $${i++}`); values.push(Number(reseller_commission)) }
    if (typeof account_type !== 'undefined') {
      const validAccountType = account_type === 'reseller' ? 'reseller' : 'brand'
      fields.push(`account_type = $${i++}`)
      values.push(validAccountType)
    }

    // Handle parent_brand_id update
    if (typeof parent_brand_id !== 'undefined') {
      const parentBrandId = parent_brand_id ? Number(parent_brand_id) : null
      if (parentBrandId) {
        // Validate parent brand exists and not self
        if (parentBrandId === brandId) {
          return res.status(400).json({ error: 'invalid_parent_brand', message: 'Brand cannot be its own parent' })
        }
        const parentCheck = await pool.query('SELECT id FROM brands WHERE id = $1', [parentBrandId])
        if (parentCheck.rows.length === 0) {
          return res.status(400).json({ error: 'invalid_parent_brand', message: 'Parent brand does not exist' })
        }
      }
      fields.push(`parent_brand_id = $${i++}`)
      values.push(parentBrandId)
    }

    // Handle slug update with validation
    if (typeof slug !== 'undefined' && slug !== existing.rows[0].slug) {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      const normalizedSlug = String(slug).trim().toLowerCase()
      if (!slugRegex.test(normalizedSlug)) {
        return res.status(400).json({ error: 'invalid_slug_format', message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
      }
      const slugCheck = await pool.query('SELECT id FROM brands WHERE slug = $1 AND id != $2', [normalizedSlug, brandId])
      if (slugCheck.rows.length > 0) {
        return res.status(409).json({ error: 'slug_already_exists', message: 'This slug is already in use' })
      }
      fields.push(`slug = $${i++}`)
      values.push(normalizedSlug)
    }

    fields.push(`updated_at = NOW()`)

    // Handle custom_links update if provided
    if (Array.isArray(custom_links)) {
      // Validate package_ids up-front so we don't delete links and then fail inserts.
      const resolvedPackageIds = new Map()
      for (const link of custom_links) {
        if (!link?.package_id) continue
        const key = String(link.package_id).trim()
        if (!key) continue
        if (resolvedPackageIds.has(key)) continue
        const resolved = await resolvePackageIdOrNull(key)
        if (!resolved) {
          return res.status(400).json({ error: 'invalid_package_id', package_id: key })
        }
        resolvedPackageIds.set(key, resolved)
      }

      // Delete existing links and recreate
      await pool.query(
        `DELETE FROM brand_links 
         WHERE brand_id = $1 
           AND package_id IS NULL 
           AND is_main_link = false`,
        [brandId]
      );
      
      // Determine which slug to use: new one if being updated, otherwise existing one
      const brandSlug = typeof slug !== 'undefined' ? String(slug).trim().toLowerCase() : existing.rows[0].slug

      for (const link of custom_links) {
        const { package_id, name: linkName, is_main_link, custom_url } = link
        const resolvedPackageId = package_id ? (resolvedPackageIds.get(String(package_id).trim()) || null) : null

        // Generate unique link ID
        let linkId = generateLinkId()
        let attempts = 0
        while (attempts < 10) {
          const existingLink = await pool.query('SELECT id FROM brand_links WHERE link_id = $1', [linkId])
          if (existingLink.rows.length === 0) break
          linkId = generateLinkId()
          attempts++
        }

        // Determine destination URL
        let destinationUrl
        if (custom_url && custom_url.trim()) {
          // Use custom URL provided by admin and append brand parameter
          const customUrlTrimmed = custom_url.trim()
          const separator = customUrlTrimmed.includes('?') ? '&' : '?'
          destinationUrl = `${customUrlTrimmed}${separator}b=${brandSlug}`
        } else if (resolvedPackageId) {
          // Package-specific landing page with brand parameter
          destinationUrl = `https://OpenSightai.com/package/${resolvedPackageId}?b=${brandSlug}`
        } else {
          // Default URL - goes to homepage with brand parameter
          destinationUrl = `https://OpenSightai.com/?b=${brandSlug}`
        }

        await pool.query(
          `INSERT INTO brand_links (brand_id, link_id, name, destination_url, package_id, custom_url, is_main_link)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [brandId, linkId, linkName, destinationUrl, resolvedPackageId, custom_url || null, is_main_link || false]
        )
      }
    }

    if (fields.length === 1) {
      // Only updated_at changed, fetch current brand
      const current = await pool.query('SELECT id, name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, created_at, updated_at FROM brands WHERE id = $1', [brandId])
      return res.json({ brand: current.rows[0] })
    }

    values.push(brandId)
    const sql = `UPDATE brands SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, created_at, updated_at`
    const result = await pool.query(sql, values)

    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRANDS - delete
app.delete('/api/admin/brands/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    const existing = await pool.query('SELECT id FROM brands WHERE id = $1', [brandId])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'not_found' })

    await pool.query('DELETE FROM brands WHERE id = $1', [brandId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})


// Admin: Approve brand
app.post('/api/admin/brands/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureUsersTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    // Get brand with password_hash
    const brandResult = await pool.query(
      'SELECT * FROM brands WHERE id = $1 AND approval_status = $2',
      [brandId, 'pending']
    )

    if (brandResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Brand not found or already processed' })
    }

    const brand = brandResult.rows[0]

    // Generate password if not already set (should be set during creation)
    let randomPassword = null
    let password_hash = brand.password_hash

    if (!password_hash) {
      randomPassword = Array.from({ length: 12 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
        return chars[Math.floor(Math.random() * chars.length)]
      }).join('')
      password_hash = bcrypt.hashSync(randomPassword, 10)
    }

    // Update brand status to active
    await pool.query(
      `UPDATE brands 
       SET approval_status = 'active', 
           status = 'active',
           updated_at = NOW()
       WHERE id = $1`,
      [brandId]
    )

    // Create user account if it doesn't exist
    const existingUser = await pool.query(
      'SELECT id, user_type FROM users WHERE email = $1',
      [brand.email]
    )

    if (existingUser.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, full_name, user_type, password_hash, plan)
         VALUES ($1, $2, $3, $4, 'starter')`,
        [brand.email, brand.name, 'brand', password_hash]
      )
    } else {
      // Update password if user exists
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [password_hash, brand.email]
      )
    }

    // Get password for email (get from brand table or use generated one)
    const finalPassword = randomPassword || '[Already set]'

    // Send welcome email with login credentials
    if (SENDGRID_API_KEY) {
      try {
        const referralUrl = `https://OpenSightai.com/pricing?ref=${brand.slug}`
        const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#00d4ff,#7c3aed);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">✅</span>
                OpenSightAI Brand Partner - Approved
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Your Brand Partner Account Has Been Approved!</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Your brand partner account has been approved and is now active. You can now login and start sharing your referral link.</p>
              
              <div style="background:#0f172a;border-radius:10px;color:#e2e8f0;padding:18px 16px;margin:16px 0;">
                <div style="font-weight:600;margin-bottom:8px;color:#00d4ff;">Login Credentials</div>
                <div style="font-size:14px;line-height:1.6">
                  <div><strong>Username:</strong> ${brand.username}</div>
                  <div><strong>Password:</strong> ${finalPassword}</div>
                  <div style="margin-top:8px;color:#94a3b8;">Please change your password after first login. Login at: https://OpenSightai.com/brand-login</div>
                </div>
              </div>
              
              <div style="background:#f8fafc;border-radius:10px;padding:18px 16px;margin:16px 0;border:1px solid #e2e8f0;">
                <div style="font-weight:600;margin-bottom:8px;color:#0f172a;">Your Referral Details</div>
                <div style="font-size:14px;line-height:1.6;color:#334155;">
                  <div><strong>Referral Slug:</strong> ${brand.slug}</div>
                  <div><strong>Commission Rate:</strong> ${brand.commission_rate}%</div>
                  <div style="margin-top:12px;"><strong>Your Referral Link:</strong></div>
                  <div style="background:#fff;padding:12px;border-radius:6px;margin-top:6px;border:1px solid #cbd5e1;word-break:break-all;font-family:monospace;font-size:13px;color:#7c3aed;">
                    ${referralUrl}
                  </div>
                </div>
              </div>
              
              <a href="https://OpenSightai.com/brand-login" style="display:inline-block;background:linear-gradient(90deg,#00d4ff,#7c3aed);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px;">Access Your Dashboard</a>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025 - Brand Partner Program</div>
          </div>
        </div>`

        await sgMail.send({
          to: brand.email,
          from: EMAIL_FROM,
          subject: 'Your OpenSightAI Brand Partner Account Has Been Approved',
          html
        })
        console.log(`[admin] Sent approval email to ${brand.email}`)
      } catch (e) {
        const details = e?.response?.body || e
        console.error('[admin] Failed to send approval email:', details)
      }
    }

    // Get updated brand
    const updatedBrand = await pool.query(
      'SELECT id, name, logo_url, email, username, slug, commission_rate, approval_status, status, created_at FROM brands WHERE id = $1',
      [brandId]
    )

    res.json({
      brand: updatedBrand.rows[0],
      message: 'Brand approved successfully',
      password_sent: !!SENDGRID_API_KEY
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Reject brand
app.post('/api/admin/brands/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()
    const brandId = Number(req.params.id)
    if (!brandId) return res.status(400).json({ error: 'invalid id' })

    const { reason } = req.body || {}

    // Get brand
    const brandResult = await pool.query(
      'SELECT * FROM brands WHERE id = $1 AND approval_status = $2',
      [brandId, 'pending']
    )

    if (brandResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Brand not found or already processed' })
    }

    const brand = brandResult.rows[0]

    // Update brand status to rejected
    await pool.query(
      `UPDATE brands 
       SET approval_status = 'rejected', 
           status = 'inactive',
           updated_at = NOW()
       WHERE id = $1`,
      [brandId]
    )

    // Optionally send rejection email
    if (SENDGRID_API_KEY && brand.email) {
      try {
        const html = `
        <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:32px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 20px rgba(2,6,23,0.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#ef4444,#dc2626);padding:20px 24px;color:#fff;">
              <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;">
                <span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;">✗</span>
                OpenSightAI Brand Partner Application
              </div>
            </div>
            <div style="padding:28px 24px 8px 24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">Application Status Update</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Unfortunately, your brand partner application has been reviewed and was not approved at this time.</p>
              ${reason ? `<div style="background:#fef2f2;border-radius:10px;padding:18px 16px;margin:16px 0;border:1px solid #fecaca;">
                <div style="font-weight:600;margin-bottom:8px;color:#991b1b;">Reason:</div>
                <div style="font-size:14px;line-height:1.6;color:#7f1d1d;">${reason}</div>
              </div>` : ''}
              <p style="margin:16px 0 0 0;color:#334155;">If you have any questions, please contact our support team.</p>
            </div>
            <div style="padding:16px 24px 24px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">OpenSightAI © 2025 - Brand Partner Program</div>
          </div>
        </div>`

        await sgMail.send({
          to: brand.email,
          from: EMAIL_FROM,
          subject: 'OpenSightAI Brand Partner Application Status',
          html
        })
        console.log(`[admin] Sent rejection email to ${brand.email}`)
      } catch (e) {
        console.error('[admin] Failed to send rejection email:', e)
      }
    }

    res.json({
      message: 'Brand rejected successfully',
      email_sent: !!SENDGRID_API_KEY
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: BRAND WALLETS - list all brand settlement information
app.get('/api/admin/brand-wallets', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBrandsTable()

    const q = (req.query.q || '').toString().trim()

    // Get settlement information directly from brands table
    let query = `
      SELECT 
        id,
        name,
        username,
        logo_url,
        website,
        status,
        account_type,
        created_at,
        settlement_method,
        settlement_crypto_wallet,
        settlement_bank_holder,
        settlement_bank_iban,
        settlement_bank_swift,
        settlement_bank_name,
        settlement_bank_address
      FROM brands
      WHERE (settlement_method IS NOT NULL OR settlement_crypto_wallet IS NOT NULL)
    `

    const values = []

    if (q) {
      values.push(`%${q}%`)
      query += ` AND (name ILIKE $1 OR username ILIKE $1)`
    }

    query += ` ORDER BY name ASC`

    const result = await pool.query(query, values)

    res.json({
      brandWallets: result.rows,
      total: result.rows.length
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===================== BRAND DASHBOARD API =====================

// Brand: Get dashboard stats
app.get('/api/brand/dashboard/stats', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    const brandId = req.brand.id
    const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)))
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Get all orders for this brand to apply conversion fee
    const ordersResult = await pool.query(
      `SELECT 
        id,
        COALESCE(amount_usd, total_amount) as order_amount,
        commission_amount,
        commission_status,
        payment_status,
        payment_message,
        created_at
       FROM orders 
       WHERE brand_id = $1`,
      [brandId]
    )

    // Get order status distribution
    const statusResult = await pool.query(
      `SELECT 
        payment_status,
        COUNT(*)::int AS count
       FROM orders 
       WHERE brand_id = $1 AND created_at >= $2
       GROUP BY payment_status`,
      [brandId, dateFrom]
    )

    // Apply conversion fee and calculate stats
    let totalOrders = 0
    let totalRevenue = 0
    let totalCommission = 0
    let totalOrderAmount = 0
    let totalApprovedCommission = 0
    const commissionBreakdown = {
      paid: 0,
      unpaid: 0,
      pending: 0,
      failed: 0,
      none: 0
    }

    ordersResult.rows.forEach(order => {
      const orderAmount = Number(order.order_amount || 0)
      const originalCommission = Number(order.commission_amount || 0)

      // Apply conversion fee to order amount
      const postFeeAmount = applyConversionFee(orderAmount, conversionFee)

      // Recalculate commission based on post-fee amount (maintain the same proportion)
      const commissionRatio = orderAmount > 0 ? (originalCommission / orderAmount) : 0
      const postFeeCommission = postFeeAmount * commissionRatio

      // Count successful transactions
      const isSuccess = order.payment_status === 'paid' ||
        (order.payment_status === 'unpaid' && order.payment_message === 'Transaction succeeded')

      // For period stats (only within date range)
      const orderDate = new Date(order.created_at)
      if (orderDate >= dateFrom && isSuccess) {
        totalOrders++
        totalRevenue += postFeeAmount
        totalCommission += postFeeCommission
      }

      // For commission breakdown (all time)
      const commissionStatus = order.commission_status || 'none'
      if (commissionBreakdown.hasOwnProperty(commissionStatus)) {
        commissionBreakdown[commissionStatus] += postFeeCommission
      }

      // For total order amount (ALL approved transactions where message = 'Transaction succeeded')
      if (order.payment_message === 'Transaction succeeded') {
        totalOrderAmount += postFeeAmount
        totalApprovedCommission += postFeeCommission
      }
    })

    const statusDistribution = {}
    statusResult.rows.forEach(row => {
      statusDistribution[row.payment_status] = row.count
    })

    // If this is a child brand (has parent_brand_id), commissions go to parent
    // So we zero them out for child brands
    const isChildBrand = req.brand.parent_brand_id !== null && req.brand.parent_brand_id !== undefined
    const rollingReserve = isChildBrand ? 0 : totalOrderAmount * 0.1
    const finalPayoutAmount = isChildBrand ? 0 : Math.max(0, totalApprovedCommission - rollingReserve)

    res.json({
      stats: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_commission: isChildBrand ? 0 : totalCommission,
        unpaid_commission: isChildBrand ? 0 : commissionBreakdown.unpaid,
        paid_commission: isChildBrand ? 0 : commissionBreakdown.paid,
        commission_rate: req.brand.commission_rate,
        is_child_brand: isChildBrand,
        // New metrics in USD (post-fee)
        total_order_amount: totalOrderAmount,
        rolling_reserve: rollingReserve,
        final_payout_amount: finalPayoutAmount
      },
      status_distribution: statusDistribution,
      period_days: days
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get orders list
app.get('/api/brand/orders', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    const brandId = req.brand.id

    const q = (req.query.q || '').toString().trim()
    const statusRaw = (req.query.status || '').toString().trim().toLowerCase()
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))

    const conditions = ['brand_id = $1']
    const values = [brandId]
    let i = 2

    if (q) {
      conditions.push(`(order_id ILIKE $${i} OR email ILIKE $${i})`)
      values.push(`%${q}%`)
      i++
    }

    if (statusRaw && statusRaw !== 'all') {
      conditions.push(`LOWER(payment_status) = $${i}`)
      values.push(statusRaw)
      i++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    // Get conversion fee
    const conversionFee = await getConversionFee()

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM orders ${where}`, values),
      pool.query(
        `SELECT id, order_id, user_id, email, items, total_amount, amount_usd, currency, payment_status, commission_amount, commission_status, created_at
         FROM orders ${where}
         ORDER BY created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        values
      )
    ])

    // Apply conversion fee to each order
    const ordersWithFee = rowsRes.rows.map(order => {
      const orderAmount = Number(order.amount_usd || order.total_amount || 0)
      const originalCommission = Number(order.commission_amount || 0)

      // Apply conversion fee
      const postFeeAmount = applyConversionFee(orderAmount, conversionFee)

      // Recalculate commission proportionally
      const commissionRatio = orderAmount > 0 ? (originalCommission / orderAmount) : 0
      const postFeeCommission = postFeeAmount * commissionRatio

      return {
        ...order,
        amount_usd: postFeeAmount,
        total_amount: postFeeAmount,
        commission_amount: postFeeCommission
      }
    })

    const total = countRes.rows?.[0]?.total || 0
    res.json({
      orders: ordersWithFee,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get payouts list with filtering and stats
app.get('/api/brand/payouts', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensurePayoutsTable()
    const brandId = req.brand.id

    const fromDate = req.query.from_date || null
    const toDate = req.query.to_date || null
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))

    const conditions = ['brand_id = $1']
    const values = [brandId]
    let i = 2

    if (fromDate) {
      conditions.push(`created_at >= $${i}`)
      values.push(fromDate)
      i++
    }

    if (toDate) {
      conditions.push(`created_at <= $${i}`)
      values.push(toDate)
      i++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    // Get stats
    const statsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS total_paid,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END), 0) AS average_payout,
        MAX(CASE WHEN status = 'completed' THEN amount ELSE NULL END) AS last_payout_amount,
        MAX(CASE WHEN status = 'completed' THEN paid_at ELSE NULL END) AS last_payout_date
       FROM payouts ${where}`,
      values
    )

    // Get paginated payouts
    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM payouts ${where}`, values),
      pool.query(
        `SELECT id, amount, period_start, period_end, status, method, reference_id, created_at, paid_at
         FROM payouts ${where}
         ORDER BY created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        values
      )
    ])

    const total = countRes.rows?.[0]?.total || 0
    const stats = statsResult.rows[0] || {
      total_paid: 0,
      average_payout: 0,
      last_payout_amount: null,
      last_payout_date: null
    }

    res.json({
      payouts: rowsRes.rows,
      stats: {
        total_paid: Number(stats.total_paid || 0),
        average_payout: Number(stats.average_payout || 0),
        last_payout: stats.last_payout_amount ? {
          amount: Number(stats.last_payout_amount),
          date: stats.last_payout_date
        } : null
      },
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get unpaid payouts (unpaid transactions after commission)
app.get('/api/brand/payouts/unpaid', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    const brandId = req.brand.id

    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10) || 20))
    const offset = (page - 1) * pageSize

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Get unpaid successful transactions (payment_status = 'unpaid' AND payment_message = 'Transaction succeeded')
    // These are transactions after commission has been calculated
    const [countRes, ordersRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total 
         FROM orders 
         WHERE brand_id = $1 
           AND payment_status = 'unpaid' 
           AND payment_message = 'Transaction succeeded'
           AND commission_amount IS NOT NULL
           AND commission_amount > 0`,
        [brandId]
      ),
      pool.query(
        `SELECT 
          id, order_id, user_id, email, first_name, last_name, 
          items, total_amount, amount_usd, currency,
          payment_status, payment_message,
          commission_amount, commission_status, commission_rate,
          created_at, billing_country, vpn_geo
         FROM orders 
         WHERE brand_id = $1 
           AND payment_status = 'unpaid' 
           AND payment_message = 'Transaction succeeded'
           AND commission_amount IS NOT NULL
           AND commission_amount > 0
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [brandId, pageSize, offset]
      )
    ])

    const total = countRes.rows[0]?.total || 0

    // Get all unpaid orders to calculate total with fee applied
    const allUnpaidOrders = await pool.query(
      `SELECT commission_amount, COALESCE(amount_usd, total_amount) as order_amount
       FROM orders 
       WHERE brand_id = $1 
         AND payment_status = 'unpaid' 
         AND payment_message = 'Transaction succeeded'
         AND commission_amount IS NOT NULL
         AND commission_amount > 0`,
      [brandId]
    )

    // Calculate total unpaid commission with conversion fee applied
    let totalUnpaidCommission = 0
    allUnpaidOrders.rows.forEach(order => {
      const orderAmount = Number(order.order_amount || 0)
      const originalCommission = Number(order.commission_amount || 0)
      const postFeeAmount = applyConversionFee(orderAmount, conversionFee)
      const commissionRatio = orderAmount > 0 ? (originalCommission / orderAmount) : 0
      const postFeeCommission = postFeeAmount * commissionRatio
      totalUnpaidCommission += postFeeCommission
    })

    const transactions = ordersRes.rows.map(order => {
      const orderAmountUSD = Number(order.amount_usd || order.total_amount || 0)
      const originalCommission = Number(order.commission_amount || 0)

      // Apply conversion fee
      const postFeeAmount = applyConversionFee(orderAmountUSD, conversionFee)
      const commissionRatio = orderAmountUSD > 0 ? (originalCommission / orderAmountUSD) : 0
      const postFeeCommission = postFeeAmount * commissionRatio

      const rollingReserveAmount = postFeeAmount * 0.10 // 10% rolling reserve on post-fee amount
      const payoutAmount = Math.max(0, postFeeCommission - rollingReserveAmount)

      return {
        ...order,
        order_amount_usd: postFeeAmount,
        amount_usd: postFeeAmount,
        total_amount: postFeeAmount,
        commission_amount: postFeeCommission,
        rolling_reserve_amount: rollingReserveAmount,
        payout_amount: payoutAmount
      }
    })

    res.json({
      transactions,
      stats: {
        total_unpaid_commission: totalUnpaidCommission,
        total_count: total
      },
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get child brand transactions (for parent brands)
app.get('/api/brand/child-transactions', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureBrandsTable()
    const parentBrandId = req.brand.id

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Get all child brands
    const childBrands = await pool.query(
      'SELECT id, name, email, commission_rate FROM brands WHERE parent_brand_id = $1',
      [parentBrandId]
    )

    if (childBrands.rows.length === 0) {
      return res.json({
        stats: {
          total_paid: 0,
          final_payout: 0,
          rolling_reserve: 0,
          total_order_amount: 0,
          total_transactions: 0
        },
        transactions: [],
        child_brands: []
      })
    }

    const childBrandIds = childBrands.rows.map(b => b.id)

    // Get all orders from child brands
    const ordersResult = await pool.query(
      `SELECT 
        o.id, o.order_id, o.user_id, o.email, o.items, 
        o.total_amount, o.payment_status, o.commission_amount, 
        o.commission_status, o.created_at, o.brand_id,
        o.currency, o.amount_usd,
        b.name as brand_name
       FROM orders o
       JOIN brands b ON o.brand_id = b.id
       WHERE o.brand_id = ANY($1::bigint[])
       ORDER BY o.created_at DESC`,
      [childBrandIds]
    )

    // Apply conversion fee and calculate aggregate stats
    let totalOrderAmount = 0
    let totalPaid = 0
    let totalCommission = 0

    const transactionsWithFee = ordersResult.rows.map(order => {
      const orderAmount = Number(order.amount_usd || order.total_amount || 0)
      const originalCommission = Number(order.commission_amount || 0)

      // Apply conversion fee
      const postFeeAmount = applyConversionFee(orderAmount, conversionFee)
      const commissionRatio = orderAmount > 0 ? (originalCommission / orderAmount) : 0
      const postFeeCommission = postFeeAmount * commissionRatio

      totalOrderAmount += postFeeAmount
      if (order.payment_status === 'paid') {
        totalPaid += postFeeAmount
      }
      totalCommission += postFeeCommission

      return {
        ...order,
        total_amount: postFeeAmount,
        amount_usd: postFeeAmount,
        commission_amount: postFeeCommission
      }
    })

    const rollingReserve = totalOrderAmount * 0.10 // 10% rolling reserve from order amount
    const finalPayout = totalCommission - rollingReserve

    res.json({
      stats: {
        total_paid: totalPaid,
        final_payout: finalPayout,
        rolling_reserve: rollingReserve,
        total_order_amount: totalPaid,
        total_transactions: transactionsWithFee.length
      },
      transactions: transactionsWithFee,
      child_brands: childBrands.rows
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get network transactions (for brands with child brands)
app.get('/api/brand/network-transactions', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureBrandsTable()
    const parentBrandId = req.brand.id

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Get all child brands
    const childBrands = await pool.query(
      'SELECT id, name, email, commission_rate FROM brands WHERE parent_brand_id = $1',
      [parentBrandId]
    )

    // Return 404 if no child brands exist
    if (childBrands.rows.length === 0) {
      return res.status(404).json({
        error: 'No child brands found',
        message: 'This brand does not have any child brands'
      })
    }

    const childBrandIds = childBrands.rows.map(b => b.id)

    // Parse query parameters for filtering
    const { fromDate, toDate, status, brand, geo } = req.query

    // Build WHERE conditions
    const conditions = ['o.brand_id = ANY($1::bigint[])']
    const values = [childBrandIds]
    let paramCount = 1

    if (fromDate) {
      paramCount++
      conditions.push(`o.created_at >= $${paramCount}`)
      values.push(new Date(fromDate))
    }

    if (toDate) {
      paramCount++
      conditions.push(`o.created_at <= $${paramCount}`)
      values.push(new Date(toDate))
    }

    if (status && status !== 'all') {
      paramCount++
      conditions.push(`o.payment_status = $${paramCount}`)
      values.push(status)
    }

    if (brand && brand !== 'all') {
      paramCount++
      conditions.push(`o.brand_id = $${paramCount}`)
      values.push(parseInt(brand))
    }

    if (geo && geo !== 'all') {
      paramCount++
      conditions.push(`o.vpn_geo = $${paramCount}`)
      values.push(geo)
    }

    const whereClause = conditions.join(' AND ')

    // Get all orders from child brands with filters
    const ordersResult = await pool.query(
      `SELECT 
        o.id, o.order_id, o.user_id, o.email, o.first_name, o.last_name, o.items, 
        o.total_amount, o.payment_status, o.commission_amount, 
        o.commission_status, o.commission_rate, o.created_at, o.brand_id,
        o.card_holder_name, o.phone, o.user_ip, o.vpn_detected,
        o.vpn_geo, o.card_bin, o.card_issuer, o.payment_message,
        o.currency, o.amount_usd, o.billing_country, o.payment_method,
        b.name as brand_name,
        b.commission_rate as brand_current_rate,
        u.full_name
       FROM orders o
       JOIN brands b ON o.brand_id = b.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC`,
      values
    )

    // Apply conversion fee and calculate aggregate stats
    let totalOrderAmount = 0
    let totalPaid = 0
    let totalCommission = 0

    // Parse full_name into firstName and lastName only if not already present
    const transactions = ordersResult.rows.map(tx => {
      // Use existing first_name and last_name from orders table if available
      let firstName = tx.first_name || ''
      let lastName = tx.last_name || ''

      // Only parse full_name if first_name or last_name is missing
      if (!firstName || !lastName) {
        const fullName = tx.full_name || tx.card_holder_name || ''
        const nameParts = fullName.split(' ')
        firstName = firstName || nameParts[0] || ''
        lastName = lastName || nameParts.slice(1).join(' ') || ''
      }

      // Apply conversion fee to order amount
      const orderAmountUSD = Number(tx.amount_usd || 0)
      const postFeeAmount = applyConversionFee(orderAmountUSD, conversionFee)

      // RECALCULATE commission using stored commission_rate (or brand's current rate as fallback) on POST-FEE amount
      const commissionRate = Number(tx.commission_rate) || Number(tx.brand_current_rate) || 0
      let commission = 0

      if (commissionRate > 0 && postFeeAmount > 0) {
        commission = postFeeAmount * (commissionRate / 100)
      }

      const rollingReserveAmount = postFeeAmount * 0.10 // 10% of post-fee order amount
      const payoutAmount = commission - rollingReserveAmount // commission minus rolling reserve

      // Accumulate totals
      totalOrderAmount += postFeeAmount
      if (tx.payment_status === 'paid') {
        totalPaid += postFeeAmount
      }
      totalCommission += commission

      return {
        ...tx,
        first_name: firstName,
        last_name: lastName,
        order_amount_usd: postFeeAmount,
        amount_usd: postFeeAmount,
        total_amount: postFeeAmount,
        commission_rate: commissionRate, // Store the rate used for display
        commission_amount: commission, // Use recalculated commission with fee applied
        rolling_reserve_amount: rollingReserveAmount,
        payout_amount: payoutAmount
      }
    })

    const rollingReserve = totalOrderAmount * 0.10 // 10% rolling reserve from order amount
    const finalPayout = totalCommission - rollingReserve

    res.json({
      stats: {
        total_order_amount: totalOrderAmount,
        rolling_reserve: rollingReserve,
        final_payout: finalPayout,
        total_paid: totalPaid
      },
      transactions,
      child_brands: childBrands.rows
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get all transactions (own + child brands if parent)
app.get('/api/brand/all-transactions', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureBrandsTable()
    const brandId = req.brand.id

    // Parse query parameters for filtering
    const { fromDate, toDate, status, brand, geo } = req.query

    // Get child brands
    const childBrands = await pool.query(
      'SELECT id, name, email, commission_rate FROM brands WHERE parent_brand_id = $1',
      [brandId]
    )

    const childBrandIds = childBrands.rows.map(b => b.id)
    const isParent = childBrandIds.length > 0

    // Build WHERE conditions
    const conditions = []
    const values = []
    let paramCount = 0

    // Include own transactions and child transactions if parent
    if (isParent) {
      conditions.push(`(o.brand_id = $${++paramCount} OR o.brand_id = ANY($${++paramCount}::bigint[]))`)
      values.push(brandId, childBrandIds)
    } else {
      conditions.push(`o.brand_id = $${++paramCount}`)
      values.push(brandId)
    }

    if (fromDate) {
      conditions.push(`o.created_at >= $${++paramCount}`)
      values.push(new Date(fromDate))
    }

    if (toDate) {
      conditions.push(`o.created_at <= $${++paramCount}`)
      values.push(new Date(toDate))
    }

    if (status && status !== 'all') {
      conditions.push(`o.payment_status = $${++paramCount}`)
      values.push(status)
    }

    if (brand && brand !== 'all') {
      if (brand === 'own') {
        conditions.push(`o.brand_id = $${++paramCount}`)
        values.push(brandId)
      } else {
        conditions.push(`o.brand_id = $${++paramCount}`)
        values.push(parseInt(brand))
      }
    }

    if (geo && geo !== 'all') {
      conditions.push(`o.vpn_geo = $${++paramCount}`)
      values.push(geo)
    }

    const whereClause = conditions.join(' AND ')

    // Calculate stats WITHOUT filters (cards 1-4)
    // Build base condition for brand network (own + children)
    const brandConditions = []
    if (isParent) {
      brandConditions.push(`(o.brand_id = ${brandId} OR o.brand_id = ANY(ARRAY[${childBrandIds.join(',')}]::bigint[]))`)
    } else {
      brandConditions.push(`o.brand_id = ${brandId}`)
    }
    const baseBrandCondition = brandConditions[0]

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Card 1: Total Order Amount - sum of UNPAID transactions only
    // Note: Removed payment_message filter to include all unpaid successful transactions
    const unpaidOrdersResult = await pool.query(
      `SELECT 
        o.amount_usd,
        o.currency
       FROM orders o
       WHERE ${baseBrandCondition}
         AND o.payment_status = 'unpaid'`
    )

    // Apply conversion fee and calculate totals for unpaid orders
    let totalOrderAmount = 0

    unpaidOrdersResult.rows.forEach(order => {
      const orderAmount = Number(order.amount_usd || 0)
      const orderCurrency = order.currency || 'USD'

      // Only apply conversion fee if currency is NOT USD
      const postFeeAmount = orderCurrency === 'USD' ? orderAmount : applyConversionFee(orderAmount, conversionFee)

      totalOrderAmount += postFeeAmount
    })

    // Card 2: Rolling Reserve - 10% of Total Order Amount
    const rollingReserve = totalOrderAmount * 0.10

    // Card 3: Final Payout - 65% of Total Order Amount
    const finalPayout = totalOrderAmount * 0.65

    // Card 4: Total Paid - sum of paid order amounts (just the order amounts, not commission calculations)
    // Note: Removed payment_message filter to include all paid transactions
    const totalPaidResult = await pool.query(
      `SELECT o.amount_usd, o.currency
       FROM orders o
       WHERE ${baseBrandCondition}
         AND o.payment_status = 'paid'`
    )

    let totalPaidAmount = 0
    totalPaidResult.rows.forEach(order => {
      const orderAmount = Number(order.amount_usd || 0)
      const orderCurrency = order.currency || 'USD'

      // Only apply conversion fee if currency is NOT USD
      const postFeeAmount = orderCurrency === 'USD' ? orderAmount : applyConversionFee(orderAmount, conversionFee)

      totalPaidAmount += postFeeAmount
    })

    // Get all orders with filters (for table display)
    const ordersResult = await pool.query(
      `SELECT 
        o.id, o.order_id, o.user_id, o.email, o.first_name, o.last_name, o.items, 
        o.total_amount, o.payment_status, o.commission_amount, 
        o.commission_status, o.commission_rate, o.created_at, o.brand_id,
        o.card_holder_name, o.phone, o.user_ip, o.vpn_detected,
        o.vpn_geo, o.card_bin, o.card_issuer, o.payment_message,
        o.currency, o.amount_usd, o.billing_country, o.payment_method,
        b.name as brand_name, b.commission_rate as brand_current_rate,
        u.full_name
       FROM orders o
       JOIN brands b ON o.brand_id = b.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC`,
      values
    )

    // Parse full_name into firstName and lastName only if not already present
    const transactions = ordersResult.rows.map(tx => {
      // Use existing first_name and last_name from orders table if available
      let firstName = tx.first_name || ''
      let lastName = tx.last_name || ''

      // Only parse full_name if first_name or last_name is missing
      if (!firstName || !lastName) {
        const fullName = tx.full_name || tx.card_holder_name || ''
        const nameParts = fullName.split(' ')
        firstName = firstName || nameParts[0] || ''
        lastName = lastName || nameParts.slice(1).join(' ') || ''
      }

      // Apply conversion fee to order amount ONLY if currency is NOT USD
      const orderAmountUSD = Number(tx.amount_usd || 0)
      const orderCurrency = tx.currency || 'USD'

      // Only apply conversion fee if currency is NOT USD
      const postFeeAmount = orderCurrency === 'USD' ? orderAmountUSD : applyConversionFee(orderAmountUSD, conversionFee)

      // RECALCULATE commission using stored commission_rate (or brand's current rate as fallback) on POST-FEE amount
      const commissionRate = Number(tx.commission_rate) || Number(tx.brand_current_rate) || 0
      let commission = 0

      if (commissionRate > 0 && postFeeAmount > 0) {
        commission = postFeeAmount * (commissionRate / 100)
      }

      const rollingReserveAmount = postFeeAmount * 0.10 // 10% of post-fee order amount
      const payoutAmount = commission - rollingReserveAmount // commission minus rolling reserve

      return {
        ...tx,
        first_name: firstName,
        last_name: lastName,
        order_amount_usd: postFeeAmount,
        amount_usd: postFeeAmount,
        // Keep total_amount as original from DB (tx.total_amount), don't override it
        commission_rate: commissionRate, // Store the rate used for display
        commission_amount: commission, // Use recalculated commission with fee applied
        rolling_reserve_amount: rollingReserveAmount,
        payout_amount: payoutAmount
      }
    })

    // Build list of brands for filter (own + children)
    const brands = [
      { id: 'own', name: req.brand.name, email: req.brand.email }
    ]
    if (isParent) {
      brands.push(...childBrands.rows)
    }

    res.json({
      stats: {
        total_order_amount: totalOrderAmount,
        rolling_reserve: rollingReserve,
        final_payout: finalPayout,
        total_paid: totalPaidAmount
      },
      transactions,
      child_brands: brands
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get analytics data
app.get('/api/brand/analytics', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureOrdersTable()
    const brandId = req.brand.id
    const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)))
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Revenue over time (daily)
    const revenueOverTime = await pool.query(
      `SELECT 
        DATE(created_at) AS date,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(commission_amount), 0) AS commission
       FROM orders 
       WHERE brand_id = $1 AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [brandId, dateFrom]
    )

    // Top customers
    const topCustomers = await pool.query(
      `SELECT 
        email,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total_amount), 0) AS total_spent,
        COALESCE(SUM(commission_amount), 0) AS total_commission
       FROM orders 
       WHERE brand_id = $1
       GROUP BY email
       ORDER BY total_spent DESC
       LIMIT 10`,
      [brandId]
    )

    res.json({
      revenue_over_time: revenueOverTime.rows.map(row => ({
        date: row.date,
        orders: row.orders,
        revenue: Number(row.revenue),
        commission: Number(row.commission)
      })),
      top_customers: topCustomers.rows.map(row => ({
        email: row.email,
        order_count: row.order_count,
        total_spent: Number(row.total_spent),
        total_commission: Number(row.total_commission)
      }))
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Update profile
app.patch('/api/brand/profile', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandsTable()
    const brandId = req.brand.id
    const { name, logo_url, website, primary_color, secondary_color, description } = req.body || {}

    const fields = []
    const values = []
    let i = 1

    if (typeof name !== 'undefined') { fields.push(`name = $${i++}`); values.push(String(name).trim()) }
    if (typeof logo_url !== 'undefined') { fields.push(`logo_url = $${i++}`); values.push(logo_url || null) }
    if (typeof website !== 'undefined') { fields.push(`website = $${i++}`); values.push(website || null) }
    if (typeof primary_color !== 'undefined') { fields.push(`primary_color = $${i++}`); values.push(primary_color || null) }
    if (typeof secondary_color !== 'undefined') { fields.push(`secondary_color = $${i++}`); values.push(secondary_color || null) }
    if (typeof description !== 'undefined') { fields.push(`description = $${i++}`); values.push(description || null) }

    fields.push(`updated_at = NOW()`)

    if (fields.length === 1) {
      const result = await pool.query('SELECT id, name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email FROM brands WHERE id = $1', [brandId])
      return res.json({ brand: result.rows[0] })
    }

    values.push(brandId)
    const sql = `UPDATE brands SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email, created_at, updated_at`
    const result = await pool.query(sql, values)

    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get profile
app.get('/api/brand/profile', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandsTable()
    const result = await pool.query(
      'SELECT id, name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email, status, created_at, updated_at FROM brands WHERE id = $1',
      [req.brand.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })
    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===================== BRAND LINKS & TRACKING API =====================

// Database setup for MIDs (Merchant IDs) - display only system
async function ensureMidsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mids (
        id BIGSERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mids_code ON mids(code);
      CREATE INDEX IF NOT EXISTS idx_mids_is_active ON mids(is_active);
    `)
  } catch (err) {
    console.error('Error creating mids table:', err.message)
  }
}

async function ensureBrandMidsTable() {
  try {
    await ensureMidsTable()
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_mids (
        id BIGSERIAL PRIMARY KEY,
        brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        mid_id BIGINT NOT NULL REFERENCES mids(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        assigned_by_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(brand_id, mid_id)
      );
      CREATE INDEX IF NOT EXISTS idx_brand_mids_brand_id ON brand_mids(brand_id);
      CREATE INDEX IF NOT EXISTS idx_brand_mids_mid_id ON brand_mids(mid_id);
    `)
  } catch (err) {
    console.error('Error creating brand_mids table:', err.message)
  }
}

// Database setup for brand links
async function ensureBrandLinksTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_links (
        id BIGSERIAL PRIMARY KEY,
        brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        link_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        clicks_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_brand_links_brand_id ON brand_links(brand_id);
      CREATE INDEX IF NOT EXISTS idx_brand_links_link_id ON brand_links(link_id);
    `)

    // Add new columns if they don't exist
    const alters = [
      "ADD COLUMN IF NOT EXISTS package_id TEXT REFERENCES packages(id) ON DELETE CASCADE",
      "ADD COLUMN IF NOT EXISTS custom_url TEXT",
      "ADD COLUMN IF NOT EXISTS is_main_link BOOLEAN DEFAULT FALSE",
      "ADD COLUMN IF NOT EXISTS transactions_count INTEGER NOT NULL DEFAULT 0"
    ]
    for (const clause of alters) {
      try {
        await pool.query(`ALTER TABLE brand_links ${clause};`)
      } catch (_e) { /* ignore */ }
    }
  } catch (err) {
    console.error('Error creating brand_links table:', err.message)
  }
}

async function ensureLinkClicksTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_clicks (
        id BIGSERIAL PRIMARY KEY,
        link_id BIGINT NOT NULL REFERENCES brand_links(id) ON DELETE CASCADE,
        brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
      CREATE INDEX IF NOT EXISTS idx_link_clicks_brand_id ON link_clicks(brand_id);
      CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);
    `)
  } catch (err) {
    console.error('Error creating link_clicks table:', err.message)
  }
}

// Database setup for direct purchase links
async function ensureDirectPurchaseLinksTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS direct_purchase_links (
        id BIGSERIAL PRIMARY KEY,
        brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        link_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        package_price DECIMAL(10, 2) NOT NULL,
        credits_price DECIMAL(10, 2) NOT NULL,
        package_id TEXT NOT NULL,
        credits_amount TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        visits_count INTEGER NOT NULL DEFAULT 0,
        transactions_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_direct_purchase_links_brand_id ON direct_purchase_links(brand_id);
      CREATE INDEX IF NOT EXISTS idx_direct_purchase_links_link_id ON direct_purchase_links(link_id);
      CREATE INDEX IF NOT EXISTS idx_direct_purchase_links_is_active ON direct_purchase_links(is_active);
    `)
  } catch (err) {
    console.error('Error creating direct_purchase_links table:', err.message)
  }
}

// Predefined package + credits combinations 
const PREDEFINED_COMBINATIONS = {
  100: { packageId: 'starter', packagePrice: 50, creditsAmount: 50, creditsPrice: 50 },
  150: { packageId: 'starter', packagePrice: 50, creditsAmount: 100, creditsPrice: 100 },
  199: { packageId: 'professional', packagePrice: 129, creditsAmount: 70, creditsPrice: 70 },
  239: { packageId: 'expert', packagePrice: 189, creditsAmount: 50, creditsPrice: 50 },
  259: { packageId: 'expert', packagePrice: 189, creditsAmount: 70, creditsPrice: 70 },
  289: { packageId: 'expert', packagePrice: 189, creditsAmount: 100, creditsPrice: 100 },
  339: { packageId: 'expert', packagePrice: 189, creditsAmount: 150, creditsPrice: 150 },
  439: { packageId: 'expert', packagePrice: 189, creditsAmount: 250, creditsPrice: 250 },
  550: { packageId: 'starter', packagePrice: 50, creditsAmount: 500, creditsPrice: 500 },
  689: { packageId: 'expert', packagePrice: 189, creditsAmount: 500, creditsPrice: 500 },
  1050: { packageId: 'starter', packagePrice: 50, creditsAmount: 1000, creditsPrice: 1000 },
  1189: { packageId: 'expert', packagePrice: 189, creditsAmount: 1000, creditsPrice: 1000 },
  1689: { packageId: 'expert', packagePrice: 189, creditsAmount: 'unlimited', creditsPrice: 1500 }
}

// Helper function to calculate package + credits split for given total amount
// Uses predefined combinations for exact matches, otherwise calculates dynamically
async function calculatePackageCreditsSplit(totalAmount, packageId = null, creditsAmount = null) {
  try {
    await ensurePackagesTable()
    
    const totalAmountNum = Number(totalAmount)
    
    // Check if we have a predefined combination for this exact amount
    if (PREDEFINED_COMBINATIONS[totalAmountNum]) {
      const combo = PREDEFINED_COMBINATIONS[totalAmountNum]
      
      // Get package details from database
      const pkgResult = await pool.query('SELECT * FROM packages WHERE id = $1 AND type = $2', [combo.packageId, 'package'])
      const packageName = pkgResult.rows.length > 0 ? pkgResult.rows[0].name : combo.packageId.charAt(0).toUpperCase() + combo.packageId.slice(1)
      
      return {
        packageId: combo.packageId,
        packageName,
        packagePrice: combo.packagePrice,
        creditsPrice: combo.creditsPrice,
        creditsAmount: combo.creditsAmount
      }
    }
    
    // Fallback: Dynamic calculation if no predefined combination
    let selectedPackage = null
    if (packageId) {
      const pkgResult = await pool.query('SELECT * FROM packages WHERE id = $1 AND type = $2', [packageId, 'package'])
      if (pkgResult.rows.length > 0) {
        selectedPackage = pkgResult.rows[0]
      }
    }
    
    // If no package specified, find the starter package or one closest to $50
    if (!selectedPackage) {
      const packagesResult = await pool.query(`
        SELECT * FROM packages 
        WHERE type = 'package' AND active = true 
        ORDER BY ABS(price - 50) ASC 
        LIMIT 1
      `)
      if (packagesResult.rows.length > 0) {
        selectedPackage = packagesResult.rows[0]
      }
    }
    
    if (!selectedPackage) {
      // Fallback: use $50 as default package price
      selectedPackage = { id: 'starter', name: 'Starter', price: 50, currency: '$' }
    }
    
    const packagePrice = Number(selectedPackage.price || 50)
    
    // If creditsAmount is provided, use it; otherwise calculate
    let creditsPrice, finalCreditsAmount
    if (creditsAmount !== null && creditsAmount !== undefined) {
      finalCreditsAmount = creditsAmount === 'unlimited' ? 'unlimited' : Number(creditsAmount)
      creditsPrice = finalCreditsAmount === 'unlimited' ? 1500 : Number(finalCreditsAmount)
    } else {
      creditsPrice = Number(totalAmount) - packagePrice
      // Ensure credits price is not negative
      if (creditsPrice < 0) {
        throw new Error(`Total amount ${totalAmount} is less than package price ${packagePrice}`)
      }
      finalCreditsAmount = Math.floor(creditsPrice)
    }
    
    return {
      packageId: selectedPackage.id,
      packageName: selectedPackage.name || 'Starter',
      packagePrice,
      creditsPrice,
      creditsAmount: finalCreditsAmount
    }
  } catch (err) {
    console.error('[calculatePackageCreditsSplit] Error:', err.message)
    throw err
  }
}

// Generate unique link ID
function generateLinkId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Brand: Create new affiliate link
app.post('/api/brand/links', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandLinksTable()
    const brandId = req.brand.id
    const { name, destination_url } = req.body || {}

    if (!name || !destination_url) {
      return res.status(400).json({ error: 'name and destination_url are required' })
    }

    // Validate URL format
    try {
      new URL(destination_url)
    } catch (e) {
      return res.status(400).json({ error: 'Invalid destination_url format' })
    }

    // Generate unique link ID
    let linkId = generateLinkId()
    let attempts = 0
    while (attempts < 10) {
      const existing = await pool.query('SELECT id FROM brand_links WHERE link_id = $1', [linkId])
      if (existing.rows.length === 0) break
      linkId = generateLinkId()
      attempts++
    }

    const result = await pool.query(
      `INSERT INTO brand_links (brand_id, link_id, name, destination_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [brandId, linkId, name.trim(), destination_url.trim()]
    )

    res.json({ link: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get all links
app.get('/api/brand/links', requireAuth, requireBrand, async (req, res) => {
  console.log('GET /api/brand/links called for brand:', req.brand.id);
  try {
    await ensureBrandLinksTable();
    await ensureLinkClicksTable();
    await ensurePackagesTable();

    const brandId = req.brand.id;
    

    await ensureBrandPackageLinksForBrand(brandId);

    const result = await pool.query(
      `SELECT 
        bl.*,
        COALESCE(click_stats.visits, 0) as visits_count,
        bl.transactions_count,
        CASE 
          WHEN COALESCE(click_stats.visits, 0) > 0 
          THEN ROUND((bl.transactions_count::numeric / click_stats.visits::numeric * 100), 2)
          ELSE 0 
        END as conversion_rate
       FROM brand_links bl
       LEFT JOIN (
         SELECT link_id, COUNT(*) as visits
         FROM link_clicks
         GROUP BY link_id
       ) click_stats ON click_stats.link_id = bl.id
       WHERE bl.brand_id = $1
         AND bl.is_active = true
         AND (
           bl.is_main_link = true 
           OR bl.custom_url IS NOT NULL 
           OR bl.package_id IS NOT NULL
         )
       ORDER BY bl.is_main_link DESC, bl.created_at DESC`,
      [brandId]
    );

    // ✅ force fresh response always
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json({ links: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Brand: Update link
app.patch('/api/brand/links/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandLinksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)
    const { name, destination_url, is_active } = req.body || {}

    const fields = []
    const values = []
    let i = 1

    if (typeof name !== 'undefined') {
      fields.push(`name = $${i++}`)
      values.push(String(name).trim())
    }
    if (typeof destination_url !== 'undefined') {
      // Validate URL
      try {
        new URL(destination_url)
      } catch (e) {
        return res.status(400).json({ error: 'Invalid destination_url format' })
      }
      fields.push(`destination_url = $${i++}`)
      values.push(destination_url.trim())
    }
    if (typeof is_active !== 'undefined') {
      fields.push(`is_active = $${i++}`)
      values.push(Boolean(is_active))
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    fields.push(`updated_at = NOW()`)
    values.push(brandId, linkId)

    const result = await pool.query(
      `UPDATE brand_links 
       SET ${fields.join(', ')}
       WHERE brand_id = $${i} AND id = $${i + 1}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    res.json({ link: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Delete link (soft delete by setting is_active = false)
app.delete('/api/brand/links/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandLinksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)

    const result = await pool.query(
      `UPDATE brand_links 
       SET is_active = false, updated_at = NOW()
       WHERE brand_id = $1 AND id = $2
       RETURNING *`,
      [brandId, linkId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    res.json({ success: true, link: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get link stats
app.get('/api/brand/links/:id/stats', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandLinksTable()
    await ensureLinkClicksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)

    // Verify link belongs to brand
    const linkResult = await pool.query(
      'SELECT * FROM brand_links WHERE brand_id = $1 AND id = $2',
      [brandId, linkId]
    )

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    // Get click stats by day for last 30 days
    const clicksByDay = await pool.query(
      `SELECT 
        DATE(clicked_at) AS date,
        COUNT(*)::int AS clicks
       FROM link_clicks
       WHERE link_id = $1 AND clicked_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(clicked_at)
       ORDER BY date DESC`,
      [linkId]
    )

    // Get total clicks
    const totalClicks = await pool.query(
      'SELECT COUNT(*)::int AS total FROM link_clicks WHERE link_id = $1',
      [linkId]
    )

    res.json({
      link: linkResult.rows[0],
      total_clicks: totalClicks.rows[0]?.total || 0,
      clicks_by_day: clicksByDay.rows
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get link click history
app.get('/api/brand/links/:id/clicks', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureLinkClicksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)))
    const offset = (page - 1) * pageSize

    // Verify link belongs to brand
    const linkCheck = await pool.query(
      'SELECT id FROM brand_links WHERE brand_id = $1 AND id = $2',
      [brandId, linkId]
    )

    if (linkCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    const [countRes, clicksRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM link_clicks WHERE link_id = $1', [linkId]),
      pool.query(
        `SELECT id, ip_address, user_agent, referrer, clicked_at
         FROM link_clicks
         WHERE link_id = $1
         ORDER BY clicked_at DESC
         LIMIT $2 OFFSET $3`,
        [linkId, pageSize, offset]
      )
    ])

    const total = countRes.rows[0]?.total || 0

    res.json({
      clicks: clicksRes.rows,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Track link click and redirect
app.get('/api/track/:linkId', async (req, res) => {
  try {
    await ensureBrandLinksTable()
    await ensureLinkClicksTable()

    const linkId = req.params.linkId

    // Get link details
    const linkResult = await pool.query(
      'SELECT * FROM brand_links WHERE link_id = $1 AND is_active = true',
      [linkId]
    )

    if (linkResult.rows.length === 0) {
      return res.status(404).send('Link not found')
    }

    const link = linkResult.rows[0]

    // Track the click
    const ipAddress = getRequestIp(req)
    const userAgent = req.headers['user-agent'] || ''
    const referrer = req.headers['referer'] || req.headers['referrer'] || ''

    // Insert click record
    await pool.query(
      `INSERT INTO link_clicks (link_id, brand_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [link.id, link.brand_id, ipAddress, userAgent, referrer]
    )

    // Update clicks count
    await pool.query(
      'UPDATE brand_links SET clicks_count = clicks_count + 1, updated_at = NOW() WHERE id = $1',
      [link.id]
    )

    // Redirect to destination
    res.redirect(link.destination_url)
  } catch (err) {
    console.error('Track link error:', err)
    res.status(500).send('Error processing link')
  }
})

// Public endpoint: Record a visit when someone lands with ?link parameter
app.post('/api/brand/links/record-visit', async (req, res) => {
  try {
    await ensureBrandLinksTable()
    await ensureLinkClicksTable()

    const { linkId } = req.body || {}

    if (!linkId) {
      return res.status(400).json({ error: 'linkId is required' })
    }

    // Get link details
    const linkResult = await pool.query(
      'SELECT * FROM brand_links WHERE link_id = $1 AND is_active = true',
      [linkId]
    )

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    const link = linkResult.rows[0]

    // Track the visit
    const ipAddress = getRequestIp(req)
    const userAgent = req.headers['user-agent'] || ''
    const referrer = req.headers['referer'] || req.headers['referrer'] || ''

    // Insert visit record
    await pool.query(
      `INSERT INTO link_clicks (link_id, brand_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [link.id, link.brand_id, ipAddress, userAgent, referrer]
    )

    // Update clicks count
    await pool.query(
      'UPDATE brand_links SET clicks_count = clicks_count + 1, updated_at = NOW() WHERE id = $1',
      [link.id]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Record visit error:', err)
    res.status(500).json({ error: 'Error recording visit' })
  }
})

// ===================== DIRECT PURCHASE LINKS API =====================

// Brand: Create new direct purchase link
app.post('/api/brand/direct-purchase-links', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const brandId = req.brand.id
    const { name, total_amount, package_id, credits_amount } = req.body || {}
    
    if (!name || !total_amount) {
      return res.status(400).json({ error: 'name and total_amount are required' })
    }
    
    const totalAmountNum = Number(total_amount)
    if (isNaN(totalAmountNum) || totalAmountNum <= 0) {
      return res.status(400).json({ error: 'total_amount must be a positive number' })
    }
    
    // Calculate package and credits split (uses predefined combinations if available)
    const split = await calculatePackageCreditsSplit(totalAmountNum, package_id || null, credits_amount || null)
    
    // Generate unique link ID
    let linkId = generateLinkId()
    let attempts = 0
    while (attempts < 10) {
      const existing = await pool.query('SELECT id FROM direct_purchase_links WHERE link_id = $1', [linkId])
      if (existing.rows.length === 0) break
      linkId = generateLinkId()
      attempts++
    }
    
    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique link ID' })
    }
    
    // Handle unlimited credits - store as string
    const creditsAmountValue = split.creditsAmount === 'unlimited' ? 'unlimited' : String(split.creditsAmount)
    
    const result = await pool.query(
      `INSERT INTO direct_purchase_links (brand_id, link_id, name, total_amount, package_price, credits_price, package_id, credits_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        brandId,
        linkId,
        name.trim(),
        totalAmountNum,
        split.packagePrice,
        split.creditsPrice,
        split.packageId,
        creditsAmountValue
      ]
    )
    
    res.json({ link: result.rows[0] })
  } catch (err) {
    console.error('Create direct purchase link error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get all direct purchase links
app.get('/api/brand/direct-purchase-links', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const brandId = req.brand.id
    
    const result = await pool.query(
      `SELECT 
        dpl.*,
        COALESCE(dpl.visits_count, 0) as visits_count,
        CASE 
          WHEN COALESCE(dpl.visits_count, 0) > 0 
          THEN ROUND((dpl.transactions_count::numeric / dpl.visits_count::numeric * 100), 2)
          ELSE 0 
        END as conversion_rate
       FROM direct_purchase_links dpl
       WHERE dpl.brand_id = $1
       ORDER BY dpl.created_at DESC`,
      [brandId]
    )
    
    res.json({ links: result.rows })
  } catch (err) {
    console.error('Get direct purchase links error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Update direct purchase link
app.patch('/api/brand/direct-purchase-links/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)
    const { name, is_active } = req.body || {}
    
    // Verify ownership
    const existing = await pool.query(
      'SELECT * FROM direct_purchase_links WHERE brand_id = $1 AND id = $2',
      [brandId, linkId]
    )
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }
    
    const updates = []
    const values = []
    let paramCount = 1
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount}`)
      values.push(name.trim())
      paramCount++
    }
    
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${paramCount}`)
      values.push(is_active)
      paramCount++
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    
    updates.push('updated_at = NOW()')
    values.push(brandId, linkId)
    
    const result = await pool.query(
      `UPDATE direct_purchase_links 
       SET ${updates.join(', ')} 
       WHERE brand_id = $${paramCount} AND id = $${paramCount + 1}
       RETURNING *`,
      [...values]
    )
    
    res.json({ link: result.rows[0] })
  } catch (err) {
    console.error('Update direct purchase link error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Delete direct purchase link
app.delete('/api/brand/direct-purchase-links/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const brandId = req.brand.id
    const linkId = parseInt(req.params.id, 10)
    
    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM direct_purchase_links WHERE brand_id = $1 AND id = $2',
      [brandId, linkId]
    )
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }
    
    await pool.query('DELETE FROM direct_purchase_links WHERE brand_id = $1 AND id = $2', [brandId, linkId])
    
    res.json({ success: true })
  } catch (err) {
    console.error('Delete direct purchase link error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all direct purchase links
app.get('/api/admin/direct-purchase-links', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    await ensureBrandsTable()
    const brandId = req.query.brand_id ? parseInt(req.query.brand_id, 10) : null
    
    let query = `
      SELECT 
        dpl.*,
        b.name as brand_name,
        b.slug as brand_slug,
        COALESCE(dpl.visits_count, 0) as visits_count,
        CASE 
          WHEN COALESCE(dpl.visits_count, 0) > 0 
          THEN ROUND((dpl.transactions_count::numeric / dpl.visits_count::numeric * 100), 2)
          ELSE 0 
        END as conversion_rate
       FROM direct_purchase_links dpl
       JOIN brands b ON dpl.brand_id = b.id
       WHERE 1=1
    `
    const values = []
    let paramCount = 1
    
    if (brandId) {
      query += ` AND dpl.brand_id = $${paramCount}`
      values.push(brandId)
      paramCount++
    }
    
    query += ` ORDER BY dpl.created_at DESC`
    
    const result = await pool.query(query, values)
    
    res.json({ links: result.rows })
  } catch (err) {
    console.error('Admin get direct purchase links error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get direct purchase links for specific brand
app.get('/api/admin/direct-purchase-links/brand/:brandId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const brandId = parseInt(req.params.brandId, 10)
    
    const result = await pool.query(
      `SELECT * FROM direct_purchase_links WHERE brand_id = $1 ORDER BY created_at DESC`,
      [brandId]
    )
    
    res.json({ links: result.rows })
  } catch (err) {
    console.error('Admin get brand direct purchase links error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Get direct purchase link details
app.get('/api/direct-purchase/:linkId', async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    const linkId = req.params.linkId
    
    const result = await pool.query(
      `SELECT * FROM direct_purchase_links WHERE link_id = $1 AND is_active = true`,
      [linkId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found or inactive' })
    }
    
    res.json({ link: result.rows[0] })
  } catch (err) {
    console.error('Get direct purchase link error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get predefined combinations (for frontend)
app.get('/api/direct-purchase/combinations', async (req, res) => {
  try {
    const combinations = Object.keys(PREDEFINED_COMBINATIONS).map(amount => {
      const combo = PREDEFINED_COMBINATIONS[Number(amount)]
      return {
        total_amount: Number(amount),
        package_id: combo.packageId,
        package_price: combo.packagePrice,
        credits_amount: combo.creditsAmount,
        credits_price: combo.creditsPrice,
        name: `${combo.packageId.charAt(0).toUpperCase() + combo.packageId.slice(1)} + ${combo.creditsAmount === 'unlimited' ? 'Unlimited' : combo.creditsAmount} Credits`
      }
    })
    res.json({ combinations })
  } catch (err) {
    console.error('Get combinations error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Track visit to direct purchase link
app.post('/api/direct-purchase/:linkId/visit', async (req, res) => {
  try {
    await ensureDirectPurchaseLinksTable()
    await ensureLinkClicksTable()
    
    const linkId = req.params.linkId
    
    // Get link details
    const linkResult = await pool.query(
      'SELECT * FROM direct_purchase_links WHERE link_id = $1 AND is_active = true',
      [linkId]
    )
    
    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found or inactive' })
    }
    
    const link = linkResult.rows[0]
    
    // Track the visit
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.headers['x-real-ip'] || 
                      req.socket.remoteAddress || 
                      'unknown'
    const userAgent = req.headers['user-agent'] || ''
    const referrer = req.headers['referer'] || req.headers['referrer'] || ''
    
    // Insert visit record
    try {
      await pool.query(
        `INSERT INTO link_clicks (link_id, brand_id, ip_address, user_agent, referrer)
         VALUES ($1, $2, $3, $4, $5)`,
        [link.id.toString(), link.brand_id, ipAddress, userAgent, referrer]
      )
      
      // Update visits count
      await pool.query(
        'UPDATE direct_purchase_links SET visits_count = visits_count + 1, updated_at = NOW() WHERE id = $1',
        [link.id]
      )
    } catch (visitErr) {
      // Ignore duplicate visit errors
      console.warn('Visit tracking error (may be duplicate):', visitErr.message)
    }
    
    res.json({ success: true })
  } catch (err) {
    console.error('Track direct purchase visit error:', err)
    res.status(500).json({ error: 'Error recording visit' })
  }
})

// ===================== BRAND NETWORK API =====================

// Database setup for brand network
async function ensureBrandNetworkTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_network (
        id BIGSERIAL PRIMARY KEY,
        brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        partner_name TEXT NOT NULL,
        partner_email TEXT NOT NULL,
        partner_type TEXT NOT NULL CHECK (partner_type IN ('affiliate', 'reseller', 'partner')),
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'pending')) DEFAULT 'pending',
        commission_override NUMERIC,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_brand_network_brand_id ON brand_network(brand_id);
      CREATE INDEX IF NOT EXISTS idx_brand_network_email ON brand_network(partner_email);
    `)
  } catch (err) {
    console.error('Error creating brand_network table:', err.message)
  }
}

// Brand: Create partner
app.post('/api/brand/network', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandNetworkTable()
    const brandId = req.brand.id
    const { partner_name, partner_email, partner_type, commission_override, notes } = req.body || {}

    if (!partner_name || !partner_email || !partner_type) {
      return res.status(400).json({ error: 'partner_name, partner_email, and partner_type are required' })
    }

    if (!['affiliate', 'reseller', 'partner'].includes(partner_type)) {
      return res.status(400).json({ error: 'Invalid partner_type' })
    }

    const result = await pool.query(
      `INSERT INTO brand_network (brand_id, partner_name, partner_email, partner_type, commission_override, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [brandId, partner_name.trim(), partner_email.trim().toLowerCase(), partner_type, commission_override || null, notes || null]
    )

    res.json({ partner: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get all network partners
app.get('/api/brand/network', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandNetworkTable()
    const brandId = req.brand.id
    const partnerType = req.query.type?.toLowerCase()
    const status = req.query.status?.toLowerCase()

    let query = 'SELECT * FROM brand_network WHERE brand_id = $1'
    const values = [brandId]
    let i = 2

    if (partnerType && ['affiliate', 'reseller', 'partner'].includes(partnerType)) {
      query += ` AND partner_type = $${i++}`
      values.push(partnerType)
    }

    if (status && ['active', 'inactive', 'pending'].includes(status)) {
      query += ` AND status = $${i++}`
      values.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, values)

    res.json({ partners: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Update partner
app.patch('/api/brand/network/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandNetworkTable()
    const brandId = req.brand.id
    const partnerId = parseInt(req.params.id, 10)
    const { partner_name, partner_email, partner_type, status, commission_override, notes } = req.body || {}

    const fields = []
    const values = []
    let i = 1

    if (typeof partner_name !== 'undefined') {
      fields.push(`partner_name = $${i++}`)
      values.push(partner_name.trim())
    }
    if (typeof partner_email !== 'undefined') {
      fields.push(`partner_email = $${i++}`)
      values.push(partner_email.trim().toLowerCase())
    }
    if (typeof partner_type !== 'undefined') {
      if (!['affiliate', 'reseller', 'partner'].includes(partner_type)) {
        return res.status(400).json({ error: 'Invalid partner_type' })
      }
      fields.push(`partner_type = $${i++}`)
      values.push(partner_type)
    }
    if (typeof status !== 'undefined') {
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      fields.push(`status = $${i++}`)
      values.push(status)
    }
    if (typeof commission_override !== 'undefined') {
      fields.push(`commission_override = $${i++}`)
      values.push(commission_override || null)
    }
    if (typeof notes !== 'undefined') {
      fields.push(`notes = $${i++}`)
      values.push(notes || null)
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    fields.push(`updated_at = NOW()`)
    values.push(brandId, partnerId)

    const result = await pool.query(
      `UPDATE brand_network 
       SET ${fields.join(', ')}
       WHERE brand_id = $${i} AND id = $${i + 1}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    res.json({ partner: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Delete partner
app.delete('/api/brand/network/:id', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandNetworkTable()
    const brandId = req.brand.id
    const partnerId = parseInt(req.params.id, 10)

    const result = await pool.query(
      'DELETE FROM brand_network WHERE brand_id = $1 AND id = $2 RETURNING *',
      [brandId, partnerId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get network stats
app.get('/api/brand/network/stats', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureBrandNetworkTable()
    const brandId = req.brand.id

    const stats = await pool.query(
      `SELECT 
        COUNT(*)::int AS total_partners,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_partners,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_partners,
        COUNT(*) FILTER (WHERE partner_type = 'affiliate')::int AS affiliates,
        COUNT(*) FILTER (WHERE partner_type = 'reseller')::int AS resellers,
        COUNT(*) FILTER (WHERE partner_type = 'partner')::int AS partners
       FROM brand_network
       WHERE brand_id = $1`,
      [brandId]
    )

    res.json({ stats: stats.rows[0] || {} })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===================== ENHANCED VISITS TRACKING API =====================

// Update visits table with brand tracking
async function ensureEnhancedVisitsTable() {
  try {
    await pool.query(`
      DO $$ BEGIN
        -- Add brand_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='visits' AND column_name='brand_id') THEN
          ALTER TABLE visits ADD COLUMN brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL;
        END IF;
        
        -- Add link_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='visits' AND column_name='link_id') THEN
          ALTER TABLE visits ADD COLUMN link_id BIGINT REFERENCES brand_links(id) ON DELETE SET NULL;
        END IF;
        
        -- Add page_visited if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='visits' AND column_name='page_visited') THEN
          ALTER TABLE visits ADD COLUMN page_visited TEXT;
        END IF;
        
        -- Add session_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='visits' AND column_name='session_id') THEN
          ALTER TABLE visits ADD COLUMN session_id TEXT;
        END IF;
        
        -- Add visited_at if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='visits' AND column_name='visited_at') THEN
          ALTER TABLE visits ADD COLUMN visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
      END $$;
      
      CREATE INDEX IF NOT EXISTS idx_visits_brand_id ON visits(brand_id);
      CREATE INDEX IF NOT EXISTS idx_visits_link_id ON visits(link_id);
      CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
    `)
  } catch (err) {
    console.error('Error enhancing visits table:', err.message)
  }
}

// Brand: Get visits
app.get('/api/brand/visits', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureEnhancedVisitsTable()

    const brandId = req.brand.id
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)))
    const offset = (page - 1) * pageSize

    // Return only visits specifically for this brand
    const [countRes, visitsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM visits WHERE brand_id = $1', [brandId]),
      pool.query(
        `SELECT id, ip, visits_count, page_visited, visited_at
         FROM visits
         WHERE brand_id = $1
         ORDER BY visited_at DESC
         LIMIT $2 OFFSET $3`,
        [brandId, pageSize, offset]
      )
    ])

    const total = countRes.rows[0]?.total || 0

    res.json({
      visits: visitsRes.rows,
      meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Brand: Get visit stats
app.get('/api/brand/visits/stats', requireAuth, requireBrand, async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureEnhancedVisitsTable()

    const brandId = req.brand.id
    const days = Math.min(90, Math.max(1, parseInt(req.query.days || '30', 10)))
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Daily visit stats - only for this brand (use COALESCE to handle NULL visited_at)
    const dailyStats = await pool.query(
      `SELECT 
        DATE(COALESCE(visited_at, last_visit_at, created_at)) AS date,
        SUM(visits_count)::int AS total_visits
       FROM visits
       WHERE brand_id = $1 AND COALESCE(visited_at, last_visit_at, created_at) >= $2
       GROUP BY DATE(COALESCE(visited_at, last_visit_at, created_at))
       ORDER BY date DESC`,
      [brandId, dateFrom]
    )

    // Total visits - only for this brand (all visits across all brand links)
    const totalStats = await pool.query(
      'SELECT SUM(visits_count)::int AS total_visits FROM visits WHERE brand_id = $1',
      [brandId]
    )

    res.json({
      daily_stats: dailyStats.rows,
      total_visits: totalStats.rows[0]?.total_visits || 0,
      period_days: days
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===================== RESELLER API (mirrors brand API with network additions) =====================

// Reseller: Get dashboard stats
app.get('/api/reseller/dashboard/stats', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureOrdersTable()
    const resellerId = req.reseller.id
    const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)))
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get stats for reseller's child brand orders (using USD amounts for consistency)
    // Resellers don't have direct orders, only orders from their child brands
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(COALESCE(amount_usd, total_amount)), 0)::numeric AS total_revenue,
        COALESCE(SUM(commission_amount), 0)::numeric AS total_commission,
        COALESCE(SUM(CASE WHEN commission_status = 'paid' THEN commission_amount ELSE 0 END), 0)::numeric AS paid_commission,
        COALESCE(SUM(CASE WHEN commission_status = 'unpaid' THEN commission_amount ELSE 0 END), 0)::numeric AS unpaid_commission
       FROM orders
       WHERE brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)
       AND created_at >= $2`,
      [resellerId, dateFrom]
    )

    // Get total order amount (all successful unpaid transactions in USD) from child brands
    const totalOrderAmountResult = await pool.query(
      `SELECT 
        COALESCE(SUM(COALESCE(amount_usd, total_amount)), 0) AS total_order_amount
       FROM orders 
       WHERE brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)
       AND payment_status = 'unpaid' AND payment_message = 'Transaction succeeded'`,
      [resellerId]
    )

    // Get rolling reserve (10% of total order amount)
    const rollingReserve = Number(totalOrderAmountResult.rows[0]?.total_order_amount || 0) * 0.1

    const totalOrderAmount = Number(totalOrderAmountResult.rows[0]?.total_order_amount || 0)
    const totalCommission = Number(statsResult.rows[0]?.total_commission || 0)
    const finalPayoutAmount = Math.max(0, totalCommission - rollingReserve)

    // Get brand breakdown for reseller's child brands
    const brandBreakdownRes = await pool.query(`
      SELECT
        b.id,
        b.name,
        COUNT(o.id)::int AS total_orders,
        COALESCE(SUM(COALESCE(o.amount_usd, o.total_amount)), 0)::numeric AS total_revenue,
        COALESCE(SUM(o.commission_amount), 0)::numeric AS total_commission,
        COALESCE(SUM(CASE WHEN o.commission_status = 'paid' THEN o.commission_amount ELSE 0 END), 0)::numeric AS paid_commission,
        COALESCE(SUM(CASE WHEN o.commission_status = 'unpaid' THEN o.commission_amount ELSE 0 END), 0)::numeric AS unpaid_commission
      FROM brands b
      LEFT JOIN orders o ON b.id = o.brand_id AND o.payment_status IN ('paid', 'unpaid')
      WHERE b.parent_brand_id = $1
      GROUP BY b.id, b.name
      ORDER BY total_revenue DESC
    `, [resellerId])

    const brandBreakdown = brandBreakdownRes.rows.map(brand => ({
      ...brand,
      rolling_reserve: Number(brand.total_revenue || 0) * 0.1,
      final_payout_amount: Math.max(0, Number(brand.total_commission || 0) - (Number(brand.total_revenue || 0) * 0.1))
    }))

    const stats = {
      ...statsResult.rows[0],
      commission_rate: req.reseller.commission_rate || 10.0,
      period_days: days,
      // New metrics in USD
      total_order_amount: totalOrderAmount,
      rolling_reserve: rollingReserve,
      final_payout_amount: finalPayoutAmount
    }

    res.json({ stats, brand_breakdown: brandBreakdown })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get available MIDs (for selection)
app.get('/api/reseller/mids', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureMidsTable()

    // Get all active MIDs
    const result = await pool.query(
      'SELECT id, code, name, description FROM mids WHERE is_active = true ORDER BY code ASC'
    )

    res.json({ mids: result.rows || [] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Create brand (pending approval)
app.post('/api/reseller/brands', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureBrandLinksTable()
    await ensurePackagesTable()
    const resellerId = req.reseller.id
    const { name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email, username, custom_links, selected_mids } = req.body || {}

    if (!name) return res.status(400).json({ error: 'name_required' })
    if (!slug) return res.status(400).json({ error: 'slug_required' })
    if (!email) return res.status(400).json({ error: 'email_required' })
    if (!username) return res.status(400).json({ error: 'username_required' })

    // Validate slug format (alphanumeric + hyphens, lowercase)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    const normalizedSlug = String(slug).trim().toLowerCase()
    if (!slugRegex.test(normalizedSlug)) {
      return res.status(400).json({ error: 'invalid_slug_format', message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    }

    // Validate username format (alphanumeric + underscores + hyphens, lowercase)
    const usernameRegex = /^[a-z0-9_-]+$/
    const normalizedUsername = String(username).trim().toLowerCase()
    if (!usernameRegex.test(normalizedUsername)) {
      return res.status(400).json({ error: 'invalid_username_format', message: 'Username must contain only lowercase letters, numbers, underscores, and hyphens' })
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: 'username_too_short', message: 'Username must be at least 3 characters long' })
    }

    // Check if slug already exists
    const slugCheck = await pool.query('SELECT id FROM brands WHERE slug = $1', [normalizedSlug])
    if (slugCheck.rows.length > 0) {
      return res.status(409).json({ error: 'slug_already_exists', message: 'This slug is already in use' })
    }

    // Check if username already exists
    const usernameCheck = await pool.query('SELECT id FROM brands WHERE username = $1', [normalizedUsername])
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'username_already_exists', message: 'This username is already in use' })
    }

    // Validate custom_links package_ids (prevents FK errors on brand_links.package_id)
    const resolvedPackageIds = new Map()
    if (Array.isArray(custom_links)) {
      for (const link of custom_links) {
        if (!link?.package_id) continue
        const key = String(link.package_id).trim()
        if (!key) continue
        if (resolvedPackageIds.has(key)) continue
        const resolved = await resolvePackageIdOrNull(key)
        if (!resolved) {
          return res.status(400).json({ error: 'invalid_package_id', package_id: key })
        }
        resolvedPackageIds.set(key, resolved)
      }
    }

    // Generate random secure password (will be sent after approval)
    const randomPassword = Array.from({ length: 12 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
      return chars[Math.floor(Math.random() * chars.length)]
    }).join('')

    const password_hash = bcrypt.hashSync(randomPassword, 10)
    const commissionRate = commission_rate !== undefined ? Number(commission_rate) : 10.0

    // Create brand record with pending status and parent_brand_id set to reseller
    const brandResult = await pool.query(
      `INSERT INTO brands (name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, password_hash, parent_brand_id, account_type, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, name, logo_url, website, primary_color, secondary_color, description, status, slug, commission_rate, email, username, parent_brand_id, account_type, approval_status, created_at, updated_at`,
      [name, logo_url || null, website || null, primary_color || null, secondary_color || null, description || null, 'pending', normalizedSlug, commissionRate, String(email).trim().toLowerCase(), normalizedUsername, password_hash, resellerId, 'brand', 'pending']
    )

    const brand = brandResult.rows[0]

    // Store selected MIDs if provided (for admin reference)
    // Note: This is just for display/storage, actual MID assignment happens manually by admin
    if (Array.isArray(selected_mids) && selected_mids.length > 0) {
      await ensureBrandMidsTable()
      for (const midId of selected_mids) {
        try {
          // Validate MID exists
          const midCheck = await pool.query('SELECT id FROM mids WHERE id = $1 AND is_active = true', [midId])
          if (midCheck.rows.length > 0) {
            await pool.query(
              `INSERT INTO brand_mids (brand_id, mid_id)
               VALUES ($1, $2)
               ON CONFLICT (brand_id, mid_id) DO NOTHING`,
              [brand.id, midId]
            )
          }
        } catch (e) {
          console.error(`[reseller-brand] Failed to store MID ${midId}:`, e.message)
        }
      }
    }

    // Create custom brand links if provided
    if (Array.isArray(custom_links) && custom_links.length > 0) {
      for (const link of custom_links) {
        const { package_id, name: linkName, is_main_link, custom_url } = link
        const resolvedPackageId = package_id ? (resolvedPackageIds.get(String(package_id).trim()) || null) : null

        // Generate unique link ID
        let linkId = generateLinkId()
        let attempts = 0
        while (attempts < 10) {
          const existing = await pool.query('SELECT id FROM brand_links WHERE link_id = $1', [linkId])
          if (existing.rows.length === 0) break
          linkId = generateLinkId()
          attempts++
        }

        // Determine destination URL
        let destinationUrl
        if (custom_url && custom_url.trim()) {
          const customUrlTrimmed = custom_url.trim()
          const separator = customUrlTrimmed.includes('?') ? '&' : '?'
          destinationUrl = `${customUrlTrimmed}${separator}b=${brand.slug}`
        } else if (resolvedPackageId) {
          destinationUrl = `https://OpenSightai.com/package/${resolvedPackageId}?b=${brand.slug}`
        } else {
          destinationUrl = `https://OpenSightai.com/?b=${brand.slug}`
        }

        await pool.query(
          `INSERT INTO brand_links (brand_id, link_id, name, destination_url, package_id, custom_url, is_main_link)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [brand.id, linkId, linkName, destinationUrl, resolvedPackageId, custom_url || null, is_main_link || false]
        )
      }
    }

    // DO NOT create user account or send email - wait for admin approval

    // Return brand data without password_hash
    const { password_hash: _, ...brandData } = brand
    res.json({
      brand: brandData,
      message: 'Brand registration submitted successfully. It is pending admin approval.',
      approval_status: 'pending'
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get profile
app.get('/api/reseller/profile', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandsTable()
    const result = await pool.query(
      'SELECT id, name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email, status, account_type, created_at, updated_at FROM brands WHERE id = $1',
      [req.reseller.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })
    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Update profile
app.put('/api/reseller/profile', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandsTable()
    const resellerId = req.reseller.id
    const { name, logo_url, website, primary_color, secondary_color, description } = req.body || {}

    await pool.query(
      `UPDATE brands 
       SET name = COALESCE($1, name),
           logo_url = COALESCE($2, logo_url),
           website = COALESCE($3, website),
           primary_color = COALESCE($4, primary_color),
           secondary_color = COALESCE($5, secondary_color),
           description = COALESCE($6, description),
           updated_at = NOW()
       WHERE id = $7`,
      [name, logo_url, website, primary_color, secondary_color, description, resellerId]
    )

    const result = await pool.query(
      'SELECT id, name, logo_url, website, primary_color, secondary_color, description, slug, commission_rate, email, status, account_type, created_at, updated_at FROM brands WHERE id = $1',
      [resellerId]
    )

    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get links
app.get('/api/reseller/links', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandLinksTable()
    await ensureLinkClicksTable()
    const resellerId = req.reseller.id

    const result = await pool.query(
      `SELECT bl.*, COALESCE(COUNT(lc.id), 0)::int AS clicks_count
       FROM brand_links bl
       LEFT JOIN link_clicks lc ON bl.link_id = lc.link_id
       WHERE bl.brand_id = $1 AND bl.is_active = TRUE
       GROUP BY bl.id
       ORDER BY bl.created_at DESC`,
      [resellerId]
    )

    res.json({ links: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get visits
app.get('/api/reseller/visits', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureEnhancedVisitsTable()
    await ensureBrandsTable()

    const resellerId = req.reseller.id
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)))
    const offset = (page - 1) * pageSize

    // Get visits from reseller and all child brands
    const result = await pool.query(
      `SELECT * FROM visits 
       WHERE brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)
       ORDER BY visited_at DESC 
       LIMIT $2 OFFSET $3`,
      [resellerId, pageSize, offset]
    )

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM visits 
       WHERE brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)`,
      [resellerId]
    )
    const total = countResult.rows[0]?.total || 0

    res.json({
      visits: result.rows,
      meta: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get visit stats
app.get('/api/reseller/visits/stats', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureBrandsTable()
    const resellerId = req.reseller.id
    const days = Math.min(90, Math.max(1, parseInt(req.query.days || '30', 10)))
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get stats from reseller and all child brands
    const dailyStats = await pool.query(
      `SELECT 
        DATE(visited_at) AS date,
        SUM(visits_count)::int AS total_visits
       FROM visits
       WHERE (brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1))
       AND visited_at >= $2
       GROUP BY DATE(visited_at)
       ORDER BY date DESC`,
      [resellerId, dateFrom]
    )

    const totalStats = await pool.query(
      `SELECT SUM(visits_count)::int AS total_visits FROM visits 
       WHERE brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)`,
      [resellerId]
    )

    res.json({
      daily_stats: dailyStats.rows,
      total_visits: totalStats.rows[0]?.total_visits || 0,
      period_days: days
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get all transactions
app.get('/api/reseller/all-transactions', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureBrandsTable()
    const resellerId = req.reseller.id

    // Get reseller name
    const resellerResult = await pool.query(
      'SELECT name FROM brands WHERE id = $1',
      [resellerId]
    )
    const resellerName = resellerResult.rows[0]?.name || 'Reseller'

    // Get all child brands
    const childBrands = await pool.query(
      'SELECT id, name, email, commission_rate FROM brands WHERE parent_brand_id = $1',
      [resellerId]
    )

    // Return empty result if no child brands exist
    if (childBrands.rows.length === 0) {
      return res.json({
        transactions: [],
        child_brands: [],
        reseller_name: resellerName,
        stats: {
          total_order_amount: 0,
          rolling_reserve: 0,
          final_payout: 0,
          total_paid: 0
        }
      })
    }

    const childBrandIds = childBrands.rows.map(b => b.id)

    // Parse query parameters for filtering
    const { fromDate, toDate, status, brand, geo } = req.query

    // Build WHERE conditions
    const conditions = ['o.brand_id = ANY($1::bigint[])']
    const values = [childBrandIds]
    let paramCount = 1

    if (fromDate) {
      paramCount++
      conditions.push(`o.created_at >= $${paramCount}`)
      values.push(new Date(fromDate))
    }

    if (toDate) {
      paramCount++
      conditions.push(`o.created_at <= $${paramCount}`)
      values.push(new Date(toDate))
    }

    if (status && status !== 'all') {
      paramCount++
      conditions.push(`o.payment_status = $${paramCount}`)
      values.push(status)
    }

    if (brand && brand !== 'all') {
      paramCount++
      conditions.push(`o.brand_id = $${paramCount}`)
      values.push(parseInt(brand))
    }

    if (geo && geo !== 'all') {
      paramCount++
      conditions.push(`o.vpn_geo = $${paramCount}`)
      values.push(geo)
    }

    const whereClause = conditions.join(' AND ')

    // Calculate stats WITHOUT filters (cards 1-4)
    // Card 1: Total Order Amount - sum of UNPAID transactions only
    // Note: Removed payment_message filter to include all unpaid successful transactions
    const unpaidStatsResult = await pool.query(
      `SELECT 
        o.amount_usd,
        o.currency
       FROM orders o
       WHERE o.brand_id = ANY($1::bigint[])
         AND o.payment_status = 'unpaid'`,
      [childBrandIds]
    )

    const totalOrderAmount = unpaidStatsResult.rows
      .reduce((sum, o) => sum + Number(o.amount_usd || 0), 0)

    // Card 2: Rolling Reserve - 10% of Total Order Amount
    const rollingReserve = totalOrderAmount * 0.10

    // Card 3: Final Payout - 65% of Total Order Amount
    const finalPayout = totalOrderAmount * 0.65

    // Card 4: Total Paid - sum of paid order amounts (just the order amounts, not commission calculations)
    // Note: Removed payment_message filter to include all paid transactions
    const paidStatsResult = await pool.query(
      `SELECT 
        o.amount_usd,
        o.currency
       FROM orders o
       WHERE o.brand_id = ANY($1::bigint[])
         AND o.payment_status = 'paid'`,
      [childBrandIds]
    )

    let totalPaid = 0
    paidStatsResult.rows.forEach(order => {
      const orderAmount = Number(order.amount_usd || 0)
      totalPaid += orderAmount
    })

    // Get all orders from child brands with filters (for table display)
    const ordersResult = await pool.query(
      `SELECT 
        o.id, o.order_id, o.user_id, o.email, o.first_name, o.last_name, o.items, 
        o.total_amount, o.payment_status, o.commission_amount, 
        o.commission_status, o.commission_rate, o.created_at, o.brand_id,
        o.card_holder_name, o.phone, o.user_ip, o.vpn_detected,
        o.vpn_geo, o.card_bin, o.card_issuer, o.payment_message,
        o.currency, o.amount_usd, o.billing_country, o.payment_method,
        b.name as brand_name, b.slug as brand_slug, b.commission_rate as brand_current_rate,
        b.reseller_commission,
        u.full_name
       FROM orders o
       JOIN brands b ON o.brand_id = b.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC`,
      values
    )

    // Calculate total reseller commission from filtered transactions
    const totalResellerCommission = ordersResult.rows
      .reduce((sum, o) => {
        const orderAmount = Number(o.amount_usd || 0)
        const resellerRate = Number(o.reseller_commission || 0)
        return sum + (orderAmount * (resellerRate / 100))
      }, 0)

    // Parse full_name into firstName and lastName only if not already present
    const transactions = ordersResult.rows.map(tx => {
      // Use existing first_name and last_name from orders table if available
      let firstName = tx.first_name || ''
      let lastName = tx.last_name || ''

      // Only parse full_name if first_name or last_name is missing
      if (!firstName || !lastName) {
        const fullName = tx.full_name || tx.card_holder_name || ''
        const nameParts = fullName.split(' ')
        firstName = firstName || nameParts[0] || ''
        lastName = lastName || nameParts.slice(1).join(' ') || ''
      }

      // IMPORTANT: Only use amount_usd (USD amount), NOT total_amount (original currency)
      // If amount_usd is null/0 and currency is USD, use total_amount
      let orderAmountUSD = Number(tx.amount_usd || 0)
      if (orderAmountUSD === 0 && tx.currency === 'USD') {
        orderAmountUSD = Number(tx.total_amount || 0)
      }

      // RECALCULATE commission using stored commission_rate (or brand's current rate as fallback)
      let commission = Number(tx.commission_amount || 0)
      const commissionRate = Number(tx.commission_rate) || Number(tx.brand_current_rate) || 0

      if (commissionRate > 0 && orderAmountUSD > 0) {
        commission = orderAmountUSD * (commissionRate / 100)
      }

      const rollingReserveAmount = orderAmountUSD * 0.10 // 10% of order amount
      const payoutAmount = commission - rollingReserveAmount // commission minus rolling reserve

      // Calculate reseller part from order amount
      const resellerCommission = Number(tx.reseller_commission || 0)
      const resellerPart = resellerCommission > 0 ? orderAmountUSD * (resellerCommission / 100) : 0

      return {
        ...tx,
        first_name: firstName,
        last_name: lastName,
        order_amount_usd: orderAmountUSD,
        amount_usd: orderAmountUSD,
        // Keep total_amount as original from DB (tx.total_amount), don't override it
        commission_rate: commissionRate, // Store the rate used for display
        reseller_part: resellerPart,
        commission_amount: commission, // Use recalculated commission
        rolling_reserve_amount: rollingReserveAmount,
        payout_amount: payoutAmount
      }
    })

    res.json({
      stats: {
        total_order_amount: totalOrderAmount,
        rolling_reserve: rollingReserve,
        final_payout: finalPayout,
        total_paid: totalPaid,
        total_reseller_commission: totalResellerCommission
      },
      transactions,
      child_brands: childBrands.rows,
      reseller_name: resellerName
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get payouts
app.get('/api/reseller/payouts', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensurePayoutsTable()
    await ensureBrandsTable()
    const resellerId = req.reseller.id

    // Get payouts for reseller and all child brands
    const result = await pool.query(
      `SELECT * FROM payouts 
       WHERE brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)
       ORDER BY created_at DESC LIMIT 100`,
      [resellerId]
    )

    const statsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::numeric AS total_paid,
        COALESCE(AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END), 0)::numeric AS average_payout,
        MAX(CASE WHEN status = 'paid' THEN payout_date ELSE NULL END) AS last_payout
       FROM payouts
       WHERE brand_id = $1 OR brand_id IN (SELECT id FROM brands WHERE parent_brand_id = $1)`,
      [resellerId]
    )

    res.json({
      payouts: result.rows,
      stats: statsResult.rows[0] || { total_paid: 0, average_payout: 0, last_payout: null }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get network brands (child brands)
app.get('/api/reseller/network/brands', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureOrdersTable()
    const resellerId = req.reseller.id

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Parse date filters
    const { fromDate, toDate } = req.query

    // Get all child brands with their reseller_commission
    const brandsResult = await pool.query(
      `SELECT id, name, slug, logo_url, status, commission_rate, reseller_commission, created_at
       FROM brands
       WHERE parent_brand_id = $1
       ORDER BY created_at DESC`,
      [resellerId]
    )

    // Get stats for each child brand
    const brands = await Promise.all(brandsResult.rows.map(async (brand) => {
      // Build WHERE conditions for date filtering
      const conditions = ['brand_id = $1']
      const values = [brand.id]
      let paramCount = 1

      if (fromDate) {
        paramCount++
        conditions.push(`created_at >= $${paramCount}`)
        values.push(new Date(fromDate))
      }

      if (toDate) {
        paramCount++
        conditions.push(`created_at <= $${paramCount}`)
        values.push(new Date(toDate))
      }

      const whereClause = conditions.join(' AND ')

      const ordersResult = await pool.query(
        `SELECT 
          amount_usd,
          currency,
          payment_message
         FROM orders
         WHERE ${whereClause}`,
        values
      )

      // Calculate totals with conversion fee applied
      let totalOrders = 0
      let totalRevenue = 0
      let totalBrandPart = 0
      let totalResellerPart = 0

      ordersResult.rows.forEach(order => {
        if (order.payment_message === 'Transaction succeeded') {
          totalOrders++
          const orderAmount = Number(order.amount_usd || 0)
          const orderCurrency = order.currency || 'USD'

          // Only apply conversion fee if currency is NOT USD
          const postFeeAmount = orderCurrency === 'USD' ? orderAmount : applyConversionFee(orderAmount, conversionFee)

          totalRevenue += postFeeAmount

          // Calculate brand part and reseller part based on post-fee amount
          const brandCommissionRate = Number(brand.commission_rate || 0)
          const resellerCommissionRate = Number(brand.reseller_commission || 0)

          totalBrandPart += postFeeAmount * (brandCommissionRate / 100)
          totalResellerPart += postFeeAmount * (resellerCommissionRate / 100)
        }
      })

      // Calculate rolling reserve (10% of total revenue)
      const rollingReserve = totalRevenue * 0.10

      return {
        ...brand,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_commission: totalBrandPart, // For backwards compatibility
        total_brand_part: totalBrandPart,
        total_reseller_part: totalResellerPart,
        rolling_reserve: rollingReserve
      }
    }))

    res.json({ brands })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Reseller: Get network transactions (aggregated from child brands)
app.get('/api/reseller/network/transactions', requireAuth, requireReseller, async (req, res) => {
  try {
    await ensureBrandsTable()
    await ensureOrdersTable()
    const resellerId = req.reseller.id

    // Get conversion fee
    const conversionFee = await getConversionFee()

    // Parse date filters
    const { fromDate, toDate } = req.query

    // Build WHERE conditions for date filtering
    const conditions = ['b.parent_brand_id = $1']
    const values = [resellerId]
    let paramCount = 1

    if (fromDate) {
      paramCount++
      conditions.push(`o.created_at >= $${paramCount}`)
      values.push(new Date(fromDate))
    }

    if (toDate) {
      paramCount++
      conditions.push(`o.created_at <= $${paramCount}`)
      values.push(new Date(toDate))
    }

    const whereClause = conditions.join(' AND ')

    // Get all orders with their currencies and reseller commissions
    const ordersResult = await pool.query(
      `SELECT 
        o.amount_usd,
        o.currency,
        o.payment_message,
        b.reseller_commission
       FROM orders o
       INNER JOIN brands b ON o.brand_id = b.id
       WHERE ${whereClause}`,
      values
    )

    // Calculate totals with conversion fee applied
    let totalOrders = 0
    let totalSales = 0
    let totalResellerPart = 0

    ordersResult.rows.forEach(order => {
      if (order.payment_message === 'Transaction succeeded') {
        totalOrders++
        const orderAmount = Number(order.amount_usd || 0)
        const orderCurrency = order.currency || 'USD'

        // Only apply conversion fee if currency is NOT USD
        const postFeeAmount = orderCurrency === 'USD' ? orderAmount : applyConversionFee(orderAmount, conversionFee)

        totalSales += postFeeAmount

        // Calculate reseller part based on post-fee amount
        const resellerCommissionRate = Number(order.reseller_commission || 0)
        totalResellerPart += postFeeAmount * (resellerCommissionRate / 100)
      }
    })

    res.json({
      stats: {
        total_orders: totalOrders,
        total_sales: totalSales,
        total_commission: totalResellerPart // This is the network commission (reseller part)
      }
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Get brand by slug
app.get('/api/brands/by-slug/:slug', async (req, res) => {
  try {
    await ensureBrandsTable()
    const slug = req.params.slug

    const result = await pool.query(
      'SELECT id, name, slug, logo_url FROM brands WHERE slug = $1 AND status = $2',
      [slug, 'active']
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    res.json({ brand: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

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
  const headerValue = req.headers?.['x-frontend-route']
  const bodyValue = req.body?.frontend_route || req.body?.frontendRoute
  const normalized = normalizeFrontendRoute(headerValue || bodyValue)
  return normalized ? BRAND_ROUTE_ALLOWLIST.has(normalized) : false
}

// Public: Check VPN/Proxy status
app.post('/api/check-vpn', async (req, res) => {
  try {
    if (isBrandRouteBypass(req)) {
      return res.json({ allowed: true, isVpn: false, isProxy: false, blockReason: null })
    }

    await ensureVisitsTable()
    await ensureVisitsSchema()
    await ensureIpWhitelistTable()
    await ensureIpWhitelistSettingsTable()

    // Get user's IP
    const ipAddress = getRequestIp(req)

    if (ipAddress === 'unknown' || ipAddress === '::1' || ipAddress.startsWith('127.')) {
      // Allow localhost/development
      return res.json({ allowed: true, isVpn: false, isProxy: false, blockReason: null })
    }

    // Check if user is an authenticated admin (they bypass all restrictions)
    let isAdmin = false
    try {
      let token = req.cookies?.token
      const authHeader = req.get('authorization') || req.get('Authorization')
      if (!token && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim()
      }
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET)
        if (payload && payload.role === 'admin') {
          isAdmin = true
        }
      }
    } catch (_e) {
      // Not authenticated or not admin, continue with checks
    }

    // Admins bypass all restrictions
    if (isAdmin) {
      return res.json({ allowed: true, isVpn: false, isProxy: false, blockReason: null })
    }

    // Get security settings (whitelist and VPN block)
    const securitySettings = await pool.query(
      'SELECT enabled, vpn_block_enabled, vpn_whitelist_exemption FROM ip_whitelist_settings WHERE id = 1'
    )

    // Explicit boolean conversion with defaults
    const settings = securitySettings.rows[0] || {}
    const whitelistEnabled = settings.enabled === true
    // VPN blocking: explicitly false means disabled, anything else (true/null/undefined) means enabled
    const vpnBlockEnabled = settings.vpn_block_enabled !== false
    const vpnWhitelistExemption = settings.vpn_whitelist_exemption === true

    console.log('[VPN Check]', {
      ip: ipAddress,
      whitelistEnabled,
      vpnBlockEnabled,
      vpnWhitelistExemption,
      rawVpnBlockValue: settings.vpn_block_enabled,
      rawSettings: settings
    })

    // If whitelist is enabled, check if IP is whitelisted
    if (whitelistEnabled) {
      const whitelistCheck = await pool.query(
        'SELECT id FROM ip_whitelist WHERE ip_address = $1',
        [ipAddress]
      )

      if (whitelistCheck.rows.length === 0) {
        // IP not in whitelist, block access
        return res.json({
          allowed: false,
          isVpn: false,
          isProxy: false,
          blockReason: 'whitelist',
          ip: ipAddress
        })
      }
    }

    // If VPN/Proxy blocking is disabled, allow access without checking
    if (!vpnBlockEnabled) {
      return res.json({
        allowed: true,
        isVpn: false,
        isProxy: false,
        blockReason: null,
        ip: ipAddress
      })
    }

    // Call vpnapi.io
    const vpnApiKey = '2867120f50374c63bb98e7dce24b0b83'
    const vpnApiUrl = `https://vpnapi.io/api/${ipAddress}?key=${vpnApiKey}`

    try {
      const fetch = (await import('node-fetch')).default
      const vpnResponse = await fetch(vpnApiUrl)
      const vpnData = await vpnResponse.json()

      const isVpn = vpnData.security?.vpn || false
      const isProxy = vpnData.security?.proxy || false
      const isTor = vpnData.security?.tor || false
      const isRelay = vpnData.security?.relay || false
      const isBlocked = isVpn || isProxy || isTor || isRelay

      // Update or insert into visits table
      const existing = await pool.query('SELECT id FROM visits WHERE ip = $1', [ipAddress])

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE visits 
           SET is_vpn = $2, 
               is_proxy = $3, 
               vpn_check_attempted = true,
               last_visit_at = NOW()
           WHERE ip = $1`,
          [ipAddress, isVpn || isTor || isRelay, isProxy]
        )
      } else {
        await pool.query(
          `INSERT INTO visits (ip, is_vpn, is_proxy, vpn_check_attempted, visits_count)
           VALUES ($1, $2, $3, true, 1)`,
          [ipAddress, isVpn || isTor || isRelay, isProxy]
        )
      }

      // Check if VPN exemption for whitelisted IPs is enabled
      let finalAllowed = !isBlocked
      let finalBlockReason = isBlocked ? 'vpn' : null

      if (isBlocked && vpnWhitelistExemption) {
        // VPN detected but exemption is enabled, check if IP is in whitelist
        const whitelistCheck = await pool.query(
          'SELECT id FROM ip_whitelist WHERE ip_address = $1',
          [ipAddress]
        )

        if (whitelistCheck.rows.length > 0) {
          // IP is whitelisted, allow access despite VPN
          finalAllowed = true
          finalBlockReason = null
          console.log(`[VPN Check] IP ${ipAddress} is using VPN but is whitelisted, allowing access`)
        } else {
          // IP not whitelisted, keep blocked
          console.log(`[VPN Check] IP ${ipAddress} is using VPN and not whitelisted, blocking access`)
        }
      }

      res.json({
        allowed: finalAllowed,
        isVpn: isVpn || isTor || isRelay,
        isProxy,
        blockReason: finalBlockReason,
        ip: ipAddress
      })
    } catch (apiError) {
      console.error('VPN API error:', apiError)
      // On API failure, allow access but log the attempt
      await pool.query(
        `INSERT INTO visits (ip, vpn_check_attempted, visits_count)
         VALUES ($1, false, 1)
         ON CONFLICT (ip) DO UPDATE 
         SET vpn_check_attempted = false, last_visit_at = NOW()`,
        [ipAddress]
      )
      res.json({ allowed: true, isVpn: false, isProxy: false, blockReason: null, error: 'VPN check failed' })
    }
  } catch (err) {
    console.error('Check VPN error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Track visit
app.post('/api/track/visit', async (req, res) => {
  try {
    await ensureVisitsTable()
    await ensureEnhancedVisitsTable()

    const { brand_id, brand_slug, link_id, page_visited, session_id } = req.body || {}
    const ipAddress = getRequestIp(req)

    let finalBrandId = brand_id

    // If brand_slug is provided, look up the brand_id
    if (brand_slug && !brand_id) {
      await ensureBrandsTable()
      const brandResult = await pool.query(
        'SELECT id FROM brands WHERE slug = $1 AND status = $2',
        [brand_slug, 'active']
      )
      if (brandResult.rows.length > 0) {
        finalBrandId = brandResult.rows[0].id
      }
    }

    // Check if IP exists
    const existing = await pool.query('SELECT id FROM visits WHERE ip = $1', [ipAddress])

    if (existing.rows.length > 0) {
      // Update visit count
      await pool.query(
        `UPDATE visits 
         SET visits_count = visits_count + 1, 
             visited_at = NOW(),
             brand_id = COALESCE($2, brand_id),
             link_id = COALESCE($3, link_id),
             page_visited = COALESCE($4, page_visited),
             session_id = COALESCE($5, session_id)
         WHERE ip = $1`,
        [ipAddress, finalBrandId || null, link_id || null, page_visited || null, session_id || null]
      )
    } else {
      // Insert new visit
      await pool.query(
        `INSERT INTO visits (ip, visits_count, brand_id, link_id, page_visited, session_id, visited_at)
         VALUES ($1, 1, $2, $3, $4, $5, NOW())`,
        [ipAddress, finalBrandId || null, link_id || null, page_visited || null, session_id || null]
      )
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Track visit error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ===================== PACKAGES MANAGEMENT API =====================

// Admin: PACKAGES - list all packages
app.get('/api/admin/packages', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackagesTable()

    const result = await pool.query(`
      SELECT * FROM packages 
      ORDER BY 
        CASE type 
          WHEN 'package' THEN 1 
          WHEN 'credits' THEN 2 
        END,
        price ASC
    `)

    // Map packages and handle unlimited credits display
    const mappedRows = result.rows.map(pkg => {
      // Check if this is the unlimited package
      if (pkg.id === 'credits-unlimited' || (pkg.type === 'credits' && pkg.credits === null && parseFloat(pkg.price) === 1500)) {
        return { ...pkg, credits: 'unlimited' }
      }
      return pkg
    })

    const packages = mappedRows.filter(p => p.type === 'package')
    const creditPackages = mappedRows.filter(p => p.type === 'credits')

    res.json({ packages, creditPackages })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: PACKAGES - get single package
app.get('/api/admin/packages/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackagesTable()
    const result = await pool.query('SELECT * FROM packages WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: PACKAGES - create new package
app.post('/api/admin/packages', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackagesTable()
    const { id, name, price, currency, type, credits, description, features, popular, active } = req.body || {}

    if (!id || !name || price === undefined || !type) {
      return res.status(400).json({ error: 'missing_required_fields' })
    }

    // Check if package with this ID already exists
    const existing = await pool.query('SELECT id FROM packages WHERE id = $1', [id])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'package_id_exists' })
    }

    const result = await pool.query(
      `INSERT INTO packages (id, name, price, currency, type, credits, description, features, popular, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        name,
        price,
        currency || '$',
        type,
        credits || null,
        description || null,
        JSON.stringify(features || []),
        popular || false,
        active !== undefined ? active : true
      ]
    )

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: PACKAGES - update package
app.put('/api/admin/packages/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackagesTable()
    const packageId = req.params.id
    const { name, price, currency, type, credits, description, features, popular, active } = req.body || {}

    // Check if package exists
    const existing = await pool.query('SELECT id FROM packages WHERE id = $1', [packageId])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    const result = await pool.query(
      `UPDATE packages 
       SET name = $1, price = $2, currency = $3, type = $4, credits = $5, 
           description = $6, features = $7, popular = $8, active = $9
       WHERE id = $10
       RETURNING *`,
      [
        name,
        price,
        currency || '$',
        type,
        credits || null,
        description || null,
        JSON.stringify(features || []),
        popular || false,
        active !== undefined ? active : true,
        packageId
      ]
    )

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: PACKAGES - delete package
app.delete('/api/admin/packages/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackagesTable()
    const packageId = req.params.id

    const existing = await pool.query('SELECT id FROM packages WHERE id = $1', [packageId])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    await pool.query('DELETE FROM packages WHERE id = $1', [packageId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Public: Get packages for frontend display
app.get('/api/packages/public', async (req, res) => {
  try {
    await ensurePackagesTable();
   // await seedPricesPagePackages(); 

    const result = await pool.query(`
      SELECT * FROM packages 
      WHERE active = true
      ORDER BY 
        CASE type 
          WHEN 'package' THEN 1 
          WHEN 'credits' THEN 2 
        END,
        sort_order ASC,
        price ASC
    `);

    const mappedRows = result.rows.map(pkg => {
      if (pkg.id === 'credits-unlimited' || (pkg.type === 'credits' && pkg.credits === null && parseFloat(pkg.price) === 1500)) {
        return { ...pkg, credits: 'unlimited' }
      }
      return pkg
    });

    const packages = mappedRows.filter(p => p.type === 'package');
    const creditPackages = mappedRows.filter(p => p.type === 'credits');

    res.json({ packages, creditPackages });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// ============================================
// ADMIN LOGS ENDPOINTS
// ============================================

// Get admin logs with filters (admin only)
// Client-side logging endpoint (no auth required to allow frontend error logging)
app.post('/api/admin/logs/client', async (req, res) => {
  try {
    console.log('[client-log] Received log from frontend:', req.body)
    const { level, category, action, message, details } = req.body
    const clientIp = getRequestIp(req)

    await logToAdmin({
      level: level || 'INFO',
      category: category || 'FRONTEND',
      action: action || 'CLIENT_LOG',
      message: message || 'Client log',
      details: details || {}
    })

    console.log('[client-log] Successfully logged to admin_logs table')
    res.json({ success: true })
  } catch (error) {
    console.error('[client-log] Error:', error)
    res.status(500).json({ error: 'Failed to log' })
  }
})

// Test endpoint to manually create a log (no auth for testing)
app.post('/api/admin/logs/test', async (req, res) => {
  try {
    await logToAdmin({
      level: 'INFO',
      category: 'TEST',
      action: 'TEST_LOG',
      message: 'Test log entry created',
      details: { timestamp: new Date().toISOString(), test: true }
    })

    // Get count of logs
    const result = await pool.query('SELECT COUNT(*) FROM admin_logs')
    const count = parseInt(result.rows[0].count)

    res.json({
      success: true,
      message: 'Test log created successfully',
      totalLogs: count
    })
  } catch (error) {
    console.error('[test-log] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get log count (no auth for debugging)
app.get('/api/admin/logs/count', async (req, res) => {
  try {
    await ensureAdminLogsTable()
    const result = await pool.query('SELECT COUNT(*) FROM admin_logs')
    const count = parseInt(result.rows[0].count)

    // Get a sample of recent logs
    const sampleResult = await pool.query('SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 5')

    res.json({
      totalLogs: count,
      recentLogs: sampleResult.rows
    })
  } catch (error) {
    console.error('[log-count] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[admin/logs] Request from:', req.auth?.email, 'Role:', req.auth?.role)

    const {
      page = 1,
      limit = 50,
      level,
      category,
      action,
      userEmail,
      startDate,
      endDate,
      search
    } = req.query

    console.log('[admin/logs] Filters:', { page, limit, level, category, action, userEmail, startDate, endDate, search })

    await ensureAdminLogsTable()

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const conditions = []
    const params = []
    let paramCount = 1

    // Build WHERE conditions
    if (level) {
      conditions.push(`log_level = $${paramCount}`)
      params.push(level)
      paramCount++
    }

    if (category) {
      conditions.push(`category = $${paramCount}`)
      params.push(category)
      paramCount++
    }

    if (action) {
      conditions.push(`action = $${paramCount}`)
      params.push(action)
      paramCount++
    }

    if (userEmail) {
      conditions.push(`user_email ILIKE $${paramCount}`)
      params.push(`%${userEmail}%`)
      paramCount++
    }

    if (startDate) {
      conditions.push(`timestamp >= $${paramCount}`)
      params.push(startDate)
      paramCount++
    }

    if (endDate) {
      conditions.push(`timestamp <= $${paramCount}`)
      params.push(endDate)
      paramCount++
    }

    if (search) {
      conditions.push(`(message ILIKE $${paramCount} OR action ILIKE $${paramCount})`)
      params.push(`%${search}%`)
      paramCount++
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM admin_logs ${whereClause}`
    const countResult = await pool.query(countQuery, params)
    const totalCount = parseInt(countResult.rows[0].count)

    // Get logs
    params.push(parseInt(limit))
    params.push(offset)
    const logsQuery = `
      SELECT id, timestamp, log_level, category, action, message, 
             details, user_id, user_email, request_id, created_at
      FROM admin_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    const logsResult = await pool.query(logsQuery, params)

    console.log('[admin/logs] Query results - Total count:', totalCount, 'Rows returned:', logsResult.rows.length)

    // Get statistics
    const statsQuery = `
      SELECT 
        log_level,
        category,
        COUNT(*) as count
      FROM admin_logs
      ${whereClause}
      GROUP BY log_level, category
      ORDER BY count DESC
    `
    const statsResult = await pool.query(statsQuery, conditions.length > 0 ? params.slice(0, paramCount - 1) : [])

    res.json({
      logs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      statistics: statsResult.rows
    })
  } catch (err) {
    console.error('[admin/logs] Error fetching logs:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get log categories and actions (for filters)
app.get('/api/admin/logs/meta', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureAdminLogsTable()

    const categoriesQuery = 'SELECT DISTINCT category FROM admin_logs ORDER BY category'
    const actionsQuery = 'SELECT DISTINCT action FROM admin_logs ORDER BY action'
    const levelsQuery = 'SELECT DISTINCT log_level FROM admin_logs ORDER BY log_level'

    const [categories, actions, levels] = await Promise.all([
      pool.query(categoriesQuery),
      pool.query(actionsQuery),
      pool.query(levelsQuery)
    ])

    res.json({
      categories: categories.rows.map(r => r.category),
      actions: actions.rows.map(r => r.action),
      levels: levels.rows.map(r => r.log_level)
    })
  } catch (err) {
    console.error('[admin/logs/meta] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get critical logs (for dashboard alerts)
app.get('/api/admin/logs/critical', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureAdminLogsTable()

    const query = `
      SELECT id, timestamp, category, action, message, details, user_email
      FROM admin_logs
      WHERE log_level IN ('CRITICAL', 'ERROR')
      ORDER BY timestamp DESC
      LIMIT 20
    `

    const result = await pool.query(query)
    res.json({ criticalLogs: result.rows })
  } catch (err) {
    console.error('[admin/logs/critical] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Clear old logs (admin only) - keeps logs from last 90 days
app.delete('/api/admin/logs/cleanup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body

    await ensureAdminLogsTable()

    const result = await pool.query(
      `DELETE FROM admin_logs WHERE timestamp < NOW() - INTERVAL '${parseInt(daysToKeep)} days'`
    )

    await logToAdmin({
      level: 'INFO',
      category: 'ADMIN',
      action: 'LOGS_CLEANUP',
      message: `Cleaned up logs older than ${daysToKeep} days`,
      details: { deletedCount: result.rowCount },
      userId: req.user?.id,
      userEmail: req.user?.email
    })

    res.json({ success: true, deletedCount: result.rowCount })
  } catch (err) {
    console.error('[admin/logs/cleanup] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ============================================
// CURRENCY ENDPOINTS
// ============================================

// Public: Get all active currencies with exchange rates
app.get('/api/currencies/public', async (req, res) => {
  try {
    await ensureCurrenciesTable()
    const result = await pool.query(`
      SELECT code, symbol, name, exchange_rate, is_base
      FROM currencies 
      WHERE active = true
      ORDER BY 
        CASE 
          WHEN is_base THEN 0 
          ELSE 1 
        END,
        code ASC
    `)
    res.json({ currencies: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all currencies (including inactive)
app.get('/api/admin/currencies', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrenciesTable()
    const result = await pool.query(`
      SELECT * FROM currencies 
      ORDER BY 
        CASE 
          WHEN is_base THEN 0 
          ELSE 1 
        END,
        code ASC
    `)

    // Get conversion fee
    const conversionFee = await getConversionFee()

    res.json({
      currencies: result.rows,
      conversion_fee_usd: conversionFee
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Sync exchange rates from external API
app.post('/api/admin/currencies/sync-rates', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrenciesTable()

    // 1️⃣ Get base currency (should be USD)
    const baseResult = await pool.query(
      'SELECT code FROM currencies WHERE is_base = true LIMIT 1'
    )
    if (baseResult.rows.length === 0) {
      return res.status(400).json({ error: 'no_base_currency' })
    }
    const baseCurrency = String(baseResult.rows[0].code).toUpperCase()

    // 2️⃣ Fetch rates (1 BASE = X units)
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates')
    }

    const data = await response.json()
    const rates = data?.rates || {}

    let updated = 0

    // 3️⃣ UPSERT all currencies from API
    for (const [codeRaw, rateRaw] of Object.entries(rates)) {
      const code = String(codeRaw).trim().toUpperCase()
      const rate = Number(rateRaw)

      if (!code || !Number.isFinite(rate) || rate <= 0) continue

      await pool.query(
        `
        INSERT INTO currencies (
          code,
          symbol,
          name,
          exchange_rate,
          active,
          is_base,
          last_synced
        )
        VALUES ($1, $2, $3, $4, TRUE, FALSE, NOW())
        ON CONFLICT (code)
        DO UPDATE SET
          exchange_rate = EXCLUDED.exchange_rate,
          last_synced = NOW()
        `,
        [
          code,
          code,                    // fallback symbol
          `${code} Currency`,      // fallback name
          rate
        ]
      )

      updated++
    }

    // 4️⃣ Ensure base currency rate = 1
    await pool.query(
      'UPDATE currencies SET exchange_rate = 1 WHERE UPPER(code) = $1',
      [baseCurrency]
    )

    res.json({
      ok: true,
      updated,
      base_currency: baseCurrency,
      synced_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[sync-rates] error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Update conversion fee (must come BEFORE /:code route)
app.put('/api/admin/currencies/conversion-fee', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body || {}

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'amount_required' })
    }

    const feeAmount = Number(amount)
    if (isNaN(feeAmount) || feeAmount < 0) {
      return res.status(400).json({ error: 'invalid_amount' })
    }

    await ensureSettingsTable()
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,
      ['conversion_fee_usd', JSON.stringify({ amount: feeAmount })]
    )

    // Clear cache
    cachedConversionFee = null

    res.json({
      ok: true,
      conversion_fee_usd: feeAmount
    })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Update currency settings (set base, toggle active, manual rate)
app.put('/api/admin/currencies/:code', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrenciesTable()
    const currencyCode = req.params.code
    const { is_base, active, exchange_rate } = req.body || {}

    // If setting as base, unset all others first
    if (is_base === true) {
      await pool.query('UPDATE currencies SET is_base = false')
    }

    const updates = []
    const values = []
    let paramIndex = 1

    if (is_base !== undefined) {
      updates.push(`is_base = $${paramIndex++}`)
      values.push(is_base)
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`)
      values.push(active)
    }
    if (exchange_rate !== undefined && exchange_rate !== null) {
      updates.push(`exchange_rate = $${paramIndex++}`)
      values.push(exchange_rate)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'no_updates' })
    }

    values.push(currencyCode)
    const result = await pool.query(
      `UPDATE currencies SET ${updates.join(', ')} WHERE code = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// ============================================
// CURRENCY GEO MAPPINGS ENDPOINTS
// ============================================

// Public: Get currency for specific country
app.get('/api/currencies/for-country/:countryCode', async (req, res) => {
  try {
    await ensureCurrencyGeoMappingsTable()
    const countryCode = req.params.countryCode.toUpperCase()

    const result = await pool.query(`
      SELECT cgm.country_code, cgm.currency_code, c.symbol, c.name
      FROM currency_geo_mappings cgm
      JOIN currencies c ON cgm.currency_code = c.code
      WHERE cgm.country_code = $1 AND c.active = true
    `, [countryCode])

    if (result.rows.length === 0) {
      // Default to USD if no mapping found
      return res.json({ currency_code: 'USD', country_code: countryCode })
    }

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get all currency geo mappings
app.get('/api/admin/currency-geo-mappings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrencyGeoMappingsTable()
    const result = await pool.query(`
      SELECT cgm.*, c.symbol, c.name as currency_name
      FROM currency_geo_mappings cgm
      LEFT JOIN currencies c ON cgm.currency_code = c.code
      ORDER BY cgm.country_code ASC
    `)
    res.json({ mappings: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Create new currency geo mapping
app.post('/api/admin/currency-geo-mappings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrencyGeoMappingsTable()
    const { country_code, currency_code } = req.body || {}

    if (!country_code || !currency_code) {
      return res.status(400).json({ error: 'missing_required_fields' })
    }

    // Validate country code format (2 letters)
    if (!/^[A-Z]{2}$/i.test(country_code)) {
      return res.status(400).json({ error: 'invalid_country_code' })
    }

    // Check if currency exists
    const currencyCheck = await pool.query('SELECT code FROM currencies WHERE code = $1', [currency_code])
    if (currencyCheck.rows.length === 0) {
      return res.status(400).json({ error: 'currency_not_found' })
    }

    const result = await pool.query(
      `INSERT INTO currency_geo_mappings (country_code, currency_code)
       VALUES ($1, $2)
       ON CONFLICT (country_code) DO UPDATE SET currency_code = $2, updated_at = NOW()
       RETURNING *`,
      [country_code.toUpperCase(), currency_code]
    )

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Update currency geo mapping
app.put('/api/admin/currency-geo-mappings/:countryCode', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrencyGeoMappingsTable()
    const countryCode = req.params.countryCode.toUpperCase()
    const { currency_code } = req.body || {}

    if (!currency_code) {
      return res.status(400).json({ error: 'missing_currency_code' })
    }

    // Check if currency exists
    const currencyCheck = await pool.query('SELECT code FROM currencies WHERE code = $1', [currency_code])
    if (currencyCheck.rows.length === 0) {
      return res.status(400).json({ error: 'currency_not_found' })
    }

    const result = await pool.query(
      `UPDATE currency_geo_mappings 
       SET currency_code = $1, updated_at = NOW()
       WHERE country_code = $2
       RETURNING *`,
      [currency_code, countryCode]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Delete currency geo mapping
app.delete('/api/admin/currency-geo-mappings/:countryCode', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureCurrencyGeoMappingsTable()
    const countryCode = req.params.countryCode.toUpperCase()

    const result = await pool.query(
      'DELETE FROM currency_geo_mappings WHERE country_code = $1 RETURNING *',
      [countryCode]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Get custom currency prices for a package
app.get('/api/admin/package-prices/:packageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackageCurrencyPricesTable()
    const packageId = req.params.packageId

    const result = await pool.query(
      'SELECT * FROM package_currency_prices WHERE package_id = $1',
      [packageId]
    )

    res.json({ prices: result.rows })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Admin: Update custom prices for a package
app.put('/api/admin/package-prices/:packageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePackageCurrencyPricesTable()
    const packageId = req.params.packageId
    const { prices } = req.body || {} // prices is an object { currencyCode: price }

    if (!prices || typeof prices !== 'object') {
      return res.status(400).json({ error: 'invalid_prices_format' })
    }

    // Delete existing custom prices for this package
    await pool.query('DELETE FROM package_currency_prices WHERE package_id = $1', [packageId])

    // Insert new custom prices
    for (const [currencyCode, price] of Object.entries(prices)) {
      if (price !== null && price !== undefined && price !== '') {
        await pool.query(
          `INSERT INTO package_currency_prices (package_id, currency_code, custom_price)
           VALUES ($1, $2, $3)
           ON CONFLICT (package_id, currency_code) 
           DO UPDATE SET custom_price = $3, updated_at = NOW()`,
          [packageId, currencyCode, price]
        )
      }
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Seed initial packages if table is empty
async function seedPackages() {
  try {
    const count = await pool.query('SELECT COUNT(*) FROM packages')
    if (parseInt(count.rows[0].count) > 0) {
      console.log('[db] Packages already seeded')
      return
    }

    console.log('[db] Seeding initial packages...')

    const initialPackages = [
      {
        id: 'starter',
        name: 'Starter',
        price: 59,
        currency: '$',
        type: 'package',
        description: 'Perfect for beginners exploring market analysis',
        features: JSON.stringify([
          'Live chart analytics (10 analyses)',
          'AI agent teacher (basic access)',
          'Education center access',
          'Email support (48-hour response)',
          'Standard analysis tools and features',
          'Basic market research insights',
          'Mobile app access',
          'Analysis history (30 days)',
          'Export to PDF'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 129,
        currency: '$',
        type: 'package',
        description: 'Most popular choice for serious traders',
        features: JSON.stringify([
          'Live chart analytics (50 analyses)',
          'AI agent teacher (advanced features)',
          'Full education center access',
          'Email support (24-hour response)',
          'Advanced analysis tools and features',
          'Comprehensive market research insights',
          'Mobile app access',
          'Analysis history (6 months)',
          'Export to Excel/PDF',
          'Multiple data watchlists',
          'Advanced assessment suite',
          'Pattern recognition tools',
          'Custom analysis templates'
        ]),
        popular: true,
        active: true
      },
      {
        id: 'expert',
        name: 'Expert',
        price: 189,
        currency: '$',
        type: 'package',
        description: 'Full access to all premium features',
        features: JSON.stringify([
          'Live chart analytics (unlimited analyses)',
          'AI agent teacher (premium features)',
          'Full education center with premium content',
          'Priority email support (immediate response)',
          'Professional-grade analysis tools',
          'Premium market research insights',
          'Mobile and desktop app access',
          'Analysis history (unlimited)',
          'Export to Excel/PDF/CSV',
          'Multiple data watchlists (unlimited)',
          'Advanced assessment suite',
          'Pattern recognition tools',
          'Custom analysis templates',
          'API access for integrations',
          'White-label options',
          'Priority feature requests',
          'Advanced market indicators',
          'Real-time data feeds',
          'Portfolio tracking tools'
        ]),
        popular: false,
        active: true
      },
      // Credit packages
      {
        id: 'credits-50',
        name: 'Starter',
        price: 50,
        currency: '$',
        type: 'credits',
        credits: 50,
        description: 'Perfect for getting started',
        features: JSON.stringify([
          '50 chart analyses',
          'Basic AI insights',
          'Email support',
          '30-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-70',
        name: 'Basic',
        price: 70,
        currency: '$',
        type: 'credits',
        credits: 70,
        description: 'Great for regular users',
        features: JSON.stringify([
          '70 chart analyses',
          'Enhanced AI insights',
          'Priority support',
          '45-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-100',
        name: 'Standard',
        price: 100,
        currency: '$',
        type: 'credits',
        credits: 100,
        description: 'Most popular choice',
        features: JSON.stringify([
          '100 chart analyses',
          'Advanced AI features',
          'Live chat support',
          '60-day validity'
        ]),
        popular: true,
        active: true
      },
      {
        id: 'credits-150',
        name: 'Popular',
        price: 150,
        currency: '$',
        type: 'credits',
        credits: 150,
        description: 'Best value for money',
        features: JSON.stringify([
          '150 chart analyses',
          'Premium AI insights',
          'Priority support',
          '90-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-250',
        name: 'Professional',
        price: 250,
        currency: '$',
        type: 'credits',
        credits: 250,
        description: 'For serious analysts',
        features: JSON.stringify([
          '250 chart analyses',
          'Professional features',
          'Dedicated support',
          '120-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-500',
        name: 'Business',
        price: 500,
        currency: '$',
        type: 'credits',
        credits: 500,
        description: 'Perfect for teams',
        features: JSON.stringify([
          '500 chart analyses',
          'Business features',
          'Account manager',
          '180-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-1000',
        name: 'Enterprise',
        price: 1000,
        currency: '$',
        type: 'credits',
        credits: 1000,
        description: 'For large organizations',
        features: JSON.stringify([
          '1000 chart analyses',
          'Enterprise features',
          '24/7 support',
          '365-day validity'
        ]),
        popular: false,
        active: true
      },
      {
        id: 'credits-unlimited',
        name: 'Unlimited',
        price: 1500,
        currency: '$',
        type: 'credits',
        credits: 'unlimited',
        description: 'No limits, endless analysis',
        features: JSON.stringify([
          'Unlimited analyses',
          'All premium features',
          'White-glove support',
          'Lifetime access'
        ]),
        popular: false,
        active: true
      }
    ]

    for (const pkg of initialPackages) {
      // Handle unlimited credits - store as NULL in database, handle display in frontend
      const creditsValue = pkg.credits === 'unlimited' ? null : (pkg.credits || null);

      await pool.query(
        `INSERT INTO packages (id, name, price, currency, type, credits, description, features, popular, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [pkg.id, pkg.name, pkg.price, pkg.currency, pkg.type, creditsValue,
        pkg.description, pkg.features, pkg.popular, pkg.active]
      )
    }

    console.log('[db] Initial packages seeded successfully')
  } catch (err) {
    console.error('[db] Error seeding packages:', err)
  }
}

// Migration: Update existing brand links to use package landing pages
async function migrateBrandLinksToPackagePages() {
  try {
    await ensureBrandLinksTable()

    // Find all brand links that have a package_id but are pointing to the old URL format
    const result = await pool.query(`
      SELECT id, package_id, brand_id, destination_url 
      FROM brand_links 
      WHERE package_id IS NOT NULL 
        AND destination_url NOT LIKE '%/package/%'
        AND (custom_url IS NULL OR custom_url = '')
    `)

    if (result.rows.length > 0) {
      console.log(`[migration] Found ${result.rows.length} brand links to migrate to package landing pages`)

      for (const link of result.rows) {
        const newDestinationUrl = `https://OpenSightai.com/package/${link.package_id}`

        await pool.query(
          `UPDATE brand_links 
           SET destination_url = $1 
           WHERE id = $2`,
          [newDestinationUrl, link.id]
        )

        console.log(`[migration] Updated link ${link.id} to ${newDestinationUrl}`)
      }

      console.log('[migration] Brand links migration completed successfully')
    } else {
      console.log('[migration] No brand links need migration')
    }
  } catch (err) {
    console.error('[migration] Error migrating brand links:', err)
  }
}

async function migrateBrandLinksToSlugFormat() {
  try {
    await ensureBrandLinksTable()
    await ensureBrandsTable()

    // Find all brand links that don't have ?b= parameter yet
    const result = await pool.query(`
      SELECT bl.id, bl.brand_id, bl.destination_url, bl.package_id, bl.custom_url, b.slug
      FROM brand_links bl
      JOIN brands b ON bl.brand_id = b.id
      WHERE bl.destination_url NOT LIKE '%?b=%'
        AND bl.destination_url NOT LIKE '%&b=%'
        AND b.slug IS NOT NULL
    `)

    if (result.rows.length > 0) {
      console.log(`[migration] Found ${result.rows.length} brand links to migrate to slug format (?b=slug)`)

      for (const link of result.rows) {
        let newDestinationUrl

        if (link.custom_url && link.custom_url.trim()) {
          // Custom URL - append ?b=slug or &b=slug
          const separator = link.destination_url.includes('?') ? '&' : '?'
          newDestinationUrl = `${link.destination_url}${separator}b=${link.slug}`
        } else if (link.package_id) {
          // Package link - ensure format is /package/{id}?b=slug
          newDestinationUrl = `https://OpenSightai.com/package/${link.package_id}?b=${link.slug}`
        } else {
          // Main link
          newDestinationUrl = `https://OpenSightai.com/?b=${link.slug}`
        }

        await pool.query(
          `UPDATE brand_links 
           SET destination_url = $1 
           WHERE id = $2`,
          [newDestinationUrl, link.id]
        )

        console.log(`[migration] Updated link ${link.id}: ${link.destination_url} → ${newDestinationUrl}`)
      }

      console.log('[migration] Brand links slug migration completed successfully')
    } else {
      console.log('[migration] No brand links need slug migration')
    }
  } catch (err) {
    console.error('[migration] Error migrating brand links to slug format:', err)
  }
}

// Admin: Fix USD amounts in existing orders (one-time fix)
app.post('/api/admin/fix-usd-amounts', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureOrdersTable()
    await ensureCurrenciesTable()

    // Get all orders where amount_usd equals total_amount but currency is not USD
    const ordersToFix = await pool.query(
      `SELECT id, order_id, total_amount, amount_usd, currency 
       FROM orders 
       WHERE currency IS NOT NULL 
       AND currency != 'USD' 
       AND (amount_usd IS NULL OR amount_usd = total_amount)
       ORDER BY created_at DESC`
    )

    console.log(`[fix-usd] Found ${ordersToFix.rows.length} orders to fix`)

    let fixed = 0
    let skipped = 0
    const results = []

    for (const order of ordersToFix.rows) {
      try {
        // Get exchange rate for this currency
        const currencyResult = await pool.query(
          'SELECT exchange_rate FROM currencies WHERE code = $1 AND active = true',
          [order.currency]
        )

        if (currencyResult.rows.length === 0) {
          console.log(`[fix-usd] No exchange rate found for ${order.currency}, skipping order ${order.order_id}`)
          skipped++
          continue
        }

        const exchangeRate = Number(currencyResult.rows[0].exchange_rate || 1)
        const totalAmount = Number(order.total_amount || 0)

        // Convert: divide by exchange rate (1 USD = X foreign currency)
        const correctUSD = totalAmount / exchangeRate

        // Update the order
        await pool.query(
          'UPDATE orders SET amount_usd = $1 WHERE id = $2',
          [correctUSD, order.id]
        )

        console.log(`[fix-usd] Fixed order ${order.order_id}: ${totalAmount} ${order.currency} -> ${correctUSD.toFixed(2)} USD (rate: ${exchangeRate})`)

        results.push({
          order_id: order.order_id,
          currency: order.currency,
          original_amount: totalAmount,
          old_usd: Number(order.amount_usd || 0),
          new_usd: correctUSD,
          exchange_rate: exchangeRate
        })

        fixed++
      } catch (err) {
        console.error(`[fix-usd] Error fixing order ${order.order_id}:`, err)
        skipped++
      }
    }

    res.json({
      success: true,
      total_found: ordersToFix.rows.length,
      fixed: fixed,
      skipped: skipped,
      results: results
    })
  } catch (err) {
    console.error('[fix-usd] Error:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Create HTTP server for Socket.io support
const httpServer = createServer(app)

// Initialize Socket.io for real-time bot logs
initializeSocketIO(httpServer, FRONTEND_ORIGIN)

const port = process.env.PORT || 3001
httpServer.listen(port, async () => {
  console.log(`[server] listening on http://localhost:${port}`)
  console.log(`[server] Socket.io initialized for real-time bot logs`)
  await bootstrapAdminUser()
  await ensureBrandsTable()
  console.log('[db] Brands table initialized')
  await ensurePackagesTable()

  // Test log to verify admin logging system works
  await ensureAdminLogsTable()
  await logToAdmin({
    level: 'INFO',
    category: 'SYSTEM',
    action: 'SERVER_STARTED',
    message: 'Server started successfully',
    details: {
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  })
  console.log('[server] Admin logging system initialized')
  await seedPackages()
  console.log('[db] Packages table initialized')
  await ensureCurrenciesTable()
  await seedCurrencies()
  console.log('[db] Currencies table initialized')
  await ensureCurrencyGeoMappingsTable()
  await seedCurrencyGeoMappings()
  console.log('[db] Currency geo mappings table initialized')
  await ensurePackageCurrencyPricesTable()
  console.log('[db] Package currency prices table initialized')
  await ensureConversionFeeSetting()
  console.log('[db] Conversion fee setting initialized')
  await ipLimiter.ensureIpAttemptLimitsTable(pool)
  console.log('[db] IP attempt limits table initialized')

  // Run migrations to update brand links
  await migrateBrandLinksToPackagePages()
  await migrateBrandLinksToSlugFormat()
})


