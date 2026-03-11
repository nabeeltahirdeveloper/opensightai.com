import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandVisitsSection() {
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [days, setDays] = useState(30);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadVisits();
    loadLinks();
  }, [page]);

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const data = await serverApi.brand.visits.list({ page: String(page), pageSize: '20' });
      setVisits(data.visits || []);
      setMeta(data.meta || { total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to load visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await serverApi.brand.visits.getStats({ days: String(days) });
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadLinks = async () => {
    try {
      const data = await serverApi.brand.links.list();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Failed to load links:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Link copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const getTrackingUrl = (link) => {
    const url = new URL(link.destination_url);
    url.searchParams.set('link', link.link_id);
    return url.toString();
  };

  if (loading && page === 1) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading visits...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visits</h2>
          <p className="text-sm text-gray-600 mt-1">Track visitor analytics and engagement</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="search-input p-3 rounded-lg w-full sm:w-auto"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Total Visits</h3>
              <i className="fas fa-eye text-blue-500 text-xl"></i>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total_visits || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Period Visits</h3>
              <i className="fas fa-calendar text-green-500 text-xl"></i>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.daily_stats?.reduce((sum, day) => sum + (day.total_visits || 0), 0) || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last {stats.period_days} days</p>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Avg Per Day</h3>
              <i className="fas fa-chart-line text-purple-500 text-xl"></i>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.daily_stats?.length > 0
                ? Math.round(stats.daily_stats.reduce((sum, day) => sum + (day.total_visits || 0), 0) / stats.daily_stats.length)
                : 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Daily average</p>
          </div>
        </div>
      )}

      {/* Daily Stats Chart */}
      {stats && stats.daily_stats && stats.daily_stats.length > 0 && (
        <div className="glass-panel p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Visits Over Time</h3>
          <div className="space-y-2">
            {stats.daily_stats.slice(0, 10).map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">
                  {new Date(day.date).toLocaleDateString()}
                </span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.min(100, (day.total_visits / Math.max(...stats.daily_stats.map(d => d.total_visits))) * 100)}%`
                    }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {day.total_visits}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visits Statistics per Link */}
      <div className="mb-6">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Visits Statistics per Link</h2>
            <p className="text-gray-600">
              Detailed performance breakdown for each of your brand links.
            </p>
          </div>
          <button
            onClick={loadLinks}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
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

        {/* Main Link */}
        {links.find(l => l.is_main_link) && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Main link</h3>
            
            <div className="flex items-center gap-3 mb-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
              <input
                type="text"
                value={getTrackingUrl(links.find(l => l.is_main_link))}
                readOnly
                className="flex-1 bg-transparent text-gray-700 outline-none font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(getTrackingUrl(links.find(l => l.is_main_link)))}
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
                  {links.find(l => l.is_main_link)?.visits_count || 0}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                  <i className="fas fa-receipt mr-2"></i>
                  Transactions
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  {links.find(l => l.is_main_link)?.transactions_count || 0}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
                  <i className="fas fa-percentage mr-2"></i>
                  Conv. Rate
                </div>
                <div className={`text-3xl font-bold ${
                  Number(links.find(l => l.is_main_link)?.conversion_rate || 0) >= 50 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {Number(links.find(l => l.is_main_link)?.conversion_rate || 0).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Package Links */}
        {links.filter(l => !l.is_main_link).length > 0 && (
          <div className="space-y-6">
            {links.filter(l => !l.is_main_link).map((link) => (
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
            <h3 className="text-xl font-bold text-gray-700 mb-2">No Brand Links</h3>
            <p className="text-gray-600">
              Contact your administrator to set up tracking links for your brand.
            </p>
          </div>
        )}
      </div>

      {/* Integration Instructions */}
      <div className="glass-panel p-6 mt-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          <i className="fas fa-info-circle text-blue-500 mr-2"></i>
          Visit Tracking Integration
        </h3>
        <p className="text-gray-700 mb-3">
          To track visits on your website, add this script to your pages:
        </p>
        <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm">
          <code className="text-gray-800">
            {`<script>
  fetch('${window.location.origin}/api/track/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: YOUR_BRAND_ID,
      page_visited: window.location.pathname
    })
  });
</script>`}
          </code>
        </div>
      </div>
    </div>
  );
}





