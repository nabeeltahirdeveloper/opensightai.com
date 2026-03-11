import React, { useState, useEffect, useCallback } from 'react';
import { serverApi } from '@/api/serverApi';
import { transformPaymentMessage } from '@/utils/paymentMessages';
import { exportToCSV, formatDateForCSV, formatCurrencyForCSV } from '@/utils/csvExport';
import { getCurrencySymbol } from '@/utils/currency';

export default function BrandAllTransactionsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [geoFilter, setGeoFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [entriesPerPage, setEntriesPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAllTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (brandFilter && brandFilter !== 'all') params.brand = brandFilter;
      if (geoFilter && geoFilter !== 'all') params.geo = geoFilter;
      
      const result = await serverApi.brand.allTransactions.list(params);
      setData(result);
    } catch (error) {
      console.error('Failed to load all transactions:', error);
      setError(error.message || 'Failed to load all transactions');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [fromDate, toDate, statusFilter, brandFilter, geoFilter]);

  useEffect(() => {
    loadAllTransactions();
  }, [loadAllTransactions]);

  const handleRefresh = () => {
    loadAllTransactions(true);
  };

  const toggleRow = (txId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(txId)) {
      newExpanded.delete(txId);
    } else {
      newExpanded.add(txId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadgeClass = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'unpaid':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'refund':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'chargeback':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const symbol = getCurrencySymbol(currency);
    return `${Number(amount || 0).toFixed(2)}${symbol}`;
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

  // Get unique geos from transactions
  const getUniqueGeos = () => {
    if (!data?.transactions) return [];
    const geos = new Set();
    data.transactions.forEach(tx => {
      if (tx.vpn_geo) geos.add(tx.vpn_geo);
    });
    return Array.from(geos).sort();
  };

  // Filter transactions based on search query and payment method
  const filteredTransactions = data?.transactions?.filter(tx => {
    // Payment method filter
    if (paymentMethodFilter !== 'all') {
      const txMethod = (tx.payment_method || 'card').toLowerCase();
      if (txMethod !== paymentMethodFilter) return false;
    }
    
    // Search query filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.brand_name?.toLowerCase().includes(query) ||
      tx.email?.toLowerCase().includes(query) ||
      tx.first_name?.toLowerCase().includes(query) ||
      tx.last_name?.toLowerCase().includes(query) ||
      tx.order_id?.toLowerCase().includes(query)
    );
  }) || [];

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = filteredTransactions.map(tx => ({
      order_id: tx.order_id || '',
      date: formatDateForCSV(tx.created_at),
      brand_name: tx.brand_name || '',
      customer_name: `${tx.first_name || ''} ${tx.last_name || ''}`.trim(),
      email: tx.email || '',
      country: tx.billing_country || tx.vpn_geo || '',
      amount: formatCurrencyForCSV(tx.amount_usd || tx.total_amount, tx.currency || 'USD'),
      commission: formatCurrencyForCSV(tx.commission_amount, 'USD'),
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
      { key: 'amount', header: 'Amount' },
      { key: 'commission', header: 'Commission' },
      { key: 'commission_rate', header: 'Commission Rate' },
      { key: 'payment_method', header: 'Payment Method' },
      { key: 'payment_status', header: 'Payment Status' },
      { key: 'payment_message', header: 'Payment Message' },
      { key: 'items', header: 'Items' }
    ];

    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `brand-transactions-${dateStr}`, columns);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading all transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <i className="fas fa-exclamation-circle mr-2"></i>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card p-12 text-center">
        <i className="fas fa-receipt text-6xl text-gray-400 mb-4"></i>
        <h3 className="text-xl font-bold text-gray-700 mb-2">No Transactions</h3>
        <p className="text-gray-600">
          No transactions found.
        </p>
      </div>
    );
  }

  const { stats, child_brands } = data;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">All Transactions</h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Monitor all your transactions including network sales.
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
        <div className="glass-card p-4 md:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600">Total Order Amount</h3>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-dollar-sign text-blue-600 text-sm sm:text-base"></i>
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {formatCurrency(stats.total_order_amount)}
          </p>
        </div>

        <div className="glass-card p-4 md:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600">Rolling Reserve 10%</h3>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-chart-line text-orange-600 text-sm sm:text-base"></i>
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {formatCurrency(stats.rolling_reserve)}
          </p>
          <p className="text-xs text-gray-500 mt-1 hidden sm:block">(120 days)</p>
        </div>

        <div className="glass-card p-4 md:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600">Final Payout Amount</h3>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-wallet text-purple-600 text-sm sm:text-base"></i>
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {formatCurrency(stats.final_payout)}
          </p>
        </div>

        <div className="glass-card p-4 md:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600">Total Paid</h3>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-check-circle text-green-600 text-sm sm:text-base"></i>
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {formatCurrency(stats.total_paid)}
          </p>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="glass-card p-4 md:p-6 rounded-xl mb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Date Range Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="glass-card p-4 md:p-6 rounded-xl mb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Filter Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="rejected">Rejected</option>
              <option value="refund">Refund</option>
              <option value="chargeback">Chargeback</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand:</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Brands</option>
              {child_brands?.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Geo/Location:</label>
            <select
              value={geoFilter}
              onChange={(e) => setGeoFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Locations</option>
              {getUniqueGeos().map(geo => (
                <option key={geo} value={geo}>{geo}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method:</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="card">💳 Card</option>
              <option value="applepay">🍎 Apple Pay</option>
              <option value="googlepay">🔵 Google Pay</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="glass-card p-4 rounded-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="glass-card p-4 rounded-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          
          <div className="flex-1 w-full md:max-w-md">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table - Desktop */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-gray-700"></th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Brand Name</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">ID</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">First Name</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Last Name</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">GEO</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Order Amount</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Payment Method</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, entriesPerPage).map((tx) => (
                  <React.Fragment key={tx.id}>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-4">
                        <button
                          onClick={() => toggleRow(tx.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <i className={`fas fa-chevron-${expandedRows.has(tx.id) ? 'down' : 'right'}`}></i>
                        </button>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{tx.brand_name}</td>
                      <td className="p-4 text-gray-700 font-mono text-sm">#{tx.id}</td>
                      <td className="p-4 text-gray-700">{tx.first_name}</td>
                      <td className="p-4 text-gray-700">{tx.last_name}</td>
                      <td className="p-4 text-gray-700">{tx.email}</td>
                      <td className="p-4 text-gray-700 uppercase font-semibold">{tx.billing_country || 'N/A'}</td>
                      <td className="p-4 font-semibold text-gray-900">
                        {formatCurrency(tx.total_amount, tx.currency || 'USD')}
                        {tx.currency && tx.currency !== 'USD' && (
                          <span className="text-xs text-gray-500 ml-1">({tx.currency})</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">
                        {getPaymentMethodIcon(tx.payment_method)} {getPaymentMethodName(tx.payment_method)}
                      </td>
                      <td className="p-4 text-gray-700">{formatDate(tx.created_at)}</td>
                      <td className="p-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(tx.payment_status)}`}>
                          {tx.payment_status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                    
                    {expandedRows.has(tx.id) && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td colSpan="10" className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Customer Name:</p>
                                <p className="text-base font-semibold text-gray-900">
                                  {tx.first_name || tx.last_name 
                                    ? `${tx.first_name || ''} ${tx.last_name || ''}`.trim()
                                    : 'N/A'}
                                </p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Original Order:</p>
                                <p className="text-base font-semibold text-purple-600">
                                  {tx.currency && tx.currency !== 'USD' 
                                    ? `${formatCurrency(tx.total_amount, tx.currency)} (${tx.currency})`
                                    : formatCurrency(tx.total_amount, 'USD')}
                                </p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Order Amount USD:</p>
                                <p className="text-base font-semibold text-green-600">{formatCurrency(tx.order_amount_usd || tx.amount_usd || tx.total_amount, 'USD')}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">User IP:</p>
                                <p className="text-base font-mono text-gray-900">{tx.user_ip || 'N/A'}</p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-gray-600 mb-1">CARD BIN:</p>
                                <p className="text-base font-mono font-semibold text-gray-900">{tx.card_bin || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Phone:</p>
                                <p className="text-base font-semibold text-gray-900">{tx.phone || 'N/A'}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Commission (Brand Rate {tx.commission_rate || tx.brand_current_rate || 'N/A'}%):</p>
                                <p className="text-base font-semibold text-indigo-600">{formatCurrency(tx.commission_amount, 'USD')}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Rolling Reserve (10%):</p>
                                <p className="text-base font-semibold text-orange-600">{formatCurrency(tx.rolling_reserve_amount || 0, 'USD')}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Final Payout USD:</p>
                                <p className="text-base font-semibold text-blue-600">{formatCurrency(tx.payout_amount || 0, 'USD')}</p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Card Issuer:</p>
                                <p className="text-base font-semibold text-gray-900">{tx.card_issuer || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Order ID:</p>
                                <p className="text-base font-mono font-semibold text-gray-900">#{tx.order_id || tx.id}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">IP:</p>
                                <p className="text-base font-mono text-gray-900">{tx.user_ip || 'N/A'}</p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">VPN/PROXY:</p>
                                <p className="text-base font-semibold">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs ${tx.vpn_detected ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {tx.vpn_detected ? 'Detected' : 'Not Detected'}
                                  </span>
                                </p>
                              </div>
                              
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">IP GEO:</p>
                                <p className="text-base font-semibold text-gray-900">{tx.vpn_geo ? `${tx.vpn_geo}` : 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-6 pt-6 border-t border-gray-300">
                            <p className="text-sm text-gray-600 mb-2">Transaction Message:</p>
                            <p className={`text-base p-3 rounded-lg border whitespace-pre-line ${
                              tx.payment_message === 'Transaction succeeded' 
                                ? 'text-green-800 bg-green-50/50 border-green-200/50' 
                                : 'text-red-800 bg-red-50/50 border-red-200/50'
                            }`}>
                              {transformPaymentMessage(tx.payment_message) || 'No message available'}
                            </p>
                          </div>
                          
                          <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Action:</label>
                            <select
                              value={tx.payment_status}
                              disabled
                              className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                            >
                              <option value="paid">Paid</option>
                              <option value="unpaid">Unpaid</option>
                              <option value="rejected">Rejected</option>
                              <option value="refund">Refund</option>
                              <option value="chargeback">Chargeback</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Info */}
        {filteredTransactions.length > 0 && (
          <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              Showing 1 to {Math.min(entriesPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
            </p>
            
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                <i className="fas fa-angle-double-left"></i>
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                <i className="fas fa-angle-left"></i>
              </button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold">
                1
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                <i className="fas fa-angle-right"></i>
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                <i className="fas fa-angle-double-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredTransactions.length === 0 ? (
          <div className="glass-card p-8 text-center rounded-xl">
            <i className="fas fa-receipt text-4xl text-gray-400 mb-3"></i>
            <p className="text-gray-600">No transactions found</p>
          </div>
        ) : (
          filteredTransactions.slice(0, entriesPerPage).map((tx) => (
            <div key={tx.id} className="glass-card p-4 rounded-xl border border-gray-200">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => toggleRow(tx.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <i className={`fas fa-chevron-${expandedRows.has(tx.id) ? 'down' : 'right'}`}></i>
                    </button>
                    <span className="font-semibold text-gray-900 text-sm">{tx.brand_name}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">#{tx.id}</span>
                </div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(tx.payment_status)}`}>
                  {tx.payment_status || 'unknown'}
                </span>
              </div>

              {/* Main Info */}
              <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-gray-200">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Order Amount</div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {formatCurrency(tx.total_amount, tx.currency || 'USD')}
                    {tx.currency && tx.currency !== 'USD' && (
                      <span className="text-xs text-gray-500 ml-1">({tx.currency})</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Date</div>
                  <div className="text-gray-700 text-sm">{formatDate(tx.created_at)}</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Customer</div>
                  <div className="text-gray-700 text-sm">
                    {tx.first_name || tx.last_name 
                      ? `${tx.first_name || ''} ${tx.last_name || ''}`.trim()
                      : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-600 break-all">{tx.email}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Location</div>
                  <div className="text-gray-700 text-sm uppercase font-semibold">{tx.billing_country || 'N/A'}</div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRows.has(tx.id) && (
                <div className="mt-4 pt-4 border-t border-gray-300 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Original Order</div>
                      <div className="font-semibold text-purple-600 text-sm">
                        {tx.currency && tx.currency !== 'USD' 
                          ? `${formatCurrency(tx.total_amount, tx.currency)} (${tx.currency})`
                          : formatCurrency(tx.total_amount, 'USD')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">USD Amount</div>
                      <div className="font-semibold text-green-600 text-sm">{formatCurrency(tx.order_amount_usd || tx.amount_usd || tx.total_amount, 'USD')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Commission</div>
                      <div className="font-semibold text-indigo-600 text-sm">{formatCurrency(tx.commission_amount, 'USD')}</div>
                      <div className="text-xs text-gray-500 mt-1">Rate: {tx.commission_rate || tx.brand_current_rate || 'N/A'}%</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rolling Reserve</div>
                      <div className="font-semibold text-orange-600 text-sm">{formatCurrency(tx.rolling_reserve_amount || 0, 'USD')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Final Payout</div>
                      <div className="font-semibold text-blue-600 text-sm">{formatCurrency(tx.payout_amount || 0, 'USD')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">VPN/PROXY</div>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${tx.vpn_detected ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {tx.vpn_detected ? 'Detected' : 'Not Detected'}
                      </span>
                    </div>
                  </div>

                  {tx.phone && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Phone</div>
                      <div className="text-gray-700 text-sm">{tx.phone}</div>
                    </div>
                  )}

                  {(tx.user_ip || tx.card_bin || tx.card_issuer) && (
                    <div className="grid grid-cols-2 gap-4">
                      {tx.user_ip && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">User IP</div>
                          <div className="text-gray-700 text-xs font-mono break-all">{tx.user_ip}</div>
                        </div>
                      )}
                      {tx.card_bin && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Card BIN</div>
                          <div className="text-gray-700 text-xs font-mono">{tx.card_bin}</div>
                        </div>
                      )}
                      {tx.card_issuer && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Card Issuer</div>
                          <div className="text-gray-700 text-xs">{tx.card_issuer}</div>
                        </div>
                      )}
                      {tx.vpn_geo && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">IP GEO</div>
                          <div className="text-gray-700 text-xs">{tx.vpn_geo}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {tx.payment_message && (
                    <div className="pt-3 border-t border-gray-300">
                      <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Transaction Message</div>
                      <p className={`text-sm p-3 rounded-lg border whitespace-pre-line ${
                        tx.payment_message === 'Transaction succeeded' 
                          ? 'text-green-800 bg-green-50/50 border-green-200/50' 
                          : 'text-red-800 bg-red-50/50 border-red-200/50'
                      }`}>
                        {transformPaymentMessage(tx.payment_message) || 'No message available'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {filteredTransactions.length > 0 && (
          <div className="glass-card p-4 rounded-xl border border-gray-200">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-600 text-center">
                Showing 1 to {Math.min(entriesPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
              </p>
              
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                  <i className="fas fa-angle-left"></i>
                </button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold">
                  1
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                  <i className="fas fa-angle-right"></i>
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

