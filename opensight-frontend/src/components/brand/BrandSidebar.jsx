import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function BrandSidebar({ activeSection, onSectionChange, isOpen, onClose }) {
  const [brandInfo, setBrandInfo] = useState(null);
  const [hasChildBrands, setHasChildBrands] = useState(false);

  useEffect(() => {
    // Load brand info for display
    const loadBrandInfo = async () => {
      try {
        const data = await serverApi.brand.profile.get();
        setBrandInfo(data.brand);
        
        // Check if brand has child brands by attempting to fetch network transactions
        try {
          await serverApi.brand.networkTransactions.list();
          setHasChildBrands(true);
        } catch (e) {
          // If 404 or error, brand doesn't have child brands
          setHasChildBrands(false);
        }
      } catch (e) {
        console.error('Failed to load brand info:', e);
      }
    };

    loadBrandInfo();
  }, []);

  const menuItems = [
    { id: 'dashboard', icon: 'fa-home', label: 'Dashboard' },
    { id: 'brand-links', icon: 'fa-link', label: 'Brand Links' },
    { id: 'direct-purchase-links', icon: 'fa-shopping-cart', label: 'Direct Purchase Links' },
    ...(hasChildBrands ? [{ id: 'network', icon: 'fa-network-wired', label: 'Network Transactions' }] : []),
    { id: 'transactions', icon: 'fa-list', label: 'All Transactions' },
    { id: 'visits', icon: 'fa-eye', label: 'Visits' },
    { id: 'payouts', icon: 'fa-dollar-sign', label: 'Payouts' },
    { id: 'settings', icon: 'fa-cog', label: 'Settings' }
  ];

  const handleLogout = async () => {
    try {
      await serverApi.auth.logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
    // Redirect to login regardless of API call result
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div className={`sidebar brand-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="flex items-center justify-between w-full mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-handshake text-white"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">OpenSightAI</h1>
              <p className="text-xs text-gray-500">Brand Dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sidebar-close-x md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Close sidebar"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      
      <nav className="space-y-1">
        {menuItems.map(item => (
          <div
            key={item.id}
            className={`nav-item-brand p-3 cursor-pointer flex items-center ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            <i className={`fas ${item.icon} mr-3 text-gray-600`} style={{ width: '20px' }}></i>
            <span className="text-gray-700">{item.label}</span>
          </div>
        ))}
      </nav>
      
      <div className="absolute bottom-6 left-6 right-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all text-sm"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>
      </div>
      
      <style jsx>{`
        .brand-sidebar {
          background: white;
          border-right: 1px solid #E5E7EB;
        }
        
        .nav-item-brand {
          transition: all 0.2s ease;
          border-radius: 8px;
          margin: 2px 0;
          font-size: 14px;
        }
        
        .nav-item-brand:hover {
          background: #F3F4F6;
        }
        
        .nav-item-brand.active {
          background: #EFF6FF;
          color: #3B82F6;
        }
        
        .nav-item-brand.active i {
          color: #3B82F6;
        }
        
        .nav-item-brand.active span {
          color: #3B82F6;
          font-weight: 500;
        }
      `}</style>
      </div>
    </>
  );
}
