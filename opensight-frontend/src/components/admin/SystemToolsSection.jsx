import React, { useState } from 'react';
import { serverApi } from '@/api/serverApi';

export default function SystemToolsSection() {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFixUSDAmounts = async () => {
    if (!confirm('This will recalculate USD amounts for all orders with non-USD currencies. Continue?')) {
      return;
    }

    setFixing(true);
    setError(null);
    setResult(null);

    try {
      const data = await serverApi.admin.systemTools.fixUsdAmounts();
      setResult(data);
    } catch (err) {
      console.error('Error fixing USD amounts:', err);
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold gradient-text">System Tools</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Fix USD Amounts Tool */}
        <div className="glass-panel p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2 text-white flex items-center">
                <i className="fas fa-dollar-sign text-green-400 mr-3"></i>
                Fix USD Conversion
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Recalculates USD amounts for all orders with non-USD currencies using current exchange rates.
                This fixes orders where the amount_usd incorrectly equals the original currency amount.
              </p>
            </div>
          </div>

          <button
            onClick={handleFixUSDAmounts}
            disabled={fixing}
            className={`action-btn ${fixing ? 'btn-disabled' : 'btn-primary'} flex items-center space-x-2`}
          >
            {fixing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Fixing...</span>
              </>
            ) : (
              <>
                <i className="fas fa-wrench"></i>
                <span>Fix USD Amounts</span>
              </>
            )}
          </button>

          {/* Results Display */}
          {result && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h4 className="text-lg font-semibold mb-3 text-green-400 flex items-center">
                <i className="fas fa-check-circle mr-2"></i>
                Fix Completed Successfully
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Total Found</div>
                  <div className="text-2xl font-bold text-cyan-400">{result.total_found}</div>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Fixed</div>
                  <div className="text-2xl font-bold text-green-400">{result.fixed}</div>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Skipped</div>
                  <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Success Rate</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {result.total_found > 0 ? Math.round((result.fixed / result.total_found) * 100) : 0}%
                  </div>
                </div>
              </div>

              {result.results && result.results.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-gray-300 mb-2">Recent Fixes:</h5>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.results.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="bg-gray-900/50 p-3 rounded text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono text-cyan-400">{item.order_id}</span>
                          <span className="text-xs text-gray-500">{item.currency}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{item.original_amount.toFixed(2)} {item.currency}</span>
                          <span>→</span>
                          <span className="text-red-400 line-through">${item.old_usd.toFixed(2)}</span>
                          <span>→</span>
                          <span className="text-green-400">${item.new_usd.toFixed(2)} USD</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {result.results.length > 10 && (
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      Showing 10 of {result.results.length} fixed orders
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <h4 className="text-lg font-semibold mb-2 text-red-400 flex items-center">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Error
              </h4>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Future tools can be added here */}
        <div className="glass-panel p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2 text-white flex items-center">
                <i className="fas fa-tools text-blue-400 mr-3"></i>
                More Tools Coming Soon
              </h3>
              <p className="text-gray-400 text-sm">
                Additional system maintenance and utility tools will be added here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

