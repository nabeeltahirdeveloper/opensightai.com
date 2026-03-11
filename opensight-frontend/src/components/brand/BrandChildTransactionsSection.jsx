import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandChildTransactionsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadChildTransactions();
  }, []);

  const loadChildTransactions = async () => {
    setLoading(true);
    try {
      const result = await serverApi.brand.childTransactions.list();
      setData(result);
    } catch (error) {
      console.error('Failed to load child transactions:', error);
      setError('Failed to load child transactions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
        <p className="text-gray-400">Loading child transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
        <i className="fas fa-exclamation-circle mr-2"></i>
        {error}
      </div>
    );
  }

  if (!data || data.child_brands.length === 0) {
    return (
      <div className="glass-panel p-12 text-center">
        <i className="fas fa-sitemap text-6xl text-gray-600 mb-4"></i>
        <h3 className="text-xl font-bold text-gray-300 mb-2">No Child Brands</h3>
        <p className="text-gray-400">
          You don't have any child brands yet. Contact your administrator to set up child brands.
        </p>
      </div>
    );
  }

  const { stats, transactions, child_brands } = data;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold gradient-text mb-2">Child Brand Transactions</h2>
        <p className="text-gray-400">
          View and manage transactions from all your child brands
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Paid</h3>
            <i className="fas fa-dollar-sign text-cyan-400"></i>
          </div>
          <p className="text-3xl font-bold text-cyan-400">
            ${Number(stats.total_paid || 0).toFixed(2)}
          </p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Final Payout</h3>
            <i className="fas fa-money-bill-wave text-green-400"></i>
          </div>
          <p className="text-3xl font-bold text-green-400">
            ${Number(stats.final_payout || 0).toFixed(2)}
          </p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Rolling Reserve (10%)</h3>
            <i className="fas fa-shield-alt text-yellow-400"></i>
          </div>
          <p className="text-3xl font-bold text-yellow-400">
            ${Number(stats.rolling_reserve || 0).toFixed(2)}
          </p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Transactions</h3>
            <i className="fas fa-receipt text-purple-400"></i>
          </div>
          <p className="text-3xl font-bold text-purple-400">
            {stats.total_transactions || 0}
          </p>
        </div>
      </div>

      {/* Child Brands Info */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-200 mb-4">
          <i className="fas fa-sitemap mr-2"></i>
          Child Brands ({child_brands.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {child_brands.map(brand => (
            <div key={brand.id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="font-semibold text-gray-200">{brand.name}</div>
              <div className="text-sm text-gray-400 mt-1">{brand.email}</div>
              <div className="text-xs text-cyan-400 mt-2">
                Commission: {brand.commission_rate}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="glass-panel p-6">
        <h3 className="text-xl font-bold text-gray-200 mb-4">
          <i className="fas fa-list mr-2"></i>
          Transactions
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No transactions yet from child brands
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr className="text-gray-400 text-sm">
                  <th className="text-left p-4">Order ID</th>
                  <th className="text-left p-4">Child Brand</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Commission</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4 font-mono text-sm text-gray-300">
                      {tx.order_id}
                    </td>
                    <td className="p-4 text-gray-200">
                      {tx.brand_name}
                    </td>
                    <td className="p-4 text-gray-300">
                      {tx.email}
                    </td>
                    <td className="p-4 font-semibold text-cyan-400">
                      ${Number(tx.amount_usd || tx.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4 font-semibold text-green-400">
                      ${Number(tx.commission_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        tx.payment_status === 'paid' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {tx.payment_status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString()}
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


