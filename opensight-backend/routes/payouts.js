import express from 'express'

export default function createPayoutRoutes(pool, { requireAuth, requireAdmin, ensurePayoutsTable, ensureOrdersTable, ensureBrandsTable } = {}) {
  if (!pool?.query) {
    throw new Error('[payoutsRoutes] PostgreSQL pool is required')
  }
  
  if (typeof requireAuth !== 'function' || typeof requireAdmin !== 'function') {
    throw new Error('[payoutsRoutes] requireAuth and requireAdmin middlewares are required')
  }
  
  if (typeof ensurePayoutsTable !== 'function' || typeof ensureOrdersTable !== 'function' || typeof ensureBrandsTable !== 'function') {
    throw new Error('[payoutsRoutes] ensurePayoutsTable, ensureOrdersTable, and ensureBrandsTable functions are required')
  }
  
  const router = express.Router()
  
  router.post('/mark-paid', requireAuth, requireAdmin, async (req, res) => {
    try {
      await ensurePayoutsTable()
      await ensureOrdersTable()
      await ensureBrandsTable()

      const { brandIds, orderIds, fromDate, toDate } = req.body || {}

      // Support both orderIds (new) and brandIds (backward compatibility)
      if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
        // New approach: mark specific orders by ID
        const orderIdNumbers = orderIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        
        if (orderIdNumbers.length === 0) {
          return res.status(400).json({ error: 'Invalid orderIds array' })
        }

        // Fetch orders to verify they exist and are unpaid
        const ordersRes = await pool.query(
          `SELECT id, order_id, brand_id, commission_amount, commission_status, created_at
           FROM orders 
           WHERE id = ANY($1::bigint[])
           AND commission_status = 'unpaid'`,
          [orderIdNumbers]
        )

        if (ordersRes.rows.length === 0) {
          return res.status(404).json({ error: 'No unpaid orders found with the provided orderIds' })
        }

        // Group orders by brand_id for payout records
        const ordersByBrand = {}
        let totalOrders = 0
        let totalAmount = 0

        ordersRes.rows.forEach(order => {
          const brandId = Number(order.brand_id)
          if (!brandId) return

          if (!ordersByBrand[brandId]) {
            ordersByBrand[brandId] = {
              brandId,
              orders: [],
              totalAmount: 0
            }
          }

          ordersByBrand[brandId].orders.push(order)
          ordersByBrand[brandId].totalAmount += Number(order.commission_amount || 0)
          totalOrders += 1
          totalAmount += Number(order.commission_amount || 0)
        })

        // Update all selected orders to paid
        await pool.query(
          `UPDATE orders 
           SET commission_status = 'paid', payment_status = 'paid' 
           WHERE id = ANY($1::bigint[])
           AND commission_status = 'unpaid'`,
          [orderIdNumbers]
        )

        // Create payout records grouped by brand (optional - only if dates provided)
        const results = []
        for (const brandId in ordersByBrand) {
          const brandData = ordersByBrand[brandId]
          
          // Verify brand exists
          const brandRes = await pool.query('SELECT id, name, email FROM brands WHERE id = $1', [Number(brandId)])
          if (brandRes.rows.length === 0) {
            results.push({ brandId: Number(brandId), error: 'Brand not found', success: false })
            continue
          }

          const brand = brandRes.rows[0]
          let payoutId = null

          // Create payout record if dates provided
          if (fromDate && toDate) {
            try {
              const payoutRes = await pool.query(
                `INSERT INTO payouts (brand_id, amount, period_start, period_end, status, paid_at, reference_id)
                 VALUES ($1, $2, $3::date, $4::date, 'completed', NOW(), $5)
                 RETURNING id`,
                [Number(brandId), brandData.totalAmount, fromDate, toDate, `PAYOUT-${Date.now()}-${brandId}`]
              )
              payoutId = payoutRes.rows[0]?.id || null
            } catch (e) {
              console.error(`[payouts] Failed to create payout record for brand ${brandId}:`, e)
            }
          }

          results.push({
            brandId: Number(brandId),
            brandName: brand.name,
            ordersMarked: brandData.orders.length,
            amount: brandData.totalAmount,
            payoutId: payoutId,
            success: true
          })

          console.log(`[payouts] Marked ${brandData.orders.length} orders as paid for brand ${brand.name}, total: $${brandData.totalAmount}`)
        }

        res.json({
          success: true,
          summary: {
            totalOrders,
            totalAmount,
            totalBrands: Object.keys(ordersByBrand).length,
            dateRange: fromDate && toDate ? { fromDate, toDate } : null
          },
          results
        })
        return
      }

      // Backward compatibility: brandIds approach
      if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
        return res.status(400).json({ error: 'Either brandIds or orderIds array is required' })
      }

      // Dates are optional - if not provided, mark all unpaid orders for selected brands
      let fromDateObj = null
      let toDateObj = null
      let toExclusiveISO = null

      if (fromDate && toDate) {
        // Parse dates like the orders endpoint
        const parseDate = (value) => {
          if (!value) return null
          const parsed = new Date(value)
          if (Number.isNaN(parsed?.getTime?.())) return null
          return parsed
        }
        fromDateObj = parseDate(fromDate)
        toDateObj = parseDate(toDate)
        
        if (!fromDateObj || !toDateObj) {
          return res.status(400).json({ error: 'Invalid date format' })
        }

        // Add 1 day to toDate and use < to capture the entire selected day
        const toDateStr = String(toDate || '')
        const useWholeDay = !toDateStr.includes('T')
        const toExclusive = new Date(toDateObj.getTime())
        if (useWholeDay) {
          toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
        } else {
          toExclusive.setTime(toExclusive.getTime() + 1)
        }
        toExclusiveISO = toExclusive.toISOString()
      }

      const results = []
      let totalOrders = 0
      let totalAmount = 0

      // Process each brand
      for (const brandId of brandIds) {
        // Verify brand exists
        const brandRes = await pool.query('SELECT id, name, email FROM brands WHERE id = $1', [Number(brandId)])
        if (brandRes.rows.length === 0) {
          results.push({ brandId, error: 'Brand not found', success: false })
          continue
        }

        const brand = brandRes.rows[0]

        // Find all pending orders for this brand (with optional date range)
        let ordersRes
        if (fromDateObj && toExclusiveISO) {
          // Use timestamptz casting and exclusive comparison like orders endpoint
          ordersRes = await pool.query(
            `SELECT id, order_id, commission_amount 
             FROM orders 
             WHERE brand_id = $1 
               AND commission_status = 'unpaid' 
               AND created_at >= $2::timestamptz 
               AND created_at < $3::timestamptz`,
            [Number(brandId), fromDateObj.toISOString(), toExclusiveISO]
          )
        } else {
          // No date range - get all unpaid orders for this brand
          ordersRes = await pool.query(
            `SELECT id, order_id, commission_amount 
             FROM orders 
             WHERE brand_id = $1 
               AND commission_status = 'unpaid'`,
            [Number(brandId)]
          )
        }

        if (ordersRes.rows.length === 0) {
          results.push({
            brandId,
            brandName: brand.name,
            ordersMarked: 0,
            amount: 0,
            success: true,
            message: 'No pending orders found in date range'
          })
          continue
        }

        // Calculate total commission for this brand
        const commissionTotal = ordersRes.rows.reduce((sum, order) => {
          return sum + Number(order.commission_amount || 0)
        }, 0)

        // Update all orders to paid - update both commission_status and payment_status
        if (fromDateObj && toExclusiveISO) {
          // Use timestamptz casting and exclusive comparison like orders endpoint
          await pool.query(
            `UPDATE orders 
             SET commission_status = 'paid', payment_status = 'paid' 
             WHERE brand_id = $1 
               AND commission_status = 'unpaid' 
               AND created_at >= $2::timestamptz 
               AND created_at < $3::timestamptz`,
            [Number(brandId), fromDateObj.toISOString(), toExclusiveISO]
          )
        } else {
          // No date range - update all unpaid orders for this brand
          await pool.query(
            `UPDATE orders 
             SET commission_status = 'paid', payment_status = 'paid' 
             WHERE brand_id = $1 
               AND commission_status = 'unpaid'`,
            [Number(brandId)]
          )
        }

        // Create payout record (only if dates were provided)
        let payoutId = null
        if (fromDate && toDate) {
          // Use the original dates (not exclusive) for period_start and period_end
          const payoutRes = await pool.query(
            `INSERT INTO payouts (brand_id, amount, period_start, period_end, status, paid_at, reference_id)
             VALUES ($1, $2, $3::date, $4::date, 'completed', NOW(), $5)
             RETURNING id`,
            [Number(brandId), commissionTotal, fromDate, toDate, `PAYOUT-${Date.now()}-${brandId}`]
          )
          payoutId = payoutRes.rows[0]?.id || null
        }

        results.push({
          brandId,
          brandName: brand.name,
          ordersMarked: ordersRes.rows.length,
          amount: commissionTotal,
          payoutId: payoutId,
          success: true
        })

        totalOrders += ordersRes.rows.length
        totalAmount += commissionTotal

        console.log(`[payouts] Marked ${ordersRes.rows.length} orders as paid for brand ${brand.name}, total: $${commissionTotal}`)
      }

      res.json({
        success: true,
        summary: {
          totalBrands: brandIds.length,
          totalOrders,
          totalAmount,
          dateRange: { fromDate, toDate }
        },
        results
      })
    } catch (err) {
      console.error('[payouts/mark-paid] Error:', err)
      res.status(500).json({ error: String(err?.message || err) })
    }
  })
  
  return router
}


