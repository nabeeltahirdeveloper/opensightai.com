import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import LandingStyles from '@/components/landing/LandingStyles.jsx';
import { getMainSiteBaseUrl } from '@/utils/cartHydration';
import { serverApi } from '@/api/serverApi';

const isDevelopment = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Full list of countries (ISO 3166-1 alpha-2 codes) excluding restricted ones via filter below
const CURRENCY_TO_REGION = {
  USD: { regionCode: 'US', regionName: 'United States' },
  EUR: { regionName: 'Eurozone' }, // EUR is multi-country
  GBP: { regionCode: 'GB', regionName: 'United Kingdom' },
  AUD: { regionCode: 'AU', regionName: 'Australia' },
  CAD: { regionCode: 'CA', regionName: 'Canada' },
  JPY: { regionCode: 'JP', regionName: 'Japan' },
  INR: { regionCode: 'IN', regionName: 'India' },
  CHF: { regionCode: 'CH', regionName: 'Switzerland' },
  SGD: { regionCode: 'SG', regionName: 'Singapore' },
  HKD: { regionName: 'Hong Kong' },
  MXN: { regionCode: 'MX', regionName: 'Mexico' },
  BRL: { regionCode: 'BR', regionName: 'Brazil' },
  KRW: { regionCode: 'KR', regionName: 'South Korea' },
  TRY: { regionCode: 'TR', regionName: 'Turkey' },
  AED: { regionCode: 'AE', regionName: 'United Arab Emirates' },
  SEK: { regionCode: 'SE', regionName: 'Sweden' },
  NOK: { regionCode: 'NO', regionName: 'Norway' },
  ZAR: { regionCode: 'ZA', regionName: 'South Africa' },
  DKK: { regionCode: 'DK', regionName: 'Denmark' },
  ARS: { regionCode: 'AR', regionName: 'Argentina' },
  COP: { regionCode: 'CO', regionName: 'Colombia' },
  PEN: { regionCode: 'PE', regionName: 'Peru' },
  SAR: { regionCode: 'SA', regionName: 'Saudi Arabia' },
  RON: { regionCode: 'RO', regionName: 'Romania' },
  BGN: { regionCode: 'BG', regionName: 'Bulgaria' },
  PLN: { regionCode: 'PL', regionName: 'Poland' },
};

// Countries we must block completely (add/remove as needed)
const RESTRICTED_COUNTRY_CODES = new Set([
  'PK', // Pakistan
  'IL', // Israel
  // add any other restricted codes here
])

const ALL_COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' }, { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei Darussalam' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' }, { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic of the' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" }, { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czechia' }, { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' }, { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },{ code: "IS", name: "Iceland" }, { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' }, { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' }, { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: "Lao People's Democratic Republic" },
  { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' }, { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' }, { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' }, { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' }, { code: 'MD', name: 'Moldova' }, { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' }, { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' }, { code: 'MK', name: 'North Macedonia' }, { code: 'KP', name: 'North Korea' },
  { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine, State of' }, { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' }, { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' }, { code: 'KN', name: 'Saint Kitts and Nevis' }, { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' }, { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' }, { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' }, { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' }, { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'KR', name: 'South Korea' }, { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' }, { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' }, { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Viet Nam' },
  { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' }, { code: 'ZW', name: 'Zimbabwe' },
];

const ALLOWED_CURRENCY_CODES = [
  "EUR","USD","GBP","AUD","CAD","JPY","INR","CHF","SGD","HKD","MXN","BRL","KRW","TRY","AED","SEK","NOK","ZAR","DKK","ARS","COP","PEN","SAR","RON","BGN","PLN",
];


const ALLOWED_COUNTRIES = ALL_COUNTRIES.filter(country => !RESTRICTED_COUNTRY_CODES.has(country.code));

