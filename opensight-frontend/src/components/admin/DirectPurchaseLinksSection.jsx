import React, { useState, useEffect, useMemo } from 'react';
import { serverApi } from '@/api/serverApi';

// Get checkout base URL
const getCheckoutBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5174';
    }
    if (hostname.includes('OpenSightai.com')) {
      return 'https://pay.OpenSightai.com';
    }
    return 'https://pay.OpenSightai.com';
  }
  return 'https://pay.OpenSightai.com';
};

export default function DirectPurchaseLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    loadBrands();
    loadLinks();
  }, []);

  useEffect(() => {
    loadLinks();
  }, [selectedBrandId]);

  const stats = useMemo(() => {
    const total = links.length;
    const active = links.filter(link => link.is_active).length;
    const visits = links.reduce((sum, link) => sum + Number(link.visits_count || 0), 0);
    return { total, active, visits };
  }, [links]);

  const loadBrands = async () => {
    try {
      const data = await serverApi.admin.brands.list();
      setBrands(data.brands || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
    }
  };

  const loadLinks = async () => {
    setLoading(true);
    try {
      const params = selectedBrandId ? { brand_id: selectedBrandId } : {};
      const data = await serverApi.admin.directPurchaseLinks.list(params);
      setLinks(data.links || []);
    } catch (err) {
      console.error('Failed to load direct purchase links:', err);
      setError('Failed to load direct purchase links');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Link copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const getPurchaseUrl = (link) => {
    const baseUrl = getCheckoutBaseUrl();
    return `${baseUrl}/direct-purchase/${link.link_id}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Direct Purchase Links</h2>
          <p className="text-gray-400">
            Monitor every direct purchase link created by brands and share them instantly.
          </p>
        </div>
        <button
          onClick={loadLinks}
          disabled={loading}
          className="action-btn btn-primary flex items-center gap-2"
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="glass-panel border border-green-400/40 bg-green-500/10 text-green-200 px-4 py-3 mb-4 flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="glass-panel border border-red-400/40 bg-red-500/10 text-red-200 px-4 py-3 mb-4 flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Stats */}
      <div className="glass-panel p-6 mb-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Filter by Brand
            </label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            >
              <option value="">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 rounded-lg text-center">
              <p className="text-xs uppercase tracking-wide text-gray-400">Total Links</p>
              <p className="text-2xl font-bold text-cyan-300">{stats.total}</p>
            </div>
            <div className="glass-card p-4 rounded-lg text-center">
              <p className="text-xs uppercase tracking-wide text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-300">{stats.active}</p>
            </div>
            <div className="glass-card p-4 rounded-lg text-center">
              <p className="text-xs uppercase tracking-wide text-gray-400">Visits</p>
              <p className="text-2xl font-bold text-purple-300">{stats.visits}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && links.length === 0 && (
        <div className="glass-panel p-8 text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
          <p className="text-gray-400">Loading direct purchase links...</p>
        </div>
      )}

      {/* Links List */}
      {links.length > 0 && !loading && (
        <div className="space-y-5">
          {links.map((link) => (
            <div key={link.id} className="glass-panel p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-semibold text-white">{link.name}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      link.is_active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {link.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-1">
                    <span className="text-gray-300 font-medium">Brand:</span> {link.brand_name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-400">
                    ${Number(link.total_amount).toFixed(2)} • Package: ${Number(link.package_price).toFixed(2)} • Credits: ${Number(link.credits_price).toFixed(2)} ({link.credits_amount === 'unlimited' ? 'Unlimited' : link.credits_amount} credits)
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(getPurchaseUrl(link))}
                  className="action-btn btn-secondary whitespace-nowrap"
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copy Link
                </button>
              </div>

              <div className="glass-card border border-white/10 rounded-lg p-3 mb-5 flex flex-col md:flex-row md:items-center gap-3">
                <input
                  type="text"
                  value={getPurchaseUrl(link)}
                  readOnly
                  className="search-input font-mono text-sm p-3 rounded-lg flex-1 bg-transparent"
                />
                <button
                  onClick={() => copyToClipboard(getPurchaseUrl(link))}
                  className="action-btn btn-primary w-full md:w-auto"
                >
                  Copy
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-lg text-center">
                  <div className="text-gray-400 text-sm flex items-center justify-center gap-2 mb-2">
                    <i className="fas fa-eye"></i> Visits
                  </div>
                  <div className="text-3xl font-bold text-cyan-300">
                    {link.visits_count || 0}
                  </div>
                </div>

                <div className="glass-card p-4 rounded-lg text-center">
                  <div className="text-gray-400 text-sm flex items-center justify-center gap-2 mb-2">
                    <i className="fas fa-receipt"></i> Transactions
                  </div>
                  <div className="text-3xl font-bold text-purple-300">
                    {link.transactions_count || 0}
                  </div>
                </div>

                <div className="glass-card p-4 rounded-lg text-center">
                  <div className="text-gray-400 text-sm flex items-center justify-center gap-2 mb-2">
                    <i className="fas fa-percentage"></i> Conv. Rate
                  </div>
                  <div className="text-3xl font-bold text-green-300">
                    {Number(link.conversion_rate || 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Links */}
      {links.length === 0 && !loading && (
        <div className="glass-panel p-12 text-center">
          <i className="fas fa-link text-5xl text-gray-500 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-200 mb-2">No Direct Purchase Links</h3>
          <p className="text-gray-400">
            {selectedBrandId ? 'This brand has no direct purchase links yet.' : 'No direct purchase links found.'}
          </p>
        </div>
      )}
    </div>
  );
}

