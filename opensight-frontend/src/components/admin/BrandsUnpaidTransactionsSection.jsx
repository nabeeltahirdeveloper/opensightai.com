import React, { useState, useEffect, useCallback } from 'react';
import { serverApi } from '@/api/serverApi';

const formatDateForAPI = (dateStr, isEndOfDay = false) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    console.warn(`[BrandsUnpaidTransactions] Invalid date format: ${dateStr}`);
    return '';
  }
  const [year, month, day] = parts;
  return isEndOfDay
    ? `${year}-${month}-${day}T23:59:59.999Z`
    : `${year}-${month}-${day}T00:00:00.000Z`;
};

export default function BrandsUnpaidTransactionsSection() {
  // Load saved date filters from localStorage on mount
  const loadSavedDateFilters = () => {
    try {
      const saved = localStorage.getItem('adminBrandsUnpaidTransactionsDateFilters');
      if (saved) {
        const filters = JSON.parse(saved);
        return {
          fromDate: filters.fromDate || '',
          toDate: filters.toDate || ''
        };
      }
    } catch (e) {
      console.warn('Failed to load saved date filters:', e);
    }
    return { fromDate: '', toDate: '' };
  };

  const savedFilters = loadSavedDateFilters();

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState(savedFilters.fromDate);
  const [toDate, setToDate] = useState(savedFilters.toDate);

  // Save date filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('adminBrandsUnpaidTransactionsDateFilters', JSON.stringify({
        fromDate: fromDate,
        toDate: toDate
      }));
    } catch (e) {
      console.warn('Failed to save date filters:', e);
    }
  }, [fromDate, toDate]);

  const loadData = useCallback(async (isRefresh = false) => {
    // Always show loading state for any data fetch
    setLoading(true);
    if (isRefresh) {
      setRefreshing(true);
    }
    
    try {
      const params = {};
      if (fromDate) params.from = formatDateForAPI(fromDate, false);
      if (toDate) params.to = formatDateForAPI(toDate, true);

      const data = await serverApi.admin.brands.getUnpaidTransactions(params);
      setBrands(data.brands || []);
    } catch (error) {
      console.error('Failed to load unpaid transactions:', error);
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    try {
      localStorage.removeItem('adminBrandsUnpaidTransactionsDateFilters');
    } catch (e) {
      console.warn('Failed to clear date filters from localStorage:', e);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Brands For Payouts</h2>
          <p className="text-sm text-gray-400">
            Monitor brands with unpaid transactions
          </p>
        </div>
        <button 
          className="action-btn btn-primary"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <i className={`fas fa-sync-alt mr-2 ${refreshing ? 'fa-spin' : ''}`}></i>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Date Filters */}
      <div className="glass-panel p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-alt mr-2 text-blue-400"></i>From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-check mr-2 text-blue-400"></i>To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            />
          </div>
        </div>

        {/* Clear Filters */}
        <div className="mt-4 flex justify-start md:justify-end">
          <button
            onClick={handleClearFilters}
            className="action-btn btn-secondary w-full md:w-auto"
            disabled={loading}
          >
            <i className="fas fa-times mr-2"></i>Clear Filters
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 md:p-6">
        {loading ? (
          <div className="text-center py-12 flex items-center justify-center">
            <div>
              <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
              <p className="text-gray-400">Loading brands...</p>
            </div>
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">No brands found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Unpaid Transactions Count</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4" data-label="ID">
                      <span className="text-sm text-cyan-400 font-mono">{brand.id}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Name">
                      <span className="text-sm font-semibold text-white">{brand.name}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Unpaid Transactions Count">
                      <span className={`text-sm font-bold ${brand.unpaid_transactions_count > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {brand.unpaid_transactions_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

