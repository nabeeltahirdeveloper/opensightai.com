import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';
import OrderModal from './OrderModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load saved date filters from localStorage on mount
  const loadSavedDateFilters = () => {
    try {
      const saved = localStorage.getItem('adminOrdersDateFilters');
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

  const [state, setState] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    q: '',
    status: 'all',
    pkg: '',
    fromDate: savedFilters.fromDate,
    toDate: savedFilters.toDate
  });
  const [searchQuery, setSearchQuery] = useState(''); // Local search input value (debounced to state.q)
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [modalState, setModalState] = useState({
    show: false,
    mode: null, // 'view', 'edit', 'create'
    order: null,
    loading: false
  });
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    orderId: null
  });

  // Save date filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('adminOrdersDateFilters', JSON.stringify({
        fromDate: state.fromDate,
        toDate: state.toDate
      }));
    } catch (e) {
      console.warn('Failed to save date filters:', e);
    }
  }, [state.fromDate, state.toDate]);

  // Handle search - only triggered when search icon is clicked or Enter is pressed
  const handleSearch = () => {
    setState(prev => ({ ...prev, q: searchQuery.trim(), page: 1 }));
  };

  // Handle Enter key in search input
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle all filter changes - date filters will be disabled during loading
  useEffect(() => {
    loadOrders();
  }, [state.page, state.q, state.status, state.pkg, state.fromDate, state.toDate]);

  const formatDateForAPI = (dateStr, isEndOfDay = false) => {
    if (!dateStr) return '';

    // Parse date string directly (YYYY-MM-DD format from HTML date input)
    // Split by '-' to avoid timezone issues with Date object
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      console.warn(`[formatDateForAPI] Invalid date format: ${dateStr}`);
      return '';
    }

    const [year, month, day] = parts;

    if (isEndOfDay) {
      // For end date: send the end of the selected day in UTC (23:59:59.999Z)
      // Using Z to indicate UTC timezone to match database storage format
      const endDateString = `${year}-${month}-${day}T23:59:59.999Z`;
      console.log(`[formatDateForAPI] End date: ${dateStr} -> sending end of day (UTC): ${endDateString}`);
      return endDateString;
    } else {
      // For start date: send the start of the selected day in UTC (00:00:00.000Z)
      // Using Z to indicate UTC timezone to match database storage format
      const startDateString = `${year}-${month}-${day}T00:00:00.000Z`;
      console.log(`[formatDateForAPI] Start date: ${dateStr} -> sending (UTC): ${startDateString}`);
      return startDateString;
    }
  };

  const loadOrders = async () => {
    setLoading(true);

    try {
      const params = {
        page: String(state.page),
        pageSize: String(state.pageSize),
        ...(state.q ? { q: state.q } : {}),
        ...(state.status && state.status !== 'all' ? { status: state.status } : {}),
        ...(state.pkg ? { package: state.pkg } : {}),
        ...(state.fromDate ? { from: formatDateForAPI(state.fromDate, false) } : {}),
        ...(state.toDate ? { to: formatDateForAPI(state.toDate, true) } : {})
      };

      console.log('[OrdersSection] Loading orders with params:', params);

      const data = await serverApi.admin.orders.list(params);

      console.log('[OrdersSection] Received orders:', data.orders?.length || 0, 'Total:', data.meta?.total || 0);

      setOrders(data.orders || []);
      setMeta(data.meta || { page: 1, pages: 1, total: 0 });
      setState(prev => ({ ...prev, total: data.meta?.total || 0 }));

    } catch (error) {
      console.error('Failed to load orders:', error);
      alert('⚠️ Failed to load orders. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const getPackageDisplay = (items) => {
    try {
      const arr = Array.isArray(items) ? items : [];
      const p = arr.find(it => (it?.type || '').toLowerCase() === 'package');
      const c = arr.find(it => (it?.type || '').toLowerCase() === 'credits');
      const pkgName = p ? (p.name || p.id || 'Package') : '';
      const credits = c ? (c.unlimited ? 'Unlimited' : (c.credits ? `${c.credits} Credits` : '')) : '';
      return [pkgName, credits].filter(Boolean).join(' - ');
    } catch (e) {
      return '';
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'status-active';
    if (s === 'pending') return 'status-pending';
    return 'status-inactive';
  };

  const getStatusLabel = (order) => {
    // Check payment_message for success
    if (order.payment_message === 'Transaction succeeded') {
      return 'Approved';
    }

    const s = (order.payment_status || '').toLowerCase();
    if (s === 'unpaid') return 'Unpaid';
    if (s === 'pending') return 'Pending';
    if (s === 'cancelled' || s === 'failed' || s === 'rejected') return 'Declined';
    return order.payment_status || 'Unknown';
  };

  const formatOrderDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      }).format(date).replace(',', ''); // en-GB inserts comma by default
    } catch (err) {
      console.warn('[formatOrderDate] Failed to format date:', dateString, err);
      return dateString;
    }
  };

  const openDeleteModal = (orderId) => {
    setDeleteModal({ show: true, orderId });
  };

  const confirmDelete = async () => {
    try {
      await serverApi.admin.orders.delete(deleteModal.orderId);
      setDeleteModal({ show: false, orderId: null });
      loadOrders();
    } catch (error) {
      console.error('Failed to delete order:', error);
      alert('❌ Failed to delete order: ' + error.message);
      setDeleteModal({ show: false, orderId: null });
    }
  };

  const viewOrder = async (orderId) => {
    // Show modal immediately with loading state
    setModalState({ show: true, mode: 'view', order: null, loading: true });

    try {
      const data = await serverApi.admin.orders.get(orderId);
      setModalState({ show: true, mode: 'view', order: data.order, loading: false });
    } catch (error) {
      console.error('Failed to view order:', error);
      setModalState({ show: false, mode: null, order: null, loading: false });
      alert('❌ Failed to load order details');
    }
  };

  const editOrder = async (orderId) => {
    // Show modal immediately with loading state
    setModalState({ show: true, mode: 'edit', order: null, loading: true });

    try {
      const data = await serverApi.admin.orders.get(orderId);
      setModalState({ show: true, mode: 'edit', order: data.order, loading: false });
    } catch (error) {
      console.error('Failed to load order:', error);
      setModalState({ show: false, mode: null, order: null, loading: false });
      alert('❌ Failed to load order details');
    }
  };

  const createOrder = () => {
    setModalState({ show: true, mode: 'create', order: null, loading: false });
  };

  const closeModal = () => {
    setModalState({ show: false, mode: null, order: null, loading: false });
  };

  const handleOrderSuccess = () => {
    loadOrders();
  };

  // Calculate status counts based on loaded orders
  const approvedCount = orders.filter(o => o.payment_message === 'Transaction succeeded').length;
  const unpaidCount = orders.filter(o => o.payment_message !== 'Transaction succeeded' && o.payment_status === 'unpaid').length;
  const declineCount = orders.filter(o =>
    o.payment_message !== 'Transaction succeeded' &&
    ['cancelled', 'rejected', 'failed', 'paid'].includes((o.payment_status || '').toLowerCase())
  ).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold gradient-text">Order Management</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <button className="action-btn btn-primary w-full sm:w-auto" onClick={createOrder}>
            <i className="fas fa-plus mr-2"></i>Add Order
          </button>
          <button className="action-btn btn-danger w-full sm:w-auto" onClick={() => window.location.href = '/dashboard'}>
            <i className="fas fa-arrow-left mr-2"></i>Switch to User Dashboard
          </button>
        </div>
      </div>

      {/* Status Count Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Approved Transactions</p>
              <p className="text-3xl font-bold text-green-400">{approvedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-check-circle text-2xl text-green-400"></i>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Unpaid Transactions</p>
              <p className="text-3xl font-bold text-blue-400">{unpaidCount}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-clock text-2xl text-blue-400"></i>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Declined Transactions</p>
              <p className="text-3xl font-bold text-red-400">{declineCount}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <i className="fas fa-times-circle text-2xl text-red-400"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-panel p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search orders by email, name, order ID..."
              className="search-input p-3 pr-12 rounded-lg w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
            <button
              type="button"
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Search"
            >
              <i className="fas fa-search"></i>
            </button>
          </div>
          <select
            className="search-input p-3 rounded-lg"
            value={state.status}
            onChange={(e) => setState(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          >
            <option value="all">All Status</option>
            <option value="paid">Approved</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="search-input p-3 rounded-lg"
            value={state.pkg}
            onChange={(e) => setState(prev => ({ ...prev, pkg: e.target.value, page: 1 }))}
          >
            <option value="">All Packages</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
          <input
            type="date"
            placeholder="From Date"
            className="search-input p-3 rounded-lg"
            value={state.fromDate}
            onChange={(e) => setState(prev => ({ ...prev, fromDate: e.target.value, page: 1 }))}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          />
          <input
            type="date"
            placeholder="To Date"
            className="search-input p-3 rounded-lg"
            value={state.toDate}
            onChange={(e) => setState(prev => ({ ...prev, toDate: e.target.value, page: 1 }))}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel p-6 flex flex-col" style={{ height: 'calc(100vh - 450px)', minHeight: '500px' }}>
        {loading ? (
          <div className="text-center py-12 flex-1 flex items-center justify-center">
            <div>
              <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
              <p className="text-gray-400">Loading orders...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="table-container flex-1 overflow-y-auto" style={{ minHeight: 0, maxHeight: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <table className="w-full" style={{ display: 'table' }}>
                <thead className="border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
                  <tr>
                    <th className="text-left p-4">Customer Email</th>
                    <th className="text-left p-4">Full Name</th>
                    <th className="text-left p-4">Brand Name</th>
                    <th className="text-left p-4">Reseller Name</th>
                    <th className="text-left p-4">Package</th>
                    <th className="text-left p-4">Amount</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Date</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-4" data-label="Customer Email">{order.email || ''}</td>
                      <td className="p-4" data-label="Full Name">{order.full_name || '-'}</td>
                      <td className="p-4" data-label="Brand Name">{order.brand_name || '-'}</td>
                      <td className="p-4" data-label="Reseller Name">{order.reseller_name || '-'}</td>
                      <td className="p-4" data-label="Package">{getPackageDisplay(order.items)}</td>
                      <td className="p-4" data-label="Amount">${Number(order.total_amount || 0)}</td>
                      <td className="p-4" data-label="Status">
                        <span className={`status-badge ${getStatusBadge(order.payment_status)}`}>
                          {getStatusLabel(order)}
                        </span>
                      </td>
                      <td className="p-4" data-label="Date">{formatOrderDate(order.created_at)}</td>
                      <td className="p-4" data-label="Actions">
                        <div className="flex space-x-2">
                          <button
                            className="action-btn btn-secondary"
                            onClick={() => viewOrder(order.order_id)}
                            title="View order details"
                          >
                            View
                          </button>
                          <button
                            className="action-btn btn-primary"
                            onClick={() => editOrder(order.order_id)}
                            title="Edit order"
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn btn-danger"
                            onClick={() => openDeleteModal(order.order_id)}
                            title="Delete order"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && !loading && (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-gray-400">
                        {state.q
                          ? `No orders match "${state.q}".`
                          : 'No orders found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!loading && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 pt-4 mt-auto border-t border-gray-700">
                <button
                  className="action-btn btn-secondary w-full sm:w-auto"
                  onClick={() => state.page > 1 && setState(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={state.page <= 1}
                >
                  Prev
                </button>
                <div className="text-sm text-gray-400 text-center order-first sm:order-none">
                  Page {meta.page} of {meta.pages} — {meta.total} total
                </div>
                <button
                  className="action-btn btn-secondary w-full sm:w-auto"
                  onClick={() => state.page < meta.pages && setState(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={state.page >= meta.pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Modal */}
      {modalState.show && (
        <OrderModal
          order={modalState.order}
          mode={modalState.mode}
          onClose={closeModal}
          onSuccess={handleOrderSuccess}
          loading={modalState.loading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <DeleteConfirmModal
          title="Delete Order"
          message={`Are you sure you want to delete order ${deleteModal.orderId}? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal({ show: false, orderId: null })}
        />
      )}
    </div>
  );
}
