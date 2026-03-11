import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function ResellerProfile() {
  const [brand, setBrand] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    website: '',
    primary_color: '#00d4ff',
    secondary_color: '#7c3aed',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await serverApi.reseller.profile.get();
      setBrand(data.brand);
      setFormData({
        name: data.brand.name || '',
        logo_url: data.brand.logo_url || '',
        website: data.brand.website || '',
        primary_color: data.brand.primary_color || '#00d4ff',
        secondary_color: data.brand.secondary_color || '#7c3aed',
        description: data.brand.description || ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const data = await serverApi.reseller.profile.update(formData); 
      setBrand(data.brand);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyReferralLink = () => {
    const url = `https://OpenSightai.com/pricing?ref=${brand.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setSuccess('Referral link copied to clipboard!');
      setTimeout(() => setSuccess(''), 3000);
    }).catch(() => {
      setError('Failed to copy link');
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
        <p className="text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">Brand Profile</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
          {success}
        </div>
      )}

      {/* Referral Link Section */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Your Referral Link</h3>
        <div className="flex items-center space-x-4">
          <div className="flex-1 bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p className="font-mono text-cyan-400 break-all">
              https://OpenSightai.com/pricing?ref={brand?.slug}
            </p>
          </div>
          <button
            onClick={copyReferralLink}
            className="action-btn btn-primary whitespace-nowrap"
          >
            <i className="fas fa-copy mr-2"></i>
            Copy Link
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Your Slug</p>
            <p className="text-lg font-semibold text-white font-mono">{brand?.slug}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Commission Rate</p>
            <p className="text-lg font-semibold text-cyan-400">{brand?.commission_rate}%</p>
          </div>
        </div>
      </div>

      {/* Profile Edit Form */}
      <div className="glass-panel p-6">
        <h3 className="text-xl font-semibold mb-4">Edit Profile</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Brand Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter brand name"
                className="search-input p-3 rounded-lg w-full"
              />
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Logo URL
              </label>
              <input
                type="url"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="https://example.com/logo.png"
                className="search-input p-3 rounded-lg w-full"
              />
              {formData.logo_url && (
                <div className="mt-2">
                  <img 
                    src={formData.logo_url} 
                    alt="Brand logo preview" 
                    className="w-20 h-20 rounded object-cover border border-gray-700"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="search-input p-3 rounded-lg w-full"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Primary Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                    placeholder="#00d4ff"
                    className="search-input p-3 rounded-lg flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Secondary Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                    placeholder="#7c3aed"
                    className="search-input p-3 rounded-lg flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Enter brand description..."
                className="search-input p-3 rounded-lg w-full resize-none"
              />
            </div>

            {/* Read-only fields */}
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Account Information (Read-only)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Email</p>
                  <p className="text-sm text-gray-300">{brand?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className="text-sm">
                    <span className={`status-badge ${brand?.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {brand?.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Created</p>
                  <p className="text-sm text-gray-300">
                    {brand?.created_at ? new Date(brand.created_at).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Last Updated</p>
                  <p className="text-sm text-gray-300">
                    {brand?.updated_at ? new Date(brand.updated_at).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="action-btn btn-primary px-8"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

