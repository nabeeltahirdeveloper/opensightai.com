// Utility for tracking brand link IDs through the checkout flow

const LINK_ID_KEY = 'vs_link_id';
const VISIT_RECORDED_KEY = 'vs_visit_recorded_';

/**
 * Capture link ID from URL parameters and store in sessionStorage
 * Also records the visit to the backend
 * Should be called when app initializes or on route changes
 */
export async function captureLinkIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const linkId = params.get('link') || params.get('linkId');
    
    if (linkId) {
      sessionStorage.setItem(LINK_ID_KEY, linkId);
      console.log('[linkTracking] Captured link ID:', linkId);
      
      // Check if we've already recorded a visit for this link in this session
      const visitRecordedKey = VISIT_RECORDED_KEY + linkId;
      const alreadyRecorded = sessionStorage.getItem(visitRecordedKey);
      
      if (!alreadyRecorded) {
        // Record the visit to the backend
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'https://api-dev.OpenSightai.com';
          const response = await fetch(`${apiUrl}/api/brand/links/record-visit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ linkId }),
          });
          
          if (response.ok) {
            // Mark this visit as recorded for this session
            sessionStorage.setItem(visitRecordedKey, 'true');
            console.log('[linkTracking] Visit recorded successfully');
          } else {
            console.error('[linkTracking] Failed to record visit:', response.status);
          }
        } catch (recordError) {
          console.error('[linkTracking] Error recording visit:', recordError);
        }
      } else {
        console.log('[linkTracking] Visit already recorded for this session');
      }
    }
  } catch (error) {
    console.error('[linkTracking] Failed to capture link ID:', error);
  }
}

/**
 * Get the stored link ID from sessionStorage
 * @returns {string|null} The link ID if stored, null otherwise
 */
export function getStoredLinkId() {
  try {
    return sessionStorage.getItem(LINK_ID_KEY);
  } catch (error) {
    console.error('[linkTracking] Failed to get link ID:', error);
    return null;
  }
}

/**
 * Clear the stored link ID from sessionStorage
 */
export function clearLinkId() {
  try {
    sessionStorage.removeItem(LINK_ID_KEY);
    console.log('[linkTracking] Cleared link ID');
  } catch (error) {
    console.error('[linkTracking] Failed to clear link ID:', error);
  }
}


