// Visit tracking utility for brand referrals

const STORAGE_KEY = 'vs_ref';
const TRACKED_KEY = 'vs_tracked';
const API_BASE = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com';

/**
 * Extracts the ref parameter from URL
 */
function getRefFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ref');
}

/**
 * Store the ref parameter in session storage and localStorage
 */
function storeRef(ref) {
  try {
    sessionStorage.setItem(STORAGE_KEY, ref);
    sessionStorage.setItem(TRACKED_KEY, 'false');
    // Also store in localStorage for checkout to use
    localStorage.setItem('vs_referral_slug', ref);
  } catch (e) {
    console.error('Failed to store ref:', e);
  }
}

/**
 * Get the stored ref parameter
 */
function getStoredRef() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Check if visit has already been tracked
 */
function hasBeenTracked() {
  try {
    return sessionStorage.getItem(TRACKED_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Mark visit as tracked
 */
function markAsTracked() {
  try {
    sessionStorage.setItem(TRACKED_KEY, 'true');
  } catch (e) {
    console.error('Failed to mark as tracked:', e);
  }
}

/**
 * Track the visit to the backend
 */
async function trackVisit(brandSlug) {
  try {
    const response = await fetch(`${API_BASE}/api/track/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_slug: brandSlug,
        page_visited: window.location.pathname,
        session_id: getSessionId(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to track visit');
    }

    markAsTracked();
    return true;
  } catch (error) {
    console.error('Visit tracking error:', error);
    return false;
  }
}

/**
 * Generate or get session ID
 */
function getSessionId() {
  try {
    let sessionId = sessionStorage.getItem('vs_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem('vs_session_id', sessionId);
    }
    return sessionId;
  } catch (e) {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Initialize visit tracking
 * Call this on app mount/page load
 */
export async function initVisitTracking() {
  // Check if visit has already been tracked
  if (hasBeenTracked()) {
    return;
  }

  // Check for ref in URL
  const refFromURL = getRefFromURL();
  
  if (refFromURL) {
    // Store the ref for future use
    storeRef(refFromURL);
    
    // Track the visit
    await trackVisit(refFromURL);
  } else {
    // Check if we have a stored ref from a previous page
    const storedRef = getStoredRef();
    
    if (storedRef) {
      // Track the visit if not already tracked
      await trackVisit(storedRef);
    }
  }
}

/**
 * Get the current ref (for use in checkout/forms)
 */
export function getCurrentRef() {
  return getRefFromURL() || getStoredRef();
}

/**
 * Clear the stored ref (e.g., after checkout completion)
 */
export function clearRef() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TRACKED_KEY);
    localStorage.removeItem('vs_referral_slug');
  } catch (e) {
    console.error('Failed to clear ref:', e);
  }
}

