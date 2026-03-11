// Currency utility functions

export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZD$',
  MYR: 'RM',
  SGD: 'S$',
  AED: 'AED',
  BHD: 'ب.د.',
  SAR: 'SAR$',
  QAR: 'ر.ق.',
  KWD: 'د.ك.',
  PEN: 'S/.',
  PYG: '₲',
  HNL: 'L',
  UYU: '$U',
  CRC: '₡',
  GTQ: 'Q',
  DOP: 'RD$',
  CLP: 'CL$',
  MXN: 'MX$',
  CZK: 'Kč',
  PLN: 'zł',
  ZAR: 'R',
  INR: '₹',
  CHF: 'Fr'
};

export const CURRENCY_NAMES = {
  USD: 'USA Dollar',
  EUR: 'European Euro',
  GBP: 'United Kingdom Pound',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
  MYR: 'Malaysian Ringgit',
  SGD: 'Singapore Dollar',
  AED: 'UAE Dirham',
  BHD: 'Bahraini Dinar',
  SAR: 'Saudi Riyal',
  QAR: 'Qatari Riyal',
  KWD: 'Kuwaiti Dinar',
  PEN: 'Peruvian Sol',
  PYG: 'Paraguay Guarani',
  HNL: 'Honduras Lempira',
  UYU: 'Uruguayan Peso',
  CRC: 'Costa Rican Colon',
  GTQ: 'Guatemalan Quetzal',
  DOP: 'Dominican Peso',
  CLP: 'Chilean Peso',
  MXN: 'Mexican Peso',
  CZK: 'Czech Koruna',
  PLN: 'Polish Złoty',
  ZAR: 'South African Rand',
  INR: 'Indian Rupee',
  CHF: 'Swiss Franc'
};

// Get currency symbol
export function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code;
}

// Convert price from one currency to another
export function convertPrice(amount, fromCurrency, toCurrency, exchangeRates) {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to USD first (base currency)
  const amountInUSD = amount / (exchangeRates[fromCurrency] || 1);
  
  // Convert from USD to target currency
  const convertedAmount = amountInUSD * (exchangeRates[toCurrency] || 1);
  
  return convertedAmount;
}

// Format price with currency symbol and proper decimal places
export function formatPrice(amount, currencyCode, exchangeRates = {}) {
  const symbol = getCurrencySymbol(currencyCode);
  
  // Determine decimal places based on currency
  let decimals = 2;
  if (['JPY', 'KRW', 'PYG', 'CLP', 'CRC'].includes(currencyCode)) {
    decimals = 0; // No decimal places
  } else if (['BHD', 'KWD', 'OMR'].includes(currencyCode)) {
    decimals = 3; // Three decimal places
  }
  
  // Convert if exchange rates are provided
  let finalAmount = amount;
  if (exchangeRates[currencyCode]) {
    finalAmount = amount * exchangeRates[currencyCode];
  }
  
  const formattedAmount = finalAmount.toFixed(decimals);
  
  return `${formattedAmount}${symbol}`;
}

// Get decimal places for a currency
export function getDecimalPlaces(currencyCode) {
  if (['JPY', 'KRW', 'PYG', 'CLP', 'CRC'].includes(currencyCode)) {
    return 0;
  } else if (['BHD', 'KWD', 'OMR'].includes(currencyCode)) {
    return 3;
  }
  return 2;
}

