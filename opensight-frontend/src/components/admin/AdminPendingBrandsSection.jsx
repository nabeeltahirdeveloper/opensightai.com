import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function AdminPendingBrandsSection() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectModal, setRejectModal] = useState({ show: false, brandId: null, reason: '' });

  useEffect(() => {
    loadPendingBrands();
  }, [page]);

  const loadPendingBrands = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await serverApi.admin.brands.getPending({ 
        page: String(page), 
        pageSize: String(pageSize) 
      });
      setBrands(data.brands || []);
      setMeta(data.meta || { total: 0, pages: 1 });
    } catch (err) {
      console.error('Failed to load pending brands:', err);
      const errorMessage = err?.error || err?.message || 'Failed to load pending brands';
      setError(errorMessage);
      // If it's a 400 error with "invalid id", it might be a route conflict issue
      if (errorMessage.includes('invalid id')) {
        setError('Route conflict detected. Please contact the administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (brandId) => {
    if (!confirm('Are you sure you want to approve this brand? This will create a user account and send login credentials via email.')) {
      return;
    }

    setProcessingId(brandId);
    setError('');
    setSuccess('');

    try {
      const response = await serverApi.admin.brands.approve(brandId);
      setSuccess(`Brand approved successfully! ${response.password_sent ? 'Login credentials have been sent via email.' : 'Note: Email service may not be configured.'}`);
      setTimeout(() => {
        setSuccess('');
        loadPendingBrands();
      }, 3000);
    } catch (err) {
      console.error('Failed to approve brand:', err);
      setError(err.message || 'Failed to approve brand');
      setTimeout(() => setError(''), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.brandId) return;
    
    setProcessingId(rejectModal.brandId);
    setError('');
    setSuccess('');

    try {
      await serverApi.admin.brands.reject(rejectModal.brandId, rejectModal.reason);
      setSuccess('Brand rejected successfully. The reseller has been notified.');
      setRejectModal({ show: false, brandId: null, reason: '' });
      setTimeout(() => {
        setSuccess('');
        loadPendingBrands();
      }, 3000);
    } catch (err) {
      console.error('Failed to reject brand:', err);
      setError(err.message || 'Failed to reject brand');
      setTimeout(() => setError(''), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (brandId) => {
    setRejectModal({ show: true, brandId, reason: '' });
  };

  const closeRejectModal = () => {
    setRejectModal({ show: false, brandId: null, reason: '' });
  };

  if (loading && page === 1) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i>
        <p className="text-gray-600">Loading pending brands...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Pending Brand Approvals</h2>
        <p className="text-sm text-gray-600 mt-1">Review and approve brand registrations submitted by resellers</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
          <i className="fas fa-check-circle mr-2"></i>
          {success}
        </div>
      )}

      {/* Stats Card */}
      <div className="glass-card p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Pending Brands</p>
            <p className="text-3xl font-bold text-yellow-600">{meta.total}</p>
          </div>
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <i className="fas fa-clock text-3xl text-yellow-500"></i>
          </div>
        </div>
      </div>

      {/* Brands List */}
      {brands.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Brands</h3>
          <p className="text-gray-600">All brand registrations have been reviewed.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Brand Name</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Email</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Username</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Slug</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Commission Rate</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Created By</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Submitted</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand) => (
                    <tr key={brand.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          {brand.logo_url ? (
                            <img 
                              src={brand.logo_url} 
                              alt={brand.name} 
                              className="w-10 h-10 rounded mr-3 object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded mr-3 bg-purple-100 flex items-center justify-center">
                              <i className="fas fa-store text-purple-600"></i>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{brand.name}</p>
                            {brand.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">{brand.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">{brand.email}</td>
                      <td className="py-4 px-6">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{brand.username}</code>
                      </td>
                      <td className="py-4 px-6">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{brand.slug}</code>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">{brand.commission_rate}%</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {brand.parent_brand_name ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <i className="fas fa-network-wired mr-1"></i>
                            {brand.parent_brand_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {new Date(brand.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleApprove(brand.id)}
                            disabled={processingId === brand.id}
                            className="action-btn btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === brand.id ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Processing...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-check mr-2"></i>
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openRejectModal(brand.id)}
                            disabled={processingId === brand.id}
                            className="action-btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <i className="fas fa-times mr-2"></i>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {brands.map((brand) => (
              <div key={brand.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center flex-1 min-w-0">
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url} 
                        alt={brand.name} 
                        className="w-12 h-12 rounded mr-3 object-cover flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded mr-3 bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-store text-purple-600"></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{brand.name}</p>
                      <p className="text-xs text-gray-500">{brand.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Username:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{brand.username}</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Slug:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{brand.slug}</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Commission:</span>
                    <span className="font-medium">{brand.commission_rate}%</span>
                  </div>
                  {brand.parent_brand_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Created By:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        <i className="fas fa-network-wired mr-1"></i>
                        {brand.parent_brand_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Submitted:</span>
                    <span className="text-gray-900">{new Date(brand.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleApprove(brand.id)}
                    disabled={processingId === brand.id}
                    className="action-btn btn-primary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === brand.id ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check mr-2"></i>
                        Approve
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => openRejectModal(brand.id)}
                    disabled={processingId === brand.id}
                    className="action-btn btn-secondary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="action-btn btn-secondary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {meta.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                disabled={page >= meta.pages}
                className="action-btn btn-secondary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold gradient-text">Reject Brand</h3>
                <button 
                  onClick={closeRejectModal}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  placeholder="Provide a reason for rejection (will be sent to reseller via email)..."
                  className="search-input p-3 rounded-lg w-full resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This reason will be included in the rejection email sent to the reseller.
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={closeRejectModal}
                  className="action-btn btn-secondary px-6"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingId === rejectModal.brandId}
                  className="action-btn btn-danger px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingId === rejectModal.brandId ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-times mr-2"></i>
                      Reject Brand
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

