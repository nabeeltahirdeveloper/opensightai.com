import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';

export default function CartIcon() {
  const { totalItems, openCart } = useCart();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openCart}
      className="relative"
    >
      <ShoppingCart className="w-4 h-4" />
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
      <span className="ml-2 hidden sm:inline">Cart</span>
    </Button>
  );
}

