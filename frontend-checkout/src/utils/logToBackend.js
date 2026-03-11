/**
 * Utility to log frontend errors to the backend admin logs system
 */

const SERVER_URL = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'

export async function logToBackend({ level = 'ERROR', category, action, message, details = {} }) {
  try {
    await fetch(`${SERVER_URL}/api/admin/logs/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level,
        category,
        action,
        message,
        details: {
          ...details,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      })
    })
  } catch (error) {
    // Silent fail - don't break the app if logging fails
    console.error('[logToBackend] Failed to send log:', error)
  }
}

// Convenience methods
export const logError = (category, action, message, details) => 
  logToBackend({ level: 'ERROR', category, action, message, details })

export const logWarning = (category, action, message, details) => 
  logToBackend({ level: 'WARNING', category, action, message, details })

export const logInfo = (category, action, message, details) => 
  logToBackend({ level: 'INFO', category, action, message, details })


