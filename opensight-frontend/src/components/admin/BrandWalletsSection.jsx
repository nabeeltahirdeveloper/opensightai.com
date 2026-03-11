import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandWalletsSection() {
  const [brandWallets, setBrandWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('brands'); // 'brands' or 'resellers'

  useEffect(() => {
    loadBrandWallets();
  }, []);

  const loadBrandWallets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) {
        params.q = searchQuery;
      }
      
      const data = await serverApi.admin.brandWallets.list(params);
      setBrandWallets(data.brandWallets || []);
    } catch (error) {
      console.error('Failed to load brand wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadBrandWallets();
  };

  const copyToClipboard = (text, brandId) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedWallet(brandId);
      setTimeout(() => setCopiedWallet(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const getSettlementBadge = (method) => {
    if (!method) return <span className="status-badge status-inactive">Not Set</span>;
    if (method === 'crypto') return <span className="status-badge status-active">Crypto</span>;
    if (method === 'fiat') return <span className="status-badge status-pending">FIAT</span>;
    return <span className="status-badge status-inactive">{method}</span>;
  };

  // Filter data based on active tab
  const filteredWallets = brandWallets.filter(b => {
    if (activeTab === 'brands') {
      return b.account_type === 'brand';
    } else {
      return b.account_type === 'reseller';
    }
  });

  // Calculate stats for current tab
  const stats = {
    total: filteredWallets.length,
    crypto: filteredWallets.filter(b => b.settlement_method === 'crypto').length,
    fiat: filteredWallets.filter(b => b.settlement_method === 'fiat').length
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold gradient-text mb-2">Settlement Wallets</h2>
        <p className="text-gray-400">View all brand and reseller settlement information for payouts</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="glass-panel p-1 inline-flex rounded-lg">
          <button
            onClick={() => setActiveTab('brands')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'brands'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <i className="fas fa-building mr-2"></i>
            Brands
          </button>
          <button
            onClick={() => setActiveTab('resellers')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === 'resellers'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <i className="fas fa-users mr-2"></i>
            Resellers
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">
            Total {activeTab === 'brands' ? 'Brands' : 'Resellers'}
          </h3>
          <p className="text-3xl font-bold text-cyan-400">{stats.total}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Crypto Wallets</h3>
          <p className="text-3xl font-bold text-green-400">{stats.crypto}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Bank Accounts</h3>
          <p className="text-3xl font-bold text-yellow-400">{stats.fiat}</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder={`Search ${activeTab === 'brands' ? 'brands' : 'resellers'} by name or username...`}
            className="search-input p-3 rounded-lg flex-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="action-btn btn-primary px-6"
          >
            <i className="fas fa-search mr-2"></i>Search
          </button>
        </div>
      </div>

      {/* Wallets Table */}
      <div className="glass-panel p-6">
        {loading ? (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
            <p className="text-gray-400">Loading {activeTab === 'brands' ? 'brand' : 'reseller'} wallets...</p>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-wallet text-4xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">No {activeTab === 'brands' ? 'brand' : 'reseller'} wallets found.</p>
            <p className="text-gray-500 text-sm mt-2">
              {activeTab === 'brands' ? 'Brands' : 'Resellers'} need to configure their settlement methods in their settings.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left p-4">{activeTab === 'brands' ? 'Brand' : 'Reseller'}</th>
                  <th className="text-left p-4">Username</th>
                  <th className="text-left p-4">Settlement Method</th>
                  <th className="text-left p-4">Crypto Wallet</th>
                  <th className="text-left p-4">Bank Details</th>
                  <th className="text-left p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredWallets.map((brand) => (
                  <tr key={brand.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4" data-label="Brand">
                      <div className="flex items-center gap-3">
                        {brand.logo_url ? (
                          <img 
                            src={brand.logo_url} 
                            alt={brand.name} 
                            className="w-10 h-10 rounded object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {brand.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white">{brand.name || 'N/A'}</div>
                          {brand.website && (
                            <a 
                              href={brand.website} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs text-cyan-400 hover:underline"
                            >
                              {brand.website.replace(/^https?:\/\//, '').substring(0, 30)}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 mono font-semibold text-cyan-400" data-label="Username">
                      {brand.username || '-'}
                    </td>
                    <td className="p-4" data-label="Settlement Method">
                      {getSettlementBadge(brand.settlement_method)}
                    </td>
                    <td className="p-4" data-label="Crypto Wallet">
                      {brand.settlement_crypto_wallet ? (
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-800/50 px-2 py-1 rounded text-cyan-300">
                            {brand.settlement_crypto_wallet.substring(0, 10)}...
                            {brand.settlement_crypto_wallet.substring(brand.settlement_crypto_wallet.length - 8)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(brand.settlement_crypto_wallet, brand.id)}
                            className="action-btn btn-secondary text-xs py-1 px-2"
                            title="Copy full address"
                          >
                            {copiedWallet === brand.id ? (
                              <><i className="fas fa-check mr-1"></i>Copied</>
                            ) : (
                              <><i className="fas fa-copy mr-1"></i>Copy</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4" data-label="Bank Details">
                      {brand.settlement_method === 'fiat' && brand.settlement_bank_holder ? (
                        <div className="text-sm">
                          <div className="text-white font-medium">{brand.settlement_bank_holder}</div>
                          {brand.settlement_bank_name && (
                            <div className="text-gray-400">{brand.settlement_bank_name}</div>
                          )}
                          {brand.settlement_bank_iban && (
                            <div className="text-xs text-gray-500 mono">{brand.settlement_bank_iban}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4" data-label="Status">
                      <span className={`status-badge ${brand.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                        {brand.status || 'active'}
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

