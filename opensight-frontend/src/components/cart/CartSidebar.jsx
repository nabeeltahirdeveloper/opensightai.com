import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { redirectToCheckout } from '@/utils/checkoutRedirect';
import { serverApi } from '@/api/serverApi';
import TransactionBlockedModal from '@/components/TransactionBlockedModal';

export default function CartSidebar({ onNavigateToCheckout, checkoutDisabled }) {
  const {
    isOpen,
    closeCart,
    items,
    totalAmount,
    totalItems,
    removeItem,
    updateQuantity,
    requiresCredits,
    clearCart
  } = useCart();
  
  const { selectedCurrency, formatPrice: formatCurrencyPrice } = useCurrency();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const handleQuantityChange = (itemId, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity > 0) {
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleGoToCheckout = async () => {
    if (requiresCredits) {
      toast({
        title: "Credit Package Required",
        description: "Please add a credit package to continue with your purchase.",
        variant: "destructive"
      });
      return;
    }

    // Check transaction attempt status before allowing checkout
    try {
      setIsCheckingStatus(true);
      const status = await serverApi.checkout.checkStatus();
      
      if (!status || typeof status.allowed === 'undefined') {
        console.warn('[CartSidebar] Invalid status response, allowing checkout:', status);
        closeCart();
        redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency);
        return;
      }
      
      if (!status.allowed) {
        setIsBlocked(true);
        setBlockMessage(status.message || "Your payment attempts are temporarily blocked. Please try again later.");
        return;
      }
      
      // Status check passed, proceed to checkout
      closeCart();
      redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency);
    } catch (error) {
      console.error('[CartSidebar] Error checking status:', error);
      // On error, allow checkout (fail open) but log the error for debugging
      if (error.error === 'html_response' || error.error === 'parse_error') {
        console.error('[CartSidebar] API returned non-JSON response. Check backend route configuration.');
      }
      closeCart();
      redirectToCheckout({ items, totalAmount, totalItems }, selectedCurrency);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <>
      <TransactionBlockedModal isOpen={isBlocked} message={blockMessage} />
      <Sheet open={isOpen} onOpenChange={closeCart}>
        <SheetContent side="right" className="w-[90vw] sm:w-[540px] max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Shopping Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Your cart is empty
                </h3>
                <p className="text-gray-500">
                  Add some packages to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Credit Requirements Warning */}
                {requiresCredits && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800">
                          Credit Package Required
                        </h4>
                        <p className="text-sm text-amber-700 mt-1">
                          You need to add a credit package to use your selected plan.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cart Items */}
                {items.map((item) => (
                  <div key={item.id} className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {item.name}
                          {item.type === 'credits' && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {item.credits} Credits
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.description}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                          className="w-8 h-8 flex items-center justify-center border rounded-md hover:bg-gray-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-medium min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                          className="w-8 h-8 flex items-center justify-center border rounded-md hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">
                          {formatCurrencyPrice(Number(item.price) * item.quantity)}
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-sm text-gray-500">
                            {formatCurrencyPrice(Number(item.price))} each
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          {items.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-medium">Total:</span>
                <span className="text-2xl font-bold">
                  {formatCurrencyPrice(totalAmount)}
                </span>
              </div>

              <Button 
                className="w-full text-sm sm:text-base" 
                size="lg"
                disabled={requiresCredits || isCheckingStatus || checkoutDisabled}
                onClick={handleGoToCheckout}
              >
                {requiresCredits ? (
                  <>
                    <span className="hidden sm:inline">Add Credit Package First</span>
                    <span className="sm:hidden">Add Credits</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Go to Checkout</span>
                    <span className="sm:hidden">Checkout</span>
                  </>
                )}
              </Button>

              {requiresCredits && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Please add a credit package to continue
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
