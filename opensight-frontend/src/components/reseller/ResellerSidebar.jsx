import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function ResellerSidebar({ activeSection, onSectionChange, isOpen, onClose }) {
  const [resellerInfo, setResellerInfo] = useState(null);

  useEffect(() => {
    // Load reseller info for display
    const loadResellerInfo = async () => {
      try {
        const data = await serverApi.reseller.profile.get();
        setResellerInfo(data.brand);
      } catch (e) {
        console.error('Failed to load reseller info:', e);
      }
    };

    loadResellerInfo();
  }, []);

  const menuItems = [
    { id: 'dashboard', icon: 'fa-home', label: 'Dashboard' },
    { id: 'brand-links', icon: 'fa-link', label: 'Brand Links' },
    { id: 'network', icon: 'fa-network-wired', label: 'Network' },
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

      <div className={`sidebar reseller-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="flex items-center justify-between w-full mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-network-wired text-white"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">OpenSightAI</h1>
              <p className="text-xs text-gray-500">Reseller Dashboard</p>
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
            className={`nav-item-reseller p-3 cursor-pointer flex items-center ${activeSection === item.id ? 'active' : ''}`}
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
        .reseller-sidebar {
          background: white;
          border-right: 1px solid #E5E7EB;
        }
        
        .nav-item-reseller {
          transition: all 0.2s ease;
          border-radius: 8px;
          margin: 2px 0;
          font-size: 14px;
        }
        
        .nav-item-reseller:hover {
          background: #FAF5FF;
        }
        
        .nav-item-reseller.active {
          background: #F3E8FF;
          color: #9333EA;
        }
        
        .nav-item-reseller.active i {
          color: #9333EA;
        }
        
        .nav-item-reseller.active span {
          color: #9333EA;
          font-weight: 500;
        }
      `}</style>
      </div>
    </>
  );
}


