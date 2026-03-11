import React, { useState, useEffect, useMemo } from "react";
import { serverApi } from "@/api/serverApi";

export default function BrandLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [packagePrices, setPackagePrices] = useState({});

  useEffect(() => {
    loadLinks();
    loadPackagePrices();
  }, []);

  

  const loadPackagePrices = async () => {
    try {
      const data = await serverApi.packages.listPublic();
      const pricesMap = {}; 
      if (data?.packages) {
        data.packages.forEach(pkg => {
          if (pkg.id && pkg.price !== undefined) {
            pricesMap[pkg.id] = Number(pkg.price);
          }
        });
      }
      setPackagePrices(pricesMap);
    } catch (err) {
      console.error("Failed to load package prices:", err);
    }
  };

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await serverApi.brand.links.list({ ts: Date.now() });
      console.log('🔍 ALL LINKS FROM API:', JSON.stringify(data.links, null, 2));
      setLinks(data.links || []);
      setError("");
    } catch (err) {
      console.error("Failed to load links:", err);
      setError("Failed to load links");
    } finally {
      setLoading(false);
    }
  };
    
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess("Link copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const getTrackingUrl = (link) => {
    const url = new URL(link.destination_url);
    url.searchParams.set("link", link.link_id);
    return url.toString();
  };

  // Filter: Only show links that have either custom_url OR package_id (exclude legacy links)
  const validLinks = useMemo(() => {
    return (links || []).filter(l => {
      if (l?.is_active === false) return false;
      if (l?.is_main_link === true) return true;
      if (!l?.custom_url && !l?.package_id) return false;
      return true;
    });
  }, [links]);

  // Get main link
  const mainLink = useMemo(() => {
    return validLinks.find(l => l?.is_main_link === true);
  }, [validLinks]);
  
  // Get all packages link (link to prices page)
  const allPackagesLink = useMemo(() => {
    return validLinks.find(l => {
      if (l?.is_main_link) return false;
      const url = String(l?.destination_url || "").toLowerCase();
      const name = String(l?.name || "").toLowerCase();
      return url.includes("prices") || name.includes("all packages");
    });
  }, [validLinks]);
  
  // Get custom credit link (package_id = 'Custom')
  const customCreditLink = useMemo(() => {
    return validLinks.find(l => {
      if (l?.is_main_link) return false;
      const packageId = String(l?.package_id || "");
      const url = String(l?.destination_url || "").toLowerCase();
      return packageId === 'Custom' || url.includes("/credits/custom");
    });
  }, [validLinks]);
  
  // Get all active package links
  const packageLinks = useMemo(() => {
    const excludedIds = new Set([
      mainLink?.id,
      allPackagesLink?.id,
      customCreditLink?.id
    ].filter(Boolean));

    return validLinks
      .filter(l => {
        if (excludedIds.has(l?.id)) return false;
        if (l?.is_main_link) return false;
        if (String(l?.package_id || "").toLowerCase() === 'custom') return false;
        if (!l?.package_id) return false;
        const url = String(l?.destination_url || "").toLowerCase();
        const name = String(l?.name || "").toLowerCase();
        if (url.includes("prices") || name.includes("all packages")) return false;
        if (!url.includes("/package/")) return false;
        return true;
      })
      .sort((a, b) => {
        const aName = String(a?.name || "").toLowerCase();
        const bName = String(b?.name || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [validLinks, mainLink?.id, allPackagesLink?.id, customCreditLink?.id]);
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p className="text-gray-600">Loading links...</p>
      </div>
    );
  }

  const getPackagePrice = (packageId) => {
    if (!packageId) return null;
    return packagePrices[packageId] || null;
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return null;
    return `$${Number(price).toFixed(2)}`;
  };

  const renderLinkCard = (link) => {
    const packagePrice = link.package_id ? getPackagePrice(link.package_id) : null;
    const priceDisplay = packagePrice ? formatPrice(packagePrice) : null;

    return (
      <div key={link.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold text-gray-900">{link.name}</h3>
          {priceDisplay && (
            <span className="text-lg font-semibold text-blue-600">
              {priceDisplay}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
          <input
            type="text"
            value={getTrackingUrl(link)}
            readOnly
            className="flex-1 bg-transparent text-gray-700 outline-none font-mono text-sm"
          />
          <button
            onClick={() => copyToClipboard(getTrackingUrl(link))}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <i className="fas fa-copy mr-2"></i>
            Copy
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
              <i className="fas fa-eye mr-2"></i>
              Visits
            </div>
            <div className="text-3xl font-bold text-blue-600">{link.visits_count || 0}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
              <i className="fas fa-receipt mr-2"></i>
              Transactions
            </div>
            <div className="text-3xl font-bold text-purple-600">{link.transactions_count || 0}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
              <i className="fas fa-percentage mr-2"></i>
              Conv. Rate
            </div>
            <div
              className={`text-3xl font-bold ${
                Number(link.conversion_rate || 0) >= 50
                  ? "text-green-600"
                  : Number(link.conversion_rate || 0) > 0
                  ? "text-yellow-600"
                  : "text-gray-600"
              }`}
            >
              {Number(link.conversion_rate || 0).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Brand Links</h2>
          <p className="text-gray-600">
            Share these links with your agents to track FTDs and conversions.
          </p>
        </div>
        <button
          onClick={loadLinks}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          Refresh
        </button>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <i className="fas fa-check-circle mr-2"></i>
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {/* Main Link */}
      {mainLink && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Main Link</h3>
          <div className="space-y-6">{renderLinkCard(mainLink)}</div>
        </div>
      )}

      {/* All Packages Link */}
      {allPackagesLink && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">All Packages Link</h3>
          <div className="space-y-6">{renderLinkCard(allPackagesLink)}</div>
        </div>
      )}

      {/* Custom Credit Link */}
      {customCreditLink && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Custom Credit Link</h3>
          <div className="space-y-6">{renderLinkCard(customCreditLink)}</div>
        </div>
      )}

      {/* Active Package Links */}
      {packageLinks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Active Package Links</h3>
          <div className="space-y-6">{packageLinks.map(renderLinkCard)}</div>
        </div>
      )}

      {/* No links */}
      {!mainLink && !allPackagesLink && !customCreditLink && packageLinks.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
          <i className="fas fa-link text-6xl text-gray-400 mb-4"></i>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Active Links</h3>
          <p className="text-gray-600">
            Contact your administrator to set up tracking links for your brand.
          </p>
        </div>
      )}

    </div>
  );
}