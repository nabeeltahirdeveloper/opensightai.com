import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

// Formats a number with exactly two decimal places using the current locale
// Returns an empty string if value is not a finite number
export function formatCurrency(value, options = {}) {
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  if (!isNumber) return ''
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options
  try {
    return value.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits })
  } catch (_e) {
    // Fallback if locale formatting fails for any reason
    return value.toFixed(Math.max(0, Math.min(20, maximumFractionDigits)))
  }
}

// Formats asset prices dynamically based on magnitude:
// - >= 1 → 2 decimals
// - < 1 scales up to 8 decimals to preserve meaningful precision for small quotes
export function formatAssetPrice(value) {
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  if (!isNumber) return ''
  const abs = Math.abs(value)
  let decimals = 2
  if (abs >= 1) {
    decimals = 2
  } else if (abs >= 0.1) {
    decimals = 3
  } else if (abs >= 0.01) {
    decimals = 4
  } else if (abs >= 0.001) {
    decimals = 5
  } else if (abs >= 0.0001) {
    decimals = 6
  } else if (abs >= 0.00001) {
    decimals = 7
  } else {
    decimals = 8
  }
  try {
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  } catch (_e) {
    return value.toFixed(decimals)
  }
}