import express from 'express'

export default function createBrandRoutes(pool, { requireAuth, requireAdmin, ensureBrandsTable, ensureOrdersTable } = {}) {
  if (!pool?.query) {
    throw new Error('[brandRoutes] PostgreSQL pool is required')
  }
  
  if (typeof requireAuth !== 'function' || typeof requireAdmin !== 'function') {
    throw new Error('[brandRoutes] requireAuth and requireAdmin middlewares are required')
  }
  
  if (typeof ensureBrandsTable !== 'function' || typeof ensureOrdersTable !== 'function') {
    throw new Error('[brandRoutes] ensureBrandsTable and ensureOrdersTable functions are required')
  }
  
  const router = express.Router()
  
  // Get all brands with their unpaid transaction counts
  router.get('/unpaid-transactions', requireAuth, requireAdmin, async (req, res) => {
    try {
      await ensureBrandsTable()
      await ensureOrdersTable()
      
      // Parse date filters
      const fromStr = req.query.from || ''
      const toStr = req.query.to || ''
      const parseDate = (value) => {
        if (!value) return null
        const parsed = new Date(value)
        if (Number.isNaN(parsed?.getTime?.())) return null
        return parsed
      }
      const fromDate = parseDate(fromStr)
      const toDate = parseDate(toStr)
      
      // Build WHERE conditions
      const conditions = ['o.payment_status = $1']
      const values = ['unpaid']
      let paramIndex = 2
      
      if (fromDate) {
        conditions.push(`o.created_at >= $${paramIndex}::timestamptz`)
        values.push(fromDate.toISOString())
        paramIndex++
      }
      
      if (toDate) {
        conditions.push(`o.created_at <= $${paramIndex}::timestamptz`)
        values.push(toDate.toISOString())
        paramIndex++
      }
      
      const whereClause = conditions.join(' AND ')
      
      const result = await pool.query(`
        SELECT 
          b.id,
          b.name,
          COUNT(o.id)::int AS unpaid_transactions_count
        FROM brands b
        LEFT JOIN orders o ON b.id = o.brand_id AND ${whereClause}
        GROUP BY b.id, b.name
        ORDER BY unpaid_transactions_count DESC, b.name ASC
      `, values)
      
      res.json({ brands: result.rows })
    } catch (err) {
      console.error('[brandRoutes] Error fetching unpaid transactions:', err)
      res.status(500).json({ error: String(err?.message || err) })
    }
  })
  
  return router
}

