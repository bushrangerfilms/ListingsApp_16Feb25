import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DomainStatus = 'pending' | 'dns_configured' | 'verified' | 'needs_attention' | null;
export type EmailSenderStatus = 'pending' | 'dns_configured' | 'verified' | 'failed' | null;

export interface EmailSenderRecord {
  record?: string;
  name: string;
  type: string;
  value: string;
  ttl?: string | number;
  priority?: number;
  status?: 'not_started' | 'pending' | 'verified' | 'failed';
}

interface VerificationState {
  status: DomainStatus;
  emailSenderStatus: EmailSenderStatus;
  emailSenderDomain: string | null;
  emailSenderRecords: EmailSenderRecord[] | null;
  isChecking: boolean;
  lastChecked: Date | null;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useDomainVerification(
  organizationId: string | undefined,
  currentStatus: DomainStatus,
  enabled: boolean = true,
  initialEmailSender?: {
    status: EmailSenderStatus;
    domain: string | null;
    records: EmailSenderRecord[] | null;
  },
) {
  const [state, setState] = useState<VerificationState>({
    status: currentStatus,
    emailSenderStatus: initialEmailSender?.status ?? null,
    emailSenderDomain: initialEmailSender?.domain ?? null,
    emailSenderRecords: initialEmailSender?.records ?? null,
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
      const newEmailSenderStatus = (data?.emailSenderStatus ?? null) as EmailSenderStatus;
      const newEmailSenderDomain = (data?.emailSenderDomain ?? null) as string | null;
      const newEmailSenderRecords = (data?.emailSenderRecords ?? null) as EmailSenderRecord[] | null;

      setState({
        status: newStatus,
        emailSenderStatus: newEmailSenderStatus,
        emailSenderDomain: newEmailSenderDomain,
        emailSenderRecords: newEmailSenderRecords,
        isChecking: false,
        lastChecked: new Date(),
      });

      // Stop polling once both sides are settled: public domain verified AND
      // email sender is either verified, failed, or was never provisioned.
      const emailSenderSettled =
        newEmailSenderStatus === null ||
        newEmailSenderStatus === 'verified' ||
        newEmailSenderStatus === 'failed';

      if (newStatus === 'verified' && emailSenderSettled && intervalRef.current) {
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
    isEmailSenderVerified: state.emailSenderStatus === 'verified',
  };
}
