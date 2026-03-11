import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function ResellerPayoutsSection() {
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState({ total_paid: 0, average_payout: 0, last_payout: null });
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    loadPayouts();
  }, [page]);

  const loadPayouts = async (filterParams = {}) => {
    setLoading(true);
    try {
      const params = {
        page: String(page),
        pageSize: '20',
        ...filterParams
      };
      
      const data = await serverApi.reseller.payouts.list(params);
      setPayouts(data.payouts || []);
      setStats(data.stats || { total_paid: 0, average_payout: 0, last_payout: null });
      setMeta(data.meta || { total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to load payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    const filterParams = {};
    if (fromDate) filterParams.from_date = fromDate;
    if (toDate) filterParams.to_date = toDate;
    setPage(1);
    loadPayouts(filterParams);
  };

  const handleDownloadStatement = (payout) => {
    // Placeholder for download statement functionality
    alert(`Download statement for payout ${payout.reference_id || payout.id}`);
  };

  if (loading && page === 1) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading payout history...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold gradient-text">Payout History</h2>
        <p className="text-sm text-gray-400 mt-1">View and manage all your past and pending settlements.</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* Total Paid Out */}
          <div className="metric-card glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-400 text-sm">Total Paid Out</p>
                <p className="text-2xl font-bold text-green-400">${Number(stats.total_paid || 0).toFixed(2)}</p>
              </div>
              <i className="fas fa-dollar-sign text-3xl text-green-400 opacity-20"></i>
            </div>
          </div>

          {/* Last Payout */}
          <div className="metric-card glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-400 text-sm">Last Payout</p>
                <p className="text-2xl font-bold text-blue-400">
                  ${stats.last_payout ? Number(stats.last_payout.amount || 0).toFixed(2) : '0.00'}
                </p>
                {stats.last_payout?.date && (
                  <p className="text-xs text-gray-400 mt-1">
                    on {new Date(stats.last_payout.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                  </p>
                )}
              </div>
              <i className="fas fa-calendar-check text-3xl text-blue-400 opacity-20"></i>
            </div>
          </div>

          {/* Average Payout */}
          <div className="metric-card glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-400 text-sm">Average Payout</p>
                <p className="text-2xl font-bold text-purple-400">${Number(stats.average_payout || 0).toFixed(2)}</p>
              </div>
              <i className="fas fa-chart-line text-3xl text-purple-400 opacity-20"></i>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Filter Payouts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-alt mr-2"></i>From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-check mr-2"></i>To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div>
            <button
              onClick={handleApplyFilter}
              className="action-btn btn-primary w-full"
            >
              <i className="fas fa-filter mr-2"></i>Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="glass-panel overflow-hidden">
        {payouts.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-file-invoice-dollar text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-400">No payout history found</p>
            <p className="text-sm text-gray-500 mt-2">
              Payouts will appear here once they are processed
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Payout Date
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Reference ID
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-800/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {payout.paid_at 
                          ? new Date(payout.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(payout.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-400">
                        ${Number(payout.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(payout.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(payout.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          payout.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {payout.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {payout.method || 'Bank Transfer'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                        {payout.reference_id || `SET-${payout.id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDownloadStatement(payout)}
                          className="inline-flex items-center text-gray-400 hover:text-white font-medium transition-colors"
                        >
                          <i className="fas fa-download mr-2"></i>
                          Statement
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-700">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="action-btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-chevron-left mr-2"></i>
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} of {meta.pages} — {meta.total} total payouts
                </span>
                <button
                  onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                  disabled={page >= meta.pages}
                  className="action-btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <i className="fas fa-chevron-right ml-2"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

