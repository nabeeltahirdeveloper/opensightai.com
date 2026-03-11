import React, { useState, useEffect, useCallback } from 'react';
import { serverApi } from '@/api/serverApi';
import { exportToCSV, formatDateForCSV, formatCurrencyForCSV } from '@/utils/csvExport';
import { getCurrencySymbol } from '@/utils/currency';

const formatDateForAPI = (dateStr, isEndOfDay = false) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    console.warn(`[AdminAllTransactions] Invalid date format: ${dateStr}`);
    return '';
  }
  const [year, month, day] = parts;
  return isEndOfDay
    ? `${year}-${month}-${day}T23:59:59.999Z`
    : `${year}-${month}-${day}T00:00:00.000Z`;
};

const formatTransactionDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    });
    return formatter.format(new Date(dateString)).replace(',', '');
  } catch (err) {
    console.warn('[AdminAllTransactions] Failed to format date:', dateString, err);
    return dateString;
  }
};

export default function AdminAllTransactionsSection() {
  // Load saved date filters from localStorage on mount
  const loadSavedDateFilters = () => {
    try {
      const saved = localStorage.getItem('adminTransactionsDateFilters');
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

  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  
  // Filters
  const [fromDate, setFromDate] = useState(savedFilters.fromDate);
  const [toDate, setToDate] = useState(savedFilters.toDate);
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Save date filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('adminTransactionsDateFilters', JSON.stringify({
        fromDate: fromDate,
        toDate: toDate
      }));
    } catch (e) {
      console.warn('Failed to save date filters:', e);
    }
  }, [fromDate, toDate]);

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = filteredTransactions.map(tx => ({
      order_id: tx.order_id || '',
      date: formatDateForCSV(tx.created_at),
      brand_name: getBrandName(tx.brand_id),
      customer_name: `${tx.first_name || ''} ${tx.last_name || ''}`.trim(),
      email: tx.email || '',
      country: tx.billing_country || tx.vpn_geo || '',
      amount_original: formatCurrencyForCSV(tx.total_amount, tx.currency || 'USD'),
      amount_usd: formatCurrencyForCSV(getCorrectUSDAmount(tx), 'USD'),
      commission: formatCurrencyForCSV(getCommissionAmount(tx), 'USD'),
      commission_rate: tx.commission_rate ? `${tx.commission_rate}%` : '',
      payment_method: getPaymentMethodName(tx.payment_method),
      payment_status: tx.payment_status || '',
      payment_message: tx.payment_message || '',
      items: tx.items || ''
    }));

    const columns = [
      { key: 'order_id', header: 'Order ID' },
      { key: 'date', header: 'Date' },
      { key: 'brand_name', header: 'Brand' },
      { key: 'customer_name', header: 'Customer Name' },
      { key: 'email', header: 'Email' },
      { key: 'country', header: 'Country' },
      { key: 'amount_original', header: 'Amount (Original)' },
      { key: 'amount_usd', header: 'Amount (USD)' },
      { key: 'commission', header: 'Commission' },
      { key: 'commission_rate', header: 'Commission Rate' },
      { key: 'payment_method', header: 'Payment Method' },
      { key: 'payment_status', header: 'Payment Status' },
      { key: 'payment_message', header: 'Payment Message' },
      { key: 'items', header: 'Items' }
    ];

    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `admin-transactions-${dateStr}`, columns);
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Load brands first
      const brandsData = await serverApi.admin.brands.list();
      setBrands(brandsData.brands || []);
      
      // Load transactions
      const params = {};
      if (fromDate) params.from = formatDateForAPI(fromDate);
      if (toDate) params.to = formatDateForAPI(toDate, true);
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (brandFilter && brandFilter !== 'all') params.brand = brandFilter;
      
      const result = await serverApi.admin.transactions.list(params);
      const txs = result.transactions || [];
      const total = result.total !== undefined ? result.total : txs.length;
      
      // Debug: Log first transaction to check data
      if (txs.length > 0) {
        console.log('[AllTransactions] Sample transaction data:', {
          order_id: txs[0].order_id,
          total_amount: txs[0].total_amount,
          currency: txs[0].currency,
          amount_usd: txs[0].amount_usd,
          commission_amount: txs[0].commission_amount
        });
      }
      
      setTransactions(txs);
      setTotalTransactions(total);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [fromDate, toDate, statusFilter, brandFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const getBrandName = (brandId) => {
    const brand = brands.find(b => b.id === brandId);
    return brand ? brand.name : `Brand #${brandId}`;
  };

  // Get exchange rate for a currency (simulating backend rates)
  const getExchangeRate = (currency) => {
    const rates = {
      'USD': 1.0,
      'EUR': 0.8620,
      'GBP': 0.79,
      'CAD': 1.36,
      'AUD': 1.53,
      'NZD': 1.68,
      'MYR': 4.47,
      'SGD': 1.34,
      'AED': 3.67,
      'CHF': 0.88,
      'INR': 83.12,
      'ZAR': 18.15,
      'PLN': 4.03,
      'CZK': 23.65,
      'MXN': 20.19
    };
    return rates[currency] || 1.0;
  };

  // Get correct USD amount (fixes old wrong conversions)
  const getCorrectUSDAmount = (tx) => {
    const currency = tx.currency || 'USD';
    const totalAmount = Number(tx.total_amount || 0);
    const storedUSD = Number(tx.amount_usd || totalAmount);
    
    // If currency is USD, use total_amount
    if (currency === 'USD') {
      return totalAmount;
    }
    
    // Calculate what USD SHOULD be based on current exchange rate
    // Exchange rate represents: 1 USD = X units of foreign currency
    // So to convert from foreign currency to USD, we DIVIDE
    const exchangeRate = getExchangeRate(currency);
    const correctUSD = totalAmount / exchangeRate;
    
    // If stored USD is way off from correct USD (more than 10% difference), 
    // it was likely calculated with wrong formula - use corrected value
    const difference = Math.abs(storedUSD - correctUSD) / correctUSD;
    if (difference > 0.10) {
      console.warn(`[USD Fix] Order ${tx.order_id}: ${totalAmount} ${currency} - stored USD=$${storedUSD.toFixed(2)}, corrected=$${correctUSD.toFixed(2)}`);
      return correctUSD;
    }
    
    return storedUSD;
  };

  const getCommissionAmount = (tx) => {
    // Use corrected USD amount for commission calculation
    const usdAmount = getCorrectUSDAmount(tx);
    const storedCommission = Number(tx.commission_amount || 0);
    const brand = brands.find(b => b.id === tx.brand_id);
    
    // If commission equals the total amount, it's likely wrong - recalculate
    if (storedCommission > 0 && Math.abs(storedCommission - usdAmount) < 0.01) {
      // Commission shouldn't be 100% of the order, recalculate using brand's rate
      const commissionRate = brand ? (Number(brand.commission_rate || 10) / 100) : 0.10;
      const calculatedCommission = usdAmount * commissionRate;
      console.warn(`[Commission Fix] Order ${tx.order_id}: stored=${storedCommission}, recalculated=${calculatedCommission}`);
      return calculatedCommission;
    }
    
    // Also recalculate if commission seems wrong based on USD amount
    const expectedCommission = usdAmount * (brand ? (Number(brand.commission_rate || 10) / 100) : 0.10);
    const commissionDiff = Math.abs(storedCommission - expectedCommission) / expectedCommission;
    if (commissionDiff > 0.15) { // If commission is off by more than 15%
      console.warn(`[Commission Fix] Order ${tx.order_id}: stored=${storedCommission}, recalculated=${expectedCommission} (off by ${(commissionDiff * 100).toFixed(1)}%)`);
      return expectedCommission;
    }
    
    return storedCommission;
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const num = Number(amount || 0).toFixed(2);
    const symbol = getCurrencySymbol(currency);
    return `${num}${symbol}`;
  };

  const getClientName = (tx) => {
    // Try card_holder_name first
    if (tx.card_holder_name) {
      return tx.card_holder_name;
    }
    // Try combining first_name and last_name
    if (tx.first_name || tx.last_name) {
      return `${tx.first_name || ''} ${tx.last_name || ''}`.trim();
    }
    // Fallback to N/A
    return 'N/A';
  };

  const getPaymentMethodName = (method) => {
    const normalized = (method || 'card').toLowerCase();
    if (normalized === 'applepay') return 'Apple Pay';
    if (normalized === 'googlepay') return 'Google Pay';
    return 'Card';
  };

  const getPaymentMethodIcon = (method) => {
    const normalized = (method || 'card').toLowerCase();
    if (normalized === 'applepay') return '🍎';
    if (normalized === 'googlepay') return '🔵';
    return '💳';
  };

  const handleUpdatePaymentMethod = async () => {
    if (!selectedTx || !newPaymentMethod) return;
    
    try {
      const response = await serverApi.admin.orders.update(selectedTx.id, {
        payment_method: newPaymentMethod
      });
      
      if (response.order) {
        // Update the transaction in the list
        setTransactions(prev => prev.map(tx => 
          tx.id === selectedTx.id ? { ...tx, payment_method: newPaymentMethod } : tx
        ));
        // Update selected transaction
        setSelectedTx({ ...selectedTx, payment_method: newPaymentMethod });
        setEditingPaymentMethod(false);
        setNewPaymentMethod('');
      }
    } catch (error) {
      console.error('Failed to update payment method:', error);
      alert('Failed to update payment method. Please try again.');
    }
  };

  // Calculate statistics (using corrected USD amounts for totals)
  // Use totalTransactions from API for accurate count, but calculate other stats from loaded transactions
  const stats = {
    total: totalTransactions, // Use total count from database via API
    totalRevenue: transactions.filter(tx => tx.payment_status === 'unpaid').reduce((sum, tx) => sum + getCorrectUSDAmount(tx), 0),
    totalCommission: transactions.filter(tx => tx.payment_status === 'paid' || tx.payment_status === 'unpaid').reduce((sum, tx) => sum + getCommissionAmount(tx), 0),
    unpaid: transactions.filter(tx => tx.payment_status === 'unpaid').length,
    paid: transactions.filter(tx => tx.payment_status === 'paid').length,
    pending: transactions.filter(tx => tx.payment_status === 'pending').length,
  };

  // Filter transactions by search query and payment method
  const filteredTransactions = transactions.filter(tx => {
    // Payment method filter
    if (paymentMethodFilter !== 'all') {
      const txMethod = (tx.payment_method || 'card').toLowerCase();
      if (txMethod !== paymentMethodFilter) return false;
    }
    
    // Search query filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.order_id?.toLowerCase().includes(query) ||
      tx.email?.toLowerCase().includes(query) ||
      tx.card_holder_name?.toLowerCase().includes(query) ||
      tx.first_name?.toLowerCase().includes(query) ||
      tx.last_name?.toLowerCase().includes(query) ||
      getBrandName(tx.brand_id)?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
        <p className="text-gray-400">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">All Transactions</h2>
          <p className="text-sm text-gray-400">
            Monitor all transactions across all brands and partners
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="action-btn btn-secondary px-6 py-3 flex items-center justify-center gap-2 whitespace-nowrap"
            disabled={refreshing}
          >
            <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`}></i>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="action-btn btn-secondary px-6 py-3 flex items-center justify-center gap-2 whitespace-nowrap"
            disabled={!filteredTransactions || filteredTransactions.length === 0}
          >
            <i className="fas fa-download"></i>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <i className="fas fa-list text-cyan-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Total Transactions</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.total}</p>
        </div>

        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-dollar-sign text-green-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Total Revenue</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-400">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <i className="fas fa-percent text-purple-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Total Commission</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-400">{formatCurrency(stats.totalCommission)}</p>
        </div>

        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-exclamation-circle text-blue-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Unpaid to Brand</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-400">{stats.unpaid}</p>
        </div>

        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <i className="fas fa-check-circle text-emerald-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Paid to Brand</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.paid}</p>
        </div>

        <div className="glass-panel p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <i className="fas fa-clock text-orange-400 text-sm"></i>
            </div>
            <span className="text-xs text-gray-400 sm:text-right">Pending</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-orange-400">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-search mr-2 text-cyan-400"></i>Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Order ID, email, client name, brand..."
              className="search-input p-3 rounded-lg w-full"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-alt mr-2 text-blue-400"></i>From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-check mr-2 text-blue-400"></i>To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            />
      </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-filter mr-2 text-purple-400"></i>Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="chargeback">Chargeback</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-credit-card mr-2 text-green-400"></i>Payment Method
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            >
              <option value="all">All Methods</option>
              <option value="card">💳 Card</option>
              <option value="applepay">🍎 Apple Pay</option>
              <option value="googlepay">🔵 Google Pay</option>
            </select>
          </div>
          </div>
          
        {/* Brand Filter - Full Width */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <i className="fas fa-building mr-2 text-orange-400"></i>Filter by Brand
          </label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            className="search-input p-3 rounded-lg w-full"
            >
              <option value="all">All Brands</option>
            {brands.map(brand => (
              <option key={brand.id} value={brand.id}>
                {brand.name} {brand.account_type === 'reseller' ? '(Reseller)' : ''}
              </option>
              ))}
            </select>
          </div>
          
        {/* Clear Filters */}
        <div className="mt-4 flex justify-start md:justify-end">
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
              setStatusFilter('all');
              setBrandFilter('all');
              setPaymentMethodFilter('all');
              setSearchQuery('');
              // Clear from localStorage
              try {
                localStorage.removeItem('adminTransactionsDateFilters');
              } catch (e) {
                console.warn('Failed to clear date filters from localStorage:', e);
              }
            }}
            className="action-btn btn-secondary w-full md:w-auto"
          >
            <i className="fas fa-times mr-2"></i>Clear Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg md:text-xl font-semibold text-white">
            <i className="fas fa-receipt mr-2 text-cyan-400"></i>Transactions ({filteredTransactions.length})
          </h3>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">No transactions found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Brand</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Customer Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Country</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">IP</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Error Message</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Order Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">USD Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Commission</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Payment Method</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-800 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4" data-label="Order ID">
                      <span className="text-sm text-cyan-400 font-mono">{tx.order_id}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Brand">
                      <span className="text-sm text-white">{getBrandName(tx.brand_id)}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Customer Name">
                      <span className="text-sm text-gray-300">{getClientName(tx)}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Email">
                      <span className="text-sm text-gray-300">{tx.email || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Country">
                      <span className="text-sm text-gray-300">{tx.billing_country || tx.vpn_geo || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4" data-label="IP">
                      <span className="text-sm text-gray-300 font-mono">{tx.user_ip || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4" data-label="Error Message">
                      <span 
                        className="text-sm text-gray-400 truncate max-w-xs block" 
                        title={tx.payment_message || '-'}
                      >
                        {tx.payment_message || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" data-label="Order Amount">
                      <span className="text-sm font-semibold text-green-400">
                        {formatCurrency(tx.total_amount, tx.currency || 'USD')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" data-label="USD Amount">
                      <span className="text-sm font-semibold text-blue-400">
                        {formatCurrency(getCorrectUSDAmount(tx), 'USD')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" data-label="Commission">
                      <span className="text-sm font-semibold text-purple-400">
                        {formatCurrency(getCommissionAmount(tx))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" data-label="Payment Method">
                      <span className="text-sm text-gray-300">
                        {getPaymentMethodIcon(tx.payment_method)} {getPaymentMethodName(tx.payment_method)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" data-label="Status">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        tx.payment_status === 'paid'
                          ? 'bg-green-500/20 text-green-400'
                          : tx.payment_status === 'unpaid'
                          ? 'bg-blue-500/20 text-blue-400'
                          : tx.payment_status === 'pending'
                          ? 'bg-orange-500/20 text-orange-400'
                          : tx.payment_status === 'chargeback'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : tx.payment_status === 'refund'
                          ? 'bg-pink-500/20 text-pink-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.payment_status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="py-3 px-4" data-label="Date">
                      <span className="text-sm text-gray-400">{formatTransactionDate(tx.created_at)}</span>
                  </td>
                    <td className="py-3 px-4 text-center" data-label="Actions">
                        <button
                        onClick={() => setSelectedTx(selectedTx?.id === tx.id ? null : tx)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        title="View Details"
                        >
                        <i className={`fas fa-${selectedTx?.id === tx.id ? 'eye-slash' : 'eye'}`}></i>
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
                              </div>
                              
      {/* Transaction Details Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedTx(null);
            setEditingPaymentMethod(false);
            setNewPaymentMethod('');
          }}
        >
          <div
            className="glass-panel p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold gradient-text">Transaction Details</h3>
              <button
                onClick={() => {
                  setSelectedTx(null);
                  setEditingPaymentMethod(false);
                  setNewPaymentMethod('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-2xl"></i>
              </button>
                              </div>
                              
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Order ID</label>
                  <p className="text-white font-mono">{selectedTx.order_id}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Brand</label>
                  <p className="text-white">{getBrandName(selectedTx.brand_id)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Customer Name</label>
                  <p className="text-white">
                    {selectedTx.first_name || selectedTx.last_name 
                      ? `${selectedTx.first_name || ''} ${selectedTx.last_name || ''}`.trim()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Customer Email</label>
                  <p className="text-white">{selectedTx.email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Phone</label>
                  <p className="text-white">{selectedTx.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Date</label>
                  <p className="text-white">{formatTransactionDate(selectedTx.created_at)}</p>
                </div>
              </div>
                            
              {/* Financial Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="text-sm text-gray-400">Order Amount</label>
                  <p className="text-xl font-bold text-green-400">
                    {formatCurrency(selectedTx.total_amount, selectedTx.currency || 'USD')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Original currency</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">USD Amount</label>
                  <p className="text-xl font-bold text-blue-400">
                    {formatCurrency(getCorrectUSDAmount(selectedTx), 'USD')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Converted to USD</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Commission</label>
                  <p className="text-xl font-bold text-purple-400">{formatCurrency(getCommissionAmount(selectedTx))}</p>
                  <p className="text-xs text-gray-500 mt-1">Brand commission</p>
                </div>
              </div>
                              
              {/* Status */}
              <div className="pt-4 border-t border-gray-700">
                <label className="text-sm text-gray-400">Payment Status</label>
                <p>
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium mt-2 ${
                    selectedTx.payment_status === 'paid'
                      ? 'bg-green-500/20 text-green-400'
                      : selectedTx.payment_status === 'unpaid'
                      ? 'bg-blue-500/20 text-blue-400'
                      : selectedTx.payment_status === 'pending'
                      ? 'bg-orange-500/20 text-orange-400'
                      : selectedTx.payment_status === 'chargeback'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : selectedTx.payment_status === 'refund'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedTx.payment_status?.toUpperCase() || 'UNKNOWN'}
                                  </span>
                                </p>
                              </div>

              {/* Payment Method */}
              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Payment Method</label>
                  {!editingPaymentMethod && (
                    <button
                      onClick={() => {
                        setEditingPaymentMethod(true);
                        setNewPaymentMethod(selectedTx.payment_method || 'card');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
                    >
                      <i className="fas fa-edit mr-1"></i>Edit
                    </button>
                  )}
                </div>
                
                {editingPaymentMethod ? (
                  <div className="space-y-3">
                    <select
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    >
                      <option value="card">💳 Card</option>
                      <option value="applepay">🍎 Apple Pay</option>
                      <option value="googlepay">🔵 Google Pay</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdatePaymentMethod}
                        className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                      >
                        <i className="fas fa-check mr-2"></i>Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingPaymentMethod(false);
                          setNewPaymentMethod('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        <i className="fas fa-times mr-2"></i>Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-white text-lg">
                    {getPaymentMethodIcon(selectedTx.payment_method)} {getPaymentMethodName(selectedTx.payment_method)}
                  </p>
                )}
              </div>
                              
              {/* Items */}
              {selectedTx.items && (
                <div className="pt-4 border-t border-gray-700">
                  <label className="text-sm text-gray-400 mb-3 block">Order Items</label>
                  <div className="space-y-2">
                    {(typeof selectedTx.items === 'string' ? JSON.parse(selectedTx.items) : selectedTx.items).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                              <div>
                          <p className="text-white font-medium">{item.name || item.title || 'Item'}</p>
                          <p className="text-sm text-gray-400">Qty: {item.quantity || 1}</p>
                              </div>
                        <p className="text-green-400 font-semibold">{formatCurrency(item.price)}</p>
                            </div>
                    ))}
                              </div>
                            </div>
              )}

              {/* Geo Info */}
              {selectedTx.vpn_geo && (
                <div className="pt-4 border-t border-gray-700">
                  <label className="text-sm text-gray-400">Location</label>
                  <p className="text-white">
                    <i className="fas fa-map-marker-alt mr-2 text-cyan-400"></i>
                    {selectedTx.vpn_geo}
                            </p>
                          </div>
              )}
            </div>
            </div>
          </div>
        )}
    </div>
  );
}
