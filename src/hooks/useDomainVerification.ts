import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DomainStatus = 'pending' | 'dns_configured' | 'verified' | 'needs_attention' | null;

interface VerificationState {
  status: DomainStatus;
  isChecking: boolean;
  lastChecked: Date | null;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useDomainVerification(
  organizationId: string | undefined,
  currentStatus: DomainStatus,
  enabled: boolean = true,
) {
  const [state, setState] = useState<VerificationState>({
    status: currentStatus,
    isChecking: false,
    lastChecked: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkVerification = useCallback(async () => {
    if (!organizationId) return;

    setState(prev => ({ ...prev, isChecking: true }));
    try {
      const { data, error } = await supabase.functions.invoke('manage-custom-domain', {
        body: { action: 'verify', organizationId },
      });

      if (error) {
        console.error('[DomainVerification] Check failed:', error);
        setState(prev => ({ ...prev, isChecking: false }));
        return;
      }

      const newStatus = data?.status as DomainStatus;
      setState({
        status: newStatus,
        isChecking: false,
        lastChecked: new Date(),
      });

      // Stop polling if verified
      if (newStatus === 'verified' && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (err) {
      console.error('[DomainVerification] Unexpected error:', err);
      setState(prev => ({ ...prev, isChecking: false }));
    }
  }, [organizationId]);

  // Start/stop polling based on status and enabled flag
  useEffect(() => {
    const shouldPoll = enabled && currentStatus && currentStatus !== 'verified';

    if (shouldPoll) {
      // Check immediately on mount
      checkVerification();

      // Then poll on interval
      intervalRef.current = setInterval(checkVerification, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, currentStatus, checkVerification]);

  // Sync external status changes
  useEffect(() => {
    setState(prev => ({ ...prev, status: currentStatus }));
  }, [currentStatus]);

  return {
    ...state,
    checkNow: checkVerification,
    isVerified: state.status === 'verified',
  };
}
