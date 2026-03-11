import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function ResellerBrandModal({ mode, onClose, onSuccess }) {
  const isCreate = mode === 'create';

  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    website: '',
    primary_color: '#00d4ff',
    secondary_color: '#7c3aed',
    description: '',
    slug: '',
    commission_rate: 10,
    email: '',
    username: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [packages, setPackages] = useState([]);
  const [customLinks, setCustomLinks] = useState([]);
  const [mainLinkCustomUrl, setMainLinkCustomUrl] = useState('');
  const [selectedMids, setSelectedMids] = useState([]);
  const [availableMids, setAvailableMids] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadPackages();
    loadMids();
  }, []);

  const loadPackages = async () => {
    try {
      const data = await serverApi.admin.packages.list();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  };

  const loadMids = async () => {
    try {
      const data = await serverApi.reseller.mids.list();
      setAvailableMids(data.mids || []);
    } catch (error) {
      console.error('Failed to load MIDs:', error);
    }
  };

  const togglePackageLink = (pkg) => {
    const existingIndex = customLinks.findIndex(link => link.package_id === pkg.id);
    if (existingIndex >= 0) {
      setCustomLinks(customLinks.filter((_, i) => i !== existingIndex));
    } else {
      setCustomLinks([...customLinks, {
        package_id: pkg.id,
        name: `Package worth of $${pkg.price}`,
        is_main_link: false,
        custom_url: ''
      }]);
    }
  };

  const updatePackageLinkUrl = (packageId, url) => {
    setCustomLinks(customLinks.map(link => 
      link.package_id === packageId ? { ...link, custom_url: url } : link
    ));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleMid = (midId) => {
    setSelectedMids(prev => 
      prev.includes(midId) 
        ? prev.filter(id => id !== midId)
        : [...prev, midId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setError('');
    setLoading(true);

    try {
      // Prepare custom links array
      const links = [];
      
      // Add main link if brand has one
      if (formData.slug) {
        links.push({
          name: 'Main link',
          is_main_link: true,
          custom_url: mainLinkCustomUrl || null
        });
      }
      
      // Add selected package links
      links.push(...customLinks);

      const dataToSend = {
        ...formData,
        custom_links: links.length > 0 ? links : undefined,
        selected_mids: selectedMids.length > 0 ? selectedMids : undefined
      };

      const response = await serverApi.reseller.brands.create(dataToSend);
      
      // Show success modal with approval pending message
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold gradient-text">
                Register New Brand
              </h3>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Brand Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter brand name"
                    className="search-input p-3 rounded-lg w-full"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="brand@example.com"
                    className="search-input p-3 rounded-lg w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">Can be shared across multiple brands</p>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                      setFormData(prev => ({ ...prev, username: value }));
                    }}
                    required
                    placeholder="brandusername"
                    className="search-input p-3 rounded-lg w-full font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, underscores, and hyphens. Used for login.</p>
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Referral Slug <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setFormData(prev => ({ ...prev, slug: value }));
                    }}
                    required
                    placeholder="brand-slug"
                    className="search-input p-3 rounded-lg w-full font-mono"
                  />
                  {formData.slug && (
                    <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
                      <p className="text-xs text-gray-400 mb-1">Referral URL:</p>
                      <p className="text-xs text-cyan-400 font-mono break-all">
                        https://OpenSightai.com/pricing?ref={formData.slug}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and hyphens allowed</p>
                </div>

                {/* Commission Rate */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Commission Rate (%) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="commission_rate"
                    value={formData.commission_rate}
                    onChange={handleChange}
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="10"
                    className="search-input p-3 rounded-lg w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">Percentage of order total paid as commission</p>
                </div>

                {/* MID Selection */}
                {availableMids.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Select MIDs (Optional)
                    </label>
                    <p className="text-xs text-gray-400 mb-3">Select MIDs you'd like to use for this brand. This is for display purposes only - actual MID assignment will be handled by admin.</p>
                    <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800/30">
                      {availableMids.map((mid) => (
                        <label
                          key={mid.id}
                          className={`flex items-center p-2 mb-2 rounded cursor-pointer transition-colors ${
                            selectedMids.includes(mid.id)
                              ? 'bg-purple-500/20 border border-purple-500/50'
                              : 'bg-gray-800/30 border border-gray-700 hover:bg-gray-800/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMids.includes(mid.id)}
                            onChange={() => toggleMid(mid.id)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-200">{mid.code}</div>
                            {mid.name && (
                              <div className="text-xs text-gray-400">{mid.name}</div>
                            )}
                            {mid.description && (
                              <div className="text-xs text-gray-500 mt-1">{mid.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedMids.length > 0 && (
                      <p className="text-xs text-purple-400 mt-2">
                        <i className="fas fa-info-circle mr-1"></i>
                        {selectedMids.length} MID(s) selected
                      </p>
                    )}
                  </div>
                )}

                {/* Custom Links Section */}
                <div className="pt-4 border-t border-gray-700">
                  <h4 className="text-lg font-semibold mb-4 text-gray-200">
                    <i className="fas fa-link mr-2"></i>Brand Links (Optional)
                  </h4>
                  
                  {/* Main Link Customization */}
                  <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Main Link Custom URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={mainLinkCustomUrl}
                      onChange={(e) => setMainLinkCustomUrl(e.target.value)}
                      placeholder="Leave empty for default: OpenSightai.com/?b=slug"
                      className="search-input p-3 rounded-lg w-full"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Main link will be auto-created. Customize destination URL if needed.
                    </p>
                  </div>

                  {/* Package Links */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-3 text-gray-300">
                      Select Package Links
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {packages.map(pkg => {
                        const selectedLink = customLinks.find(link => link.package_id === pkg.id);
                        const isSelected = !!selectedLink;
                        return (
                          <div
                            key={pkg.id}
                            className={`p-3 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-cyan-500/20 border border-cyan-500/50'
                                : 'bg-gray-800/30 border border-gray-700'
                            }`}
                          >
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePackageLink(pkg)}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <span className="font-medium text-gray-200">{pkg.name}</span>
                                <span className="ml-2 text-cyan-400">${pkg.price}</span>
                              </div>
                            </label>
                            
                            {isSelected && (
                              <div className="mt-3 ml-7">
                                <label className="block text-xs font-medium mb-1 text-gray-400">
                                  Custom Destination URL (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={selectedLink.custom_url || ''}
                                  onChange={(e) => updatePackageLinkUrl(pkg.id, e.target.value)}
                                  placeholder={`Leave empty for default: OpenSightai.com/package/${pkg.id}?b=slug`}
                                  className="search-input p-2 rounded-lg w-full text-sm"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

                {/* Info Notice */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-300 flex items-start">
                    <i className="fas fa-info-circle mt-0.5 mr-2"></i>
                    <span>Your brand registration will be submitted for admin approval. You will receive an email notification once it's approved and activated.</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="action-btn btn-secondary px-6"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="action-btn btn-primary px-6"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Submit for Approval
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="glass-panel max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <i className="fas fa-clock text-3xl text-yellow-400"></i>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-center gradient-text mb-2">
                Brand Registration Submitted!
              </h3>
              
              <p className="text-center text-gray-400 mb-6">
                Your brand "{formData.name}" has been submitted for admin approval. You will receive an email notification once it's approved and activated.
              </p>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-300">
                  <i className="fas fa-info-circle mr-2"></i>
                  The brand account will be created and login credentials will be sent to {formData.email} once approved by an administrator.
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  onSuccess();
                }}
                className="action-btn btn-primary w-full"
              >
                <i className="fas fa-check mr-2"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

