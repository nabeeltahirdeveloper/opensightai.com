import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import LandingStyles from "@/components/landing/LandingStyles.jsx";
import { serverApi } from "@/api/serverApi";
import { getStoredLinkId, clearLinkId } from "@/utils/linkTracking";
import SolidPaymentWidget from "@/components/payment/SolidPaymentWidget";
import TransactionBlockedModal from "@/components/TransactionBlockedModal";

// Full list of countries (ISO 3166-1 alpha-2 codes) excluding restricted ones via filter below
const RESTRICTED_COUNTRY_CODES = new Set([
  // From user-provided restricted list (with code equivalents)
  "AF", // Afghanistan
  "CU", // Cuba
  "IQ", // Iraq
  "IR", // Iran (Islamic Republic of Iran)
  "LR", // Liberia
  "LY", // Libya
  "MM", // Myanmar
  "PS", // Palestine, State of
  "RU", // Russian Federation
  "SO", // Somalia
  "SY", // Syrian Arab Republic
  "SD", // Sudan
  "YE", // Yemen
  "US", // United States
  "KP", // North Korea (Korea, Democratic People's Republic of)
  "BY", // Belarus
  "MD", // Moldova, Republic of
  "NI", // Nicaragua
  "NE", // Niger
  "GN", // Guinea
  "BI", // Burundi
  "IL", // Israel
]);

