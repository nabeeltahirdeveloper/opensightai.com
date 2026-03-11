import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function PackageModal({ package: pkg, type, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    currency: '$',
    type: type === 'packages' ? 'package' : 'credits',
    credits: '',
    description: '',
    features: [],
    popular: false,
    active: true,
  });

  const [featureInput, setFeatureInput] = useState('');
  const [showCurrencyPrices, setShowCurrencyPrices] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [currencyPrices, setCurrencyPrices] = useState({});

  useEffect(() => {
    if (pkg) {
      setFormData({
        id: pkg.id || '',
        name: pkg.name || '',
        price: pkg.price?.toString() || '',
        currency: pkg.currency || '$',
        type: pkg.type || (type === 'packages' ? 'package' : 'credits'),
        credits: pkg.credits?.toString() || '',
        description: pkg.description || '',
        features: pkg.features || [],
        popular: pkg.popular || false,
        active: pkg.active !== undefined ? pkg.active : true,
      });
      
      // Load currency prices if editing existing package
      if (pkg.id) {
        loadCurrencyPrices(pkg.id);
      }
    }
  }, [pkg, type]);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      const data = await serverApi.admin.currencies.list();
      setCurrencies(data.currencies || []);
    } catch (error) {
      console.error('Failed to load currencies:', error);
    }
  };

  const loadCurrencyPrices = async (packageId) => {
    try {
      const data = await serverApi.admin.packagePrices.get(packageId);
      const pricesMap = {};
      data.prices.forEach(p => {
        pricesMap[p.currency_code] = p.custom_price;
      });
      setCurrencyPrices(pricesMap);
    } catch (error) {
      console.error('Failed to load currency prices:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
  if (!formData.name || !formData.price || !formData.id) {
    alert('Please fill in all required fields');
    return;
  }

  let creditsToSend = null;
  if (formData.credits === 'unlimited') {
    creditsToSend = null; 
  } else if (formData.credits !== '' && formData.credits !== null) {
    creditsToSend = parseInt(formData.credits);
  }

  const packageData = {
    ...formData,
    price: parseFloat(formData.price),
    credits: creditsToSend, 
    features: Array.isArray(formData.features) ? formData.features : []
  };

    await onSave(packageData);
  
    if (Object.keys(currencyPrices).length > 0) {
      try {
        await serverApi.admin.packagePrices.update(formData.id, currencyPrices);
      } catch (error) {
        console.error('Failed to save currency prices:', error);
      }
    }
  };
  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, featureInput.trim()],
      });
      setFeatureInput('');
    }
  };

  const removeFeature = (index) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-8 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold gradient-text">
            {pkg ? 'Edit' : 'Create'} {type === 'packages' ? 'Package' : 'Credit Package'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Package ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="search-input p-3 rounded-lg w-full"
                placeholder="e.g., starter, credits-100"
                required
                disabled={!!pkg}
              />
              <p className="text-xs text-gray-400 mt-1">
                Unique identifier (cannot be changed after creation)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="search-input p-3 rounded-lg w-full"
                placeholder="e.g., Professional"
                required
              />
            </div>
          </div>

        {/* Pricing & Credits Row */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div>
    <label className="block text-sm font-medium mb-2">
      Price <span className="text-red-400">*</span>
    </label>
    <input
      type="number"
      step="0.01"
      value={formData.price}
      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
      className="search-input p-3 rounded-lg w-full"
      placeholder="99.99"
      required
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-2">Currency</label>
    <select
      value={formData.currency}
      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
      className="search-input p-3 rounded-lg w-full"
    >
      <option value="$">$ USD</option>
      <option value="€">€ EUR</option>
      <option value="£">£ GBP</option>
    </select>
  </div>

  {/* Credits field is now always present and handles 'unlimited' or numbers */}
  <div>
    <label className="block text-sm font-medium mb-2">Credits</label>
    <input
      type="text"
      value={formData.credits || ''} 
      onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
      className="search-input p-3 rounded-lg w-full"
      placeholder="e.g. 100 or unlimited"
    />
    <p className="text-[10px] text-gray-500 mt-1">
      Use "unlimited" or a number.
    </p>
  </div>
</div>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="search-input p-3 rounded-lg w-full"
              rows="3"
              placeholder="Brief description of the package"
            />
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium mb-2">Features</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                className="search-input p-3 rounded-lg flex-1"
                placeholder="Add a feature and press Enter"
              />
              <button
                type="button"
                onClick={addFeature}
                className="action-btn btn-primary px-6"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>

            {formData.features.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formData.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg"
                  >
                    <span className="text-sm text-gray-300">{feature}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.popular}
                onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm font-medium">
                <i className="fas fa-star text-yellow-400 mr-2"></i>
                Mark as Popular
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm font-medium">
                <i className="fas fa-check-circle text-green-400 mr-2"></i>
                Active
              </span>
            </label>
          </div>

          {/* Currency Prices Section */}
          {pkg && (
            <div className="border-t border-gray-700 pt-6">
              <button
                type="button"
                onClick={() => setShowCurrencyPrices(!showCurrencyPrices)}
                className="flex items-center justify-between w-full text-left mb-4"
              >
                <span className="text-lg font-semibold flex items-center">
                  <i className="fas fa-dollar-sign text-cyan-400 mr-2"></i>
                  Currency-Specific Prices
                </span>
                <i className={`fas fa-chevron-${showCurrencyPrices ? 'up' : 'down'} text-gray-400`}></i>
              </button>
              
              {showCurrencyPrices && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 mb-4">
                    Set custom prices for specific currencies. Leave blank to use auto-converted prices based on exchange rates.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {currencies.filter(c => c.active).map((currency) => {
                      const autoPrice = formData.price ? (parseFloat(formData.price) * currency.exchange_rate).toFixed(2) : '0.00';
                      return (
                        <div key={currency.code} className="bg-gray-800/50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{currency.symbol}</span>
                              <span className="font-semibold">{currency.code}</span>
                              {currency.is_base && (
                                <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">BASE</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">Auto: {currency.symbol}{autoPrice}</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={currencyPrices[currency.code] || ''}
                            onChange={(e) => {
                              const newPrices = { ...currencyPrices };
                              if (e.target.value) {
                                newPrices[currency.code] = e.target.value;
                              } else {
                                delete newPrices[currency.code];
                              }
                              setCurrencyPrices(newPrices);
                            }}
                            placeholder={`Auto: ${autoPrice}`}
                            className="search-input p-2 rounded-lg w-full text-sm"
                          />
                          <p className="text-xs text-gray-500 mt-1">{currency.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="action-btn btn-secondary px-6"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn btn-primary px-6"
            >
              <i className="fas fa-save mr-2"></i>
              {pkg ? 'Update' : 'Create'} Package
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


