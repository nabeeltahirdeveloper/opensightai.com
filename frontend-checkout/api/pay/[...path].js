/**
 * Vercel Serverless Function to handle Neogate POST redirects
 * This catches all paths under /pay/ including /pay/pay_<transactionId>
 * Neogate sends POST requests back to /pay/pay_<transactionId>
 * This function converts POST to GET redirect to the React app
 */
export default async function handler(req, res) {
  // Handle both POST and GET (for testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Extract transaction ID from the path parameter
    // The path will be something like ["pay_1768210406213_xu8gfk"]
    const pathSegments = req.query.path || [];
    const fullPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    
    console.log('[NeogateCallback] Request details:', {
      url: req.url,
      path: fullPath,
      pathSegments,
      query: req.query,
      method: req.method,
      headers: Object.keys(req.headers)
    });
    
    // Extract transaction ID from path (format: pay_<transactionId>)
    let transactionId = null;
    let path = fullPath;
    
    if (path && path.startsWith('pay_')) {
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
      
      // If we don't have a transactionId yet, try to extract from POST body
      // Neogate might include merchant-order-id which matches our transaction ID format
      if (!transactionId && postData['merchant-order-id']) {
        const merchantOrderId = postData['merchant-order-id'];
        if (merchantOrderId.startsWith('pay_')) {
          transactionId = merchantOrderId.substring(4);
        } else {
          transactionId = merchantOrderId;
        }
      }
    }
    
    // Extract query parameters from POST body if they exist
    const orderId = postData['merchant-order-id'] || postData.orderId || postData.orderReference || transactionId;
    const paynetOrderId = postData['paynet-order-id'] || postData.paynetOrderId;
    const status = postData.status || postData.paymentStatus;
    const error = postData.error || postData.errorCode;

    console.log('[NeogateCallback] Extracted data:', {
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
