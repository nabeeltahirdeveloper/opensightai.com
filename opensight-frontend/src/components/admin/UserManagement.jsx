import React, { useState } from 'react';
import { User } from "@/api/entities";
import { serverApi } from '@/api/serverApi';

const Tiers = ["none", "starter", "pro", "expert"];

export default function UserManagement({ users, onUserUpdate }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleTierChange = async (userId, currentTier, newTier) => {
    if (currentTier === newTier) return;
    
    setUpdatingId(userId);
    try {
      await serverApi.auth.update(userId, { plan: newTier });
      onUserUpdate(); // Refresh data in parent
    } catch (error) {
      console.error("Failed to update user tier:", error);
      alert('Failed to update user tier');
    } finally {
      setUpdatingId(null);
    }
  };
  
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const getBadgeColor = (role) => {
    if (role === 'admin') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };
  
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (user.full_name || '').toLowerCase().includes(query) ||
           (user.email || '').toLowerCase().includes(query);
  });
  
  // Calculate stats
  const stats = {
    total: users.length,
    starter: users.filter(u => (u.subscription_tier || '').toLowerCase() === 'starter').length,
    pro: users.filter(u => (u.subscription_tier || '').toLowerCase() === 'pro').length,
    expert: users.filter(u => (u.subscription_tier || '').toLowerCase() === 'expert').length
  };
  
  return (
    <div>
      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-cyan-400">{stats.total}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2">Starter Plan</h3>
          <p className="text-3xl font-bold text-green-400">{stats.starter}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2">Pro Plan</h3>
          <p className="text-3xl font-bold text-purple-400">{stats.pro}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2">Expert Plan</h3>
          <p className="text-3xl font-bold text-yellow-400">{stats.expert}</p>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="glass-panel p-6">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="search-input p-3 rounded-lg w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="table-container" style={{ maxHeight: '600px' }}>
          <table className="w-full">
            <thead className="border-b border-gray-700 sticky top-0 bg-gray-900">
              <tr>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Subscription Tier</th>
                <th className="text-left p-4">Credits</th>
                <th className="text-left p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const initials = getInitials(user.full_name);
                const roleBadge = getBadgeColor(user.role);
                const tier = user.subscription_tier || 'none';
                const credits = user.credits_unlimited ? 'Unlimited' : (user.credits_balance || 0);
                const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
                
                return (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4" data-label="User">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold">{initials}</span>
                        </div>
                        <span>{user.full_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4" data-label="Email">{user.email || 'N/A'}</td>
                    <td className="p-4" data-label="Role">
                      <span className={`status-badge ${roleBadge}`}>{user.role || 'user'}</span>
                    </td>
                    <td className="p-4" data-label="Subscription Tier">
                      <select
                        className="search-input p-2 rounded-lg"
                        value={tier}
                        onChange={(e) => handleTierChange(user.id, tier, e.target.value)}
                        disabled={updatingId === user.id}
                      >
                        {Tiers.map(t => (
                          <option key={t} value={t} className="capitalize">{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4" data-label="Credits">
                      <span className={`text-sm ${user.credits_unlimited ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {credits}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400" data-label="Created">{createdDate}</td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}