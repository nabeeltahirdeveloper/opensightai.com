import React, { useState, useEffect } from 'react';
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

// Predefined combinations (matching backend)
const PREDEFINED_COMBINATIONS = [
  { total_amount: 100, package_id: 'starter', package_price: 50, credits_amount: 50, credits_price: 50, name: 'Starter + 50 Credits' },
  { total_amount: 150, package_id: 'starter', package_price: 50, credits_amount: 100, credits_price: 100, name: 'Starter + 100 Credits' },
  { total_amount: 199, package_id: 'professional', package_price: 129, credits_amount: 70, credits_price: 70, name: 'Professional + 70 Credits' },
  { total_amount: 239, package_id: 'expert', package_price: 189, credits_amount: 50, credits_price: 50, name: 'Expert + 50 Credits' },
  { total_amount: 259, package_id: 'expert', package_price: 189, credits_amount: 70, credits_price: 70, name: 'Expert + 70 Credits' },
  { total_amount: 289, package_id: 'expert', package_price: 189, credits_amount: 100, credits_price: 100, name: 'Expert + 100 Credits' },
  { total_amount: 339, package_id: 'expert', package_price: 189, credits_amount: 150, credits_price: 150, name: 'Expert + 150 Credits' },
  { total_amount: 439, package_id: 'expert', package_price: 189, credits_amount: 250, credits_price: 250, name: 'Expert + 250 Credits' },
  { total_amount: 550, package_id: 'starter', package_price: 50, credits_amount: 500, credits_price: 500, name: 'Starter + 500 Credits' },
  { total_amount: 689, package_id: 'expert', package_price: 189, credits_amount: 500, credits_price: 500, name: 'Expert + 500 Credits' },
  { total_amount: 1050, package_id: 'starter', package_price: 50, credits_amount: 1000, credits_price: 1000, name: 'Starter + 1000 Credits' },
  { total_amount: 1189, package_id: 'expert', package_price: 189, credits_amount: 1000, credits_price: 1000, name: 'Expert + 1000 Credits' },
  { total_amount: 1689, package_id: 'expert', package_price: 189, credits_amount: 'unlimited', credits_price: 1500, name: 'Expert + Unlimited Credits' }
];

export default function DirectPurchaseLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [creatingAmount, setCreatingAmount] = useState(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await serverApi.brand.directPurchaseLinks.list();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Failed to load direct purchase links:', error);
      setError('Failed to load direct purchase links');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async (combo) => {
    if (creatingAmount !== null) return;
    setError('');
    setSuccess('');
    setCreatingAmount(combo.total_amount);

    try {
      await serverApi.brand.directPurchaseLinks.create({
        name: `$${combo.total_amount} - ${combo.name}`,
        total_amount: combo.total_amount,
        package_id: combo.package_id,
        credits_amount: combo.credits_amount
      });
      setSuccess(`Direct purchase link created: $${combo.total_amount}!`);
      await loadLinks();
    } catch (err) {
      setError(err.message || 'Failed to create direct purchase link');
    } finally {
      setCreatingAmount(null);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      await serverApi.brand.directPurchaseLinks.update(id, updates);
      setSuccess('Link updated successfully!');
      await loadLinks();
    } catch (err) {
      setError(err.message || 'Failed to update link');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this direct purchase link?')) {
      return;
    }

    try {
      await serverApi.brand.directPurchaseLinks.delete(id);
      setSuccess('Link deleted successfully!');
      await loadLinks();
    } catch (err) {
      setError(err.message || 'Failed to delete link');
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading direct purchase links...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Direct Purchase Links</h2>
          <p className="text-gray-600">
            Create direct purchase links with custom amounts. Customers will see the total amount and proceed directly to checkout.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadLinks}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <i className="fas fa-check-circle mr-2"></i>
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {/* Predefined Combinations - Quick Create */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Create - Predefined Combinations</h3>
          <p className="text-sm text-gray-600 mb-4">Click any combination below to instantly create a direct purchase link:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PREDEFINED_COMBINATIONS.map((combo) => {
              const alreadyExists = links.some(link => Number(link.total_amount) === combo.total_amount);
              const isCreating = creatingAmount === combo.total_amount;
              return (
                <button
                  key={combo.total_amount}
                  onClick={() => handleQuickCreate(combo)}
                  disabled={alreadyExists || creatingAmount !== null}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    alreadyExists
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : creatingAmount !== null
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100'
                  }`}
                  title={alreadyExists ? 'Link already exists' : `Create $${combo.total_amount} link`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg font-bold text-gray-900">${combo.total_amount}</span>
                    {alreadyExists && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Created</span>
                    )}
                    {isCreating && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                        <i className="fas fa-spinner fa-spin"></i>Creating
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="font-medium">{combo.name}</div>
                    <div className="text-xs mt-1">
                      {combo.package_id.charAt(0).toUpperCase() + combo.package_id.slice(1)}: ${combo.package_price} + 
                      {combo.credits_amount === 'unlimited' ? ' Unlimited' : ` ${combo.credits_amount}`} Credits: ${combo.credits_price}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Links List */}
      {links.length > 0 && (
        <div className="space-y-6">
          {links.map((link) => (
            <div key={link.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{link.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    ${Number(link.total_amount).toFixed(2)} • Package: ${Number(link.package_price).toFixed(2)} • Credits: ${Number(link.credits_price).toFixed(2)} ({link.credits_amount === 'unlimited' || String(link.credits_amount).toLowerCase() === 'unlimited' ? 'Unlimited' : link.credits_amount} credits)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(link.id, { is_active: !link.is_active })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      link.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={link.is_active ? 'Deactivate direct link' : 'Activate direct link'}
                  >
                    <i className={`fas fa-${link.is_active ? 'toggle-on' : 'toggle-off'} text-xl`}></i>
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors"
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                <input
                  type="text"
                  value={getPurchaseUrl(link)}
                  readOnly
                  className="flex-1 bg-transparent text-gray-700 outline-none font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(getPurchaseUrl(link))}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copy
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                    <i className="fas fa-eye mr-2"></i>
                    Visits
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {link.visits_count || 0}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                    <i className="fas fa-receipt mr-2"></i>
                    Transactions
                  </div>
                  <div className="text-3xl font-bold text-purple-600">
                    {link.transactions_count || 0}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                    <i className="fas fa-percentage mr-2"></i>
                    Conv. Rate
                  </div>
                  <div className={`text-3xl font-bold ${
                    Number(link.conversion_rate || 0) >= 50
                      ? 'text-green-600'
                      : Number(link.conversion_rate || 0) > 0
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                  }`}>
                    {Number(link.conversion_rate || 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Links */}
      {links.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
          <i className="fas fa-link text-6xl text-gray-400 mb-4"></i>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Direct Purchase Links</h3>
          <p className="text-gray-600 mb-4">
            Use the quick create buttons above to generate your first direct purchase link.
          </p>
        </div>
      )}
    </div>
  );
}

