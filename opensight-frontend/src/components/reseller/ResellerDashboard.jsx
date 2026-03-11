import React, { useState } from 'react';
import ResellerSidebar from './ResellerSidebar';
import ResellerDashboardSection from './ResellerDashboardSection';
import ResellerNetworkSection from './ResellerNetworkSection';
import ResellerLinksSection from './ResellerLinksSection';
import ResellerAllTransactionsSection from './ResellerAllTransactionsSection';
import ResellerVisitsSection from './ResellerVisitsSection';
import ResellerPayoutsSection from './ResellerPayoutsSection';
import ResellerSettings from './ResellerSettings';
import '@/components/admin/AdminConsole.css';

export default function ResellerDashboard() {
  const [activeSection, setActiveSection] = useState(() => {
    // Restore active section from localStorage on mount
    return localStorage.getItem('reseller-active-section') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persist active section to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('reseller-active-section', activeSection);
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

      <ResellerSidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          setActiveSection(section);
          closeSidebar();
        }}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      
      <div className="main-content">
        {activeSection === 'dashboard' && <ResellerDashboardSection />}
        {activeSection === 'brand-links' && <ResellerLinksSection />}
        {activeSection === 'network' && <ResellerNetworkSection />}
        {activeSection === 'transactions' && <ResellerAllTransactionsSection />}
        {activeSection === 'visits' && <ResellerVisitsSection />}
        {activeSection === 'payouts' && <ResellerPayoutsSection />}
        {activeSection === 'settings' && <ResellerSettings />}
      </div>
    </div>
  );
}


