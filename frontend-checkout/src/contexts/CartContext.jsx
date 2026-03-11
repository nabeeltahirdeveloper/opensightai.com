import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Cart action types
const CART_ACTIONS = {
  ADD_PACKAGE: 'ADD_PACKAGE',
  ADD_CREDIT_PACKAGE: 'ADD_CREDIT_PACKAGE',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  SET_CART: 'SET_CART',
  HYDRATE_FROM_URL: 'HYDRATE_FROM_URL'
};

// Initial cart state
const initialState = {
  items: [],
  totalAmount: 0,
  totalItems: 0,
  isOpen: false,
  requiresCredits: false
};

// Cart reducer function
function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_PACKAGE: {
      const { package: pkg } = action.payload;
      // New selection starts a fresh cart: keep only the selected package
      const newItems = [{ ...pkg, quantity: 1, type: 'package' }];

      const totalAmount = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        ...state,
        items: newItems,
        totalAmount,
        totalItems,
        requiresCredits: true // Always require credits when package is added
      };
    }
    
    case CART_ACTIONS.ADD_CREDIT_PACKAGE: {
      const { creditPackage } = action.payload;
      // Replace any existing credits with the newly selected one; keep only the current package if present
      const packageItem = state.items.find(item => item.type === 'package');
      const newItems = [];
      if (packageItem) newItems.push({ ...packageItem });
      newItems.push({ ...creditPackage, quantity: 1, type: 'credits' });

      const totalAmount = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        ...state,
        items: newItems,
        totalAmount,
        totalItems,
        requiresCredits: false // Credits requirement fulfilled for current package
      };
    }
    
    case CART_ACTIONS.REMOVE_ITEM: {
      const { itemId } = action.payload;
      const newItems = state.items.filter(item => item.id !== itemId);
      
      const totalAmount = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Check if credits are still required
      const hasPackage = newItems.some(item => item.type === 'package');
      const hasCredits = newItems.some(item => item.type === 'credits');
      const requiresCredits = hasPackage && !hasCredits;
      
      return {
        ...state,
        items: newItems,
        totalAmount,
        totalItems,
        requiresCredits
      };
    }
    
    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { itemId, quantity } = action.payload;
      
      if (quantity <= 0) {
        return cartReducer(state, { 
          type: CART_ACTIONS.REMOVE_ITEM, 
          payload: { itemId } 
        });
      }
      
      const newItems = state.items.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );
      
      const totalAmount = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        ...state,
        items: newItems,
        totalAmount,
        totalItems
      };
    }
    
    case CART_ACTIONS.CLEAR_CART:
      return initialState;
    
    case CART_ACTIONS.SET_CART:
      return { ...state, ...action.payload };
    
    case CART_ACTIONS.HYDRATE_FROM_URL: {
      const { items } = action.payload;
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const hasPackage = items.some(item => item.type === 'package');
      const hasCredits = items.some(item => item.type === 'credits');
      const requiresCredits = hasPackage && !hasCredits;
      
      return {
        ...state,
        items,
        totalAmount,
        totalItems,
        requiresCredits
      };
    }
    
    default:
      return state;
  }
}

// Create context
const CartContext = createContext();

// Cart provider component
export function CartProvider({ children, initialItems = null }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // If initialItems provided (from URL), hydrate cart immediately
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      dispatch({ type: CART_ACTIONS.HYDRATE_FROM_URL, payload: { items: initialItems } });
    }
  }, [initialItems]);

  // Action creators
  const addPackage = (pkg) => {
    dispatch({ type: CART_ACTIONS.ADD_PACKAGE, payload: { package: pkg } });
  };

  const addCreditPackage = (creditPackage) => {
    dispatch({ type: CART_ACTIONS.ADD_CREDIT_PACKAGE, payload: { creditPackage } });
  };

  const removeItem = (itemId) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: { itemId } });
  };

  const updateQuantity = (itemId, quantity) => {
    dispatch({ type: CART_ACTIONS.UPDATE_QUANTITY, payload: { itemId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  };

  const toggleCart = () => {
    dispatch({ 
      type: CART_ACTIONS.SET_CART, 
      payload: { isOpen: !state.isOpen } 
    });
  };

  const openCart = () => {
    dispatch({ 
      type: CART_ACTIONS.SET_CART, 
      payload: { isOpen: true } 
    });
  };

  const closeCart = () => {
    dispatch({ 
      type: CART_ACTIONS.SET_CART, 
      payload: { isOpen: false } 
    });
  };

  const value = {
    ...state,
    addPackage,
    addCreditPackage,
    removeItem,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

