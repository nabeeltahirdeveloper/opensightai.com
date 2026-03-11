import React, { useState } from 'react';
import BrandSidebar from './BrandSidebar';
import BrandDashboardSection from './BrandDashboardSection';
import BrandOrdersSection from './BrandOrdersSection';
import BrandAnalyticsSection from './BrandAnalyticsSection';
import BrandCommissionSection from './BrandCommissionSection';
import BrandProfile from './BrandProfile';
import BrandLinksSection from './BrandLinksSection';
import DirectPurchaseLinksSection from './DirectPurchaseLinksSection';
import BrandNetworkTransactionsSection from './BrandNetworkTransactionsSection';
import BrandVisitsSection from './BrandVisitsSection';
import BrandAllTransactionsSection from './BrandAllTransactionsSection';
import BrandPayoutsSection from './BrandPayoutsSection';
import BrandSettings from './BrandSettings';
import '@/components/admin/AdminConsole.css';

export default function BrandDashboard() {
  const [activeSection, setActiveSection] = useState(() => {
    // Restore active section from localStorage on mount
    return localStorage.getItem('brand-active-section') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persist active section to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('brand-active-section', activeSection);
  }, [activeSection]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="admin-console-wrapper brand-light">
      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-btn"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      <BrandSidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          setActiveSection(section);
          closeSidebar();
        }}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      
      <div className="main-content">
        {activeSection === 'dashboard' && <BrandDashboardSection />}
        {activeSection === 'brand-links' && <BrandLinksSection />}
        {activeSection === 'direct-purchase-links' && <DirectPurchaseLinksSection />}
        {activeSection === 'network' && <BrandNetworkTransactionsSection />}
        {activeSection === 'transactions' && <BrandAllTransactionsSection />}
        {activeSection === 'visits' && <BrandVisitsSection />}
        {activeSection === 'payouts' && <BrandPayoutsSection />}
        {activeSection === 'settings' && <BrandSettings />}
        
        {/* Legacy sections - keeping for backward compatibility */}
        {activeSection === 'orders' && <BrandOrdersSection />}
        {activeSection === 'analytics' && <BrandAnalyticsSection />}
        {activeSection === 'commission' && <BrandCommissionSection />}
        {activeSection === 'profile' && <BrandProfile />}
      </div>
    </div>
  );
}
