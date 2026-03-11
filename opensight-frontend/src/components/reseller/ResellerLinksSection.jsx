import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function ResellerLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await serverApi.reseller.links.list();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Failed to load links:', error);
      setError('Failed to load links');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Link copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const getTrackingUrl = (link) => {
    // Return the actual destination URL with link parameter appended
    const url = new URL(link.destination_url);
    url.searchParams.set('link', link.link_id);
    return url.toString();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i>
        <p className="text-gray-600">Loading links...</p>
      </div>
    );
  }

  // Separate main link from package links
  const mainLink = links.find(l => l.is_main_link);
  const packageLinks = links.filter(l => !l.is_main_link);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Reseller Links</h2>
          <p className="text-gray-600">
            This is your personal reseller URL. Share it with your agents to track all your FTD's in the back office.
          </p>
        </div>
        <button
          onClick={loadLinks}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          Refresh
        </button>
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

      {/* Main Link */}
      {mainLink && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Main link</h3>
          
          <div className="flex items-center gap-3 mb-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <input
              type="text"
              value={getTrackingUrl(mainLink)}
              readOnly
              className="flex-1 bg-transparent text-gray-700 outline-none font-mono text-sm"
            />
            <button
              onClick={() => copyToClipboard(getTrackingUrl(mainLink))}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
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
                {mainLink.visits_count || 0}
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                <i className="fas fa-receipt mr-2"></i>
                Transactions
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {mainLink.transactions_count || 0}
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                <i className="fas fa-percentage mr-2"></i>
                Conv. Rate
              </div>
              <div className={`text-3xl font-bold ${
                Number(mainLink.conversion_rate || 0) >= 50 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {Number(mainLink.conversion_rate || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Links */}
      {packageLinks.length > 0 && (
        <div className="space-y-6">
          {packageLinks.map((link) => (
            <div key={link.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{link.name}</h3>
              
              <div className="flex items-center gap-3 mb-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                <input
                  type="text"
                  value={getTrackingUrl(link)}
                  readOnly
                  className="flex-1 bg-transparent text-gray-700 outline-none font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(getTrackingUrl(link))}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
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
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Reseller Links</h3>
          <p className="text-gray-600">
            Contact your administrator to set up tracking links for your reseller account.
          </p>
        </div>
      )}
    </div>
  );
}


