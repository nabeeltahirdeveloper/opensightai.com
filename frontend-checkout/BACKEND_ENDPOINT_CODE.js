/**
 * BACKEND ENDPOINT CODE - Add this to your backend API
 * 
 * This endpoint handles POST requests from Neogate when they redirect back
 * Route: POST /api/checkout/neogate-redirect/:transactionId
 * Or: POST /pay/pay_:transactionId (if handled directly by Apache)
 */

// Express.js example (adjust for your framework)
router.post('/api/checkout/neogate-redirect/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Extract POST body data (Neogate sends form-urlencoded data)
    const postData = req.body || {};
    
    // Extract payment information
    const merchantOrderId = postData['merchant-order-id'] || postData.merchantOrderId || transactionId;
    const paynetOrderId = postData['paynet-order-id'] || postData.paynetOrderId;
    const status = postData.status || postData.paymentStatus;
    const error = postData.error || postData.errorCode;
    
    console.log('[NeogateRedirect] POST request received:', {
      transactionId,
      merchantOrderId,
      paynetOrderId,
      status,
      error,
      body: postData
    });
    
    // Build redirect URL with query parameters
    const params = new URLSearchParams();
    
    if (merchantOrderId) {
      params.set('orderId', merchantOrderId);
    }
    
    if (paynetOrderId) {
      params.set('paynetOrderId', paynetOrderId);
    }
    
    if (status) {
      params.set('status', status);
    }
    
    if (error) {
      params.set('error', error);
    } else if (!merchantOrderId && transactionId) {
      // Fallback: use transaction ID if no merchantOrderId
      params.set('orderId', transactionId);
    }
    
    // Redirect to success page with GET
    const redirectUrl = `https://pay.OpenSightai.com/success?${params.toString()}`;
    
    console.log('[NeogateRedirect] Redirecting to:', redirectUrl);
    
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
    console.error('[NeogateRedirect] Error:', error);
    // Redirect to success page with error
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=https://pay.OpenSightai.com/success?error=callback_error">
          <script>window.location.href = "https://pay.OpenSightai.com/success?error=callback_error";</script>
        </head>
        <body>
          <p>Redirecting...</p>
          <a href="https://pay.OpenSightai.com/success?error=callback_error">Click here if you are not redirected</a>
        </body>
      </html>
    `);
  }
});

// Alternative: Handle all /pay/pay_* routes
router.post('/pay/pay_:transactionId', async (req, res) => {
  // Same code as above, but extract transactionId from route param
  const transactionId = req.params.transactionId;
  // ... rest of the code
});
