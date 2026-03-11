import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, Filter, Download, Trash2, AlertTriangle, Info, AlertCircle, XCircle } from 'lucide-react'

// Use the same API URL pattern as the rest of the app
const API_BASE = `${import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com'}/api`

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'CRITICAL']
const LOG_LEVEL_COLORS = {
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
  WARN: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ERROR: 'bg-red-100 text-red-800 border-red-300',
  CRITICAL: 'bg-purple-100 text-purple-800 border-purple-300'
}

const LOG_LEVEL_ICONS = {
  INFO: Info,
  WARN: AlertTriangle,
  ERROR: XCircle,
  CRITICAL: AlertCircle
}

export default function AdminLogsSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    level: '',
    category: '',
    action: '',
    userEmail: '',
    search: '',
    startDate: '',
    endDate: ''
  })
  const [pagination, setPagination] = useState({})
  const [statistics, setStatistics] = useState([])
  const [metadata, setMetadata] = useState({ categories: [], actions: [], levels: [] })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [criticalLogs, setCriticalLogs] = useState([])

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      Object.keys(filters).forEach(key => {
        if (filters[key]) queryParams.append(key, filters[key])
      })

      const url = `${API_BASE}/admin/logs?${queryParams}`
      console.log('[Fetch Logs] URL:', url)
      console.log('[Fetch Logs] Current filters:', filters)

      const response = await fetch(url, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[Fetch Logs] Response pagination:', data.pagination)
        setLogs(data.logs)
        setPagination(data.pagination)
        setStatistics(data.statistics)
      } else {
        console.error('[Fetch Logs] Response not OK:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Fetch metadata and critical logs only once on mount
  useEffect(() => {
    fetchMetadata()
    fetchCriticalLogs()
  }, [])

  // Fetch logs whenever filters change
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const fetchMetadata = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/logs/meta`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setMetadata(data)
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error)
    }
  }

  const fetchCriticalLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/logs/critical`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setCriticalLogs(data.criticalLogs)
      }
    } catch (error) {
      console.error('Failed to fetch critical logs:', error)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    console.log('[Pagination] Changing from page', filters.page, 'to page', newPage)
    setFilters(prev => {
      const updated = { ...prev, page: newPage }
      console.log('[Pagination] Updated filters:', updated)
      return updated
    })
  }

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      level: '',
      category: '',
      action: '',
      userEmail: '',
      search: '',
      startDate: '',
      endDate: ''
    })
  }

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Category', 'Action', 'Message', 'User Email'].join(','),
      ...logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.log_level,
        log.category,
        log.action,
        `"${log.message}"`,
        log.user_email || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-logs-${new Date().toISOString()}.csv`
    a.click()
  }

  const handleCleanup = async () => {
    if (!confirm('Are you sure you want to delete logs older than 90 days?')) return

    try {
      const response = await fetch(`${API_BASE}/admin/logs/cleanup`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysToKeep: 90 })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deletedCount} old log entries`)
        fetchLogs()
      }
    } catch (error) {
      console.error('Failed to cleanup logs:', error)
      alert('Failed to cleanup logs')
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

  // Helper function to safely parse JSON (handles both strings and objects)
  const safeJsonParse = (data) => {
    if (!data) return null
    if (typeof data === 'object') return data  // Already an object
    try {
      return JSON.parse(data)  // Try to parse if it's a string
    } catch (e) {
      console.error('Failed to parse JSON:', e, data)
      return null
    }
  }

  const LogLevelIcon = ({ level }) => {
    const Icon = LOG_LEVEL_ICONS[level] || Info
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Critical Logs Alert */}
      {criticalLogs.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-900 mb-2">⚠️ {criticalLogs.length} Critical Issues Detected</h3>
              <div className="space-y-2">
                {criticalLogs.slice(0, 3).map(log => (
                  <div key={log.id} className="text-sm text-red-800 bg-white rounded p-2">
                    <div className="font-semibold">{log.action}</div>
                    <div>{log.message}</div>
                    <div className="text-xs text-red-600 mt-1">{formatDate(log.timestamp)}</div>
                  </div>
                ))}
              </div>
              {criticalLogs.length > 3 && (
                <button
                  onClick={() => {
                    // Show both CRITICAL and ERROR logs by clearing other filters
                    setFilters({
                      page: 1,
                      limit: 50,
                      level: '',
                      category: '',
                      action: '',
                      userEmail: '',
                      search: '',
                      startDate: '',
                      endDate: ''
                    })
                    // Then scroll to the logs table
                    setTimeout(() => {
                      const logsTable = document.querySelector('.bg-white.rounded-lg.border')
                      if (logsTable) logsTable.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 100)
                  }}
                  className="mt-2 text-sm text-red-700 underline hover:text-red-900"
                >
                  View all {criticalLogs.length} critical/error logs below
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">System Logs</h2>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {pagination.totalCount || 0} total logs
              </span>
            </p>
          </div>
          <div className="flex gap-2">
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
              onClick={handleCleanup}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Cleanup
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

      {/* Statistics */}
      {statistics.length > 0 && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {LOG_LEVELS.map(level => {
            const count = statistics.filter(s => s.log_level === level).reduce((sum, s) => sum + parseInt(s.count), 0)
            return (
              <div
                key={level}
                className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-shadow ${LOG_LEVEL_COLORS[level]}`}
                onClick={() => handleFilterChange('level', level)}
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
      )}

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
                {metadata.levels.map(level => (
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
                {metadata.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Actions</option>
                {metadata.actions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            {/* User Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
              <input
                type="email"
                value={filters.userEmail}
                onChange={(e) => handleFilterChange('userEmail', e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
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
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-blue-500 mb-3" />
            <p className="text-gray-600 text-lg">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-2">No logs found matching your filters</p>
            {(filters.level || filters.category || filters.action || filters.userEmail || filters.search || filters.startDate || filters.endDate) && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Level</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Message</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap font-medium">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${LOG_LEVEL_COLORS[log.log_level]}`}>
                        <LogLevelIcon level={log.log_level} />
                        {log.log_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{log.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">{log.message}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{log.user_email || <span className="text-gray-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              onClick={() => handlePageChange(parseInt(filters.page) - 1)}
              disabled={parseInt(filters.page) <= 1}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange(parseInt(filters.page) + 1)}
              disabled={parseInt(filters.page) >= pagination.totalPages}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
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
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
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
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <div className="text-gray-900">{selectedLog.category}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Action</label>
                    <div className="text-gray-900">{selectedLog.action}</div>
                  </div>
                  {selectedLog.user_email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">User Email</label>
                      <div className="text-gray-900">{selectedLog.user_email}</div>
                    </div>
                  )}
                  {selectedLog.request_id && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500">Request ID</label>
                      <div className="text-gray-900 font-mono text-sm">{selectedLog.request_id}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Message</label>
                  <div className="text-gray-900 bg-gray-50 p-3 rounded">{selectedLog.message}</div>
                </div>

                {selectedLog.details && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Details</label>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(safeJsonParse(selectedLog.details), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Display HTTP request/response details if available */}
                {selectedLog.http_method && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">HTTP Request/Response Details</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Method</label>
                        <div className="text-gray-900 font-mono">{selectedLog.http_method}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Route</label>
                        <div className="text-gray-900 font-mono text-sm">{selectedLog.route}</div>
                      </div>
                      {selectedLog.response_status && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Status Code</label>
                          <div className={`font-mono ${selectedLog.response_status >= 400 ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedLog.response_status}
                          </div>
                        </div>
                      )}
                      {selectedLog.response_time_ms && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Response Time</label>
                          <div className="text-gray-900">{selectedLog.response_time_ms}ms</div>
                        </div>
                      )}
                    </div>

                    {selectedLog.query_params && Object.keys(safeJsonParse(selectedLog.query_params) || {}).length > 0 && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Query Parameters</label>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-48">
                          {JSON.stringify(safeJsonParse(selectedLog.query_params), null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.headers && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Headers</label>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-48">
                          {JSON.stringify(safeJsonParse(selectedLog.headers), null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.request_body && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Request Body</label>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                          {JSON.stringify(safeJsonParse(selectedLog.request_body), null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.response_body && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Response Body</label>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                          {JSON.stringify(safeJsonParse(selectedLog.response_body), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


