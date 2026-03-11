import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function IpWhitelistSection() {
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [vpnBlockEnabled, setVpnBlockEnabled] = useState(true);
  const [vpnWhitelistExemption, setVpnWhitelistExemption] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ipToDelete, setIpToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ipList, settings] = await Promise.all([
        serverApi.admin.ipWhitelist.list(),
        serverApi.admin.ipWhitelist.getSettings()
      ]);
      setIps(ipList);
      setWhitelistEnabled(settings.enabled || false);
      setVpnBlockEnabled(settings.vpnBlockEnabled !== false);
      setVpnWhitelistExemption(settings.vpnWhitelistExemption || false);
    } catch (error) {
      console.error('Failed to load IP whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWhitelistToggle = async () => {
    try {
      const newStatus = !whitelistEnabled;
      await serverApi.admin.ipWhitelist.updateSettings({ enabled: newStatus });
      setWhitelistEnabled(newStatus);
    } catch (error) {
      console.error('Failed to toggle whitelist:', error);
      alert('Failed to update whitelist status');
    }
  };

  const handleVpnBlockToggle = async () => {
    try {
      const newStatus = !vpnBlockEnabled;
      await serverApi.admin.ipWhitelist.updateSettings({ vpnBlockEnabled: newStatus });
      setVpnBlockEnabled(newStatus);
      // If disabling VPN block, also disable exemption
      if (!newStatus && vpnWhitelistExemption) {
        await serverApi.admin.ipWhitelist.updateSettings({ vpnWhitelistExemption: false });
        setVpnWhitelistExemption(false);
      }
    } catch (error) {
      console.error('Failed to toggle VPN blocking:', error);
      alert('Failed to update VPN blocking status');
    }
  };

  const handleVpnWhitelistExemptionToggle = async () => {
    try {
      const newStatus = !vpnWhitelistExemption;
      await serverApi.admin.ipWhitelist.updateSettings({ vpnWhitelistExemption: newStatus });
      setVpnWhitelistExemption(newStatus);
    } catch (error) {
      console.error('Failed to toggle VPN whitelist exemption:', error);
      alert('Failed to update VPN whitelist exemption status');
    }
  };

  const handleAddIp = async (e) => {
    e.preventDefault();
    setError('');

    if (!newIp.trim()) {
      setError('IP address is required');
      return;
    }

    try {
      await serverApi.admin.ipWhitelist.add(newIp.trim(), newLabel.trim());
      await loadData();
      setAddModalOpen(false);
      setNewIp('');
      setNewLabel('');
    } catch (error) {
      console.error('Failed to add IP:', error);
      setError(error.message || 'Failed to add IP address');
    }
  };

  const handleDeleteClick = (ip) => {
    setIpToDelete(ip);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!ipToDelete) return;

    try {
      await serverApi.admin.ipWhitelist.delete(ipToDelete.id);
      await loadData();
      setDeleteModalOpen(false);
      setIpToDelete(null);
    } catch (error) {
      console.error('Failed to delete IP:', error);
      alert('Failed to delete IP address');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Access Control</h2>
          <p className="text-gray-400 text-sm mt-1">Manage VPN blocking and IP whitelist settings</p>
        </div>
        <button 
          className="action-btn btn-primary w-full sm:w-auto"
          onClick={() => setAddModalOpen(true)}
        >
          <i className="fas fa-plus mr-2"></i>
          Add IP to Whitelist
        </button>
      </div>

      {/* Security Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* VPN/Proxy Block Toggle */}
        <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2 flex items-center flex-wrap gap-2">
                <i className="fas fa-user-shield text-purple-400"></i>
                <span>VPN/Proxy Blocking</span>
              </h3>
              <p className="text-gray-400 text-sm">
                {vpnBlockEnabled 
                  ? 'VPN/Proxy users are blocked' 
                  : 'VPN/Proxy blocking is disabled'
                }
              </p>
            </div>
            <button
              onClick={handleVpnBlockToggle}
              className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors focus:outline-none flex-shrink-0 ${
                vpnBlockEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={vpnBlockEnabled ? 'Disable VPN blocking' : 'Enable VPN blocking'}
            >
              <span
                className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform ${
                  vpnBlockEnabled ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Whitelist VPN Exemption Toggle */}
        <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2 flex items-center flex-wrap gap-2">
                <i className="fas fa-user-check text-cyan-400"></i>
                <span>Whitelist VPN Exemption</span>
              </h3>
              <p className="text-gray-400 text-sm">
                {vpnWhitelistExemption && vpnBlockEnabled
                  ? 'Whitelisted IPs can use VPN' 
                  : !vpnBlockEnabled
                  ? 'VPN blocking must be enabled'
                  : 'All VPN users blocked'
                }
              </p>
            </div>
            <button
              onClick={handleVpnWhitelistExemptionToggle}
              disabled={!vpnBlockEnabled}
              className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors focus:outline-none flex-shrink-0 ${
                vpnWhitelistExemption && vpnBlockEnabled ? 'bg-green-500' : 'bg-gray-600'
              } ${!vpnBlockEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={!vpnBlockEnabled ? 'Enable VPN blocking first' : vpnWhitelistExemption ? 'Disable whitelist exemption' : 'Enable whitelist exemption'}
            >
              <span
                className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform ${
                  vpnWhitelistExemption && vpnBlockEnabled ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Whitelist Toggle */}
        <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2 flex items-center flex-wrap gap-2">
                <i className="fas fa-shield-alt text-red-400"></i>
                <span>IP Whitelist</span>
              </h3>
              <p className="text-gray-400 text-sm">
                {whitelistEnabled 
                  ? 'Only whitelisted IPs can access' 
                  : 'All IPs allowed'
                }
              </p>
            </div>
            <button
              onClick={handleWhitelistToggle}
              className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors focus:outline-none flex-shrink-0 ${
                whitelistEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={whitelistEnabled ? 'Disable whitelist' : 'Enable whitelist'}
            >
              <span
                className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform ${
                  whitelistEnabled ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* IP List Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Label
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Added On
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {ips.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <i className="fas fa-shield-alt text-6xl text-gray-600 mb-4"></i>
                    <p className="text-xl text-gray-400">No IP addresses whitelisted</p>
                    <button
                      className="mt-4 action-btn btn-primary"
                      onClick={() => setAddModalOpen(true)}
                    >
                      <i className="fas fa-plus mr-2"></i>
                      Add First IP
                    </button>
                  </td>
                </tr>
              ) : (
                ips.map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white font-mono">{ip.ip_address}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">{ip.label || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-400 text-sm">{formatDate(ip.created_at)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteClick(ip)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete IP"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {ips.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <i className="fas fa-shield-alt text-6xl text-gray-600 mb-4"></i>
              <p className="text-lg text-gray-400 mb-2">No IP addresses whitelisted</p>
              <p className="text-sm text-gray-500 mb-4">Add your first IP to the whitelist</p>
              <button
                className="action-btn btn-primary w-full max-w-xs mx-auto"
                onClick={() => setAddModalOpen(true)}
              >
                <i className="fas fa-plus mr-2"></i>
                Add First IP
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {ips.map((ip) => (
                <div key={ip.id} className="p-4 hover:bg-gray-750 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">IP Address</div>
                      <div className="text-white font-mono text-sm break-all">{ip.ip_address}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteClick(ip)}
                      className="ml-3 text-red-400 hover:text-red-300 transition-colors p-2"
                      title="Delete IP"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  
                  {ip.label && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Label</div>
                      <div className="text-gray-300 text-sm">{ip.label}</div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Added On</div>
                    <div className="text-gray-400 text-sm">{formatDate(ip.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add IP Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4">Add IP Address</h3>
            <form onSubmit={handleAddIp}>
              {error && (
                <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-500 rounded text-red-200">
                  {error}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">IP Address *</label>
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="e.g., 192.168.1.1"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-purple-500 focus:outline-none font-mono"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">Label (Optional)</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Office Network"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-500 text-white py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add IP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddModalOpen(false);
                    setNewIp('');
                    setNewLabel('');
                    setError('');
                  }}
                  className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && ipToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to remove <span className="font-mono text-white">{ipToDelete.ip_address}</span> from the whitelist?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setIpToDelete(null);
                }}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

