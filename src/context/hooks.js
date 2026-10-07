import { useContext } from 'react';
import { AuthContext, LabTrackContext, ToastContext } from './contextDefinitions';

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
