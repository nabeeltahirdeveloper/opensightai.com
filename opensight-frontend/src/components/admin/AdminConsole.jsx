import React, { useState, useEffect } from 'react';
import AdminSidebar from './AdminSidebar';
import DashboardSection from './DashboardSection';
import OrdersSection from './OrdersSection';
import UsersSection from './UsersSection';
import BrandsSection from './BrandsSection';
import BrandWalletsSection from './BrandWalletsSection';
import PackagesSection from './PackagesSection';
import CurrenciesSection from './CurrenciesSection';
import CurrencyGeoMappingsSection from './CurrencyGeoMappingsSection';
import AdminVisitsSection from './AdminVisitsSection';
import AdminAllTransactionsSection from './AdminAllTransactionsSection';
import BlockedIPsSection from './BlockedIPsSection';
import AdminPayoutsSection from './AdminPayoutsSection';
import AdminPendingBrandsSection from './AdminPendingBrandsSection';
import IpWhitelistSection from './IpWhitelistSection';
import SystemToolsSection from './SystemToolsSection';
import AdminLogsSection from './AdminLogsSection';
import BotLogsSection from './BotLogsSection';
import DirectPurchaseLinksSection from './DirectPurchaseLinksSection';
import BrandsUnpaidTransactionsSection from './BrandsUnpaidTransactionsSection';
import './AdminConsole.css';

export default function AdminConsole() {
  const [activeSection, setActiveSection] = useState(() => {
    // Restore active section from localStorage on mount
    return localStorage.getItem('admin-active-section') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persist active section to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('admin-active-section', activeSection);
  }, [activeSection]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="admin-console-wrapper">
      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-btn"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      <AdminSidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          setActiveSection(section);
          closeSidebar();
        }}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      
      <div className="main-content">
        {activeSection === 'dashboard' && <DashboardSection />}
        {activeSection === 'orders' && <OrdersSection />}
        {activeSection === 'visits' && <AdminVisitsSection />}
        {activeSection === 'transactions' && <AdminAllTransactionsSection />}
        {activeSection === 'blocked-ips' && <BlockedIPsSection />}
        {activeSection === 'payouts' && <AdminPayoutsSection />}
        {activeSection === 'brands-unpaid-transactions' && <BrandsUnpaidTransactionsSection />}
        {activeSection === 'users' && <UsersSection />}
        {activeSection === 'brands' && <BrandsSection />}
        {activeSection === 'pending-brands' && <AdminPendingBrandsSection />}
        {activeSection === 'brand-wallets' && <BrandWalletsSection />}
        {activeSection === 'direct-purchase-links' && <DirectPurchaseLinksSection />}
        {activeSection === 'packages' && <PackagesSection />}
        {activeSection === 'currencies' && <CurrenciesSection />}
        {activeSection === 'currency-geo' && <CurrencyGeoMappingsSection />}
        {activeSection === 'ip-whitelist' && <IpWhitelistSection />}
        {activeSection === 'system-tools' && <SystemToolsSection />}
        {activeSection === 'logs' && <AdminLogsSection />}
        {activeSection === 'bot-logs' && <BotLogsSection />}
        {activeSection === 'analytics' && <AnalyticsSection />}
        {activeSection === 'settings' && <SettingsSection />}
      </div>
    </div>
  );
}

// Placeholder components for sections not yet fully implemented
function OldPackagesSection() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">Package Management</h2>
        <button className="action-btn btn-primary">
          <i className="fas fa-plus mr-2"></i>Create Package
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Essential', 'Professional', 'Expert'].map((name, i) => (
          <div key={name} className={`glass-card p-6 rounded-xl ${i === 1 ? 'neon-border' : ''}`}>
            {i === 1 && (
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold">{name}</h3>
                <span className="text-xs bg-cyan-500 text-black px-2 py-1 rounded">POPULAR</span>
              </div>
            )}
            {i !== 1 && <h3 className="text-xl font-bold mb-2">{name}</h3>}
            <p className={`text-3xl font-bold mb-4 ${i === 0 ? 'text-cyan-400' : i === 1 ? 'text-purple-400' : 'text-green-400'}`}>
              ${[59, 179, 449][i]}
            </p>
            <ul className="space-y-2 mb-6">
              <li className="text-sm text-gray-300">• {[50, 150, 1000][i]} Credits</li>
              <li className="text-sm text-gray-300">• {['Basic', 'Advanced', 'All'][i]} Features</li>
              <li className="text-sm text-gray-300">• {['Email', 'Priority', '24/7'][i]} Support</li>
            </ul>
            <div className="flex space-x-2">
              <button className="action-btn btn-primary flex-1">Edit</button>
              <button className="action-btn btn-secondary">Clone</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">Advanced Analytics</h2>
        <select className="search-input p-2 rounded-lg">
          <option>Last 30 days</option>
          <option>Last 90 days</option>
          <option>Last year</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-xl font-semibold mb-4">Revenue Analytics</h3>
          <div className="chart-container">
            <canvas id="analyticsRevenueChart"></canvas>
          </div>
        </div>
        
        <div className="glass-panel p-6">
          <h3 className="text-xl font-semibold mb-4">Package Distribution</h3>
          <div className="chart-container">
            <canvas id="packageChart"></canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">System Settings</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-xl font-semibold mb-4">General Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Platform Name</label>
              <input type="text" defaultValue="OpenSightAI" className="search-input p-3 rounded-lg w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Admin Email</label>
              <input type="email" defaultValue="admin@OpenSightai.com" className="search-input p-3 rounded-lg w-full" />
            </div>
            <button className="action-btn btn-primary">Save Changes</button>
          </div>
        </div>
        
        <div className="glass-panel p-6">
          <h3 className="text-xl font-semibold mb-4">Security Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Two-Factor Authentication</span>
              <button className="action-btn btn-primary">Enable</button>
            </div>
            <div className="flex items-center justify-between">
              <span>Session Timeout</span>
              <select className="search-input p-2 rounded-lg">
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
              </select>
            </div>
            <button className="action-btn btn-primary">Update Security</button>
          </div>
        </div>
      </div>
    </div>
  );
}
