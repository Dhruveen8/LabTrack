import { useContext } from 'react';
import { AuthContext, LabTrackContext, ToastContext, CartContext } from './contextDefinitions';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const useLabTrack = () => {
  const context = useContext(LabTrackContext);
  if (!context) throw new Error('useLabTrack must be used within a LabTrackProvider');
  return context;
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
