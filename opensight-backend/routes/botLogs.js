/**
 * Bot Logs Routes
 * API endpoints for bot log submission and admin management
 */

import express from 'express'
import { createBotApiKeyMiddleware } from '../middleware/botApiAuth.js'
import {
  insertBotLog,
  getBotLogs,
  deleteBotLog,
  clearOldBotLogs,
  getBotIdentifiers,
  getCategories,
  ensureBotLogsTable,
  ensureBotApiKeysTable
} from '../services/botLogs.js'
import { emitBotLog } from '../config/socketio.js'

/**
 * Create bot logs routes
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} options - Route options
 * @param {Function} options.requireAuth - Auth middleware
 * @param {Function} options.requireAdmin - Admin middleware
 * @returns {express.Router} - Express router with bot logs routes
 */
export default function createBotLogsRoutes(pool, { requireAuth, requireAdmin } = {}) {
  if (!pool?.query) {
    throw new Error('[botLogsRoutes] PostgreSQL pool is required')
  }

  const router = express.Router()
  const validateBotApiKey = createBotApiKeyMiddleware(pool)

  // Initialize tables on route setup
  ensureBotLogsTable(pool).catch(err => {
    console.error('[botLogsRoutes] Failed to initialize bot_logs table:', err)
  })
  ensureBotApiKeysTable(pool).catch(err => {
    console.error('[botLogsRoutes] Failed to initialize bot_api_keys table:', err)
  })

  // ====================================
  // Bot API Endpoints (API Key Auth)
  // ====================================

  /**
   * POST /api/bot/logs - Submit a new bot log
   * Requires API key authentication via Bearer token
   */
  router.post('/api/bot/logs', validateBotApiKey, async (req, res) => {
    try {
      const {
        level,
        category,
        action,
        message,
        details,
        bot_identifier,
        timestamp
      } = req.body

      // Validate required field
      if (!message && !action) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'At least one of "message" or "action" is required'
        })
      }

      // Validate message size (max 10KB)
      if (message && message.length > 10000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Message exceeds maximum length of 10000 characters'
        })
      }

      // Validate details size (max 50KB when serialized)
      if (details) {
        try {
          const detailsStr = JSON.stringify(details)
          if (detailsStr.length > 50000) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Details field exceeds maximum size of 50KB'
            })
          }
        } catch {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Details field must be valid JSON'
          })
        }
      }

      // Insert the log
      const log = await insertBotLog(pool, {
        level,
        category,
        action,
        message,
        details,
        bot_identifier,
        timestamp
      })

      // Emit real-time event to admin clients
      emitBotLog(log)

      console.log(`[bot-logs] New log received from ${bot_identifier || 'unknown'}: ${level || 'INFO'} - ${action || message?.substring(0, 50)}`)

      res.status(201).json({
        success: true,
        log: {
          id: log.id,
          timestamp: log.timestamp
        }
      })
    } catch (err) {
      console.error('[bot-logs] Error inserting log:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to save log entry'
      })
    }
  })

  // ====================================
  // Admin API Endpoints (Auth Required)
  // ====================================

  /**
   * GET /api/admin/bot-logs - Fetch bot logs with pagination and filters
   */
  router.get('/api/admin/bot-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        level,
        category,
        bot_identifier,
        start_date,
        end_date,
        search
      } = req.query

      const result = await getBotLogs(pool, {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10) || 50, 100), // Max 100 per page
        level,
        category,
        bot_identifier,
        start_date,
        end_date,
        search
      })

      res.json(result)
    } catch (err) {
      console.error('[bot-logs] Error fetching logs:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch bot logs'
      })
    }
  })

  /**
   * GET /api/admin/bot-logs/filters - Get available filter options
   */
  router.get('/api/admin/bot-logs/filters', requireAuth, requireAdmin, async (req, res) => {
    try {
      const [botIdentifiers, categories] = await Promise.all([
        getBotIdentifiers(pool),
        getCategories(pool)
      ])

      res.json({
        bot_identifiers: botIdentifiers,
        categories: categories,
        levels: ['DEBUG', 'INFO', 'WARNING', 'ERROR']
      })
    } catch (err) {
      console.error('[bot-logs] Error fetching filters:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch filter options'
      })
    }
  })

  /**
   * DELETE /api/admin/bot-logs/:id - Delete a specific bot log
   */
  router.delete('/api/admin/bot-logs/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10)

      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid log ID'
        })
      }

      const deleted = await deleteBotLog(pool, id)

      if (!deleted) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Log not found'
        })
      }

      res.json({ success: true })
    } catch (err) {
      console.error('[bot-logs] Error deleting log:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete log'
      })
    }
  })

  /**
   * DELETE /api/admin/bot-logs/bulk - Delete logs older than specified date
   */
  router.delete('/api/admin/bot-logs/bulk', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { before_date } = req.body

      if (!before_date) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'before_date is required'
        })
      }

      const parsedDate = new Date(before_date)
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid date format'
        })
      }

      const deletedCount = await clearOldBotLogs(pool, parsedDate)

      res.json({
        success: true,
        deleted_count: deletedCount
      })
    } catch (err) {
      console.error('[bot-logs] Error clearing old logs:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to clear old logs'
      })
    }
  })

  return router
}

