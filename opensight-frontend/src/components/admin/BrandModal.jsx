import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandModal({ brand, mode, onClose, onSuccess }) {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const isCreate = mode === 'create';

  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    website: '',
    primary_color: '#00d4ff',
    secondary_color: '#7c3aed',
    description: '',
    status: 'active',
    slug: '',
    commission_rate: 10,
    email: '',
    username: '',
    parent_brand_id: null,
    account_type: 'brand',
    reseller_commission: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState([]);
  const [packages, setPackages] = useState([]);
  const [customLinks, setCustomLinks] = useState([]);
  const [mainLinkCustomUrl, setMainLinkCustomUrl] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  useEffect(() => {
    loadBrands();
    loadPackages();
  }, []);

  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name || '',
        logo_url: brand.logo_url || '',
        website: brand.website || '',
        primary_color: brand.primary_color || '#00d4ff',
        secondary_color: brand.secondary_color || '#7c3aed',
        description: brand.description || '',
        status: brand.status || 'active',
        slug: brand.slug || '',
        commission_rate: brand.commission_rate || 10,
        email: brand.email || '',
        username: brand.username || '',
        parent_brand_id: brand.parent_brand_id || null,
        account_type: brand.account_type || 'brand',
        reseller_commission: brand.reseller_commission || 0
      });

      // Load existing custom links
      if (brand.custom_links && Array.isArray(brand.custom_links)) {
        const mainLink = brand.custom_links.find(link => link.is_main_link);
        const packageLinks = brand.custom_links.filter(link => !link.is_main_link);
        
        // Set main link custom URL if exists
        if (mainLink && mainLink.custom_url) {
          setMainLinkCustomUrl(mainLink.custom_url);
        }
        
        // Set package links
        setCustomLinks(packageLinks.map(link => ({
          package_id: link.package_id,
          name: link.name,
          is_main_link: false,
          custom_url: link.custom_url || ''
        })));
      } else {
        // Reset links if no brand or no links
        setMainLinkCustomUrl('');
        setCustomLinks([]);
      }
    } else {
      // Reset everything when no brand (create mode)
      setMainLinkCustomUrl('');
      setCustomLinks([]);
    }
  }, [brand]);

  const loadBrands = async () => {
    try {
      // Fetch all brands for the dropdown
      const allBrands = [];
      let page = 1;
      const pageSize = 200; // Max allowed by backend
      let hasMore = true;

      while (hasMore) {
        const data = await serverApi.admin.brands.list({ 
          page: String(page), 
          pageSize: String(pageSize) 
        });
        
        if (data.brands && data.brands.length > 0) {
          allBrands.push(...data.brands);
          // Check if there are more pages
          const totalPages = data.meta?.pages || 1;
          hasMore = page < totalPages;
          page++;
        } else {
          hasMore = false;
        }
      }

      setBrands(allBrands);
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  };

  const loadPackages = async () => {
    try {
      const data = await serverApi.admin.packages.list();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to load packages:', error);
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
        custom_url: '' // Empty by default, will use default pricing URL
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;
    
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
        custom_links: links.length > 0 ? links : undefined
      };

      if (isCreate) {
        const response = await serverApi.admin.brands.create(dataToSend);
        // Show password modal with generated credentials
        if (response.generated_password) {
          setGeneratedCredentials({
            username: formData.username,
            password: response.generated_password
          });
          setShowPasswordModal(true);
        }
      } else {
        // Exclude username from updates (cannot be changed after creation)
        const { username, ...updateData } = dataToSend;
        await serverApi.admin.brands.update(brand.id, updateData);
      }
      onSuccess();
      if (!isCreate) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold gradient-text">
              {isView ? 'View Brand' : isEdit ? 'Edit Brand' : 'Create Brand'}
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
                  disabled={isView}
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
                  disabled={isView}
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
                  disabled={isView || isEdit}
                  required
                  placeholder="brandusername"
                  className="search-input p-3 rounded-lg w-full font-mono"
                />
                {isEdit && (
                  <p className="text-xs text-gray-400 mt-1">Username cannot be changed after creation</p>
                )}
                {!isView && !isEdit && (
                  <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, underscores, and hyphens. Used for login.</p>
                )}
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
                  disabled={isView}
                  required
                  placeholder="brand-slug"
                  className="search-input p-3 rounded-lg w-full font-mono"
                />
                {formData.slug && !isView && (
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
                  disabled={isView}
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="10"
                  className="search-input p-3 rounded-lg w-full"
                />
                <p className="text-xs text-gray-400 mt-1">Percentage of order total paid as commission</p>
              </div>

              {/* Reseller Commission - Only shown when parent_brand_id is selected */}
              {formData.parent_brand_id && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Reseller Commission (%)
                  </label>
                  <input
                    type="number"
                    name="reseller_commission"
                    value={formData.reseller_commission}
                    onChange={handleChange}
                    disabled={isView}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                    className="search-input p-3 rounded-lg w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">Reseller's portion from the total order amount (e.g., 17.2 for 17.2%)</p>
                </div>
              )}

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Account Type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                    formData.account_type === 'brand'
                      ? 'bg-cyan-500/20 border-2 border-cyan-500'
                      : 'bg-gray-800/30 border-2 border-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="account_type"
                      value="brand"
                      checked={formData.account_type === 'brand'}
                      onChange={handleChange}
                      disabled={isView}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Brand</div>
                      <div className="text-xs text-gray-400">Regular brand partner</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                    formData.account_type === 'reseller'
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-gray-800/30 border-2 border-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="account_type"
                      value="reseller"
                      checked={formData.account_type === 'reseller'}
                      onChange={handleChange}
                      disabled={isView}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Reseller</div>
                      <div className="text-xs text-gray-400">Can manage network</div>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {formData.account_type === 'reseller' 
                    ? 'Resellers can view their network of child brands and network-wide transactions'
                    : 'Brands can view their own transactions and performance data'}
                </p>
              </div>

              {/* Parent Brand */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Parent Brand
                </label>
                <select
                  name="parent_brand_id"
                  value={formData.parent_brand_id || ''}
                  onChange={handleChange}
                  disabled={isView}
                  className="search-input p-3 rounded-lg w-full"
                >
                  <option value="">None (Independent Brand)</option>
                  {brands
                    .filter(b => !brand || b.id !== brand.id)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} (ID: {b.id})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Select a parent brand if this is a child brand. Parent can view all child transactions.
                </p>
              </div>

              {/* Custom Links Section */}
              {!isView && (
                <div className="pt-4 border-t border-gray-700">
                  <h4 className="text-lg font-semibold mb-4 text-gray-200">
                    <i className="fas fa-link mr-2"></i>Brand Links
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
                                <p className="text-xs text-gray-500 mt-1">
                                  Example: https://finvest-academy.com/vision-plan/professional-package/
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      The ?link parameter will be automatically added to track conversions
                    </p>
                  </div>

                  {/* Preview Selected Links */}
                  {customLinks.length > 0 && (
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                      <p className="text-xs font-medium text-gray-400 mb-2">
                        <i className="fas fa-check-circle text-green-400 mr-1"></i>
                        {customLinks.length} package link(s) selected
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                  disabled={isView}
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
                  disabled={isView}
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
                      disabled={isView}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      disabled={isView}
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
                      disabled={isView}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                      disabled={isView}
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
                  disabled={isView}
                  rows={4}
                  placeholder="Enter brand description..."
                  className="search-input p-3 rounded-lg w-full resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={isView}
                  className="search-input p-3 rounded-lg w-full"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Metadata (View only) */}
              {brand && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-400">
                      Created
                    </label>
                    <p className="text-sm text-gray-300">
                      {new Date(brand.created_at).toLocaleString()}
                    </p>
                  </div>
                  {brand.updated_at && (
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">
                        Last Updated
                      </label>
                      <p className="text-sm text-gray-300">
                        {new Date(brand.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="action-btn btn-secondary px-6"
              >
                {isView ? 'Close' : 'Cancel'}
              </button>
              {!isView && (
                <button
                  type="submit"
                  disabled={loading}
                  className="action-btn btn-primary px-6"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      {isCreate ? 'Create Brand' : 'Update Brand'}
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && generatedCredentials && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="glass-panel max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <i className="fas fa-check text-3xl text-green-400"></i>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-center gradient-text mb-2">
                Brand Created Successfully!
              </h3>
              
              <p className="text-center text-gray-400 mb-6">
                Save these credentials - they won't be shown again
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-500/30">
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Username
                  </label>
                  <div className="flex items-center justify-between">
                    <code className="text-cyan-400 font-mono text-lg">
                      {generatedCredentials.username}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.username);
                      }}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                      title="Copy username"
                    >
                      <i className="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 p-4 rounded-lg border border-purple-500/30">
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Password
                  </label>
                  <div className="flex items-center justify-between">
                    <code className="text-purple-400 font-mono text-lg">
                      {generatedCredentials.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.password);
                      }}
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                      title="Copy password"
                    >
                      <i className="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
                <p className="text-xs text-yellow-300 flex items-start">
                  <i className="fas fa-exclamation-triangle mt-0.5 mr-2"></i>
                  <span>These credentials have been sent to the brand's email. Make sure to save them before closing this dialog.</span>
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setGeneratedCredentials(null);
                  onClose();
                }}
                className="action-btn btn-primary w-full"
              >
                <i className="fas fa-check mr-2"></i>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

