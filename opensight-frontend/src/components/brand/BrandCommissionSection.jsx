import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandCommissionSection() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissionData();
  }, []);

  const loadCommissionData = async () => {
    setLoading(true);
    try {
      const [statsData, ordersData] = await Promise.all([
        serverApi.brand.dashboard.getStats(),
        serverApi.brand.orders.list({ pageSize: '100' })
      ]);

      setStats(statsData.stats);
      setOrders(ordersData.orders || []);
    } catch (error) {
      console.error('Failed to load commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading commission data...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Commission Tracking</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600">Total Earned</h3>
            <i className="fas fa-coins text-blue-500 text-xl"></i>
          </div>
          <p className="text-3xl font-bold text-gray-900">${Number(stats?.total_commission || 0).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600">Pending</h3>
            <i className="fas fa-clock text-yellow-500 text-xl"></i>
          </div>
          <p className="text-3xl font-bold text-yellow-600">${Number(stats?.pending_commission || 0).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting payout</p>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600">Paid Out</h3>
            <i className="fas fa-check-circle text-green-500 text-xl"></i>
          </div>
          <p className="text-3xl font-bold text-green-600">${Number(stats?.paid_commission || 0).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Successfully paid</p>
        </div>
      </div>

      {/* Commission Info */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Commission Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Your Commission Rate</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.commission_rate || 10}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.total_orders || 0}</p>
          </div>
        </div>
      </div>

      {/* Commission History */}
      <div className="glass-panel p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Commission History</h3>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No commission history yet</p>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead className="border-b border-gray-300">
                <tr className="text-gray-700">
                  <th className="text-left p-4">Order ID</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Order Amount</th>
                  <th className="text-left p-4">Commission</th>
                  <th className="text-left p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 mono text-sm text-gray-900">{order.order_id}</td>
                    <td className="p-4 text-sm text-gray-700">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-gray-900">${Number(order.amount_usd || order.total_amount || 0).toFixed(2)}</td>
                    <td className="p-4 font-semibold text-blue-600">
                      ${Number(order.commission_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`status-badge ${
                        order.commission_status === 'paid' ? 'status-active' : 'status-pending'
                      }`}>
                        {order.commission_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Info */}
      <div className="glass-panel p-6 mt-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Payout Information</h3>
        <p className="text-gray-700 mb-4">
          Commissions are reviewed and paid out monthly. If you have any questions about your payouts, please contact support.
        </p>
        <button className="action-btn btn-primary">
          <i className="fas fa-envelope mr-2"></i>
          Contact Support
        </button>
      </div>
    </div>
  );
}

