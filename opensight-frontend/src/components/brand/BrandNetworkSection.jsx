import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandNetworkSection() {
  const [partners, setPartners] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [formData, setFormData] = useState({
    partner_name: '',
    partner_email: '',
    partner_type: 'affiliate',
    commission_override: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, [filterType, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType && filterType !== 'all') params.type = filterType;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;

      const data = await serverApi.brand.network.list(params);
      setPartners(data.partners || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Failed to load network:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingPartner) {
        await serverApi.brand.network.update(editingPartner.id, formData);
      } else {
        await serverApi.brand.network.create(formData);
      }
      
      setSuccess(editingPartner ? 'Partner updated successfully!' : 'Partner added successfully!');
      setShowModal(false);
      setEditingPartner(null);
      setFormData({
        partner_name: '',
        partner_email: '',
        partner_type: 'affiliate',
        commission_override: '',
        notes: ''
      });
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partner) => {
    if (!confirm('Are you sure you want to remove this partner?')) return;

    try {
      await serverApi.brand.network.delete(partner.id);
      setSuccess('Partner removed successfully!');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to remove partner');
    }
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);
    setFormData({
      partner_name: partner.partner_name,
      partner_email: partner.partner_email,
      partner_type: partner.partner_type,
      commission_override: partner.commission_override || '',
      notes: partner.notes || ''
    });
    setShowModal(true);
  };

  const handleStatusChange = async (partner, newStatus) => {
    try {
      await serverApi.brand.network.update(partner.id, { status: newStatus });
      setSuccess(`Partner status updated to ${newStatus}!`);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading network...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Network</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your partners and affiliates</p>
        </div>
        <button
          onClick={() => {
            setEditingPartner(null);
            setFormData({
              partner_name: '',
              partner_email: '',
              partner_type: 'affiliate',
              commission_override: '',
              notes: ''
            });
            setShowModal(true);
            setError('');
          }}
          className="btn-primary action-btn flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Add Partner
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <i className="fas fa-check-circle mr-2"></i>
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Total Partners</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total_partners || 0}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Active</p>
            <p className="text-3xl font-bold text-green-600">{stats.active_partners || 0}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending_partners || 0}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Affiliates</p>
            <p className="text-3xl font-bold text-blue-600">{stats.affiliates || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Partner Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            >
              <option value="all">All Types</option>
              <option value="affiliate">Affiliate</option>
              <option value="reseller">Reseller</option>
              <option value="partner">Partner</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="search-input p-3 rounded-lg w-full"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="glass-panel p-6">
        {partners.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-users text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-500 mb-4">No partners added yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary action-btn"
            >
              Add Your First Partner
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead className="border-b border-gray-300">
                <tr className="text-gray-700">
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Commission</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{partner.partner_name}</td>
                    <td className="p-4 text-gray-700">{partner.partner_email}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {partner.partner_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={partner.status}
                        onChange={(e) => handleStatusChange(partner, e.target.value)}
                        className={`status-badge ${
                          partner.status === 'active' ? 'status-active' :
                          partner.status === 'pending' ? 'status-pending' : 'status-inactive'
                        } border-none cursor-pointer`}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="p-4">
                      {partner.commission_override ? (
                        <span className="text-green-600 font-semibold">
                          {partner.commission_override}%
                        </span>
                      ) : (
                        <span className="text-gray-500">Default</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(partner)}
                          className="action-btn btn-primary text-xs"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(partner)}
                          className="action-btn btn-danger text-xs"
                          title="Remove"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPartner ? 'Edit Partner' : 'Add Partner'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Partner Name *
                </label>
                <input
                  type="text"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                  className="search-input w-full p-3 rounded-lg"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.partner_email}
                  onChange={(e) => setFormData({ ...formData, partner_email: e.target.value })}
                  className="search-input w-full p-3 rounded-lg"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Partner Type *
                </label>
                <select
                  value={formData.partner_type}
                  onChange={(e) => setFormData({ ...formData, partner_type: e.target.value })}
                  className="search-input w-full p-3 rounded-lg"
                  required
                >
                  <option value="affiliate">Affiliate</option>
                  <option value="reseller">Reseller</option>
                  <option value="partner">Partner</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Commission Override (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.commission_override}
                  onChange={(e) => setFormData({ ...formData, commission_override: e.target.value })}
                  className="search-input w-full p-3 rounded-lg"
                  placeholder="Leave empty for default"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Override the default commission rate for this partner
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="search-input w-full p-3 rounded-lg"
                  rows="3"
                  placeholder="Additional notes about this partner..."
                ></textarea>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    editingPartner ? 'Update' : 'Add Partner'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}





