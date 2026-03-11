import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandDashboardSection() {
  const [stats, setStats] = useState({ total_orders: 0, total_commission: 0, pending_commission: 0, paid_commission: 0, commission_rate: 0 });
  const [visitStats, setVisitStats] = useState({ total_visits: 0 });
  const [linksStats, setLinksStats] = useState({ links: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visits');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, visitsData, linksData] = await Promise.all([
        serverApi.brand.dashboard.getStats({ days: '365' }),
        serverApi.brand.visits.getStats({ days: '365' }),
        serverApi.brand.links.list()
      ]);

      setStats(statsData.stats);
      setVisitStats(visitsData);
      setLinksStats(linksData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  // Calculate metrics from stats - ensure all are numbers
  const visits = Number(visitStats?.total_visits || 0);
  // Transactions now shows count of successful transactions (paid or unpaid with success)
  const transactions = Number(stats?.total_orders || 0);
  const totalOrderAmount = Number(stats?.total_order_amount || 0);
  const rollingReserve = Number(stats?.rolling_reserve || 0);
  const finalPayoutAmount = Number(stats?.final_payout_amount || 0);
  const paidPayouts = Number(stats?.paid_commission || 0);
  const unpaidPayouts = Number(stats?.unpaid_commission || 0);
  const totalPayouts = paidPayouts + unpaidPayouts;
  const transactionRate = Number(stats?.commission_rate || 0);
  const cookieDuration = 120;
  const totalClicks = Number(linksStats?.links?.reduce((sum, link) => sum + (link.clicks_count || 0), 0) || 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Brand Dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">Overview of your performance and earnings</p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        {/* Visits Card */}
        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon visits">
              <i className="fas fa-eye"></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-sm text-gray-600 mb-1">Visits</p>
            <p className="text-3xl font-bold text-gray-900">{visits}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">
              {visits > 0 ? 'Total tracked visits' : 'No visits yet'}
            </span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'visits'; }} className="brand-link-text">
              View all visits
              <i className="fas fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>

        {/* Transactions Card */}
        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon transactions">
              <i className="fas fa-list"></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-sm text-gray-600 mb-1">Transactions</p>
            <p className="text-3xl font-bold text-gray-900">{transactions}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">
              {transactions > 0 ? 'Successful transactions' : 'No transactions yet'}
            </span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'transactions'; }} className="brand-link-text">
              View all transactions
              <i className="fas fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>

        {/* Payouts Card */}
        <div className="brand-stats-card">
          <div className="flex items-center justify-between mb-3">
            <div className="brand-stats-icon payouts">
              <i className="fas fa-dollar-sign"></i>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-sm text-gray-600 mb-1">Payouts</p>
            <p className="text-3xl font-bold text-green-600">${totalPayouts.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">
              {totalPayouts > 0 ? 'Total earnings' : 'No earnings yet'}
            </span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'payouts'; }} className="brand-link-text">
              View all payouts
              <i className="fas fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>
      </div>

      {/* Tabbed Section */}
      <div className="glass-card mb-6">
        <div className="border-b border-gray-200 flex tabs-wrap-mobile">
          <button
            className={`brand-tab-button ${activeTab === 'visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('visits')}
          >
            Visits
          </button>
          <button
            className={`brand-tab-button ${activeTab === 'commissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('commissions')}
          >
            Commissions
          </button>
          <button
            className={`brand-tab-button ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            Earnings
          </button>
        </div>

        <div className="p-6">
          {/* Daily Section */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Daily</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <i className="fas fa-calendar"></i>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="search-input px-3 py-2 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="brand-daily-section space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Visits</span>
                <span className="text-gray-900 font-semibold">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Commissions</span>
                <span className="text-gray-900 font-semibold">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Earnings</span>
                <span className="text-green-600 font-semibold">$0.00</span>
              </div>
            </div>
          </div>

          {/* All Time Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All time</h3>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Visits</span>
                <span className="text-gray-900 font-bold text-xl">{visits}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Transactions</span>
                <span className="text-gray-900 font-bold text-xl">{transactions}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Order Amount</span>
                <span className="text-blue-600 font-bold text-xl">${totalOrderAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Rolling Reserve (10%)</span>
                <span className="text-yellow-600 font-bold text-xl">${rollingReserve.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Final Payout Amount</span>
                <span className="text-purple-600 font-bold text-xl">${finalPayoutAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Paid</span>
                <span className="text-green-600 font-bold text-xl">${paidPayouts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Unpaid Payouts</span>
                <span className="text-orange-600 font-bold text-xl">${unpaidPayouts.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Program Details */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Program details</h3>
        <div className="space-y-3">
          <div className="brand-program-detail">
            <div className="brand-program-icon rate">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Transaction Rate</p>
              <p className="text-base font-semibold text-gray-900">Sale rate: {transactionRate}%</p>
            </div>
          </div>
          <div className="brand-program-detail">
            <div className="brand-program-icon duration">
              <i className="fas fa-clock"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Cookie Duration</p>
              <p className="text-base font-semibold text-gray-900">{cookieDuration} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
