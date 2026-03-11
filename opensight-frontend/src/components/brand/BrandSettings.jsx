import React, { useState, useEffect } from 'react';
import { User as UserIcon, Shield, Bell, CreditCard } from 'lucide-react';
import BrandProfile from './BrandProfile';
import { serverApi } from '@/api/serverApi';

// Security Section Component
function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement brand password change API
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-4 md:mb-6">Security</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleUpdatePassword}>
        <h3 className="text-base font-medium text-slate-900 mb-4">Change Password</h3>
        
        <div className="space-y-5">
          <div>
            <label htmlFor="current-password" className="text-sm font-medium text-slate-700 mb-2 block">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="text-sm font-medium text-slate-700 mb-2 block">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700 mb-2 block">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Confirm new password"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-black hover:bg-slate-800 text-white px-8 py-2 rounded-md transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Notifications Section Component
function NotificationsSection() {
  const [notifications, setNotifications] = useState({
    weekly_summary: false,
    payout_updates: false,
    security_alerts: false,
  });

  const handleToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    // TODO: Save to backend
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-4 md:mb-6">Notifications</h2>
      
      <div className="space-y-1">
        <div className="flex items-start sm:items-center justify-between py-4 sm:py-5 border-b border-slate-200 gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-slate-900">Weekly Summary</h3>
            <p className="text-sm text-slate-500 mt-1">
              Receive a summary of your weekly performance.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={notifications.weekly_summary}
              onChange={() => handleToggle('weekly_summary')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-start sm:items-center justify-between py-4 sm:py-5 border-b border-slate-200 gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-slate-900">Payout Updates</h3>
            <p className="text-sm text-slate-500 mt-1">
              Get notified when a payout is processed.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={notifications.payout_updates}
              onChange={() => handleToggle('payout_updates')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-start sm:items-center justify-between py-4 sm:py-5 gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-slate-900">Security Alerts</h3>
            <p className="text-sm text-slate-500 mt-1">
              Receive alerts for unusual account activity.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={notifications.security_alerts}
              onChange={() => handleToggle('security_alerts')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}

// Settlements Section Component
function SettlementsSection() {
  const [activeTab, setActiveTab] = useState('crypto');
  const [cryptoWallet, setCryptoWallet] = useState('');
  const [bankDetails, setBankDetails] = useState({
    holder: '',
    iban: '',
    swift: '',
    name: '',
    address: ''
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load existing settlement data
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await serverApi.settings.getSettings();
        
        if (settings.settlement_method) {
          setActiveTab(settings.settlement_method);
        }
        
        if (settings.settlement_crypto_wallet) {
          setCryptoWallet(settings.settlement_crypto_wallet);
        }
        
        setBankDetails({
          holder: settings.settlement_bank_holder || '',
          iban: settings.settlement_bank_iban || '',
          swift: settings.settlement_bank_swift || '',
          name: settings.settlement_bank_name || '',
          address: settings.settlement_bank_address || ''
        });
      } catch (err) {
        console.error('Failed to load settlement settings:', err);
        setError('Failed to load existing settings');
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const settlementData = {
        settlement_method: activeTab,
        settlement_crypto_wallet: activeTab === 'crypto' ? cryptoWallet : null,
        settlement_bank_holder: activeTab === 'fiat' ? bankDetails.holder : null,
        settlement_bank_iban: activeTab === 'fiat' ? bankDetails.iban : null,
        settlement_bank_swift: activeTab === 'fiat' ? bankDetails.swift : null,
        settlement_bank_name: activeTab === 'fiat' ? bankDetails.name : null,
        settlement_bank_address: activeTab === 'fiat' ? bankDetails.address : null
      };
      
      await serverApi.settings.updateSettlement(settlementData);
      setSuccess('Settlement settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save settlement settings:', err);
      setError(err.message || 'Failed to save settlement settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="text-center py-8">
          <div className="text-slate-400">Loading settlement settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-2">Settlement Methods</h2>
      <p className="text-slate-500 text-sm mb-6">Choose and configure how you receive your payouts.</p>
      
      {/* Error and Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-700">
          {success}
        </div>
      )}
      
      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <button
            onClick={() => setActiveTab('crypto')}
            className={`px-4 md:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'crypto'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Crypto (USDC)
          </button>
          <button
            onClick={() => setActiveTab('fiat')}
            className={`px-4 md:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'fiat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FIAT (Bank Transfer)
          </button>
        </div>
      </div>

      {/* Crypto Tab Content */}
      {activeTab === 'crypto' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-medium text-slate-900 mb-4">USDC ERC20 Wallet</h3>
            
            <div>
              <label htmlFor="wallet-address" className="text-sm font-medium text-slate-700 mb-2 block">
                Wallet Address
              </label>
              <input
                id="wallet-address"
                type="text"
                placeholder="0x..."
                value={cryptoWallet}
                onChange={(e) => setCryptoWallet(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-black hover:bg-slate-800 text-white px-8 py-2 rounded-md transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settlement Settings'}
            </button>
          </div>
        </div>
      )}

      {/* FIAT Tab Content */}
      {activeTab === 'fiat' && (
        <div className="space-y-5">
          <h3 className="text-base font-medium text-slate-900 mb-4">Bank Account Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="account-holder" className="text-sm font-medium text-slate-700 mb-2 block">
                Account Holder Name
              </label>
              <input
                id="account-holder"
                type="text"
                value={bankDetails.holder}
                onChange={(e) => setBankDetails({ ...bankDetails, holder: e.target.value })}
                className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter account holder name"
              />
            </div>

            <div>
              <label htmlFor="iban" className="text-sm font-medium text-slate-700 mb-2 block">
                IBAN
              </label>
              <input
                id="iban"
                type="text"
                value={bankDetails.iban}
                onChange={(e) => setBankDetails({ ...bankDetails, iban: e.target.value })}
                className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter IBAN"
              />
            </div>

            <div>
              <label htmlFor="swift" className="text-sm font-medium text-slate-700 mb-2 block">
                SWIFT / BIC
              </label>
              <input
                id="swift"
                type="text"
                value={bankDetails.swift}
                onChange={(e) => setBankDetails({ ...bankDetails, swift: e.target.value })}
                className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter SWIFT/BIC"
              />
            </div>

            <div>
              <label htmlFor="bank-name" className="text-sm font-medium text-slate-700 mb-2 block">
                Bank Name
              </label>
              <input
                id="bank-name"
                type="text"
                value={bankDetails.name}
                onChange={(e) => setBankDetails({ ...bankDetails, name: e.target.value })}
                className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter bank name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bank-address" className="text-sm font-medium text-slate-700 mb-2 block">
              Bank Address
            </label>
            <input
              id="bank-address"
              type="text"
              value={bankDetails.address}
              onChange={(e) => setBankDetails({ ...bankDetails, address: e.target.value })}
              className="w-full border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter bank address"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-black hover:bg-slate-800 text-white px-8 py-2 rounded-md transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settlement Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Brand Settings Component
export default function BrandSettings() {
  const [activeSection, setActiveSection] = useState('profile');

  const sections = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settlements', label: 'Settlements', icon: CreditCard },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 md:p-8">
            {activeSection === 'profile' && <BrandProfile />}
            {activeSection === 'security' && <SecuritySection />}
            {activeSection === 'notifications' && <NotificationsSection />}
            {activeSection === 'settlements' && <SettlementsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}


