import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';
import ResellerBrandModal from './ResellerBrandModal';

export default function ResellerNetworkSection() {
  const [brands, setBrands] = useState([]);
  const [networkStats, setNetworkStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    loadNetworkData();
  }, [fromDate, toDate]);

  const loadNetworkData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const [brandsData, transactionsData] = await Promise.all([
        serverApi.reseller.network.brands(params),
        serverApi.reseller.network.transactions(params)
      ]);

      setBrands(brandsData.brands || []);
      setNetworkStats(transactionsData.stats || {});
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i>
        <p className="text-gray-600">Loading network data...</p>
      </div>
    );
  }

  const totalNetworkSales = Number(networkStats?.total_sales || 0);
  const totalNetworkCommission = Number(networkStats?.total_commission || 0);
  const totalNetworkOrders = Number(networkStats?.total_orders || 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Network Overview</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your network of child brands</p>
        </div>
        <button
          onClick={() => setShowBrandModal(true)}
          className="action-btn btn-primary px-6 py-3 flex items-center justify-center gap-2"
        >
          <i className="fas fa-plus"></i>
          <span>Add New Brand</span>
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="glass-card p-4 md:p-6 rounded-xl mb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Network Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6">
        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon visits" style={{ background: '#F3E8FF' }}>
              <i className="fas fa-sitemap" style={{ color: '#9333EA' }}></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Child Brands</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{brands.length}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">
              {brands.length > 0 ? 'Total active brands' : 'No brands yet'}
            </span>
          </div>
        </div>

        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon transactions">
              <i className="fas fa-shopping-cart"></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Network Orders</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{totalNetworkOrders}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">
              {totalNetworkOrders > 0 ? 'Across all brands' : 'No orders yet'}
            </span>
          </div>
        </div>

        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon payouts">
              <i className="fas fa-dollar-sign"></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Reseller Part</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">${totalNetworkCommission.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">
              {totalNetworkCommission > 0 ? 'Total earned' : 'No commissions yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Child Brands Table */}
      <div className="glass-card p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          <i className="fas fa-network-wired mr-2 text-purple-600"></i>
          Child Brands
        </h3>
        
        {brands.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-sitemap text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-600">No child brands in your network yet</p>
            <p className="text-sm text-gray-500 mt-1">Contact your administrator to add brands to your network</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Brand Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Orders Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Rolling Reserve</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Brand Part</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Reseller Part</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand, index) => {
                    const brandCommission = Number(brand.total_brand_part || 0);
                    const rollingReserve = Number(brand.rolling_reserve || 0);
                    const finalBrandPayout = brandCommission - rollingReserve;
                    
                    return (
                      <tr key={brand.id || index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            {brand.logo_url ? (
                              <img 
                                src={brand.logo_url} 
                                alt={brand.name} 
                                className="w-8 h-8 rounded mr-3 object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded mr-3 bg-purple-100 flex items-center justify-center">
                                <i className="fas fa-store text-purple-600 text-xs"></i>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{brand.name}</p>
                              {brand.slug && (
                                <p className="text-xs text-gray-500">@{brand.slug}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            brand.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {brand.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900">
                          {brand.total_orders || 0}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900">
                          ${Number(brand.total_revenue || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-orange-600">
                          ${rollingReserve.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-blue-600">
                          ${finalBrandPayout.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-green-600">
                          ${Number(brand.total_reseller_part || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {brands.map((brand, index) => {
                const brandCommission = Number(brand.total_brand_part || 0);
                const rollingReserve = Number(brand.rolling_reserve || 0);
                const finalBrandPayout = brandCommission - rollingReserve;
                
                return (
                  <div key={brand.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        {brand.logo_url ? (
                          <img 
                            src={brand.logo_url} 
                            alt={brand.name} 
                            className="w-10 h-10 rounded mr-3 object-cover flex-shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded mr-3 bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-store text-purple-600 text-xs"></i>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{brand.name}</p>
                          {brand.slug && (
                            <p className="text-xs text-gray-500">@{brand.slug}</p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                        brand.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {brand.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Orders</div>
                        <div className="text-sm font-semibold text-gray-900">{brand.total_orders || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Orders Amount</div>
                        <div className="text-sm font-semibold text-gray-900">${Number(brand.total_revenue || 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rolling Reserve</div>
                        <div className="text-sm font-semibold text-orange-600">${rollingReserve.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Brand Part</div>
                        <div className="text-sm font-semibold text-blue-600">${finalBrandPayout.toFixed(2)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Reseller Part</div>
                        <div className="text-sm font-semibold text-green-600">${Number(brand.total_reseller_part || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Network-wide Transactions Summary */}
      <div className="glass-card p-4 md:p-6 mt-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          <i className="fas fa-chart-bar mr-2 text-purple-600"></i>
          Network Transactions Summary
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="flex justify-between items-center p-3 md:p-4 bg-gray-50 rounded-lg">
            <span className="text-sm md:text-base text-gray-700">Total Sales</span>
            <span className="text-gray-900 font-bold text-lg md:text-xl">${totalNetworkSales.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-3 md:p-4 bg-gray-50 rounded-lg">
            <span className="text-sm md:text-base text-gray-700">Total Orders</span>
            <span className="text-gray-900 font-bold text-lg md:text-xl">{totalNetworkOrders}</span>
          </div>
          <div className="flex justify-between items-center p-3 md:p-4 bg-green-50 rounded-lg sm:col-span-2 lg:col-span-1">
            <span className="text-sm md:text-base text-gray-700">Total Reseller Part</span>
            <span className="text-green-600 font-bold text-lg md:text-xl">${totalNetworkCommission.toFixed(2)}</span>
          </div>
        </div>

        {brands.length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              <i className="fas fa-info-circle mr-2"></i>
              These statistics include all transactions from your {brands.length} child brand{brands.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Brand Creation Modal */}
      {showBrandModal && (
        <ResellerBrandModal
          mode="create"
          onClose={() => setShowBrandModal(false)}
          onSuccess={() => {
            setShowBrandModal(false);
            loadNetworkData(); // Reload brands list
          }}
        />
      )}
    </div>
  );
}

