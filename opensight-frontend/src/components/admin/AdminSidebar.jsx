import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';

export default function AdminSidebar({ activeSection, onSectionChange, isOpen, onClose }) {
  const [expandedCategories, setExpandedCategories] = useState({});

  const handleLogout = () => {
    // Clear any stored auth data
    localStorage.clear();
    sessionStorage.clear();
    // Redirect to login page
    window.location.href = createPageUrl('Login');
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const menuCategories = [
    { 
      id: 'dashboard', 
      icon: 'fa-tachometer-alt', 
      label: 'Dashboard', 
      color: 'text-purple-400' 
    },
    {
      id: 'orders-transactions',
      icon: 'fa-shopping-cart',
      label: 'Orders & Transactions',
      color: 'text-cyan-400',
      items: [
        { id: 'orders', icon: 'fa-shopping-cart', label: 'Orders', color: 'text-cyan-400' },
        { id: 'transactions', icon: 'fa-list', label: 'All Transactions', color: 'text-green-400' },
        { id: 'payouts', icon: 'fa-dollar-sign', label: 'Payouts', color: 'text-emerald-400' },
        { id: 'direct-purchase-links', icon: 'fa-link', label: 'Direct Purchase Links', color: 'text-orange-400' },
        { id: 'packages', icon: 'fa-box', label: 'Packages', color: 'text-pink-400' },
        { id: 'brands-unpaid-transactions', icon: 'fa-exclamation-triangle', label: 'Brands For Payouts', color: 'text-red-400' },
      ]
    },
    {
      id: 'users-brands',
      icon: 'fa-users',
      label: 'Users & Brands',
      color: 'text-orange-400',
      items: [
        { id: 'users', icon: 'fa-users', label: 'Users', color: 'text-orange-400' },
        { id: 'brands', icon: 'fa-building', label: 'Brands Management', color: 'text-yellow-400' },
        { id: 'pending-brands', icon: 'fa-clock', label: 'Pending Brands', color: 'text-yellow-300' },
        { id: 'brand-wallets', icon: 'fa-wallet', label: 'Brand Wallets', color: 'text-amber-400' },
      ]
    },
    {
      id: 'traffic-security',
      icon: 'fa-shield-alt',
      label: 'Traffic & Security',
      color: 'text-red-400',
      items: [
        { id: 'visits', icon: 'fa-eye', label: 'Visits', color: 'text-blue-400' },
        { id: 'blocked-ips', icon: 'fa-ban', label: 'Blocked IPs', color: 'text-red-500' },
        { id: 'ip-whitelist', icon: 'fa-shield-alt', label: 'Access Control', color: 'text-red-400' },
      ]
    },
    {
      id: 'currencies-geo',
      icon: 'fa-globe-americas',
      label: 'Currencies & Geo Settings',
      color: 'text-teal-400',
      items: [
        { id: 'currencies', icon: 'fa-money-bill', label: 'Currencies', color: 'text-teal-400' },
        { id: 'currency-geo', icon: 'fa-globe-americas', label: 'Currency Geo Mapping', color: 'text-lime-400' },
      ]
    },
    {
      id: 'logs-monitoring',
      icon: 'fa-chart-line',
      label: 'Logs & System Monitoring',
      color: 'text-violet-400',
      items: [
        { id: 'logs', icon: 'fa-file-alt', label: 'System Logs', color: 'text-violet-400' },
        { id: 'bot-logs', icon: 'fa-robot', label: 'Bot Logs', color: 'text-cyan-400' },
        { id: 'analytics', icon: 'fa-chart-bar', label: 'Analytics', color: 'text-indigo-400' },
        { id: 'system-tools', icon: 'fa-wrench', label: 'System Tools', color: 'text-rose-400' },
        { id: 'settings', icon: 'fa-cog', label: 'Settings', color: 'text-gray-400' },
      ]
    },
  ];

  // Check if current activeSection is within a category
  const isCategoryActive = (category) => {
    if (!category.items) return false;
    return category.items.some(item => item.id === activeSection);
  };

  // Auto-expand category when one of its sub-items is active
  useEffect(() => {
    menuCategories.forEach(category => {
      if (category.items && isCategoryActive(category)) {
        setExpandedCategories(prev => ({
          ...prev,
          [category.id]: true
        }));
      }
    });
  }, [activeSection]);

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

      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Header Section - Fixed */}
        <div className="sidebar-header">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">OpenSightAI</h1>
                <p className="text-xs text-gray-400 mono">Admin Console</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="sidebar-close-x md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close sidebar"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
      
        {/* Navigation Section - Scrollable */}
        <nav className="sidebar-nav">
          <div className="space-y-2">
            {menuCategories.map(category => (
              <div key={category.id}>
                {/* Category without sub-items (Dashboard, Settings) */}
                {!category.items ? (
                  <div
                    className={`nav-item p-3 cursor-pointer ${activeSection === category.id ? 'active' : ''}`}
                    onClick={() => onSectionChange(category.id)}
                  >
                    <i className={`fas ${category.icon} mr-3 ${category.color}`}></i>
                    <span>{category.label}</span>
                  </div>
                ) : (
                  /* Category with sub-items */
                  <>
                    <div
                      className={`nav-item nav-category p-3 cursor-pointer ${isCategoryActive(category) ? 'category-active' : ''}`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <i className={`fas ${category.icon} mr-3 ${category.color}`}></i>
                      <span>{category.label}</span>
                      <i className={`fas fa-chevron-right ml-auto chevron-icon ${expandedCategories[category.id] ? 'expanded' : ''}`}></i>
                    </div>
                    {/* Sub-items */}
                    {expandedCategories[category.id] && (
                      <div className="sub-items">
                        {category.items.map(item => (
                          <div
                            key={item.id}
                            className={`nav-item nav-sub-item p-3 cursor-pointer ${activeSection === item.id ? 'active' : ''}`}
                            onClick={() => onSectionChange(item.id)}
                          >
                            <i className={`fas ${item.icon} mr-3 ${item.color}`}></i>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </nav>
      
        {/* Logout Section - Fixed at Bottom */}
        <div className="sidebar-footer">
          <div className="glass-card p-4 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mx-auto mb-2 flex items-center justify-center">
              <i className="fas fa-user text-white"></i>
            </div>
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-gray-400">admin@OpenSightai.com</p>
            <button 
              onClick={handleLogout}
              className="mt-3 w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      
      <style jsx>{`
        .sidebar {
          background: rgba(15, 15, 35, 0.9);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        
        .sidebar-header {
          flex-shrink: 0;
          padding: 1.5rem 1.5rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem 1.5rem;
          margin-bottom: 0;
        }
        
        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }
        
        .sidebar-nav::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(124, 58, 237, 0.5);
          border-radius: 3px;
        }
        
        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 58, 237, 0.7);
        }
        
        .sidebar-footer {
          flex-shrink: 0;
          padding: 1rem 1.5rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 15, 35, 0.95);
        }
        
        .nav-item {
          transition: all 0.2s ease;
          border-radius: 8px;
          margin: 2px 0;
          position: relative;
          display: flex;
          align-items: center;
          border-left: 3px solid transparent;
        }
        
        .nav-item:hover {
          background: rgba(0, 212, 255, 0.1);
          border-left: 3px solid #00d4ff;
          transform: translateX(2px);
        }
        
        .nav-item.active {
          background: rgba(124, 58, 237, 0.25);
          border-left: 3px solid #7c3aed;
          font-weight: 600;
        }

        .nav-category {
          font-weight: 600;
          background: rgba(255, 255, 255, 0.03);
        }

        .nav-category:hover {
          background: rgba(0, 212, 255, 0.08);
        }

        .nav-category.category-active {
          background: rgba(124, 58, 237, 0.15);
          border-left: 3px solid rgba(124, 58, 237, 0.6);
        }

        .chevron-icon {
          font-size: 11px;
          transition: transform 0.25s ease;
          color: rgba(255, 255, 255, 0.5);
          margin-left: auto;
        }

        .chevron-icon.expanded {
          transform: rotate(90deg);
          color: rgba(255, 255, 255, 0.8);
        }

        .sub-items {
          margin-left: 0;
          margin-top: 4px;
          margin-bottom: 4px;
          overflow: hidden;
          animation: slideDown 0.3s ease;
          border-radius: 8px;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }

        .nav-sub-item {
          padding: 0.75rem 1rem 0.75rem 2.5rem !important;
          font-size: 0.875rem;
          margin: 0;
          border-left: 3px solid transparent;
          background: rgba(0, 0, 0, 0.1);
        }

        .nav-sub-item:hover {
          background: rgba(0, 212, 255, 0.15);
          border-left: 3px solid #00d4ff;
        }

        .nav-sub-item.active {
          background: rgba(124, 58, 237, 0.3);
          border-left: 3px solid #7c3aed;
          font-weight: 500;
        }
        
        .nav-sub-item i {
          font-size: 0.875rem;
          width: 20px;
        }
      `}</style>
      </div>
    </>
  );
}
