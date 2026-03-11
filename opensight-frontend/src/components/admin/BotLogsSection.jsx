import React, { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { 
  RefreshCw, Search, Filter, Download, Trash2, 
  AlertTriangle, Info, AlertCircle, XCircle, Bug,
  Wifi, WifiOff, ChevronDown, ChevronRight
} from 'lucide-react'

// Use the same API URL pattern as the rest of the app
const API_BASE = `${import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'}/api`
const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR']
const LOG_LEVEL_COLORS = {
  DEBUG: 'bg-gray-100 text-gray-800 border-gray-300',
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ERROR: 'bg-red-100 text-red-800 border-red-300'
}

const LOG_LEVEL_ICONS = {
  DEBUG: Bug,
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: XCircle
}

export default function BotLogsSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    level: '',
    category: '',
    bot_identifier: '',
    search: '',
    start_date: '',
    end_date: ''
  })
  const [pagination, setPagination] = useState({})
  const [filterOptions, setFilterOptions] = useState({ 
    bot_identifiers: [], 
    categories: [], 
    levels: LOG_LEVELS 
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedDetails, setExpandedDetails] = useState({})
  
  const socketRef = useRef(null)
  const logsContainerRef = useRef(null)

  // Initialize Socket.io connection
  useEffect(() => {
    socketRef.current = io(`${SOCKET_URL}/admin-bot-logs`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socketRef.current.on('connect', () => {
      console.log('[BotLogs] Socket.io connected')
      setIsConnected(true)
    })

    socketRef.current.on('disconnect', (reason) => {
      console.log('[BotLogs] Socket.io disconnected:', reason)
      setIsConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('[BotLogs] Socket.io connection error:', error)
      setIsConnected(false)
    })

    // Listen for new bot logs
    socketRef.current.on('new-bot-log', (newLog) => {
      console.log('[BotLogs] New log received:', newLog)
      setLogs(prevLogs => {
        // Add new log at the top (most recent first)
        const updatedLogs = [newLog, ...prevLogs]
        // Keep only the most recent logs based on limit
        return updatedLogs.slice(0, 100)
      })
      
      // Auto-scroll to top if enabled
      if (autoScroll && logsContainerRef.current) {
        logsContainerRef.current.scrollTop = 0
      }
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [autoScroll])

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      Object.keys(filters).forEach(key => {
        if (filters[key]) queryParams.append(key, filters[key])
      })

      const response = await fetch(`${API_BASE}/admin/bot-logs?${queryParams}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setPagination({
          page: data.page,
          totalPages: data.totalPages,
          totalCount: data.total
        })
      } else {
        console.error('[BotLogs] Failed to fetch logs:', response.status)
      }
    } catch (error) {
      console.error('[BotLogs] Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/bot-logs/filters`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setFilterOptions(data)
      }
    } catch (error) {
      console.error('[BotLogs] Failed to fetch filter options:', error)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      level: '',
      category: '',
      bot_identifier: '',
      search: '',
      start_date: '',
      end_date: ''
    })
  }

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Category', 'Action', 'Message', 'Bot Identifier'].join(','),
      ...logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.log_level,
        log.category || '',
        log.action || '',
        `"${(log.message || '').replace(/"/g, '""')}"`,
        log.bot_identifier || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-logs-${new Date().toISOString()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleClearOldLogs = async () => {
    const daysAgo = prompt('Delete logs older than how many days?', '30')
    if (!daysAgo) return
    
    const days = parseInt(daysAgo, 10)
    if (isNaN(days) || days < 1) {
      alert('Please enter a valid number of days')
      return
    }

    if (!confirm(`Are you sure you want to delete all bot logs older than ${days} days? This cannot be undone.`)) {
      return
    }

    try {
      const beforeDate = new Date()
      beforeDate.setDate(beforeDate.getDate() - days)

      const response = await fetch(`${API_BASE}/admin/bot-logs/bulk`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ before_date: beforeDate.toISOString() })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deleted_count} old log entries`)
        fetchLogs()
      } else {
        alert('Failed to delete old logs')
      }
    } catch (error) {
      console.error('[BotLogs] Error clearing old logs:', error)
      alert('Failed to clear old logs')
    }
  }

  const handleDeleteLog = async (id) => {
    if (!confirm('Are you sure you want to delete this log entry?')) return

    try {
      const response = await fetch(`${API_BASE}/admin/bot-logs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        setLogs(prev => prev.filter(log => log.id !== id))
        if (selectedLog?.id === id) {
          setSelectedLog(null)
        }
      } else {
        alert('Failed to delete log')
      }
    } catch (error) {
      console.error('[BotLogs] Error deleting log:', error)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const toggleDetails = (logId) => {
    setExpandedDetails(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const LogLevelIcon = ({ level }) => {
    const Icon = LOG_LEVEL_ICONS[level] || Info
    return <Icon className="w-4 h-4" />
  }

  const ConnectionStatus = () => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
      isConnected 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Disconnected</span>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Bot Logs</h2>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {pagination.totalCount || 0} total logs
              </span>
              <ConnectionStatus />
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600 mr-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-scroll
            </label>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showFilters 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleClearOldLogs}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Old
            </button>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Level Statistics */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {LOG_LEVELS.map(level => {
          const count = logs.filter(l => l.log_level === level).length
          return (
            <div
              key={level}
              className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-shadow ${LOG_LEVEL_COLORS[level]}`}
              onClick={() => handleFilterChange('level', filters.level === level ? '' : level)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm font-medium">{level}</div>
                </div>
                <LogLevelIcon level={level} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-white border-2 border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Logs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search messages and actions..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={filters.level}
                onChange={(e) => handleFilterChange('level', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Levels</option>
                {filterOptions.levels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Bot Identifier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot</label>
              <select
                value={filters.bot_identifier}
                onChange={(e) => handleFilterChange('bot_identifier', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Bots</option>
                {filterOptions.bot_identifiers.map(bot => (
                  <option key={bot} value={bot}>{bot}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleClearFilters}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div 
        ref={logsContainerRef}
        className="bg-white rounded-lg border-2 border-gray-200 shadow-sm overflow-hidden max-h-[600px] overflow-y-auto"
      >
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-blue-500 mb-3" />
            <p className="text-gray-600 text-lg">Loading bot logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Bug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No bot logs found</p>
            <p className="text-sm text-gray-500">Logs will appear here in real-time when your bot sends them</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map(log => (
              <div key={log.id} className="hover:bg-gray-50 transition-colors">
                <div 
                  className="p-4 cursor-pointer flex items-start gap-4"
                  onClick={() => setSelectedLog(log)}
                >
                  {/* Expand/Collapse Button */}
                  {log.details && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDetails(log.id)
                      }}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                    >
                      {expandedDetails[log.id] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  )}
                  {!log.details && <div className="w-6" />}

                  {/* Level Badge */}
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${LOG_LEVEL_COLORS[log.log_level]}`}>
                    <LogLevelIcon level={log.log_level} />
                    {log.log_level}
                  </span>

                  {/* Timestamp */}
                  <span className="flex-shrink-0 text-sm text-gray-500 font-mono w-44">
                    {formatDate(log.timestamp)}
                  </span>

                  {/* Bot Identifier */}
                  {log.bot_identifier && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      {log.bot_identifier}
                    </span>
                  )}

                  {/* Category & Action */}
                  <span className="flex-shrink-0 text-sm font-semibold text-gray-700">
                    {log.category && <span className="text-blue-600">[{log.category}]</span>}
                    {log.action && <span className="ml-1 text-gray-600">{log.action}</span>}
                  </span>

                  {/* Message */}
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {log.message}
                  </span>

                  {/* Screenshot indicator */}
                  {log.screenshot_url && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium" title="Has screenshot">
                      📷
                    </span>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteLog(log.id)
                    }}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedDetails[log.id] && (
                  <div className="px-4 pb-4 pl-14 space-y-3">
                    {log.screenshot_url && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Screenshot</label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <img 
                            src={log.screenshot_url} 
                            alt="Payment screenshot" 
                            className="max-w-full h-auto rounded shadow-sm"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'block'
                              }
                            }}
                          />
                          <div style={{ display: 'none' }} className="text-xs text-gray-500 mt-1">
                            Failed to load screenshot
                          </div>
                          <a 
                            href={log.screenshot_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Open in new tab
                          </a>
                        </div>
                      </div>
                    )}
                    {log.details && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Details</label>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm p-4 flex justify-between items-center">
          <div className="text-sm font-medium text-gray-700">
            Page <span className="text-blue-600">{pagination.page}</span> of <span className="text-blue-600">{pagination.totalPages}</span> 
            <span className="text-gray-500 ml-2">({pagination.totalCount} total logs)</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page >= pagination.totalPages}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Timestamp</label>
                    <div className="text-gray-900">{formatDate(selectedLog.timestamp)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Level</label>
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${LOG_LEVEL_COLORS[selectedLog.log_level]}`}>
                        <LogLevelIcon level={selectedLog.log_level} />
                        {selectedLog.log_level}
                      </span>
                    </div>
                  </div>
                  {selectedLog.category && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Category</label>
                      <div className="text-gray-900">{selectedLog.category}</div>
                    </div>
                  )}
                  {selectedLog.action && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Action</label>
                      <div className="text-gray-900">{selectedLog.action}</div>
                    </div>
                  )}
                  {selectedLog.bot_identifier && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Bot Identifier</label>
                      <div className="text-gray-900">{selectedLog.bot_identifier}</div>
                    </div>
                  )}
                </div>

                {selectedLog.message && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Message</label>
                    <div className="text-gray-900 bg-gray-50 p-3 rounded mt-1">{selectedLog.message}</div>
                  </div>
                )}

                {selectedLog.screenshot_url && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Screenshot</label>
                    <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                      <img 
                        src={selectedLog.screenshot_url} 
                        alt="Payment screenshot" 
                        className="max-w-full h-auto rounded-lg shadow-md"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'block'
                        }}
                      />
                      <div style={{ display: 'none' }} className="text-sm text-gray-500 mt-2">
                        Failed to load screenshot image
                      </div>
                      <a 
                        href={selectedLog.screenshot_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Details</label>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => handleDeleteLog(selectedLog.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  Delete Log
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

