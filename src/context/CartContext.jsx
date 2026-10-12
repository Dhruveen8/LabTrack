import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CartContext } from './contextDefinitions';
import { useAuth } from './hooks';
import { cartService } from '../services/cartService';
import { cartError } from '../utils/cart';

const emptyCart = { items: [], count: 0, can_submit: false };

export const CartProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [cart, setCart] = useState(emptyCart);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const version = useRef(0);
  const mutating = useRef(false);
  const previous = useRef(emptyCart);
  const enabled = isAuthenticated && user?.role === 'student';

  const accept = useCallback((next) => {
    const changedStock = next.items.some(item => {
      const old = previous.current.items.find(old => old.model_id === item.model_id && old.lab_id === item.lab_id);
      return old && old.available_quantity !== item.available_quantity;
    });
    if (changedStock) setChanged(true);
    previous.current = next;
    setCart(next);
    setError('');
    return next;
  }, []);

  const refreshCart = useCallback(async () => {
    if (!enabled || !user?.id || mutating.current) return null;
    const requestVersion = ++version.current;
    try {
      const next = await cartService.get();
      if (requestVersion !== version.current) return null;
      return accept(next);
    } catch (error) {
      if (requestVersion === version.current) setError(cartError(error));
      throw error;
    }
  }, [enabled, user?.id, accept]);

  useEffect(() => {
    ++version.current;
    previous.current = emptyCart;
    setCart(emptyCart);
    setError('');
    setChanged(false);
    if (enabled) refreshCart().catch(() => {});
    const onFocus = () => { if (enabled) refreshCart().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [enabled, user?.id, refreshCart]);

  const mutate = async (operation) => {
    if (mutating.current) throw new Error('Please wait for your cart update to finish');
    mutating.current = true;
    const requestVersion = ++version.current;
    setBusy(true);
    try {
      const result = await operation();
      if (requestVersion === version.current) accept(result);
      return result;
    } catch (error) {
      if (requestVersion === version.current) setError(cartError(error));
      throw error;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };

  const add = (modelId, labId, quantity = 1) => mutate(async () => {
    const latest = await cartService.get();
    const existing = latest.items.find(item => item.model_id === modelId && item.lab_id === labId);
    return cartService.update(modelId, labId, (existing?.quantity || 0) + quantity);
  });
  const update = (item, quantity) => mutate(() => cartService.update(item.model_id, item.lab_id, quantity));
  const remove = (item) => mutate(() => cartService.remove(item.model_id, item.lab_id));

  return <CartContext.Provider value={{ cart, error, busy, changed, refreshCart, add, update, remove,
    clearAfterSubmit: () => { ++version.current; accept(emptyCart); setChanged(false); } }}>
    {children}
  </CartContext.Provider>;
};
