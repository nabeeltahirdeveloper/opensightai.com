import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function CurrenciesSection() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [lastSyncInfo, setLastSyncInfo] = useState(null);
  const [conversionFee, setConversionFee] = useState(6);
  const [editingFee, setEditingFee] = useState(false);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      setLoading(true);
      const data = await serverApi.admin.currencies.list();
      setCurrencies(data.currencies || []);
      setConversionFee(data.conversion_fee_usd || 6);
    } catch (error) {
      console.error('Failed to load currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRates = async () => {
    try {
      setSyncing(true);
      const data = await serverApi.admin.currencies.syncRates();
      setLastSyncInfo(data);
      await loadCurrencies();
      alert(`Successfully synced ${data.updated} currency rates from ${data.base_currency}`);
    } catch (error) {
      console.error('Failed to sync rates:', error);
      alert('Failed to sync exchange rates. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSetBaseCurrency = async (currencyCode) => {
    try {
      await serverApi.admin.currencies.update(currencyCode, { is_base: true });
      await loadCurrencies();
    } catch (error) {
      console.error('Failed to set base currency:', error);
    }
  };

  const handleToggleActive = async (currencyCode, currentActive) => {
    try {
      await serverApi.admin.currencies.update(currencyCode, { active: !currentActive });
      await loadCurrencies();
    } catch (error) {
      console.error('Failed to toggle currency active status:', error);
    }
  };

  const handleUpdateRate = async (currencyCode, newRate) => {
    try {
      await serverApi.admin.currencies.update(currencyCode, { exchange_rate: parseFloat(newRate) });
      await loadCurrencies();
      setEditingCurrency(null);
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
    }
  };

  const handleUpdateConversionFee = async (newFee) => {
    try {
      await serverApi.admin.currencies.updateConversionFee(parseFloat(newFee));
      setConversionFee(parseFloat(newFee));
      setEditingFee(false);
      alert('Conversion fee updated successfully!');
    } catch (error) {
      console.error('Failed to update conversion fee:', error);
      alert('Failed to update conversion fee. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-400">Loading currencies...</div>
      </div>
    );
  }

  const baseCurrency = currencies.find(c => c.is_base);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Currency Management</h2>
          {baseCurrency && (
            <p className="text-gray-400 mt-2 text-sm sm:text-base">
              Base Currency: <span className="text-white font-semibold">{baseCurrency.code} ({baseCurrency.name})</span>
            </p>
          )}
        </div>
        <button 
          className="action-btn btn-primary w-full sm:w-auto"
          onClick={handleSyncRates}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Syncing...
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt mr-2"></i>
              Sync Rates from API
            </>
          )}
        </button>
      </div>

      {lastSyncInfo && (
        <div className="glass-card p-4 mb-6 bg-green-900/20 border border-green-500/30">
          <div className="flex items-center">
            <i className="fas fa-check-circle text-green-400 mr-3"></i>
            <div>
              <p className="text-green-300 font-semibold">Last Sync Successful</p>
              <p className="text-sm text-gray-400">
                Updated {lastSyncInfo.updated} rates from {lastSyncInfo.base_currency} at {new Date(lastSyncInfo.synced_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Fee Section */}
      <div className="glass-card p-4 md:p-6 rounded-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
              <i className="fas fa-dollar-sign text-cyan-400 mr-2"></i>
              Currency Conversion Fee
            </h3>
            <p className="text-sm text-gray-400">
              This fee (in USD) will be deducted from all order amounts when displayed to brands/resellers. 
              This affects commission calculations and payout amounts shown in brand dashboards.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {editingFee ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={conversionFee}
                  className="search-input p-2 rounded w-24 text-center"
                  id="conversion-fee-input"
                  min="0"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('conversion-fee-input');
                    handleUpdateConversionFee(input.value);
                  }}
                  className="action-btn btn-primary px-3 py-2"
                >
                  <i className="fas fa-save mr-1"></i>
                  Save
                </button>
                <button
                  onClick={() => setEditingFee(false)}
                  className="action-btn btn-secondary px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-gray-400">Current Fee</div>
                  <div className="text-2xl font-bold text-white">
                    ${Number(conversionFee).toFixed(2)} USD
                  </div>
                </div>
                <button
                  onClick={() => setEditingFee(true)}
                  className="action-btn btn-primary px-3 py-2"
                >
                  <i className="fas fa-edit mr-1"></i>
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-4 md:p-6 rounded-xl">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Currency</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Symbol</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Exchange Rate</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Base</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Last Synced</th>
                <th className="text-right py-3 px-4 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.code} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-semibold text-white">{currency.code}</div>
                      <div className="text-sm text-gray-400">{currency.name}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-xl text-cyan-400">{currency.symbol}</span>
                  </td>
                  <td className="py-4 px-4">
                    {editingCurrency === currency.code ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          defaultValue={currency.exchange_rate}
                          className="search-input p-2 rounded w-32"
                          id={`rate-${currency.code}`}
                        />
                        <button
                          onClick={() => {
                            const input = document.getElementById(`rate-${currency.code}`);
                            handleUpdateRate(currency.code, input.value);
                          }}
                          className="action-btn btn-primary px-3 py-1 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCurrency(null)}
                          className="action-btn btn-secondary px-3 py-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">{Number(currency.exchange_rate).toFixed(4)}</span>
                        {!currency.is_base && (
                          <button
                            onClick={() => setEditingCurrency(currency.code)}
                            className="text-cyan-400 hover:text-cyan-300 text-sm"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleToggleActive(currency.code, currency.active)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        currency.active
                          ? 'bg-green-900/30 text-green-400 border border-green-500'
                          : 'bg-red-900/30 text-red-400 border border-red-500'
                      }`}
                    >
                      {currency.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-4 px-4">
                    {currency.is_base ? (
                      <span className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        BASE
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetBaseCurrency(currency.code)}
                        className="text-gray-400 hover:text-cyan-400 text-sm"
                      >
                        Set as Base
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {currency.last_synced ? new Date(currency.last_synced).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!currency.is_base && (
                        <button
                          onClick={() => setEditingCurrency(currency.code)}
                          className="action-btn btn-primary px-3 py-1 text-sm"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {currencies.map((currency) => (
            <div key={currency.code} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              {/* Currency Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currency.symbol}</span>
                  <div>
                    <div className="font-bold text-white text-lg">{currency.code}</div>
                    <div className="text-sm text-gray-400">{currency.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currency.is_base && (
                    <span className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      BASE
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleActive(currency.code, currency.active)}
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      currency.active
                        ? 'bg-green-900/30 text-green-400 border border-green-500'
                        : 'bg-red-900/30 text-red-400 border border-red-500'
                    }`}
                  >
                    {currency.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="mb-3 pb-3 border-b border-gray-700">
                <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Exchange Rate</div>
                {editingCurrency === currency.code ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="number"
                      step="0.0001"
                      defaultValue={currency.exchange_rate}
                      className="search-input p-3 rounded w-full text-center font-mono text-lg"
                      id={`rate-mobile-${currency.code}`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const input = document.getElementById(`rate-mobile-${currency.code}`);
                          handleUpdateRate(currency.code, input.value);
                        }}
                        className="action-btn btn-primary flex-1 py-2"
                      >
                        <i className="fas fa-save mr-2"></i>
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCurrency(null)}
                        className="action-btn btn-secondary flex-1 py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white text-lg">{Number(currency.exchange_rate).toFixed(4)}</span>
                    {!currency.is_base && (
                      <button
                        onClick={() => setEditingCurrency(currency.code)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        <i className="fas fa-edit mr-1"></i>
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Last Synced */}
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Synced</div>
                <div className="text-sm text-gray-300 mt-1">
                  {currency.last_synced ? new Date(currency.last_synced).toLocaleDateString() : 'Never'}
                </div>
              </div>

              {/* Actions */}
              {!currency.is_base && (
                <div className="pt-3 border-t border-gray-700">
                  <button
                    onClick={() => handleSetBaseCurrency(currency.code)}
                    className="w-full text-cyan-400 hover:text-cyan-300 text-sm py-2"
                  >
                    <i className="fas fa-star mr-2"></i>
                    Set as Base Currency
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 glass-card p-4 md:p-6 rounded-xl">
        <h3 className="text-lg md:text-xl font-bold text-white mb-4">
          <i className="fas fa-info-circle text-cyan-400 mr-2"></i>
          About Currency Management
        </h3>
        <div className="space-y-3 text-gray-300 text-sm md:text-base">
          <p>
            <strong className="text-white block mb-1">Base Currency:</strong> The currency used for storing prices in the database. All other currencies are calculated relative to this.
          </p>
          <p>
            <strong className="text-white block mb-1">Exchange Rates:</strong> Click "Sync Rates from API" to fetch the latest rates from exchangerate-api.com. You can also manually edit rates by clicking the edit icon.
          </p>
          <p>
            <strong className="text-white block mb-1">Active/Inactive:</strong> Only active currencies will be available for users to select. Inactive currencies are hidden from the frontend.
          </p>
          <p className="text-xs md:text-sm text-gray-400">
            Note: Changing the base currency will require you to sync rates again to update all exchange rates accordingly.
          </p>
        </div>
      </div>
    </div>
  );
}

