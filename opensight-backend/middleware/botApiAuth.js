/**
 * Bot API Authentication Middleware
 * Validates API keys for bot log submissions
 */

import { validateApiKey } from '../services/botLogs.js'

/**
 * Middleware factory that creates a bot API key validation middleware
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Function} - Express middleware function
 */
export function createBotApiKeyMiddleware(pool) {
  return async function validateBotApiKeyMiddleware(req, res, next) {
    try {
      // Get the Authorization header
      const authHeader = req.headers.authorization

      if (!authHeader) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing Authorization header'
        })
      }

      // Check for Bearer token format
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid Authorization header format. Use: Bearer <api_key>'
        })
      }

      // Extract the API key
      const apiKey = authHeader.slice(7).trim()

      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key is required'
        })
      }

      // Validate the API key against database
      const keyInfo = await validateApiKey(pool, apiKey)

      if (!keyInfo) {
        console.warn('[bot-api-auth] Invalid API key attempt')
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or inactive API key'
        })
      }

      // Attach bot auth info to request for downstream use
      req.botAuth = {
        keyId: keyInfo.id,
        label: keyInfo.label
      }

      next()
    } catch (err) {
      console.error('[bot-api-auth] Error validating API key:', err)
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate API key'
      })
    }
  }
}

export default createBotApiKeyMiddleware