export default function Pay() {
  const [searchParams] = useSearchParams();
  const { items, removeItem, updateQuantity, requiresCredits } = useCart();
  const { formatPrice, usdPerUnitByCode,exchangeRates , convertPriceExact, selectedCurrency, changeCurrency, currencies, loading: currencyLoading, getCurrencyLabel } = useCurrency();

  const [showPaymentUnavailable, setShowPaymentUnavailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    zipCode: '',
    country: '',
    address1: '',
    city: '',
    state: ''
  });


  // Calculate subtotal in USD (formatPrice will handle conversion to selected currency)
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const latestItems = useMemo(() => {
    const pkg = items.find(i => i.type === 'package');
    const cr = items.find(i => i.type === 'credits');
    return [pkg, cr].filter(Boolean);
  }, [items]);

  const handleQuantityChange = (itemId, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity > 0) updateQuantity(itemId, newQuantity);
  };

  const handleInputChange = (field, value) => setPaymentDetails(prev => ({ ...prev, [field]: value }));



//   const handleSubmit = async (e) => {
//     console.log('[FE] handleSubmit fired');

//     e.preventDefault();

//   console.log('[FE] submit guard:', {
//     requiresCredits,
//     itemsLen: items.length,
//     isProcessing,
//     selectedCurrency,
//   });

//   if (items.length === 0 || isProcessing) {
//     alert(
//       `Blocked: requiresCredits=${requiresCredits}, items=${items.length}, isProcessing=${isProcessing}`
//     );
//     return;
//   }
//     if (!paymentDetails.email || !paymentDetails.firstName || !paymentDetails.lastName || 
//         !paymentDetails.phone || !paymentDetails.zipCode || !paymentDetails.country ||
//         !paymentDetails.address1 || !paymentDetails.city || !paymentDetails.state) {
//       alert('Please fill in all required fields');
//       return;
//     }

//     setIsProcessing(true);

//     try {
//       // Calculate total in USD first
//       const baseTotalUSD = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      
// // Convert USD -> selected currency (your DB rates are "units per 1 USD")
// const rate = Number(exchangeRates?.[selectedCurrency] ?? 1)
// const convertedTotal =
//   Number.isFinite(rate) && rate > 0
//     ? Math.round(baseTotalUSD * rate * 100) / 100
//     : Math.round(baseTotalUSD * 100) / 100

// if (!Number.isFinite(convertedTotal) || convertedTotal <= 0) {
//   throw new Error(`Invalid convertedTotal: ${convertedTotal} (${selectedCurrency})`)
// }
//       const client_orderid = `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;
//       const backendBaseUrl = isDevelopment
//   ? 'http://localhost:3001'
//   : 'https://api-dev.OpenSightai.com';

// if (!backendBaseUrl) {
//   throw new Error('Missing VITE_API_URL in production (should be https://api-dev.OpenSightai.com)');
// }

//   const redirect_url = `${backendBaseUrl}/api/checkout/neogate-redirect/${client_orderid}`


//       console.log('[FE] neogatePrepare payload:', { selectedCurrency, baseTotalUSD, rate, convertedTotal })
//       const totalAmount = convertedTotal;

//       // Call Neogate prepare endpoint with converted amount and currency
//       const result = await serverApi.checkout.neogatePrepare({
//         items,
//         totalAmount, 
//         paymentDetails,
//         currency: selectedCurrency,
//         redirect_url,
//         client_orderid
//       });

