import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChevronDown } from 'lucide-react';

export default function CurrencySelector({ className = '' }) {
  const { selectedCurrency, currencies, changeCurrency, currentCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right + window.scrollX
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filteredCurrencies = currencies.filter(currency =>
    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectCurrency = (code) => {
    changeCurrency(code);
    setIsOpen(false);
    setSearchTerm('');
  };

  if (!currentCurrency) return null;

  const dropdownContent = isOpen && (
    <div 
      ref={dropdownRef}
      className="fixed w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-96 overflow-hidden flex flex-col"
      style={{
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`
      }}
    >
      {/* Search input */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search currencies..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          autoFocus
        />
      </div>

      {/* Currency list */}
      <div className="overflow-y-auto flex-1">
        {filteredCurrencies.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No currencies found
          </div>
        ) : (
          filteredCurrencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => handleSelectCurrency(currency.code)}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                currency.code === selectedCurrency ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{currency.symbol}</span>
                <div>
                  <div className="font-medium text-gray-900">{currency.code}</div>
                  <div className="text-xs text-gray-500">{currency.name}</div>
                </div>
              </div>
              {currency.code === selectedCurrency && (
                <span className="text-orange-500">
                  <i className="fas fa-check"></i>
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-300 hover:border-orange-400 transition-colors text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <span className="text-lg">{currentCurrency.symbol}</span>
        <span>{currentCurrency.code}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </div>
  );
}

// Mobile-friendly version
export function CurrencySelectorMobile({ className = '' }) {
  const { selectedCurrency, currencies, changeCurrency, currentCurrency } = useCurrency();

  if (!currentCurrency) return null;

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
      <select
        value={selectedCurrency}
        onChange={(e) => changeCurrency(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
    </div>
  );
}

