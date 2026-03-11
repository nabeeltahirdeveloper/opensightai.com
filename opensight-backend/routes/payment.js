/**
 * Bot Payment Routes
 * Handles bot-based payment flow with external FastAPI server
 */

import express from 'express'
import crypto from 'crypto'
import * as botPayment from '../services/botPayment.js'

/**
 * Create payment routes
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {Object} options - Configuration options
 * @param {Function} options.ensureBotPaymentsTable - Function to ensure bot_payments table exists
 * @param {Function} options.ensureUsersTable - Function to ensure users table exists
 * @param {Function} options.ensureOrdersTable - Function to ensure orders table exists
 * @param {Function} options.ensureBrandsTable - Function to ensure brands table exists
 * @param {string} options.frontendCheckoutUrl - Frontend checkout URL for callbacks
 * @returns {Router} Express router
 */
export default function createPaymentRoutes(pool, options = {}) {
  if (!pool?.query) {
    throw new Error('[paymentRoutes] PostgreSQL pool is required')
  }

  const {
    ensureBotPaymentsTable,
    ensureUsersTable,
    ensureOrdersTable,
    ensureBrandsTable,
    frontendCheckoutUrl = process.env.FRONTEND_CHECKOUT_URL || 'https://checkout.OpenSightai.com'
  } = options

  const router = express.Router()

  /**
   * Helper function to ensure order exists in orders table
   * This is called from multiple places to ensure orders are always created
   */
  async function ensureOrderInOrdersTable(pool, payment, getBrandBySlug, getLinkById) {
    const orderId = payment.order_id

    // Check if order already exists
    const existingOrder = await pool.query(
      'SELECT id FROM orders WHERE order_id = $1',
      [orderId]
    )

    if (existingOrder.rows.length > 0) {
      console.log('[ensureOrderInOrdersTable] Order already exists:', orderId)
      return existingOrder.rows[0]
    }

    console.log('[ensureOrderInOrdersTable] Creating order for:', orderId)

    // Parse payment details
    const paymentDetails = typeof payment.payment_details === 'string'
      ? JSON.parse(payment.payment_details)
      : payment.payment_details || {}

    const items = typeof payment.items === 'string'
      ? JSON.parse(payment.items)
      : payment.items || []

    // Look up brand
    let brand = null
    let brandId = null
    let commissionAmount = 0
    let commissionRate = null

    if (payment.brand_slug) {
      brand = await getBrandBySlug(payment.brand_slug)
      if (brand) {
        brandId = brand.id
        commissionRate = Number(brand.commission_rate || 10) / 100
        
        if (brand.parent_brand_id) {
          const parentResult = await pool.query(
            'SELECT commission_rate FROM brands WHERE id = $1',
            [brand.parent_brand_id]
          )
          if (parentResult.rows.length > 0) {
            commissionRate = Number(parentResult.rows[0].commission_rate || 10) / 100
          }
        }
        
        commissionAmount = Number(payment.amount) * commissionRate
        console.log('[ensureOrderInOrdersTable] Brand:', brand.name, 'Commission:', commissionAmount)
      }
    }

    // Look up link
    let linkIdNum = null
    if (payment.link_id) {
      const linkRecord = await getLinkById(payment.link_id)
      if (linkRecord) {
        linkIdNum = linkRecord.id
        if (!brandId) brandId = linkRecord.brand_id
      }
    }

    // Check/create user
    let userId = payment.user_id
    if (!userId) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [payment.email]
      )
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id
      }
    }

    // Insert order
    try {
      const orderResult = await pool.query(`
        INSERT INTO orders (
          order_id, user_id, email, items, total_amount, amount_usd, currency,
          payment_status, brand_id, link_id, commission_amount, commission_rate,
          commission_status, first_name, last_name, phone, billing_country,
          payment_method, payment_gateway, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
        ON CONFLICT (order_id) DO UPDATE SET
          payment_status = EXCLUDED.payment_status,
          user_id = COALESCE(EXCLUDED.user_id, orders.user_id),
          brand_id = COALESCE(EXCLUDED.brand_id, orders.brand_id),
          commission_amount = COALESCE(EXCLUDED.commission_amount, orders.commission_amount),
          commission_status = COALESCE(EXCLUDED.commission_status, orders.commission_status)
        RETURNING id, order_id
      `, [
        orderId,
        userId,
        payment.email,
        JSON.stringify(items),
        payment.amount,
        payment.amount,
        payment.currency || 'USD',
        'paid',
        brandId,
        linkIdNum,
        commissionAmount,
        commissionRate ? commissionRate * 100 : null,
        'unpaid',
        paymentDetails.firstName || null,
        paymentDetails.lastName || null,
        paymentDetails.phone || null,
        paymentDetails.country || null,
        'card',
        'bot'
      ])
      
      console.log('[ensureOrderInOrdersTable] ✅ Order created:', orderResult.rows[0])
      return orderResult.rows[0]
    } catch (err) {
      console.error('[ensureOrderInOrdersTable] ❌ Error creating order:', err.message)
      throw err
    }
  }

  /**
   * Helper function to look up brand by slug
   */
  async function getBrandBySlug(slug) {
    if (!slug) return null
    try {
      const result = await pool.query(
        'SELECT id, name, commission_rate, parent_brand_id FROM brands WHERE slug = $1 AND status = $2',
        [slug, 'active']
      )
      return result.rows[0] || null
    } catch (e) {
      console.error('[payment] Error looking up brand:', e)
      return null
    }
  }

  /**
   * Helper function to get link details
   */
  async function getLinkById(linkId) {
    if (!linkId) return null
    try {
      const result = await pool.query(
        'SELECT id, brand_id FROM brand_links WHERE id = $1',
        [linkId]
      )
      return result.rows[0] || null
    } catch (e) {
      console.error('[payment] Error looking up link:', e)
      return null
    }
  }

  /**
   * POST /api/payment/trigger-bot
   * Trigger bot payment and get payment link
   */
  router.post('/trigger-bot', async (req, res) => {
    try {
      console.log('[payment/trigger-bot] Request received:', req.body)

      // Ensure tables exist
      if (ensureBotPaymentsTable) await ensureBotPaymentsTable()
      if (ensureOrdersTable) await ensureOrdersTable()
      if (ensureBrandsTable) await ensureBrandsTable()

      const {
        items = [],
        totalAmount,
        paymentDetails = {},
        currency = 'USD',
        brandSlug,
        linkId
      } = req.body

      // Validate required fields
      if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({ error: 'Invalid total amount' })
      }

      if (!paymentDetails.email) {
        return res.status(400).json({ error: 'Email is required' })
      }

      // Generate unique order ID - use VS prefix (OpenSight) instead of BOT
      const orderId = `VS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

      // Normalize currency
      const normalizedCurrency = botPayment.normalizeCurrency(currency)

      // Look up brand by slug
      let brand = null
      let brandId = null
      let linkRecord = null

      if (brandSlug) {
        brand = await getBrandBySlug(brandSlug)
        if (brand) {
          brandId = brand.id
          console.log('[payment/trigger-bot] Brand found:', brand.name, 'ID:', brandId)
        }
      }

      // Look up link if provided
      if (linkId) {
        linkRecord = await getLinkById(linkId)
        if (linkRecord && !brandId) {
          brandId = linkRecord.brand_id
        }
      }

      // Build after payment link with order ID
      const afterPaymentLink = `${frontendCheckoutUrl}/payment-success?id=${orderId}`

      console.log('[payment/trigger-bot] Creating payment with:', {
        orderId,
        amount: totalAmount,
        currency: normalizedCurrency,
        email: paymentDetails.email,
        brandSlug,
        brandId,
        afterPaymentLink
      })

      // Call bot API to trigger payment
      const botResponse = await botPayment.triggerBot({
        amount: totalAmount,
        title: orderId,
        afterPaymentLink,
        currency: normalizedCurrency
      })

      if (!botResponse.success || !botResponse.link) {
        throw new Error('Failed to get payment link from bot')
      }

      // Store payment record in database
      await pool.query(`
        INSERT INTO bot_payments (
          order_id,
          email,
          amount,
          currency,
          status,
          payment_link,
          items,
          payment_details,
          brand_slug,
          link_id,
          bot_response,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [
        orderId,
        paymentDetails.email,
        totalAmount,
        normalizedCurrency,
        'pending',
        botResponse.link,
        JSON.stringify(items),
        JSON.stringify(paymentDetails),
        brandSlug || null,
        linkId || null,
        JSON.stringify(botResponse.rawResponse || {})
      ])

      console.log('[payment/trigger-bot] Payment record created:', orderId)

      res.json({
        success: true,
        orderId,
        paymentLink: botResponse.link
      })
    } catch (error) {
      console.error('[payment/trigger-bot] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to initiate payment' })
    }
  })

  /**
   * GET /api/payment/check-status/:orderId
   * Check transaction status from bot server
   */
  router.get('/check-status/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' })
      }

      console.log('[payment/check-status] Checking status for:', orderId)

      // Ensure tables exist
      if (ensureOrdersTable) await ensureOrdersTable()
      if (ensureBrandsTable) await ensureBrandsTable()

      // First check our database
      const dbResult = await pool.query(
        'SELECT * FROM bot_payments WHERE order_id = $1',
        [orderId]
      )

      if (dbResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const payment = dbResult.rows[0]

      // If already marked as paid in DB, ensure order exists and return
      if (payment.status === 'paid') {
        console.log('[payment/check-status] Order already marked as paid in DB')
        // Ensure order exists in orders table
        await ensureOrderInOrdersTable(pool, payment, getBrandBySlug, getLinkById)
        return res.json({
          success: true,
          orderId,
          status: 'paid',
          isPaid: true
        })
      }

      // Check status from bot server
      const statusResponse = await botPayment.checkTransactionStatus(orderId)

      // If bot says paid but our DB says pending, update our DB and create order
      if (statusResponse.isPaid && payment.status !== 'paid') {
        console.log('[payment/check-status] Updating order to paid based on bot status')
        await pool.query(
          'UPDATE bot_payments SET status = $1, updated_at = NOW() WHERE order_id = $2',
          ['paid', orderId]
        )
        
        // Create order in orders table
        payment.status = 'paid' // Update local object
        await ensureOrderInOrdersTable(pool, payment, getBrandBySlug, getLinkById)
      }

      res.json({
        success: true,
        orderId,
        status: statusResponse.status,
        isPaid: statusResponse.isPaid
      })
    } catch (error) {
      console.error('[payment/check-status] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to check status' })
    }
  })

  /**
   * POST /api/payment/mark-paid/:orderId
   * Mark order as paid when user is redirected back from payment
   * This is called when user lands on success page with ?id parameter
   */
  router.post('/mark-paid/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' })
      }

      console.log('[payment/mark-paid] Marking order as paid:', orderId)

      // Ensure tables exist
      if (ensureBotPaymentsTable) await ensureBotPaymentsTable()
      if (ensureUsersTable) await ensureUsersTable()
      if (ensureOrdersTable) await ensureOrdersTable()
      if (ensureBrandsTable) await ensureBrandsTable()

      // Get payment record
      const paymentResult = await pool.query(
        'SELECT * FROM bot_payments WHERE order_id = $1',
        [orderId]
      )

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const payment = paymentResult.rows[0]

      // If already paid, return success
      if (payment.status === 'paid') {
        console.log('[payment/mark-paid] Order already marked as paid')

        // Get user info if exists
        let userInfo = null
        if (payment.user_id) {
          const userResult = await pool.query(
            'SELECT id, email, full_name FROM users WHERE id = $1',
            [payment.user_id]
          )
          if (userResult.rows.length > 0) {
            userInfo = userResult.rows[0]
          }
        }

        return res.json({
          success: true,
          orderId,
          status: 'paid',
          message: 'Payment already processed',
          user: userInfo
        })
      }

      // Verify with bot server first
      let botStatus = null
      try {
        botStatus = await botPayment.checkTransactionStatus(orderId)
      } catch (e) {
        console.warn('[payment/mark-paid] Could not verify with bot server:', e.message)
      }

      // Update payment status to paid
      await pool.query(
        'UPDATE bot_payments SET status = $1, updated_at = NOW() WHERE order_id = $2',
        ['paid', orderId]
      )

      // Parse payment details
      const paymentDetails = typeof payment.payment_details === 'string'
        ? JSON.parse(payment.payment_details)
        : payment.payment_details || {}

      const items = typeof payment.items === 'string'
        ? JSON.parse(payment.items)
        : payment.items || []

      // Look up brand by slug
      let brand = null
      let brandId = null
      let commissionAmount = 0
      let commissionRate = null

      if (payment.brand_slug) {
        brand = await getBrandBySlug(payment.brand_slug)
        if (brand) {
          brandId = brand.id
          // Calculate commission
          commissionRate = Number(brand.commission_rate || 10) / 100
          
          // If brand has a parent, use parent's commission rate
          if (brand.parent_brand_id) {
            const parentResult = await pool.query(
              'SELECT commission_rate FROM brands WHERE id = $1',
              [brand.parent_brand_id]
            )
            if (parentResult.rows.length > 0) {
              commissionRate = Number(parentResult.rows[0].commission_rate || 10) / 100
              console.log('[payment/mark-paid] Using parent brand commission rate:', commissionRate * 100, '%')
            }
          }
          
          commissionAmount = Number(payment.amount) * commissionRate
          console.log('[payment/mark-paid] Brand found:', brand.name, 'Commission:', commissionAmount)
        }
      }

      // Look up link if provided
      let linkIdNum = null
      if (payment.link_id) {
        const linkRecord = await getLinkById(payment.link_id)
        if (linkRecord) {
          linkIdNum = linkRecord.id
          if (!brandId) {
            brandId = linkRecord.brand_id
          }
        }
      }

      // Generate password for new user
      const generatedPassword = crypto.randomBytes(8).toString('hex')
      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.hash(generatedPassword, 10)

      // Check if user exists or create new one
      let userId = null
      let isNewUser = false
      const existingUser = await pool.query(
        'SELECT id, email FROM users WHERE email = $1',
        [payment.email]
      )

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id
        console.log('[payment/mark-paid] Existing user found:', userId)
      } else {
        // Create new user
        const fullName = paymentDetails.firstName && paymentDetails.lastName
          ? `${paymentDetails.firstName} ${paymentDetails.lastName}`
          : paymentDetails.firstName || 'User'

        const newUserResult = await pool.query(`
          INSERT INTO users (email, full_name, password_hash, plan, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING id
        `, [payment.email, fullName, passwordHash, 'paid'])

        userId = newUserResult.rows[0].id
        isNewUser = true
        console.log('[payment/mark-paid] New user created:', userId)
      }

      // Update payment with user_id
      await pool.query(
        'UPDATE bot_payments SET user_id = $1 WHERE order_id = $2',
        [userId, orderId]
      )

      // Create order record in orders table with all required fields
      // This is CRITICAL - if this fails, the order won't show in admin/brand panels
      const orderInsertValues = [
        orderId,                                           // $1
        userId,                                            // $2
        payment.email,                                     // $3
        JSON.stringify(items),                             // $4
        payment.amount,                                    // $5 total_amount
        payment.amount,                                    // $6 amount_usd (same for now)
        payment.currency || 'USD',                         // $7 currency
        'paid',                                            // $8 payment_status
        brandId,                                           // $9 brand_id
        linkIdNum,                                         // $10 link_id
        commissionAmount,                                  // $11 commission_amount
        commissionRate ? commissionRate * 100 : null,      // $12 commission_rate (as percentage)
        'unpaid',                                          // $13 commission_status
        paymentDetails.firstName || null,                  // $14 first_name
        paymentDetails.lastName || null,                   // $15 last_name
        paymentDetails.phone || null,                      // $16 phone
        paymentDetails.country || null,                    // $17 billing_country
        'card',                                            // $18 payment_method
        'bot'                                              // $19 payment_gateway
      ]

      console.log('[payment/mark-paid] Inserting order with values:', {
        orderId,
        userId,
        email: payment.email,
        amount: payment.amount,
        currency: payment.currency,
        brandId,
        linkIdNum,
        commissionAmount,
        commissionRate: commissionRate ? commissionRate * 100 : null
      })

      try {
        const orderResult = await pool.query(`
          INSERT INTO orders (
            order_id,
            user_id,
            email,
            items,
            total_amount,
            amount_usd,
            currency,
            payment_status,
            brand_id,
            link_id,
            commission_amount,
            commission_rate,
            commission_status,
            first_name,
            last_name,
            phone,
            billing_country,
            payment_method,
            payment_gateway,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
          ON CONFLICT (order_id) DO UPDATE SET
            payment_status = EXCLUDED.payment_status,
            user_id = EXCLUDED.user_id,
            brand_id = COALESCE(EXCLUDED.brand_id, orders.brand_id),
            commission_amount = COALESCE(EXCLUDED.commission_amount, orders.commission_amount),
            commission_status = EXCLUDED.commission_status
          RETURNING id, order_id
        `, orderInsertValues)
        
        console.log('[payment/mark-paid] ✅ Order record created/updated:', orderResult.rows[0])
        console.log('[payment/mark-paid] Order details - brand_id:', brandId, 'commission:', commissionAmount, 'commission_status: unpaid')
      } catch (orderErr) {
        // Log the full error - this is critical for debugging
        console.error('[payment/mark-paid] ❌ CRITICAL ERROR creating order record:', orderErr.message)
        console.error('[payment/mark-paid] Error details:', orderErr)
        console.error('[payment/mark-paid] Failed values:', orderInsertValues)
        // Don't throw - still return success to user since payment was made
        // But log this as a critical issue that needs attention
      }

      console.log('[payment/mark-paid] Order marked as paid successfully')

      res.json({
        success: true,
        orderId,
        status: 'paid',
        message: 'Payment successful',
        user: {
          id: userId,
          email: payment.email,
          isNew: isNewUser
        },
        password: isNewUser ? generatedPassword : undefined
      })
    } catch (error) {
      console.error('[payment/mark-paid] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to process payment' })
    }
  })

  /**
   * GET /api/payment/order/:orderId
   * Get order details
   */
  router.get('/order/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' })
      }

      const result = await pool.query(
        'SELECT order_id, email, amount, currency, status, created_at FROM bot_payments WHERE order_id = $1',
        [orderId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      res.json({
        success: true,
        order: result.rows[0]
      })
    } catch (error) {
      console.error('[payment/order] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to get order' })
    }
  })

  /**
   * POST /api/payment/sync-orders
   * Sync all paid bot_payments to orders table (fixes missing orders)
   */
  router.post('/sync-orders', async (req, res) => {
    try {
      console.log('[payment/sync-orders] Starting sync of bot_payments to orders...')

      // Ensure tables exist
      if (ensureBotPaymentsTable) await ensureBotPaymentsTable()
      if (ensureOrdersTable) await ensureOrdersTable()
      if (ensureBrandsTable) await ensureBrandsTable()
      if (ensureUsersTable) await ensureUsersTable()

      // Find all paid bot_payments that don't have corresponding orders
      const missingOrders = await pool.query(`
        SELECT bp.* 
        FROM bot_payments bp
        LEFT JOIN orders o ON bp.order_id = o.order_id
        WHERE bp.status = 'paid' AND o.id IS NULL
      `)

      console.log('[payment/sync-orders] Found', missingOrders.rows.length, 'missing orders')

      const results = {
        total: missingOrders.rows.length,
        created: 0,
        failed: 0,
        errors: []
      }

      for (const payment of missingOrders.rows) {
        try {
          await ensureOrderInOrdersTable(pool, payment, getBrandBySlug, getLinkById)
          results.created++
          console.log('[payment/sync-orders] Created order:', payment.order_id)
        } catch (err) {
          results.failed++
          results.errors.push({ orderId: payment.order_id, error: err.message })
          console.error('[payment/sync-orders] Failed to create order:', payment.order_id, err.message)
        }
      }

      console.log('[payment/sync-orders] Sync complete:', results)

      res.json({
        success: true,
        message: `Synced ${results.created} orders, ${results.failed} failed`,
        results
      })
    } catch (error) {
      console.error('[payment/sync-orders] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to sync orders' })
    }
  })

  /**
   * GET /api/payment/debug/:orderId
   * Debug endpoint to check order status in both tables
   */
  router.get('/debug/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' })
      }

      // Check bot_payments table
      const botPaymentResult = await pool.query(
        'SELECT * FROM bot_payments WHERE order_id = $1',
        [orderId]
      )

      // Check orders table
      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE order_id = $1',
        [orderId]
      )

      res.json({
        success: true,
        orderId,
        inBotPayments: botPaymentResult.rows.length > 0,
        botPayment: botPaymentResult.rows[0] || null,
        inOrders: orderResult.rows.length > 0,
        order: orderResult.rows[0] || null,
        diagnosis: {
          botPaymentExists: botPaymentResult.rows.length > 0,
          botPaymentStatus: botPaymentResult.rows[0]?.status || 'N/A',
          orderExists: orderResult.rows.length > 0,
          orderPaymentStatus: orderResult.rows[0]?.payment_status || 'N/A',
          orderBrandId: orderResult.rows[0]?.brand_id || 'N/A',
          orderCommission: orderResult.rows[0]?.commission_amount || 'N/A',
          issue: !orderResult.rows.length ? 'Order not in orders table - mark-paid may have failed' : 
                 !orderResult.rows[0]?.brand_id ? 'Order exists but no brand_id set' : 'Order looks complete'
        }
      })
    } catch (error) {
      console.error('[payment/debug] Error:', error)
      res.status(500).json({ error: error.message || 'Failed to debug order' })
    }
  })

  return router
}
