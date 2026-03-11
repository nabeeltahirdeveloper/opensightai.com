import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandAnalyticsSection() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await serverApi.brand.analytics.get({ days: String(days) });
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
        <p className="text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">Analytics</h2>
        <select
          className="search-input p-3 rounded-lg"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Revenue Over Time */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Revenue & Commission Trends</h3>
        {analytics?.revenue_over_time && analytics.revenue_over_time.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Orders</th>
                  <th className="text-left p-3">Revenue</th>
                  <th className="text-left p-3">Commission</th>
                </tr>
              </thead>
              <tbody>
                {analytics.revenue_over_time.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="p-3">{row.orders}</td>
                    <td className="p-3 text-green-400">${Number(row.revenue).toFixed(2)}</td>
                    <td className="p-3 text-purple-400">${Number(row.commission).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No data available for selected period</p>
        )}
      </div>

      {/* Top Customers */}
      <div className="glass-panel p-6">
        <h3 className="text-xl font-semibold mb-4">Top Customers</h3>
        {analytics?.top_customers && analytics.top_customers.length > 0 ? (
          <div className="space-y-3">
            {analytics.top_customers.map((customer, idx) => (
              <div key={idx} className="glass-card p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">{customer.email}</p>
                  <p className="text-sm text-gray-400">{customer.order_count} orders</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-400">${Number(customer.total_spent).toFixed(2)}</p>
                  <p className="text-sm text-purple-400">Commission: ${Number(customer.total_commission).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No customers yet</p>
        )}
      </div>
    </div>
  );
}