const ALL_COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei Darussalam" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo, Democratic Republic of the" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d’Ivoire" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Lao People's Democratic Republic" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "MK", name: "North Macedonia" },
  { code: "KP", name: "North Korea" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine, State of" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Viet Nam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

const ALLOWED_COUNTRIES = ALL_COUNTRIES.filter(
  (country) => !RESTRICTED_COUNTRY_CODES.has(country.code)
);

export default function Checkout() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['landing', 'common']);
  const isTurkish = i18n.language === 'tr';
  const { items, removeItem, updateQuantity, clearCart, requiresCredits, addPackage, addCreditPackage } = useCart();
  const { formatPrice, selectedCurrency, convertPrice } = useCurrency();

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutId, setCheckoutId] = useState(null);
  const [checkoutIdApplePay, setCheckoutIdApplePay] = useState(null);
  const [checkoutIdGooglePay, setCheckoutIdGooglePay] = useState(null);
  const [checkoutIntegrity, setCheckoutIntegrity] = useState(null);
  const [checkoutIntegrityApplePay, setCheckoutIntegrityApplePay] = useState(null);
  const [checkoutIntegrityGooglePay, setCheckoutIntegrityGooglePay] = useState(null);
  const [googlePayEntityId, setGooglePayEntityId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState(null);
  // Hardcoded payment details for Neogate payload
  const [paymentDetails, setPaymentDetails] = useState({
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    phone: "+1206358204",
    address1: "Test Street 123",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    country: "US",
  });

  // Calculate subtotal in USD first, then convert to selected currency
  const subtotal = useMemo(() => {
    const usdTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    return selectedCurrency === "USD"
      ? usdTotal
      : convertPrice(usdTotal, selectedCurrency);
  }, [items, selectedCurrency, convertPrice]);

  // Ensure only latest selection is shown at checkout in case of stale localStorage
  const latestItems = useMemo(() => {
    const pkg = items.find((i) => i.type === "package");
    const cr = items.find((i) => i.type === "credits");
    return [pkg, cr].filter(Boolean);
  }, [items]);

  const handleQuantityChange = (itemId, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity > 0) updateQuantity(itemId, newQuantity);
  };

  const handleInputChange = (field, value) =>
    setPaymentDetails((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requiresCredits || items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      // Calculate total in USD first (items have USD prices)
      const totalAmountUSD = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Always convert to EUR
      const totalAmount = convertPrice(totalAmountUSD, "EUR");

      console.log("[checkout] Total amount:", {
        usd: totalAmountUSD,
        currency: "EUR",
        convertedAmount: totalAmount,
      });

      // Get referral slug from localStorage if present
      let brandSlug = null;
      try {
        brandSlug = localStorage.getItem("vs_referral_slug");
        if (brandSlug) {
          console.log("[checkout] Using brand referral slug:", brandSlug);
        }
      } catch (e) {
        console.error("[checkout] Failed to retrieve referral slug:", e);
      }

      // Get stored link ID if available
      const linkId = getStoredLinkId();

      // NOTE: Browser data is collected automatically by Solid Payment's COPYandPAY widget
      // We don't need to collect or send it manually - the widget handles it when the form loads

      // Prepare checkout - always use EUR
      const result = await serverApi.checkout.prepareCheckout({
        items,
        totalAmount,
        paymentDetails,
        brandSlug,
        currency: "EUR",
        linkId,
      });

      if (result.success && result.checkoutId && result.checkoutIdApplePay && result.checkoutIdGooglePay) {
        setCheckoutId(result.checkoutId);
        setCheckoutIdApplePay(result.checkoutIdApplePay);
        setCheckoutIdGooglePay(result.checkoutIdGooglePay);
        setCheckoutIntegrity(result.integrity);
        setCheckoutIntegrityApplePay(result.integrityApplePay);
        setCheckoutIntegrityGooglePay(result.integrityGooglePay);
        setGooglePayEntityId(result.googlePayEntityId);
        console.log(
          "[checkout] Credit Card Checkout prepared:",
          result.checkoutId,
          "integrity:",
          result.integrity
        );
        console.log(
          "[checkout] Apple Pay Checkout prepared:",
          result.checkoutIdApplePay,
          "integrity:",
          result.integrityApplePay
        );
        console.log(
          "[checkout] Google Pay Checkout prepared:",
          result.checkoutIdGooglePay,
          "integrity:",
          result.integrityGooglePay
        );
        console.log("[checkout] Google Pay Entity ID:", result.googlePayEntityId);
      } else {
        throw new Error("Failed to prepare checkout");
      }
    } catch (error) {
      console.error("[checkout] Error preparing checkout:", error);
      
      // Check if error is due to too many attempts
      // For 429 status, the backend returns { error: 'too_many_attempts', message: '...' }
      if (error.status === 429 || error.error === 'too_many_attempts' || error.message?.includes('too_many_attempts')) {
        setIsBlocked(true);
        setBlockMessage(error.message || "Your payment attempts are temporarily blocked. Please try again later.");
        setCheckoutError(null);
      } else {
        setCheckoutError(
          error.message || "Failed to initialize payment. Please try again."
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Ensure we land at the top of the page when navigating to checkout
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch (_e) {}
  }, []);

  useEffect(() => {
    // If cart already has items, don't override.
    if (items.length > 0) return;
  
    try {
      const planType = localStorage.getItem("selected_plan_type");
  
      if (planType === "base") {
        const planId = localStorage.getItem("selected_plan_id");
        if (!planId) return;
  
        // Map IDs to package data (must match Prices page LOCAL_PACKAGES ids)
        const baseMap = {
          starter: { id: "starter", name: "Starter Package", price: 25, type: "package", quantity: 1 },
          growth: { id: "growth", name: "Growth Package", price: 80, type: "package", quantity: 1 },
          pro: { id: "pro", name: "Pro Package", price: 129, type: "package", quantity: 1 },
        };
  
        const pkg = baseMap[planId];
        if (!pkg) return;
  
        // Ensure a clean cart state
        clearCart();
        addPackage(pkg);
      }
  
      if (planType === "custom") {
        const amtRaw = localStorage.getItem("selected_custom_amount");
        const amt = Number(amtRaw);
  
        if (!Number.isFinite(amt) || amt <= 0) return;
  
        const custom = {
          id: `custom-credits-${Date.now()}`,
          name: "Custom Plan",
          price: amt,        // USD base
          credits: amt,
          description: "Custom credit package",
          features: ["Custom amount of credits", "Flexible pricing"],
          custom: true,
          type: "credits",
          quantity: 1,
        };
  
        clearCart();
        addCreditPackage(custom);
      }
    } catch (_e) {
      // fail silently - checkout will show empty cart UI
    }
  }, [items.length, addPackage, addCreditPackage, clearCart]);
  

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LandingStyles />
        <div className="security-header">
          <div className="checkout-container">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="ssl-indicator">
                  <i className="fas fa-lock"></i>
                  <span>256-bit SSL Encrypted</span>
                </div>
                <div className="ssl-indicator">
                  <i className="fas fa-shield-alt"></i>
                  <span>PCI DSS Compliant</span>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <i className="fas fa-phone"></i>
                <span>Support: +44-7537-106208</span>
              </div>
            </div>
          </div>
        </div>
        <header className="py-6 bg-white border-b shadow-sm">
          <div className="checkout-container">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="flex justify-center items-center w-12 h-12 rounded-lg gradient-gold">
                  <i className="text-2xl text-white fas fa-chart-line"></i>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 heading-font">
                    OpenSightAI
                  </h1>
                  <p className="text-sm text-gray-600">Secure Checkout</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="py-16 text-center checkout-container">
          <h2 className="mb-2 text-2xl font-bold text-gray-800 heading-font">
            Your Cart is Empty
          </h2>
          <p className="mb-6 text-gray-600">
            Add some packages to get started with your purchase.
          </p>
          <div className="flex flex-col gap-3 justify-center sm:flex-row">
            <button
              className="btn-premium"
              onClick={() => navigate("/pricing")}
            >
              Browse Packages
            </button>
            <button
              className="px-8 py-3 font-semibold rounded-full border-2 transition-all border-gold text-gold hover:bg-gold hover:text-white"
              onClick={() => navigate("/")}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LandingStyles />
      <TransactionBlockedModal isOpen={isBlocked} message={blockMessage} />
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
          <div className="flex flex-col gap-3 justify-between items-center sm:flex-row">
            <div className="flex items-center space-x-4">
              <div className="ssl-indicator">
                <i className="fas fa-lock"></i>
                <span>256-bit SSL Encrypted</span>
              </div>
              <div className="ssl-indicator">
                <i className="fas fa-shield-alt"></i>
                <span>PCI DSS Compliant</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <i className="fas fa-phone"></i>
              <span>Support: +44-7537-106208</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="py-6 bg-white border-b shadow-sm">
        <div className="checkout-container">
          <div className="flex flex-col gap-4 justify-between items-center md:flex-row">
            <div className="flex items-center space-x-3">
              <div className="flex justify-center items-center w-12 h-12 rounded-lg gradient-gold">
                <i className="text-2xl text-white fas fa-chart-line"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 heading-font">
                  OpenSightAI
                </h1>
                <p className="text-sm text-gray-600">Secure Checkout</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="security-badge">
                <i className="fas fa-shield-check"></i>Secured by SSL
              </div>
              <div className="trust-indicator">
                <i className="fas fa-award"></i>FinTech Certified
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="py-8 checkout-container">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="p-6 premium-card lg:sticky lg:top-4">
              <h2 className="mb-6 text-2xl font-bold text-gray-800 heading-font">
                Order Summary
              </h2>

              {latestItems.map((item) => (
                <div key={item.id} className="order-item">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {item.name}
                      </h3>
                      {item.type === "credits" && (
                        <p className="text-sm text-gray-600">
                          {item.unlimited
                            ? "Unlimited Credits"
                            : `${item.credits} Credits`}
                        </p>
                      )}
                      {item.type === "credits" && !item.unlimited && (
                        <div className="flex items-center mt-2">
                          <div className="px-3 py-1 text-sm font-bold text-white bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full credit-badge">
                            {item.credits}
                          </div>
                          {item.popular && (
                            <span className="px-2 py-1 ml-2 text-xs text-green-800 bg-green-100 rounded-full">
                              MOST POPULAR
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-800">
                        {formatPrice(item.price)}
                      </p>
                      <p className="text-sm text-gray-600">One-time</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      {item.type === "credits" ? (
                        <>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity, -1)
                            }
                          >
                            <i className="fas fa-minus-circle"></i>
                          </button>
                          <span className="px-3 py-1 text-sm font-medium bg-gray-100 rounded">
                            {item.quantity}
                          </span>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity, 1)
                            }
                          >
                            <i className="fas fa-plus-circle"></i>
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1 text-sm font-medium bg-gray-100 rounded">
                          Qty: {item.quantity}
                        </span>
                      )}
                    </div>
                    <button
                      className="text-sm text-red-500 hover:text-red-700"
                      onClick={() => removeItem(item.id)}
                    >
                      <i className="mr-1 fas fa-trash-alt"></i>Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Pricing Breakdown */}
              <div className="mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span id="subtotal" className="font-medium">
                    {formatPrice(
                      latestItems.reduce((s, i) => s + i.price * i.quantity, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (0%):</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Educational Discount:</span>
                  <span>-$0.00</span>
                </div>
                <hr className="my-4" />
                <div className="flex justify-between text-xl font-bold">
                  <span>Total:</span>
                  <span id="total" className="text-gold">
                    {formatPrice(
                      latestItems.reduce((s, i) => s + i.price * i.quantity, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          {!isBlocked && (
          <div className="lg:col-span-2">
            <div className="p-8 premium-card">
              <div className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-gray-800 heading-font">
                  Payment Information
                </h2>

                {/* Payment Descriptor and Card Logos */}
                <div className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-semibold text-gray-800">
                        Secure Payment Processing
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-700">
                        We accept all major credit and debit cards. Your payment
                        information is protected with industry-standard 256-bit
                        SSL encryption and PCI DSS compliance for maximum
                        security.
                      </p>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="p-2 bg-white rounded-lg border shadow-sm">
                        <img
                          src="/Visa_Inc.-Logo.wine.png"
                          alt="Visa"
                          className="object-contain w-12 h-8"
                        />
                      </div>
                      <div className="p-2 bg-white rounded-lg border shadow-sm">
                        <img
                          src="/Mastercard-Logo.wine.png"
                          alt="Mastercard"
                          className="object-contain w-12 h-8"
                        />
                      </div>
                      <div className="text-sm font-medium text-gray-600">
                        + More
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center pt-4 mt-4 border-t border-blue-200">
                    <div className="flex gap-2 items-center text-sm text-green-700">
                      <i className="fas fa-shield-check"></i>
                      <span className="font-medium">Bank-Level Security</span>
                    </div>
                    <div className="flex gap-2 items-center text-sm text-blue-700">
                      <i className="fas fa-lock"></i>
                      <span className="font-medium">256-bit SSL Encrypted</span>
                    </div>
                    <div className="flex gap-2 items-center text-sm text-indigo-700">
                      <i className="fas fa-certificate"></i>
                      <span className="font-medium">PCI DSS Compliant</span>
                    </div>
                  </div>
                </div>
              </div>

              <form id="paymentForm" onSubmit={handleSubmit}>
                {/* Customer Information */}
                <div className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    Customer Information
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        First Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="John"
                        required
                        value={paymentDetails.firstName}
                        onChange={(e) =>
                          handleInputChange("firstName", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Doe"
                        required
                        value={paymentDetails.lastName}
                        onChange={(e) =>
                          handleInputChange("lastName", e.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="john.doe@company.com"
                        required
                        value={paymentDetails.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="+1 (555) 123-4567"
                        required
                        value={paymentDetails.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Company/Organization
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="ABC Financial Corp"
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    Billing Address
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="123 Wall Street"
                        required
                        value={paymentDetails.address1}
                        onChange={(e) =>
                          handleInputChange("address1", e.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Suite 456"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        City *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="New York"
                        required
                        value={paymentDetails.city}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        State/Province *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="NY"
                        required
                        value={paymentDetails.state}
                        onChange={(e) =>
                          handleInputChange("state", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        ZIP/Postal Code *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="10004"
                        required
                        value={paymentDetails.zipCode}
                        onChange={(e) =>
                          handleInputChange("zipCode", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Country *
                      </label>
                      <select
                        className="form-input"
                        required
                        value={paymentDetails.country}
                        onChange={(e) =>
                          handleInputChange("country", e.target.value)
                        }
                      >
                        <option value="">Select Country</option>
                        {ALLOWED_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* USD Currency Notice */}
                {selectedCurrency !== "USD" && (
                  <div className="mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <div className="flex gap-3 items-start">
                        <i className="fas fa-info-circle text-blue-600 text-xl mt-0.5"></i>
                        <div>
                          <h4 className="mb-1 font-semibold text-blue-900">
                            Currency Conversion Notice
                          </h4>
                          <p className="text-sm text-blue-700">
                            Payments are processed in USD. Your{" "}
                            {selectedCurrency} amount will be converted to USD
                            at the current exchange rate. The final charge will
                            appear in USD on your statement.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Section */}
                {!checkoutId && (
                  <div className="mb-8">
                    <div className="p-6 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                      <i className="mb-3 text-4xl text-blue-600 fas fa-credit-card"></i>
                      <h3 className="mb-2 text-lg font-semibold text-gray-800">
                        Secure Payment
                      </h3>
                      <p className="text-sm text-gray-600">
                        Fill in your information above and click "Proceed to
                        Payment" to enter your card details securely.
                      </p>
                    </div>
                  </div>
                )}

                {/* Widget will be rendered OUTSIDE the form to avoid nested forms */}

                {/* Checkout Error */}
                {checkoutError && (
                  <div className="mb-6">
                    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <div className="flex gap-3 items-start">
                        <i className="fas fa-exclamation-triangle text-red-600 text-xl mt-0.5"></i>
                        <div>
                          <h4 className="mb-1 font-semibold text-red-900">
                            Payment Error
                          </h4>
                          <p className="text-sm text-red-700">
                            {checkoutError}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                <div className="mb-8">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="mb-2 font-semibold text-blue-800">
                      Terms & Conditions
                    </h4>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-start">
                        <input type="checkbox" className="mt-1 mr-3" required />
                        <span className="text-blue-700">
                          I agree to the{" "}
                          <a
                            href="/terms.html"
                            target="_blank"
                            rel="noopener"
                            className="underline"
                          >
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a
                            href="/privacy.html"
                            target="_blank"
                            rel="noopener"
                            className="underline"
                          >
                            Privacy Policy
                          </a>
                        </span>
                      </label>
                      <label className="flex items-start">
                        <input type="checkbox" className="mt-1 mr-3" required />
                        <span className="text-blue-700">
                          I understand this is a one-time payment for
                          educational and research purposes only
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                {!checkoutId && (
                  <div className="text-center">
                    <button
                      type="submit"
                      className="px-12 py-4 w-full text-lg btn-premium md:w-auto"
                      disabled={requiresCredits || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <i className="mr-2 fas fa-spinner fa-spin"></i>
                          Preparing Checkout...
                        </>
                      ) : (
                        <>
                          <i className="mr-2 fas fa-lock"></i>
                          Proceed to Payment - {formatPrice(subtotal)}
                        </>
                      )}
                    </button>
                    <p className="mt-4 text-xs text-gray-500">
                      Your payment information is encrypted and processed
                      securely.
                      <br />
                      This transaction will appear as "OpenSightAI" on your
                      statement.
                    </p>
                  </div>
                )}
              </form>

              {/* Solid Payment Widget - OUTSIDE the checkout form to avoid nested forms */}
              {checkoutId && checkoutIdApplePay && checkoutIdGooglePay && (
                <div className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    Payment Information
                  </h3>
                  <SolidPaymentWidget
                    checkoutId={checkoutId}
                    checkoutIdApplePay={checkoutIdApplePay}
                    checkoutIdGooglePay={checkoutIdGooglePay}
                    integrity={checkoutIntegrity}
                    integrityApplePay={checkoutIntegrityApplePay}
                    integrityGooglePay={checkoutIntegrityGooglePay}
                    googlePayEntityId={googlePayEntityId}
                    onError={(error) => setCheckoutError(error)}
                    onReady={() =>
                      console.log("[checkout] Payment widget ready")
                    }
                  />
                  <div className="mt-4 text-center">
                    <p className="mb-2 text-sm text-gray-600">
                      <i className="mr-1 fas fa-info-circle"></i>
                      Enter your card details above or use Apple Pay or Google Pay to complete your purchase.
                    </p>
                    <p className="text-xs text-gray-500">
                      This transaction will appear as "OpenSightAI" on your
                      statement.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Security Footer */}
      <footer className="py-12 mt-16 text-white bg-gray-900">
        <div className="checkout-container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center mb-4 space-x-2">
                <div className="flex justify-center items-center w-8 h-8 rounded-lg gradient-gold">
                  <i className="text-white fas fa-chart-line"></i>
                </div>
                <span className="text-xl font-bold heading-font">
                  OpenSightAI
                </span>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Advanced Market Intelligence Platform
              </p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>🏆 Winner of 2024 FinTech Innovation Award</p>
                <p>🔒 Bank-Grade Security & Encryption</p>
                <p>✅ Regulatory Compliant Platform</p>
                <p>🛡️ PCI DSS Level 1 Certified</p>
              </div>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Security & Compliance</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• 256-bit SSL Encryption</li>
                <li>• PCI DSS Compliant</li>
                <li>• SOC 2 Type II Certified</li>
                <li>• GDPR Compliant</li>
                <li>• Regular Security Audits</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Customer Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  📧{" "}
                  <a
                    href={isTurkish ? "mailto:suuport@OpenSightai.com" : "mailto:suuport@OpenSightai.com"}
                    className="underline hover:text-gold"
                  >
                    {isTurkish ? "suuport@OpenSightai.com" : "suuport@OpenSightai.com"}
                  </a>
                </li>
                <li>
                  📞{" "}
                  <a
                    href="tel:+447537106208"
                    className="underline hover:text-gold"
                  >
                    +44-7537-106208
                  </a>
                </li>
                <li>🕒 Mon-Fri: 9AM-6PM EST</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Legal & Policies</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a
                    href={isTurkish ? "/terms-tr.html" : "/terms.html"}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-gold"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href={isTurkish ? "/privacy-tr.html" : "/privacy.html"}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-gold"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href={isTurkish ? "/refund-policy-tr.html" : "/refund-policy.html"}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-gold"
                  >
                    Refund Policy
                  </a>
                </li>
                <li>
                  <a
                    href={isTurkish ? "/cookie-policy-tr.html" : "/cookie-policy.html"}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-gold"
                  >
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a
                    href={isTurkish ? "/acceptable-use-tr.html" : "/acceptable-use.html"}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-gold"
                  >
                    Acceptable Use Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 mt-8 text-center border-t border-gray-700">
            <div className="flex overflow-x-hidden flex-wrap gap-2 justify-center items-center mb-4 sm:gap-4">
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener"
                aria-label="GDPR Privacy Policy"
              >
                <img
                  src="https://img.shields.io/badge/Privacy-GDPR-gold?style=for-the-badge"
                  alt="GDPR Compliant"
                  className="h-6"
                />
              </a>
            </div>
            {isTurkish && (
              <div className="mt-6 text-sm text-center text-gray-400">
                <p>{t('footer.businessDetails.company', { ns: 'landing', defaultValue: 'The Seacus Company LTD' })}</p>
                <p>{t('footer.businessDetails.registration', { ns: 'landing', defaultValue: 'It is registered as a legal entity under the Civil & Commercial code at the Business Registration office, Samut Prakan Province.' })}</p>
                <p>{t('footer.businessDetails.registrationNumber', { ns: 'landing', defaultValue: 'Company registration number: 0115569002129' })}</p>
                <p>Email: <a href={`mailto:${t('footer.businessDetails.email', { ns: 'landing', defaultValue: 'suuport@OpenSightai.com' })}`} className="hover:text-gold transition-colors">{t('footer.businessDetails.email', { ns: 'landing', defaultValue: 'suuport@OpenSightai.com' })}</a></p>
                <p>Phone: <a href={`tel:${t('footer.businessDetails.phone', { ns: 'landing', defaultValue: '+447537106208' }).replace(/[^0-9+]/g, '')}`} className="hover:text-gold transition-colors">{t('footer.businessDetails.phone', { ns: 'landing', defaultValue: '+44-7537-106208' })}</a></p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              © 2025 {isTurkish ? 'ScopeZeka' : 'OpenSightAI'}. All rights reserved. For educational and
              research purposes only.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Disclaimer: {isTurkish ? 'ScopeZeka' : 'OpenSightAI'} is a technological research tool and
              does not provide financial or investment advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
