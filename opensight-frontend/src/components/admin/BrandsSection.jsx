import React, { useState, useEffect } from 'react';
import BrandModal from './BrandModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { serverApi } from '@/api/serverApi';

export default function BrandsSection() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    q: ''
  });
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [modalState, setModalState] = useState({
    show: false,
    mode: null, // 'view', 'edit', 'create'
    brand: null
  });
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    brandId: null
  });

  useEffect(() => {
    loadBrands();
  }, [state.page, state.q]);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const params = {
        page: String(state.page),
        pageSize: String(state.pageSize),
        ...(state.q ? { q: state.q } : {})
      };
      
      const data = await serverApi.admin.brands.list(params);
      setBrands(data.brands || []);
      setMeta(data.meta || { page: 1, pages: 1, total: 0 });
      setState(prev => ({ ...prev, total: data.meta?.total || 0 }));
    } catch (error) {
      console.error('Failed to load brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'status-active';
    if (s === 'inactive') return 'status-inactive';
    return 'status-pending';
  };

  const openDeleteModal = (brandId) => {
    setDeleteModal({ show: true, brandId });
  };

  const confirmDelete = async () => {
    try {
      await serverApi.admin.brands.delete(deleteModal.brandId);
      setDeleteModal({ show: false, brandId: null });
      loadBrands();
    } catch (error) {
      console.error('Failed to delete brand:', error);
      alert('❌ Failed to delete brand: ' + error.message);
      setDeleteModal({ show: false, brandId: null });
    }
  };

  const viewBrand = async (brandId) => {
    try {
      const data = await serverApi.admin.brands.get(brandId);
      setModalState({ show: true, mode: 'view', brand: data.brand });
    } catch (error) {
      console.error('Failed to view brand:', error);
      alert('❌ Failed to load brand details');
    }
  };

  const editBrand = async (brandId) => {
    try {
      const data = await serverApi.admin.brands.get(brandId);
      setModalState({ show: true, mode: 'edit', brand: data.brand });
    } catch (error) {
      console.error('Failed to load brand:', error);
      alert('❌ Failed to load brand details');
    }
  };

  const createBrand = () => {
    setModalState({ show: true, mode: 'create', brand: null });
  };

  const closeModal = () => {
    setModalState({ show: false, mode: null, brand: null });
  };

  const handleBrandSuccess = () => {
    loadBrands();
  };

  // Calculate stats
  const stats = {
    total: meta.total || 0,
    active: brands.filter(b => (b.status || '').toLowerCase() === 'active').length,
    inactive: brands.filter(b => (b.status || '').toLowerCase() === 'inactive').length
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">Brands Management</h2>
        <button className="action-btn btn-primary" onClick={createBrand}>
          <i className="fas fa-plus mr-2"></i>Add Brand Partner
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Total Brands</h3>
          <p className="text-3xl font-bold text-cyan-400">{stats.total}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Active Brands</h3>
          <p className="text-3xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Inactive Brands</h3>
          <p className="text-3xl font-bold text-yellow-400">{stats.inactive}</p>
        </div>
      </div>
      
      {/* Search */}
      <div className="glass-panel p-6 mb-6">
        <div className="grid grid-cols-1 gap-4">
          <input
            type="text"
            placeholder="Search brands by name, website, or description..."
            className="search-input p-3 rounded-lg"
            value={state.q}
            onChange={(e) => setState(prev => ({ ...prev, q: e.target.value, page: 1 }))}
          />
        </div>
      </div>
      
      {/* Brands Table */}
      <div className="glass-panel p-6">
        {loading ? (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
            <p className="text-gray-400">Loading brands...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left p-4">ID</th>
                  <th className="text-left p-4">Username</th>
                  <th className="text-left p-4">Logo</th>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Website</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Created</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4 mono" data-label="ID">#{brand.id}</td>
                    <td className="p-4 mono font-semibold text-cyan-400" data-label="Username">
                      {brand.username || '-'}
                    </td>
                    <td className="p-4" data-label="Logo">
                      {brand.logo_url ? (
                        <img 
                          src={brand.logo_url} 
                          alt={brand.name} 
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {brand.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold" data-label="Name">{brand.name || 'N/A'}</td>
                    <td className="p-4" data-label="Website">
                      {brand.website ? (
                        <a 
                          href={brand.website} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-cyan-400 hover:underline"
                        >
                          {brand.website.replace(/^https?:\/\//, '').substring(0, 30)}
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4" data-label="Status">
                      <span className={`status-badge ${getStatusBadge(brand.status)}`}>
                        {brand.status || 'active'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400" data-label="Created">
                      {new Date(brand.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4" data-label="Actions">
                      <div className="flex space-x-2">
                        <button 
                          className="action-btn btn-secondary"
                          onClick={() => viewBrand(brand.id)}
                          title="View brand details"
                        >
                          View
                        </button>
                        <button 
                          className="action-btn btn-primary"
                          onClick={() => editBrand(brand.id)}
                          title="Edit brand"
                        >
                          Edit
                        </button>
                        <button 
                          className="action-btn btn-danger"
                          onClick={() => openDeleteModal(brand.id)}
                          title="Delete brand"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-400">
                      No brands found. Click "Add Brand Partner" to create your first brand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && brands.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <button
              className="action-btn btn-secondary"
              onClick={() => state.page > 1 && setState(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={state.page <= 1}
            >
              <i className="fas fa-chevron-left mr-2"></i>Previous
            </button>
            <div className="text-sm text-gray-400">
              Page {meta.page} of {meta.pages} — {meta.total} total
            </div>
            <button
              className="action-btn btn-secondary"
              onClick={() => state.page < meta.pages && setState(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={state.page >= meta.pages}
            >
              Next<i className="fas fa-chevron-right ml-2"></i>
            </button>
          </div>
        )}
      </div>

      {/* Brand Modal */}
      {modalState.show && (
        <BrandModal
          brand={modalState.brand}
          mode={modalState.mode}
          onClose={closeModal}
          onSuccess={handleBrandSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <DeleteConfirmModal
          title="Delete Brand"
          message={`Are you sure you want to delete this brand? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal({ show: false, brandId: null })}
        />
      )}
    </div>
  );
}

