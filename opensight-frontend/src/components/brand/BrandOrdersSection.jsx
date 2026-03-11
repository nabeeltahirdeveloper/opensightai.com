import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandOrdersSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    q: '',
    status: 'all'
  });
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadOrders();
  }, [state.page, state.q, state.status]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: String(state.page),
        pageSize: String(state.pageSize),
        ...(state.q ? { q: state.q } : {}),
        ...(state.status && state.status !== 'all' ? { status: state.status } : {})
      };
      
      const data = await serverApi.brand.orders.list(params);
      setOrders(data.orders || []);
      setMeta(data.meta || { page: 1, pages: 1, total: 0 });
      setState(prev => ({ ...prev, total: data.meta?.total || 0 }));
    } catch (error) {
      console.error('Failed to load orders:', error);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Orders</h2>
      </div>

      {/* Search and Filters */}
      <div className="glass-panel p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by order ID or customer email..."
            className="search-input p-3 rounded-lg"
            value={state.q}
            onChange={(e) => setState(prev => ({ ...prev, q: e.target.value, page: 1 }))}
          />
          <select
            className="search-input p-3 rounded-lg"
            value={state.status}
            onChange={(e) => setState(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel p-6">
        {loading ? (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead className="border-b border-gray-300">
                <tr className="text-gray-700">
                  <th className="text-left p-4">Order ID</th>
                  <th className="text-left p-4">Customer</th>
                  <th className="text-left p-4">Package</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Commission</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Commission Status</th>
                  <th className="text-left p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 mono text-sm text-gray-900">{order.order_id}</td>
                    <td className="p-4 text-gray-900">{order.email}</td>
                    <td className="p-4 text-sm text-gray-700">{getPackageDisplay(order.items)}</td>
                    <td className="p-4 font-semibold text-gray-900">${Number(order.amount_usd || order.total_amount || 0).toFixed(2)}</td>
                    <td className="p-4 text-blue-600 font-semibold">${Number(order.commission_amount || 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`status-badge ${
                        order.payment_status === 'paid' ? 'status-active' : 
                        order.payment_status === 'pending' ? 'status-pending' : 'status-inactive'
                      }`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`status-badge ${
                        order.commission_status === 'paid' ? 'status-active' : 'status-pending'
                      }`}>
                        {order.commission_status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && orders.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <button
              className="action-btn btn-secondary"
              onClick={() => state.page > 1 && setState(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={state.page <= 1}
            >
              <i className="fas fa-chevron-left mr-2"></i>Previous
            </button>
            <div className="text-sm text-gray-600">
              Page {meta.page} of {meta.pages} — {meta.total} total
            </div>
            <button
              className="action-btn btn-secondary"
              onClick={() => state.page < meta.pages && setState(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={state.page >= meta.pages}
            >
              Next<i className="fas fa-chevron-right ml-2"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

