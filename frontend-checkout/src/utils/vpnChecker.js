// VPN/Proxy detection utility

const API_BASE = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com';

/**
 * Check if user is using VPN or Proxy
 * @returns {Promise<{allowed: boolean, isVpn: boolean, isProxy: boolean}>}
 */
export async function checkVpnStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/check-vpn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('VPN check failed with status:', response.status);
      // On error, allow access
      return { allowed: true, isVpn: false, isProxy: false };
    }

    const data = await response.json();
    return {
      allowed: data.allowed !== false,
      isVpn: data.isVpn || false,
      isProxy: data.isProxy || false,
    };
  } catch (error) {
    console.error('VPN check error:', error);
    // On error, allow access
    return { allowed: true, isVpn: false, isProxy: false };
  }
}

