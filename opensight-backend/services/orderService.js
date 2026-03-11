/**
 * Order Service
 * Handles order-related business logic
 */

/**
 * Update an order with proper handling of commission_status to prevent duplicate assignments
 * @param {Object} params - Update parameters
 * @param {Object} params.pool - Database connection pool
 * @param {Object} params.existing - Existing order object
 * @param {Object} params.updateData - Data to update (email, items, total_amount, payment_status, user_id, created_at, brand_id, payment_method)
 * @param {Function} params.ensureOrdersTable - Function to ensure orders table exists
 * @param {Function} params.ensureUsersTable - Function to ensure users table exists
 * @param {Function} params.ensureBrandsTable - Function to ensure brands table exists
 * @returns {Promise<Object>} Updated order and metadata
 */
export async function updateOrder({
  pool,
  existing,
  updateData,
  ensureOrdersTable,
  ensureUsersTable,
  ensureBrandsTable
}) {
  await ensureOrdersTable()
  await ensureUsersTable()

  const fields = []
  const values = []
  let i = 1
  const { email, items, total_amount, payment_status, user_id, created_at, brand_id, payment_method } = updateData || {}

  // Track reversals for logging
  const reversals = []
  
  // Track if commission_status has been set to prevent duplicate assignments
  let commissionStatusSet = false

  // Handle brand assignment/change
  let brandChangeLog = null
  if (typeof brand_id !== 'undefined') {
    await ensureBrandsTable()

    if (brand_id === null || brand_id === '') {
      // Removing brand assignment
      fields.push(`brand_id = $${i++}`)
      values.push(null)
      fields.push(`commission_amount = $${i++}`)
      values.push(0)
      // Only set commission_status to 'none' if not changing to refund/chargeback
      // (refund/chargeback section will set it to 'cancelled' if needed)
      const newStatus = typeof payment_status !== 'undefined' ? String(payment_status).toLowerCase() : null
      if (newStatus !== 'refund' && newStatus !== 'chargeback') {
        fields.push(`commission_status = $${i++}`)
        values.push('none')
        commissionStatusSet = true
      }
      brandChangeLog = 'Brand assignment removed'
      console.log(`[order-update] Removed brand from order ${existing.order_id}`)
    } else {
      // Adding or changing brand
      const brandRes = await pool.query('SELECT id, name, commission_rate, parent_brand_id FROM brands WHERE id = $1', [Number(brand_id)])
      if (brandRes.rows.length === 0) {
        throw new Error('Brand not found')
      }

      const brand = brandRes.rows[0]
      // IMPORTANT: Use amount_usd (USD amount) for commission calculation, NOT total_amount (original currency)
      const orderAmountUSD = Number(existing.amount_usd || existing.total_amount || 0)
      let commissionRate = Number(brand.commission_rate || 10) / 100

      // If this brand has a parent (is a child brand), use parent's commission rate
      if (brand.parent_brand_id) {
        const parentBrand = await pool.query('SELECT commission_rate FROM brands WHERE id = $1', [brand.parent_brand_id])
        if (parentBrand.rows.length > 0) {
          commissionRate = Number(parentBrand.rows[0].commission_rate || 10) / 100
          console.log(`[commission] Order update: Using parent brand commission rate: ${commissionRate * 100}% for child brand ${brand.id}`)
        }
      }

      const commissionAmount = orderAmountUSD * commissionRate
      console.log(`[commission] Order update: Calculated commission ${commissionAmount} from USD amount ${orderAmountUSD} at rate ${commissionRate * 100}%`)

      fields.push(`brand_id = $${i++}`)
      values.push(Number(brand_id))
      fields.push(`commission_amount = $${i++}`)
      values.push(commissionAmount)

      // Set commission status based on payment status
      // IMPORTANT: Skip this if payment_status is being changed to refund/chargeback
      // because that will be handled in the refund/chargeback section below
      if (!commissionStatusSet) {
        const currentStatus = typeof payment_status !== 'undefined' ? payment_status : existing.payment_status
        const statusLower = String(currentStatus || 'unpaid').toLowerCase()
        const willHandleCommissionStatusLater = typeof payment_status !== 'undefined' && (statusLower === 'refund' || statusLower === 'chargeback')
        
        if (!willHandleCommissionStatusLater) {
          if (statusLower === 'refund' || statusLower === 'chargeback') {
            fields.push(`commission_status = $${i++}`)
            values.push('cancelled')
            commissionStatusSet = true
          } else if (statusLower === 'unpaid' || statusLower === 'paid') {
            // Both unpaid and paid mean commission is owed/being processed
            fields.push(`commission_status = $${i++}`)
            values.push('unpaid')
            commissionStatusSet = true
          } else if (statusLower === 'pending' || statusLower === 'failed') {
            fields.push(`commission_status = $${i++}`)
            values.push(statusLower === 'pending' ? 'pending' : 'cancelled')
            commissionStatusSet = true
          }
        }
      }

      const oldBrandId = existing.brand_id
      if (oldBrandId) {
        brandChangeLog = `Brand changed (commission: $${commissionAmount.toFixed(2)})`
      } else {
        brandChangeLog = `Brand assigned: ${brand.name} (commission: $${commissionAmount.toFixed(2)})`
      }
      console.log(`[order-update] ${brandChangeLog} for order ${existing.order_id}`)
    }
  }

  // Handle refund/chargeback status changes - revert credits and subscription
  if (typeof payment_status !== 'undefined') {
    const newStatus = String(payment_status).toLowerCase()
    const oldStatus = String(existing.payment_status || '').toLowerCase()

    if ((newStatus === 'refund' || newStatus === 'chargeback') && oldStatus !== 'refund' && oldStatus !== 'chargeback') {
      console.log(`[order-update] Processing ${newStatus} for order ${existing.order_id}`)

      // Parse order items
      let orderItems = []
      try {
        orderItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items
        if (!Array.isArray(orderItems)) orderItems = []
      } catch (e) {
        console.warn('[order-update] Failed to parse items:', e)
      }

      // Revert credits if order included credits
      const creditsItem = orderItems.find(item => String(item.type || '').toLowerCase() === 'credits')
      if (creditsItem && existing.user_id) {
        const creditsToRevert = creditsItem.unlimited ? 0 : (Number(creditsItem.credits) || 0)
        if (creditsToRevert > 0) {
          await pool.query(
            'UPDATE users SET credits_balance = GREATEST(0, credits_balance - $1) WHERE id = $2',
            [creditsToRevert, existing.user_id]
          )
          reversals.push(`Reverted ${creditsToRevert} credits`)
          console.log(`[order-update] Reverted ${creditsToRevert} credits from user ${existing.user_id}`)
        }
        // Handle unlimited credits
        if (creditsItem.unlimited) {
          await pool.query(
            'UPDATE users SET credits_unlimited = false WHERE id = $1',
            [existing.user_id]
          )
          reversals.push('Reverted unlimited credits')
          console.log(`[order-update] Reverted unlimited credits from user ${existing.user_id}`)
        }
      }

      // Revert subscription if order included package
      const packageItem = orderItems.find(item => String(item.type || '').toLowerCase() === 'package')
      if (packageItem && existing.user_id) {
        await pool.query(
          'UPDATE users SET plan = $1 WHERE id = $2',
          ['Free', existing.user_id]
        )
        reversals.push(`Reverted subscription (was: ${packageItem.name || 'package'})`)
        console.log(`[order-update] Reverted subscription to Free for user ${existing.user_id}`)
      }

      // Update commission status to cancelled
      // Check if commission_status was already added to fields array
      const hasCommissionStatus = fields.some(f => f.startsWith('commission_status'))
      if (!hasCommissionStatus) {
        fields.push(`commission_status = $${i++}`)
        values.push('cancelled')
        commissionStatusSet = true
      } else {
        // If already set, we need to ensure it's set to 'cancelled'
        // Find and replace the existing value
        const commissionStatusFieldIndex = fields.findIndex(f => f.startsWith('commission_status'))
        if (commissionStatusFieldIndex !== -1) {
          const paramMatch = fields[commissionStatusFieldIndex].match(/\$(\d+)/)
          if (paramMatch) {
            const paramIndex = parseInt(paramMatch[1]) - 1
            values[paramIndex] = 'cancelled'
          }
        }
      }

      // Log reversals in payment message
      if (reversals.length > 0) {
        const reversalLog = `[${newStatus.toUpperCase()}] ${reversals.join('; ')}`
        const existingMessage = existing.payment_message || ''
        fields.push(`payment_message = $${i++}`)
        values.push(existingMessage ? `${existingMessage}\n${reversalLog}` : reversalLog)
      }
    }
  }

  // Handle other field updates
  if (typeof email !== 'undefined') { fields.push(`email = $${i++}`); values.push(String(email).trim().toLowerCase()) }
  if (typeof user_id !== 'undefined') { fields.push(`user_id = $${i++}`); values.push(user_id ? Number(user_id) : null) }
  if (typeof items !== 'undefined') { fields.push(`items = $${i++}::jsonb`); values.push(JSON.stringify(Array.isArray(items) ? items : [])) }
  if (typeof total_amount !== 'undefined') { fields.push(`total_amount = $${i++}`); values.push(Number(total_amount || 0)) }
  if (typeof payment_status !== 'undefined') { fields.push(`payment_status = $${i++}`); values.push(String(payment_status)) }
  if (typeof payment_method !== 'undefined') { fields.push(`payment_method = $${i++}`); values.push(String(payment_method)) }
  if (typeof created_at !== 'undefined') { fields.push(`created_at = $${i++}::timestamptz`); values.push(String(created_at)) }

  if (fields.length === 0) {
    return {
      order: existing,
      reversals: reversals.length > 0 ? reversals : undefined,
      brandChange: brandChangeLog || undefined
    }
  }

  values.push(existing.id)
  const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, order_id, user_id, email, items, total_amount, payment_status, brand_id, commission_amount, commission_status, payment_message, created_at, payment_method`
  const upd = await pool.query(sql, values)

  return {
    order: upd.rows[0],
    reversals: reversals.length > 0 ? reversals : undefined,
    brandChange: brandChangeLog || undefined
  }
}

