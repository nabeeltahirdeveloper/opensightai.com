/**
 * Socket.io Configuration
 * Handles WebSocket setup for real-time bot logs
 */

import { Server } from 'socket.io'

let io = null

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @param {string} corsOrigin - CORS origin setting
 * @returns {Object} - Socket.io server instance
 */
export function initializeSocketIO(httpServer, corsOrigin = '*') {
  if (io) {
    console.warn('[socket.io] Already initialized')
    return io
  }

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Increase ping timeout for stability
    pingTimeout: 60000,
    pingInterval: 25000
  })

  // Main namespace for general connections
  io.on('connection', (socket) => {
    console.log(`[socket.io] Client connected: ${socket.id}`)

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] Client disconnected: ${socket.id}, reason: ${reason}`)
    })

    socket.on('error', (error) => {
      console.error(`[socket.io] Socket error for ${socket.id}:`, error)
    })
  })

  // Bot logs namespace for admin monitoring
  const botLogsNamespace = io.of('/admin-bot-logs')

  botLogsNamespace.on('connection', (socket) => {
    console.log(`[socket.io:bot-logs] Admin client connected: ${socket.id}`)

    // Join the bot-logs room for receiving updates
    socket.join('bot-logs-room')

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io:bot-logs] Admin client disconnected: ${socket.id}, reason: ${reason}`)
    })

    socket.on('error', (error) => {
      console.error(`[socket.io:bot-logs] Socket error for ${socket.id}:`, error)
    })

    // Handle client requesting initial connection confirmation
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() })
    })
  })

  console.log('[socket.io] Initialized with /admin-bot-logs namespace')
  return io
}

/**
 * Get the Socket.io server instance
 * @returns {Object|null} - Socket.io server instance or null if not initialized
 */
export function getIO() {
  return io
}

/**
 * Emit a new bot log to all connected admin clients
 * @param {Object} logData - The bot log data to emit
 */
export function emitBotLog(logData) {
  if (!io) {
    console.warn('[socket.io] Cannot emit bot log - Socket.io not initialized')
    return
  }

  // Emit to all clients in the bot-logs namespace
  io.of('/admin-bot-logs').to('bot-logs-room').emit('new-bot-log', logData)
}

/**
 * Get connected client count for bot logs namespace
 * @returns {number} - Number of connected clients
 */
export function getBotLogsClientCount() {
  if (!io) return 0

  const namespace = io.of('/admin-bot-logs')
  return namespace.sockets.size
}

export default {
  initializeSocketIO,
  getIO,
  emitBotLog,
  getBotLogsClientCount
}