//       if (result.success && result.paymentUrl) {
//         let paymentUrl = result.paymentUrl.trim();
//         try {
//           const url = new URL(paymentUrl);
//           window.location.href = url.href;
//         } catch (urlError) {
//           throw new Error(`Invalid payment URL received: ${paymentUrl}`);
//         }
//       } else {
//         throw new Error(result?.error || result?.message || 'Failed to initialize payment');
//       }
//     } catch (error) {
//       console.error('Payment initialization error:', error);
//       const errorMessage = error?.message || '';
//       if (errorMessage.toLowerCase().includes('too_many_attempts')) {
//         alert('Your IP address has been temporarily blocked due to too many payment attempts.');
//       } else {
//         alert('Failed to initialize payment. Please try again.');
//       }
//       setIsProcessing(false);
//     }
//   };

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch (_e) {}
  }, []);

  const mainSiteUrl = getMainSiteBaseUrl();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LandingStyles />
        <div className="security-header">
          <div className="checkout-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="ssl-indicator"><i className="fas fa-lock"></i><span>256-bit SSL Encrypted</span></div>
                <div className="ssl-indicator"><i className="fas fa-shield-alt"></i><span>PCI DSS Compliant</span></div>
              </div>
              <div className="flex items-center space-x-3 text-sm"><i className="fas fa-phone"></i><span>Support: +44-7537-106208</span></div>
            </div>
          </div>
        </div>
        <header className="bg-white shadow-sm border-b py-6">
          <div className="checkout-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 gradient-gold rounded-lg flex items-center justify-center"><i className="fas fa-chart-line text-white text-2xl"></i></div>
                <div>
                  <h1 className="text-3xl font-bold heading-font text-gray-800">OpenSightAI</h1>
                  <p className="text-sm text-gray-600">Secure Checkout</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="checkout-container py-16 text-center">
          <h2 className="text-2xl font-bold heading-font text-gray-800 mb-2">Your Cart is Empty</h2>
          <p className="text-gray-600 mb-6">Add some packages to get started with your purchase.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={`${mainSiteUrl}/pricing`} className="btn-premium">Browse Packages</a>
            <a href={mainSiteUrl} className="border-2 border-gold text-gold px-8 py-3 rounded-full font-semibold hover:bg-gold hover:text-white transition-all">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <LandingStyles />
      <style>{`
        .security-badge { background: #22c55e; color: white; padding: 8px 16px; border-radius: 25px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
        .trust-indicator { background: #f0f9ff; border: 1px solid #38bdf8; color: #0369a1; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .form-input { border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; font-size: 16px; transition: all 0.3s ease; width: 100%; }
        .form-input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1); }
        .order-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        .security-header { background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 12px 0; }
        .checkout-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .ssl-indicator { background: #dcfce7; border: 1px solid #22c55e; color: #166534; padding: 8px 16px; border-radius: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
      `}</style>

      {/* Security Header */}
      <div className="security-header">
        <div className="checkout-container">
          <div className="flex items-center justify-between flex-col gap-3 sm:flex-row">
            <div className="flex items-center space-x-4">
              <div className="ssl-indicator"><i className="fas fa-lock"></i><span>256-bit SSL Encrypted</span></div>
              <div className="ssl-indicator"><i className="fas fa-shield-alt"></i><span>PCI DSS Compliant</span></div>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <i className="fas fa-phone"></i>
              <span>Support: +44-7537-106208</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white shadow-sm border-b py-6">
        <div className="checkout-container">
          <div className="flex items-center justify-between flex-col gap-4 md:flex-row">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 gradient-gold rounded-lg flex items-center justify-center"><i className="fas fa-chart-line text-white text-2xl"></i></div>
              <div>
                <h1 className="text-3xl font-bold heading-font text-gray-800">OpenSightAI</h1>
                <p className="text-sm text-gray-600">Secure Checkout</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="security-badge"><i className="fas fa-shield-check"></i>Secured by SSL</div>
              <div className="trust-indicator"><i className="fas fa-award"></i>FinTech Certified</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="checkout-container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="premium-card p-6 lg:sticky lg:top-4">
              <h2 className="text-2xl font-bold heading-font text-gray-800 mb-6">Order Summary</h2>

              {/* Show "2 products" message when both package and credits are present */}
              {latestItems.length === 2 && latestItems.some(i => i.type === 'package') && latestItems.some(i => i.type === 'credits') && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">
                    <i className="fas fa-check-circle mr-2 text-blue-600"></i>
                    2 products: Base Packages + Credits
                  </p>
                </div>
              )}

              {latestItems.map(item => (
                <div key={item.id} className="order-item">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      {item.type === 'credits' && (
                        <p className="text-sm text-gray-600">{item.unlimited ? 'Unlimited Credits' : `${item.credits} Credits`}</p>
                      )}
                      {(item.type === 'credits' && !item.unlimited) && (
                        <div className="flex items-center mt-2">
                          <div className="credit-badge bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">{item.credits}</div>
                          {item.popular && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">MOST POPULAR</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-800">{formatPrice(item.price, selectedCurrency, item.custom || false)}</p>
                      <p className="text-sm text-gray-600">One-time</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      {item.type === 'credits' ? (
                        <>
                          <button className="text-gray-400 hover:text-gray-600" onClick={() => handleQuantityChange(item.id, item.quantity, -1)}>
                            <i className="fas fa-minus-circle"></i>
                          </button>
                          <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">{item.quantity}</span>
                          <button className="text-gray-400 hover:text-gray-600" onClick={() => handleQuantityChange(item.id, item.quantity, 1)}>
                            <i className="fas fa-plus-circle"></i>
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">Qty: {item.quantity}</span>
                      )}
                    </div>
                    <button className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeItem(item.id)}>
                      <i className="fas fa-trash-alt mr-1"></i>Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Pricing Breakdown */}
              <div className="space-y-3 mb-6">
                {(() => {
                  const hasCustomPlan = items.some(item => item.custom === true);
                  return (
                    <>
                      <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span id="subtotal" className="font-medium">{formatPrice(subtotal, selectedCurrency, hasCustomPlan)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Tax (0%):</span><span className="font-medium">{formatPrice(0, selectedCurrency, hasCustomPlan)}</span></div>
                      <div className="flex justify-between text-sm text-green-600"><span>Educational Discount:</span><span>-{formatPrice(0, selectedCurrency, hasCustomPlan)}</span></div>
                      <hr className="my-4" />
                      <div className="flex justify-between text-xl font-bold"><span>Total:</span><span id="total" className="text-gold">{formatPrice(subtotal, selectedCurrency, hasCustomPlan)}</span></div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <div className="premium-card p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold heading-font text-gray-800 mb-4">Payment Information</h2>

              </div>

              {/*<form id="paymentForm" onSubmit={handleSubmit} noValidate>*/}
              <form id="paymentForm" noValidate>
                {/* Customer Information */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input type="text" className="form-input" placeholder="John" required value={paymentDetails.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                      <input type="text" className="form-input" placeholder="Doe" required value={paymentDetails.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input type="email" className="form-input" placeholder="john.doe@company.com" required value={paymentDetails.email} onChange={(e) => handleInputChange('email', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                      <input type="tel" className="form-input" placeholder="+1 (555) 123-4567" required value={paymentDetails.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Billing Address</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1 *</label>
                      <input type="text" className="form-input" placeholder="123 Wall Street" required value={paymentDetails.address1} onChange={(e) => handleInputChange('address1', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                      <input type="text" className="form-input" placeholder="New York" required value={paymentDetails.city} onChange={(e) => handleInputChange('city', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State/Province *</label>
                      <input type="text" className="form-input" placeholder="NY" required value={paymentDetails.state} onChange={(e) => handleInputChange('state', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ZIP/Postal Code *</label>
                      <input type="text" className="form-input" placeholder="10004" required value={paymentDetails.zipCode} onChange={(e) => handleInputChange('zipCode', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country *</label>
                      <select className="form-input" required value={paymentDetails.country} onChange={(e) => handleInputChange('country', e.target.value)}>
                        <option value="">Select Country</option>
                        {ALLOWED_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Payment Unavailable Message */}
                {showPaymentUnavailable && (
                  <div className="mb-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                            <i className="fas fa-exclamation-triangle text-white text-xl"></i>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-yellow-900 mb-2">Payment Not Available</h4>
                          <p className="text-sm text-yellow-700 mb-3">
                            We're sorry, but payment processing is not available at the moment. Please try again later or contact our support team for assistance.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 mt-4">
                            <button
                              type="button"
                              onClick={() => setShowPaymentUnavailable(false)}
                              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                            >
                              Close
                            </button>
                            <a
                              href="mailto:suuport@OpenSightai.com"
                              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-center"
                            >
                              Contact Support
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Currency Selection (end of form) */}
<div className="mb-8">
  <h3 className="text-lg font-semibold text-gray-800 mb-4">Currency</h3>

  <label className="block text-sm font-medium text-gray-700 mb-2">
    Choose your preferred currency for checkout *
  </label>

  <select
    className="form-input"
    value={selectedCurrency}
    disabled={currencyLoading || isProcessing}
    onChange={(e) => changeCurrency(e.target.value)}
    required
  >
    {ALLOWED_CURRENCY_CODES.map((code) => {
  const hasMap = usdPerUnitByCode && Object.keys(usdPerUnitByCode).length > 1
  //const ok = !!exchangeRates?.[code] || code === 'USD'
const ok = true

  return (
    <option key={code} value={code} disabled={!ok}>
  {getCurrencyLabel ? getCurrencyLabel(code) : code}
  {!ok ? ' (Unavailable)' : ''}
</option>
  )
})}

  </select>

  {currencyLoading && (
    <p className="text-xs text-gray-500 mt-2">Loading currencies…</p>
  )}
</div>


                {/* Terms and Conditions */}
                <div className="mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Terms & Conditions</h4>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-start"><input type="checkbox" className="mt-1 mr-3" required /><span className="text-blue-700">I agree to the <a href="https://OpenSightai.com/terms.html" target="_blank" rel="noopener" className="underline">Terms of Service</a> and <a href="https://OpenSightai.com/privacy.html" target="_blank" rel="noopener" className="underline">Privacy Policy</a></span></label>
                      <label className="flex items-start"><input type="checkbox" className="mt-1 mr-3" required /><span className="text-blue-700">I understand this is a one-time payment for educational and research purposes only</span></label>
                    </div>
                  </div>
                </div>

                
                <div className="text-center">
                <button
  type="submit"
  className="btn-premium text-lg px-12 py-4 w-full md:w-auto"
  //disabled={isProcessing}
  disabled
  onClick={() => console.log('[FE] submit button clicked')}
>
  {isProcessing ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-arrow-right mr-2"></i>
                        Proceed to Payment - {formatPrice(subtotal, selectedCurrency, items.some(item => item.custom === true))}
                      </>
                    )}
                  </button>
                </div>
                

              </form>
            </div>
          </div>
        </div>
      </div>


      {/* Security Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="checkout-container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 gradient-gold rounded-lg flex items-center justify-center"><i className="fas fa-chart-line text-white"></i></div>
                <span className="text-xl font-bold heading-font">OpenSightAI</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">Advanced Market Intelligence Platform</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>🏆 Winner of 2024 FinTech Innovation Award</p>
                <p>🔒 Bank-Grade Security & Encryption</p>
                <p>✅ Regulatory Compliant Platform</p>
                <p>🛡️ PCI DSS Level 1 Certified</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Security & Compliance</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• 256-bit SSL Encryption</li>
                <li>• PCI DSS Compliant</li>
                <li>• SOC 2 Type II Certified</li>
                <li>• GDPR Compliant</li>
                <li>• Regular Security Audits</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Customer Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📧 <a href="mailto:suuport@OpenSightai.com" className="hover:text-gold underline">suuport@OpenSightai.com</a></li>
                <li>📞 <a href="tel:+447537106208" className="hover:text-gold underline">+44-7537-106208</a></li>
                <li>🕒 Mon-Fri: 9AM-6PM EST</li>
              </ul>
            </div>
 
            <div>
              <h4 className="font-semibold mb-4">Legal & Policies</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="https://OpenSightai.com/terms.html" target="_blank" rel="noopener" className="hover:text-gold">Terms and Conditions</a></li>
                <li><a href="https://OpenSightai.com/privacy.html" target="_blank" rel="noopener" className="hover:text-gold">Privacy Policy</a></li>
                <li><a href="https://OpenSightai.com/refund-policy.html" target="_blank" rel="noopener" className="hover:text-gold">Refund Policy</a></li>
                <li><a href="https://OpenSightai.com/cookie-policy.html" target="_blank" rel="noopener" className="hover:text-gold">Cookie Policy</a></li>
                <li><a href="https://OpenSightai.com/acceptable-use.html" target="_blank" rel="noopener" className="hover:text-gold">Acceptable Use Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <div className="mt-6 text-center text-gray-400 text-sm">
              <p>The Seacus Company LTD</p>
              <p>It is registered as a legal entity under the Civil & Commercial code</p>
              <p>At the Business Registration office, Samut Prakan Province</p>
              <p>Company registration number: 0115569002129</p>
              <p>Email: <a href="mailto:suuport@OpenSightai.com" className="hover:text-gold transition-colors">suuport@OpenSightai.com</a></p>
              <p>Phone: <a href="tel:+447537106208" className="hover:text-gold transition-colors">+44-7537-106208</a></p>
            </div>
            <p className="text-xs text-gray-500 mt-4">© 2026 OpenSightAI. All rights reserved. For educational and research purposes only.</p>
            <p className="text-xs text-gray-500 mt-2">Disclaimer: OpenSightAI is a technological research tool and does not provide financial or investment advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

