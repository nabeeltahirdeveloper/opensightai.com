/**
 * Vercel Serverless Function to handle Neogate POST redirects
 * Neogate sends POST requests back to /pay/pay_<transactionId>
 * This function converts POST to GET redirect to the React app
 */
export default async function handler(req, res) {
  // Handle both POST and GET (for testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Extract transaction ID from the original request URL
    // Vercel provides original URL info in headers or query params
    let path = null;
    
    // First, try to get from query parameter (from rewrite rule)
    if (req.query.transactionId) {
      // The rewrite passes transactionId as query param, but we need to add "pay_" prefix
      path = `pay_${req.query.transactionId}`;
    }
    
    // Try multiple methods to get the original path from headers
    if (!path) {
      const originalUrl = req.headers['x-vercel-original-url'] || 
                         req.headers['x-invoke-path'] ||
                         req.headers['x-forwarded-url'] || 
                         req.headers['referer'] || 
                         req.url;
      
      console.log('[NeogateCallback] Request details:', {
        url: req.url,
        originalUrl,
        query: req.query,
        headers: Object.keys(req.headers),
        method: req.method
      });
      
      // Extract path from original URL (format: /pay/pay_<transactionId>)
      if (originalUrl) {
        const match = originalUrl.match(/\/pay\/(pay_[^/?&]+)/);
        if (match) {
          path = match[1];
        }
      }
    }
    
    // Fallback: try to get from query parameter
    if (!path && req.query.path) {
      path = req.query.path;
    }
    
    // Fallback: try to get from query string if Neogate sends it
    if (!path) {
      path = req.query.orderId;
    }
    
    // Extract transaction ID (remove "pay_" prefix if present)
    let transactionId = path;
    if (path && typeof path === 'string' && path.startsWith('pay_')) {
      transactionId = path.substring(4);
    } else if (path) {
      transactionId = path;
    }

    // Extract any POST body data (Neogate might send payment data)
    // Neogate typically sends form-urlencoded data
    let postData = {};
    
    if (req.method === 'POST') {
      // Handle different content types
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        postData = req.body || {};
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Parse URL-encoded form data
        if (typeof req.body === 'string') {
          const params = new URLSearchParams(req.body);
          postData = Object.fromEntries(params);
        } else {
          postData = req.body || {};
        }
      } else {
        // Try to parse as JSON or use body as-is
        try {
          postData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        } catch (e) {
          postData = req.body || {};
        }
      }
      
      // If we don't have a path yet, try to extract from POST body
      // Neogate might include merchant-order-id which matches our transaction ID format
      if (!path && postData['merchant-order-id']) {
        path = postData['merchant-order-id'];
      }
    }
    
    // Re-extract transaction ID if we got it from POST body
    if (path && !transactionId) {
      if (typeof path === 'string' && path.startsWith('pay_')) {
        transactionId = path.substring(4);
      } else {
        transactionId = path;
      }
    }
    
    // Extract query parameters from POST body if they exist
    const orderId = postData['merchant-order-id'] || postData.orderId || postData.orderReference || transactionId;
    const paynetOrderId = postData['paynet-order-id'] || postData.paynetOrderId;
    const status = postData.status || postData.paymentStatus;
    const error = postData.error || postData.errorCode;

    console.log('[NeogateCallback] POST request received:', {
      path,
      transactionId,
      orderId,
      paynetOrderId,
      status,
      error,
      body: postData
    });

    // Build redirect URL with query parameters
    const params = new URLSearchParams();
    
    if (orderId) {
      params.set('orderId', orderId);
    }
    
    if (paynetOrderId) {
      params.set('paynetOrderId', paynetOrderId);
    }
    
    if (status) {
      params.set('status', status);
    }
    
    if (error) {
      params.set('error', error);
    } else if (!orderId && transactionId) {
      // Fallback: use transaction ID if no orderId
      params.set('orderId', transactionId);
    }

    // Redirect to success page with GET
    const redirectUrl = `/success?${params.toString()}`;
    
    console.log('[NeogateCallback] Redirecting to:', redirectUrl);
    
    // Return HTML redirect (works better for POST -> GET conversion)
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${redirectUrl}">
          <script>window.location.href = "${redirectUrl}";</script>
        </head>
        <body>
          <p>Redirecting...</p>
          <a href="${redirectUrl}">Click here if you are not redirected</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[NeogateCallback] Error:', error);
    // Redirect to success page with error
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=/success?error=callback_error">
          <script>window.location.href = "/success?error=callback_error";</script>
        </head>
        <body>
          <p>Redirecting...</p>
          <a href="/success?error=callback_error">Click here if you are not redirected</a>
        </body>
      </html>
    `);
  }
}
