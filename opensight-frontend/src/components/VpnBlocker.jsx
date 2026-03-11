import React from 'react';

/**
 * Full-screen blocker component that prevents access when VPN/Proxy is detected or IP is not whitelisted
 * @param {Object} props
 * @param {string} props.blockReason - Reason for blocking: 'vpn' or 'whitelist'
 */
export default function VpnBlocker({ blockReason = 'vpn' }) {
  const handleRefresh = () => {
    window.location.reload();
  };

  const isWhitelistBlock = blockReason === 'whitelist';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900 bg-opacity-95">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Warning Icon */}
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isWhitelistBlock ? 'Access Restricted' : 'VPN/Proxy Detected'}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            {isWhitelistBlock 
              ? 'Access to this website is restricted to authorized IP addresses only.'
              : 'Please turn off your VPN or Proxy to access this website. We require a direct connection for security purposes.'
            }
          </p>

          {/* Refresh Button (only show for VPN block) */}
          {!isWhitelistBlock && (
            <button
              onClick={handleRefresh}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              I've Disabled It - Refresh Page
            </button>
          )}

          {/* Additional Info */}
          <p className="text-xs text-gray-500 mt-6">
            If you believe this is an error, please contact support
          </p>
        </div>
      </div>
    </div>
  );
}

