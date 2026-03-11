/**
 * Transforms payment error messages for better user experience
 * Specifically handles "suspecting manipulation" messages from payment processors
 * 
 * @param {string} message - The original payment message
 * @returns {string} - The transformed message for better user experience
 */
export function transformPaymentMessage(message) {
  if (!message) return message;
  
  // Check for suspecting manipulation (case-insensitive)
  if (message.toLowerCase().includes('suspecting manipulation')) {
    return 'Bank verification required\n\nYour bank needs confirmation to complete this payment. Please check the SMS or email from your bank and confirm the transaction before retrying.';
  }
  
  return message;
}

