import React, { useState, useEffect } from 'react';
import { serverApi } from '@/api/serverApi';

export default function AdminPayoutsSection() {
  // Load saved date filters from localStorage on mount
  const loadSavedDateFilters = () => {
    try {
      const saved = localStorage.getItem('adminPayoutsDateFilters');
      if (saved) {
        const filters = JSON.parse(saved);
        return {
          fromDate: filters.fromDate || '',
          toDate: filters.toDate || ''
        };
      }
    } catch (e) {
      console.warn('Failed to load saved date filters:', e);
    }
    return { fromDate: '', toDate: '' };
  };

  const savedFilters = loadSavedDateFilters();

  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState({ total_paid: 0, average_payout: 0, last_payout: null });
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(savedFilters.fromDate);
  const [toDate, setToDate] = useState(savedFilters.toDate);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  
  // Bulk marking state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [brands, setBrands] = useState([]);
  const [brandNameById, setBrandNameById] = useState({});
  const [bulkFromDate, setBulkFromDate] = useState('');
  const [bulkToDate, setBulkToDate] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successSummary, setSuccessSummary] = useState(null);
  
  // New state for expandable brands and order selection
  const [expandedBrands, setExpandedBrands] = useState(new Set());
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [brandOrdersCache, setBrandOrdersCache] = useState(new Map());
  const [loadingBrandOrders, setLoadingBrandOrders] = useState(new Map());
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false); // Track if filters are actually applied

  // Save date filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('adminPayoutsDateFilters', JSON.stringify({
        fromDate: fromDate,
        toDate: toDate
      }));
    } catch (e) {
      console.warn('Failed to save date filters:', e);
    }
  }, [fromDate, toDate]);

  const formatDateForAPI = (dateStr, isEndOfDay = false) => {
    if (!dateStr) return '';

    // Parse date string directly (YYYY-MM-DD format from HTML date input)
    // Split by '-' to avoid timezone issues with Date object
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      console.warn(`[formatDateForAPI] Invalid date format: ${dateStr}`);
      return '';
    }

    const [year, month, day] = parts;

    if (isEndOfDay) {
      // For end date: send the end of the selected day in UTC (23:59:59.999Z)
      // Using Z to indicate UTC timezone to match database storage format
      const endDateString = `${year}-${month}-${day}T23:59:59.999Z`;
      console.log(`[formatDateForAPI] End date: ${dateStr} -> sending end of day (UTC): ${endDateString}`);
      return endDateString;
    } else {
      // For start date: send the start of the selected day in UTC (00:00:00.000Z)
      // Using Z to indicate UTC timezone to match database storage format
      const startDateString = `${year}-${month}-${day}T00:00:00.000Z`;
      console.log(`[formatDateForAPI] Start date: ${dateStr} -> sending (UTC): ${startDateString}`);
      return startDateString;
    }
  };

  // Handle all filter changes - date filters will auto-trigger loadPayouts
  useEffect(() => {
    loadPayouts();
  }, [page, fromDate, toDate]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const params = {
        page: String(page),
        pageSize: '20',
        ...(fromDate ? { from_date: formatDateForAPI(fromDate, false) } : {}),
        ...(toDate ? { to_date: formatDateForAPI(toDate, true) } : {})
      };
      
      console.log('[PayoutsSection] Loading payouts with params:', params);
      
      const data = await serverApi.admin.payouts.list(params);
      setPayouts(data.payouts || []);
      setStats(data.stats || { total_paid: 0, average_payout: 0, last_payout: null });
      setMeta(data.meta || { total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to load payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      const data = await serverApi.admin.brands.list({ page: '1', pageSize: '1000' });
      const fetchedBrands = data.brands || [];
      setBrands(fetchedBrands);
      const nameMap = {};
      fetchedBrands.forEach(brand => {
        nameMap[brand.id] = brand.name || brand.username || `Brand #${brand.id}`;
      });
      setBrandNameById(nameMap);
    } catch (error) {
      console.error('Failed to load brands:', error);
      alert('Failed to load brands');
    } finally {
      setLoadingBrands(false);
    }
  };

  const openBulkModal = () => {
    setShowBulkModal(true);
    setBulkFromDate('');
    setBulkToDate('');
    setFiltersApplied(false); // Reset filters applied state
    setExpandedBrands(new Set());
    setSelectedOrders(new Set());
    setBrandOrdersCache(new Map());
    setLoadingBrandOrders(new Map());
    loadBrands();
  };

  // Load unpaid orders for a specific brand
  const loadBrandOrders = async (brandId, useCache = false, fromDate = null, toDate = null) => {
    // Check cache first if useCache is true
    if (useCache && brandOrdersCache.has(brandId)) {
      return brandOrdersCache.get(brandId);
    }

    // Clear any existing cache for this brand first
    setBrandOrdersCache(prev => {
      const newMap = new Map(prev);
      newMap.delete(brandId);
      return newMap;
    });

    // Set loading state
    setLoadingBrandOrders(prev => new Map(prev).set(brandId, true));

    try {
      const params = {
        page: '1',
        pageSize: '1000',
        brand: String(brandId)
      };

      // Use date filters if provided as parameters
      if (fromDate && toDate) {
        params.from = formatDateForAPI(fromDate, false);
        params.to = formatDateForAPI(toDate, true);
        console.log(`[loadBrandOrders] Brand ${brandId}: Applying date filters - From: ${fromDate} (${params.from}), To: ${toDate} (${params.to})`);
      } else {
        console.log(`[loadBrandOrders] Brand ${brandId}: No date filters (fromDate: ${fromDate}, toDate: ${toDate})`);
      }

      console.log(`[loadBrandOrders] Brand ${brandId}: API params:`, params);
      const result = await serverApi.admin.orders.list(params);
      const allOrders = result.orders || [];

      console.log(`[loadBrandOrders] Brand ${brandId}: Fetched ${allOrders.length} orders from API`);
      if (allOrders.length > 0) {
        console.log(`[loadBrandOrders] Sample order:`, {
          id: allOrders[0].id,
          order_id: allOrders[0].order_id,
          brand_id: allOrders[0].brand_id,
          payment_status: allOrders[0].payment_status,
          commission_status: allOrders[0].commission_status
        });
      }

      // STRICT Filter to unpaid orders for this specific brand
      // Must pass ALL checks: correct brand_id, commission_status = 'unpaid', payment_status != 'failed'
      const unpaidOrders = allOrders.filter(order => {
        // Check 1: brand_id must match
        const orderBrandId = Number(order.brand_id);
        const targetBrandId = Number(brandId);
        if (orderBrandId !== targetBrandId) {
          return false;
        }
        
        // Check 2: payment_status must NOT be 'failed'
        const paymentStatus = String(order.payment_status || '').toLowerCase().trim();
        if (paymentStatus === 'failed') {
          console.log(`[FILTER] Order ${order.id} (${order.order_id}) EXCLUDED - payment_status: "${paymentStatus}"`);
          return false;
        }
        
        // Check 3: commission_status must be exactly 'unpaid'
        const commissionStatus = String(order.commission_status || '').toLowerCase().trim();
        if (commissionStatus !== 'unpaid') {
          console.log(`[FILTER] Order ${order.id} (${order.order_id}) EXCLUDED - commission_status: "${commissionStatus}" (needs "unpaid")`);
          return false;
        }
        
        // All checks passed
        return true;
      });

      console.log(`[loadBrandOrders] Brand ${brandId}: ${unpaidOrders.length} unpaid orders after STRICT filtering (from ${allOrders.length} total)`);

      // If date filters were provided, also filter by date client-side (as backup)
      // Note: Backend should already filter by date, but this is a safety check
      let filteredOrders = unpaidOrders;
      if (fromDate && toDate) {
        const fromDateObj = new Date(formatDateForAPI(fromDate, false));
        const toDateObj = new Date(formatDateForAPI(toDate, true));
        
        console.log(`[loadBrandOrders] Brand ${brandId}: Client-side date filtering - From: ${fromDateObj.toISOString()}, To: ${toDateObj.toISOString()}`);
        console.log(`[loadBrandOrders] Brand ${brandId}: Before date filter - ${unpaidOrders.length} unpaid orders`);
        
        // Log sample order dates for debugging
        if (unpaidOrders.length > 0) {
          console.log(`[loadBrandOrders] Brand ${brandId}: Sample order dates:`, unpaidOrders.slice(0, 3).map(o => ({
            order_id: o.order_id,
            created_at: o.created_at,
            date: new Date(o.created_at).toISOString()
          })));
        }
        
        filteredOrders = unpaidOrders.filter(order => {
          if (!order.created_at) {
            console.log(`[loadBrandOrders] Order ${order.id} has no created_at`);
            return false;
          }
          const orderDate = new Date(order.created_at);
          const isInRange = orderDate >= fromDateObj && orderDate <= toDateObj;
          if (!isInRange) {
            console.log(`[loadBrandOrders] Order ${order.id} (${order.order_id}) EXCLUDED by date filter - Order date: ${orderDate.toISOString()}, Range: ${fromDateObj.toISOString()} to ${toDateObj.toISOString()}`);
          }
          return isInRange;
        });
        
        console.log(`[loadBrandOrders] Brand ${brandId}: After date filter - ${filteredOrders.length} orders (from ${unpaidOrders.length} unpaid orders)`);
      }

      // Cache the results
      setBrandOrdersCache(prev => new Map(prev).set(brandId, filteredOrders));
      return filteredOrders;
    } catch (error) {
      console.error(`Failed to load orders for brand ${brandId}:`, error);
      alert('Failed to load orders. Please try again.');
      return [];
    } finally {
      setLoadingBrandOrders(prev => {
        const newMap = new Map(prev);
        newMap.delete(brandId);
        return newMap;
      });
    }
  };

  // Toggle brand expansion
  const toggleBrandExpansion = async (brandId) => {
    const newExpanded = new Set(expandedBrands);
    if (newExpanded.has(brandId)) {
      // Collapse
      newExpanded.delete(brandId);
      setExpandedBrands(newExpanded);
    } else {
      // Expand - set expanded state first
      newExpanded.add(brandId);
      setExpandedBrands(newExpanded);
      // Use cache if available, otherwise fetch
      if (!brandOrdersCache.has(brandId)) {
        setLoadingBrandOrders(prev => new Map(prev).set(brandId, true));
        await loadBrandOrders(brandId, false, 
          filtersApplied ? bulkFromDate : null, 
          filtersApplied ? bulkToDate : null
        );
      }
    }
  };

  // Apply date filters - fetch orders for ALL brands upfront
  const handleApplyFilters = async () => {
    if (!bulkFromDate || !bulkToDate) {
      alert('Please select both from and to dates');
      return;
    }

    // Clear all cached orders
    setBrandOrdersCache(new Map());
    setApplyingFilters(true);
    
    try {
      // Fetch orders for ALL brands with date filters
      const brandIds = brands.map(b => b.id);
      
      // Set loading state for all brands
      setLoadingBrandOrders(prev => {
        const newMap = new Map(prev);
        brandIds.forEach(brandId => {
          newMap.set(brandId, true);
        });
        return newMap;
      });
      
      // Load orders for all brands in parallel with date filters
      await Promise.all(brandIds.map(brandId => loadBrandOrders(brandId, false, bulkFromDate, bulkToDate)));
      
      // Mark filters as applied ONLY after loading completes successfully
      setFiltersApplied(true);
    } catch (error) {
      console.error('Failed to apply filters:', error);
      alert('Failed to apply filters. Please try again.');
      // Don't set filtersApplied to true if there was an error
    } finally {
      setApplyingFilters(false);
    }
  };

  // Clear bulk modal filters - remove dates and reload all orders without filters
  const handleClearBulkFilters = async () => {
    // Set loading state FIRST to ensure button shows "Clearing..." while filtersApplied is still true
    setApplyingFilters(true);
    
    // Clear all cached orders
    setBrandOrdersCache(new Map());
    
    // Clear dates AFTER setting loading state
    setBulkFromDate('');
    setBulkToDate('');
    
    try {
      // Fetch orders for ALL brands without date filters
      const brandIds = brands.map(b => b.id);
      
      // Set loading state for all brands
      setLoadingBrandOrders(prev => {
        const newMap = new Map(prev);
        brandIds.forEach(brandId => {
          newMap.set(brandId, true);
        });
        return newMap;
      });
      
      // Load orders for all brands in parallel (without date filters)
      await Promise.all(brandIds.map(brandId => loadBrandOrders(brandId, false, null, null)));
    } catch (error) {
      console.error('Failed to clear filters:', error);
      alert('Failed to clear filters. Please try again.');
    } finally {
      setApplyingFilters(false);
      setFiltersApplied(false); // Mark filters as not applied AFTER loading completes
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Toggle all orders for a brand
  const toggleAllOrdersForBrand = (brandId) => {
    const orders = brandOrdersCache.get(brandId) || [];
    const orderIds = orders.map(o => o.id);
    const allSelected = orderIds.every(id => selectedOrders.has(id));
    
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        orderIds.forEach(id => newSet.delete(id));
      } else {
        orderIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const prepareBulkMarkPaid = () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order');
      return;
    }

    // Get brand names from selected orders
    const orderIds = Array.from(selectedOrders);
    const brandIdsSet = new Set();
    const brandNamesList = [];

    // Collect unique brand IDs from selected orders
    orderIds.forEach(orderId => {
      for (const [brandId, orders] of brandOrdersCache.entries()) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          brandIdsSet.add(Number(brandId));
          break;
        }
      }
    });

    // Get brand names
    brandIdsSet.forEach(brandId => {
      const brand = brands.find(b => b.id === brandId);
      if (brand) {
        brandNamesList.push(brand.name || brand.username || `Brand #${brandId}`);
      } else {
        brandNamesList.push(brandNameById[brandId] || `Brand #${brandId}`);
      }
    });

    const formattedFromDate = bulkFromDate ? formatDateForAPI(bulkFromDate, false) : null;
    const formattedToDate = bulkToDate ? formatDateForAPI(bulkToDate, true) : null;

    setPendingBulkAction({
      orderIds: orderIds,
      brandNamesList,
      formattedFromDate,
      formattedToDate,
      displayFromDate: bulkFromDate,
      displayToDate: bulkToDate
    });
    setConfirmModalOpen(true);
  };

  const executeBulkMarkPaid = async () => {
    if (!pendingBulkAction) return;

    setConfirmModalOpen(false);
    setBulkLoading(true);
    try {
      const result = await serverApi.admin.payouts.markPaid({
        orderIds: pendingBulkAction.orderIds,
        fromDate: pendingBulkAction.formattedFromDate,
        toDate: pendingBulkAction.formattedToDate
      });

      const rangeLabel = pendingBulkAction.displayFromDate && pendingBulkAction.displayToDate
        ? `${pendingBulkAction.displayFromDate} → ${pendingBulkAction.displayToDate}`
        : 'Selected orders';

      setSuccessSummary({
        brandNamesList: pendingBulkAction.brandNamesList,
        rangeLabel,
        summary: result.summary
      });
      setSuccessModalOpen(true);

      setShowBulkModal(false);
      setBulkFromDate('');
      setBulkToDate('');
      setExpandedBrands(new Set());
      setSelectedOrders(new Set());
      setBrandOrdersCache(new Map());
      loadPayouts(); // Refresh payouts list
    } catch (error) {
      console.error('Failed to mark payouts:', error);
      alert('❌ Failed to mark payouts: ' + error.message);
    } finally {
      setBulkLoading(false);
      setPendingBulkAction(null);
    }
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
    // Clear from localStorage
    try {
      localStorage.removeItem('adminPayoutsDateFilters');
    } catch (e) {
      console.warn('Failed to clear date filters from localStorage:', e);
    }
  };

  const handleDownloadStatement = (payout) => {
    // Placeholder for download statement functionality
    alert(`Download statement for payout ${payout.reference_id || payout.id}`);
  };

  if (loading && page === 1) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 mb-4"></i>
        <p className="text-gray-400">Loading payout history...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Bulk Mark Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Payout History</h2>
          <p className="text-sm text-gray-400">
            View and manage all your past and pending settlements
          </p>
        </div>
        <button
          onClick={openBulkModal}
          className="action-btn btn-primary px-6 py-3 flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
        >
          <i className="fas fa-check-double"></i>
          <span>Bulk Mark as Paid</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          {/* Total Paid Out */}
          <div className="glass-panel p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <i className="fas fa-dollar-sign text-green-400 text-sm"></i>
              </div>
              <span className="text-xs text-gray-400 sm:text-right">Total Paid Out</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-400">${Number(stats.total_paid || 0).toFixed(2)}</p>
          </div>

          {/* Last Payout */}
          <div className="glass-panel p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <i className="fas fa-calendar-check text-blue-400 text-sm"></i>
              </div>
              <span className="text-xs text-gray-400 sm:text-right">Last Payout</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-400">
              ${stats.last_payout ? Number(stats.last_payout.amount || 0).toFixed(2) : '0.00'}
            </p>
            {stats.last_payout?.date && (
              <p className="text-xs text-gray-500 mt-1">
                on {new Date(stats.last_payout.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Average Payout */}
          <div className="glass-panel p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-3 gap-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <i className="fas fa-chart-line text-purple-400 text-sm"></i>
              </div>
              <span className="text-xs text-gray-400 sm:text-right">Average Payout</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-purple-400">${Number(stats.average_payout || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="glass-panel p-4 md:p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Filter Payouts</h3>
          {(fromDate || toDate) && (
            <button
              onClick={handleClearFilters}
              className="action-btn btn-secondary"
            >
              <i className="fas fa-times mr-2"></i>Clear Filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-alt mr-2 text-blue-400"></i>From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="search-input p-3 rounded-lg w-full"
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-calendar-check mr-2 text-blue-400"></i>To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="search-input p-3 rounded-lg w-full"
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="glass-panel p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg md:text-xl font-semibold text-white">
            <i className="fas fa-receipt mr-2 text-cyan-400"></i>Payouts ({payouts.length})
          </h3>
        </div>

        {payouts.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-file-invoice-dollar text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">No payout history found</p>
            <p className="text-sm text-gray-500 mt-2">
              Payouts will appear here once they are processed
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Payout Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Period</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Method</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Reference ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-sm text-white">
                        {payout.paid_at 
                          ? new Date(payout.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(payout.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        }
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-green-400">
                        ${Number(payout.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {new Date(payout.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(payout.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          payout.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {payout.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {payout.method || 'Bank Transfer'}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-400">
                        {payout.reference_id || `SET-${payout.id}`}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleDownloadStatement(payout)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <i className="fas fa-download mr-2"></i>
                          Statement
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 pt-4 mt-auto border-t border-gray-700">
                <button
                  className="action-btn btn-secondary w-full sm:w-auto"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <i className="fas fa-chevron-left mr-2"></i>
                  Prev
                </button>
                <div className="text-sm text-gray-400 text-center order-first sm:order-none">
                  Page {page} of {meta.pages} — {meta.total} total
                </div>
                <button
                  className="action-btn btn-secondary w-full sm:w-auto"
                  onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                  disabled={page >= meta.pages}
                >
                  Next
                  <i className="fas fa-chevron-right ml-2"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Mark Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowBulkModal(false)}>
          <div className="glass-panel p-6 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" style={{ overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-bold gradient-text">Bulk Mark Payouts as Paid</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1">
              {/* Date Range Selection */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  <i className="fas fa-calendar-alt mr-2 text-blue-400"></i>Filter by Date Range (Optional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <i className="fas fa-calendar-alt mr-2 text-blue-400"></i>From Date
                    </label>
                    <input
                      type="date"
                      value={bulkFromDate}
                      onChange={(e) => {
                        setBulkFromDate(e.target.value);
                      }}
                      className="search-input p-3 rounded-lg w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <i className="fas fa-calendar-check mr-2 text-blue-400"></i>To Date
                    </label>
                    <input
                      type="date"
                      value={bulkToDate}
                      onChange={(e) => {
                        setBulkToDate(e.target.value);
                      }}
                      className="search-input p-3 rounded-lg w-full"
                    />
                  </div>
                </div>
                {filtersApplied ? (
                  <button
                    onClick={handleClearBulkFilters}
                    disabled={applyingFilters}
                    className="action-btn btn-secondary w-full md:w-auto mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {applyingFilters ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Clearing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-times mr-2"></i>
                        Clear Filters
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleApplyFilters}
                    disabled={!bulkFromDate || !bulkToDate || applyingFilters}
                    className="action-btn btn-primary w-full md:w-auto mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {applyingFilters ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Applying Filters...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-filter mr-2"></i>
                        Apply Filters
                      </>
                    )}
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  <i className="fas fa-info-circle mr-1"></i>
                  {filtersApplied
                    ? 'Filters are applied. Click "Clear Filters" to remove date filters.'
                    : 'Select date range and click "Apply Filters" to filter unpaid orders for all brands.'}
                </p>
              </div>

              {/* Brand List with Expandable Orders */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-300">
                    <i className="fas fa-building mr-2 text-orange-400"></i>Brands
                  </h4>
                  {selectedOrders.size > 0 && (
                    <span className="text-sm text-cyan-400 font-medium">
                      {selectedOrders.size} order(s) selected
                    </span>
                  )}
                </div>

                {loadingBrands ? (
                  <div className="text-center py-8">
                    <i className="fas fa-spinner fa-spin text-2xl text-cyan-400"></i>
                    <p className="text-gray-400 mt-2">Loading brands...</p>
                  </div>
                ) : brands.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No brands found
                  </div>
                ) : (
                  <div className="border border-gray-700 rounded-lg max-h-[500px] overflow-y-auto">
                    {brands.map(brand => {
                      const isExpanded = expandedBrands.has(brand.id);
                      const orders = brandOrdersCache.get(brand.id) || [];
                      const isLoading = loadingBrandOrders.has(brand.id);
                      const brandOrderIds = orders.map(o => o.id);
                      const selectedCount = brandOrderIds.filter(id => selectedOrders.has(id)).length;
                      const allSelected = orders.length > 0 && brandOrderIds.every(id => selectedOrders.has(id));

                      return (
                        <div key={brand.id} className="border-b border-gray-800 last:border-b-0">
                          {/* Brand Header - Clickable */}
                          <div
                            onClick={() => !isLoading && toggleBrandExpansion(brand.id)}
                            className={`flex items-center px-4 py-3 transition-colors ${
                              isLoading ? 'cursor-wait opacity-75' : 'hover:bg-white/5 cursor-pointer'
                            }`}
                          >
                            {isLoading ? (
                              <i className="fas fa-spinner fa-spin text-cyan-400 mr-3 text-sm"></i>
                            ) : (
                              <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-400 mr-3 text-sm`}></i>
                            )}
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">{brand.name || brand.username}</div>
                              <div className="text-xs text-gray-400">{brand.email}</div>
                            </div>
                            <div className="text-xs text-gray-400 mr-3 flex items-center gap-2">
                              {isLoading && (
                                <>
                                  <i className="fas fa-spinner fa-spin text-cyan-400"></i>
                                  <span className="text-cyan-400">Loading...</span>
                                </>
                              )}
                              {!isLoading && isExpanded && orders.length > 0 && (
                                <span className="text-cyan-400">
                                  {orders.length} unpaid order{orders.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {!isLoading && !isExpanded && (
                                <span>Click to view orders</span>
                              )}
                              {!isLoading && isExpanded && orders.length === 0 && (
                                <span className="text-gray-500">No orders</span>
                              )}
                            </div>
                          </div>

                          {/* Orders Dropdown */}
                          {isExpanded && (
                            <div className="bg-gray-800/30 border-t border-gray-700">
                              {isLoading ? (
                                <div className="px-4 py-6 text-center">
                                  <i className="fas fa-spinner fa-spin text-xl text-cyan-400"></i>
                                  <p className="text-gray-400 mt-2 text-sm">Loading orders...</p>
                                </div>
                              ) : orders.length === 0 ? (
                                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                                  No unpaid orders found
                                  {bulkFromDate && bulkToDate && ' in the selected date range'}
                                </div>
                              ) : (
                                <>
                                  {/* Select All for Brand */}
                                  <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                                    <label className="flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={() => toggleAllOrdersForBrand(brand.id)}
                                        className="w-4 h-4 text-cyan-400 border-gray-600 rounded focus:ring-cyan-500 bg-transparent"
                                      />
                                      <span className="ml-2 text-sm text-gray-300">
                                        Select all ({selectedCount}/{orders.length} selected)
                                      </span>
                                    </label>
                                  </div>

                                  {/* Orders List */}
                                  <div className="max-h-64 overflow-y-auto">
                                    {orders.map(order => (
                                      <label
                                        key={order.id}
                                        className="flex items-center px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-gray-800 last:border-b-0 transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedOrders.has(order.id)}
                                          onChange={() => toggleOrderSelection(order.id)}
                                          className="w-4 h-4 text-cyan-400 border-gray-600 rounded focus:ring-cyan-500 bg-transparent"
                                        />
                                        <div className="ml-3 flex-1">
                                          <div className="text-sm font-medium text-white">
                                            Order: {order.order_id || `#${order.id}`}
                                          </div>
                                          <div className="text-xs text-gray-400 flex items-center gap-4 mt-1">
                                            <span>
                                              <i className="fas fa-dollar-sign mr-1"></i>
                                              ${Number(order.commission_amount || 0).toFixed(2)}
                                            </span>
                                            <span>
                                              <i className="fas fa-calendar mr-1"></i>
                                              {new Date(order.created_at).toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric', 
                                                year: 'numeric' 
                                              })}
                                            </span>
                                          </div>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-6 mt-6 border-t border-gray-700 flex justify-between items-center gap-3 flex-shrink-0">
              <div className="text-sm text-gray-400">
                {selectedOrders.size > 0 && (
                  <span>
                    <i className="fas fa-check-circle mr-1 text-cyan-400"></i>
                    {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="action-btn btn-secondary"
                  disabled={bulkLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={prepareBulkMarkPaid}
                  disabled={bulkLoading || selectedOrders.size === 0}
                  className="action-btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {bulkLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      Mark as Paid
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModalOpen && pendingBulkAction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="glass-panel p-6 md:p-8 rounded-xl max-w-lg w-full relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold gradient-text">Confirm Bulk Mark as Paid</h3>
              <button
                onClick={() => {
                  setConfirmModalOpen(false);
                  setPendingBulkAction(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>

            <p className="text-sm text-gray-300 mb-3">
              You are about to mark <span className="text-white font-semibold">{pendingBulkAction.orderIds?.length || 0}</span>{' '}
              order(s) as paid.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              This will update the selected orders to paid status.
            </p>

            <div className="border border-gray-700 rounded-lg max-h-48 overflow-y-auto mb-4">
              <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                <p className="text-xs text-gray-400">Affected Brands:</p>
              </div>
              {pendingBulkAction.brandNamesList.map((name, index) => (
                <p
                  key={`${name}-${index}`}
                  className="px-4 py-2 text-sm text-white border-b border-gray-800 last:border-b-0"
                >
                  {name}
                </p>
              ))}
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 mb-4">
              <p className="flex items-center gap-2">
                <i className="fas fa-calendar text-blue-400"></i>
                <span>
                  Date Range:{' '}
                  <span className="text-white font-medium">
                    {pendingBulkAction.displayFromDate && pendingBulkAction.displayToDate
                      ? `${pendingBulkAction.displayFromDate} → ${pendingBulkAction.displayToDate}`
                      : 'All unpaid orders'}
                  </span>
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirmModalOpen(false);
                  setPendingBulkAction(null);
                }}
                className="action-btn btn-secondary"
                disabled={bulkLoading}
              >
                Cancel
              </button>
              <button
                onClick={executeBulkMarkPaid}
                className="action-btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={bulkLoading}
              >
                {bulkLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalOpen && successSummary && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="glass-panel p-6 md:p-8 rounded-xl max-w-lg w-full relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <i className="fas fa-check text-green-400 text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Brands Marked as Paid</h3>
                  <p className="text-sm text-gray-400">{successSummary.rangeLabel}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSuccessModalOpen(false);
                  setSuccessSummary(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 text-sm text-gray-300 mb-4">
              <p className="flex items-center justify-between mb-2">
                <span>Total Brands</span>
                <span className="text-white font-semibold">{successSummary.summary?.totalBrands || successSummary.brandNamesList.length}</span>
              </p>
              <p className="flex items-center justify-between mb-2">
                <span>Total Orders Marked</span>
                <span className="text-cyan-400 font-semibold">{successSummary.summary?.totalOrders || 0}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Total Amount</span>
                <span className="text-green-400 font-semibold">
                  ${Number(successSummary.summary?.totalAmount || 0).toFixed(2)}
                </span>
              </p>
            </div>

            <div className="border border-gray-700 rounded-lg max-h-48 overflow-y-auto mb-4">
              {successSummary.brandNamesList.map((name, index) => (
                <p
                  key={`${name}-success-${index}`}
                  className="px-4 py-2 text-sm text-white border-b border-gray-800 last:border-b-0"
                >
                  {name}
                </p>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSuccessModalOpen(false);
                  setSuccessSummary(null);
                }}
                className="action-btn btn-primary"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
