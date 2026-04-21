// Thin wrappers over Resend's Domains REST API. Used by manage-custom-domain
// to auto-provision em.<customdomain> when a paid org verifies a custom domain.
// Docs: https://resend.com/docs/api-reference/domains/create-domain

const RESEND_API_BASE = 'https://api.resend.com';

export type ResendRecordType = 'TXT' | 'MX' | 'CNAME';

export interface ResendDnsRecord {
  record: string;        // e.g. 'SPF', 'DKIM', 'MX'
  name: string;          // host label relative to the zone root (e.g. 'send.em' or 'resend._domainkey.em')
  type: ResendRecordType;
  value: string;
  ttl?: string | number;
  priority?: number;
  status?: 'not_started' | 'pending' | 'verified' | 'failed';
}

export interface ResendDomain {
  id: string;
  name: string;
  status: 'pending' | 'verified' | 'failed' | 'temporary_failure' | 'not_started';
  records: ResendDnsRecord[];
  region?: string;
  created_at?: string;
}

function authHeaders(): Record<string, string> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function resendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) as T : ({} as T);
}

export async function createResendDomain(name: string, region = 'eu-west-1'): Promise<ResendDomain> {
  return resendRequest<ResendDomain>('/domains', {
    method: 'POST',
    body: JSON.stringify({ name, region }),
  });
}

export async function getResendDomain(id: string): Promise<ResendDomain> {
  return resendRequest<ResendDomain>(`/domains/${id}`);
}

export async function deleteResendDomain(id: string): Promise<void> {
  await resendRequest<void>(`/domains/${id}`, { method: 'DELETE' });
}

/**
 * Collapses per-record Resend statuses into a single lifecycle state that
 * mirrors custom_domain_status semantics.
 *
 *  - all records verified         -> 'verified'
 *  - any record 'failed'          -> 'failed'
 *  - at least one started / pending but not all verified -> 'dns_configured'
 *  - nothing started yet (or records missing statuses)   -> 'pending'
 */
export function summariseResendDomainStatus(
  domain: ResendDomain,
): 'pending' | 'dns_configured' | 'verified' | 'failed' {
  if (domain.status === 'verified') return 'verified';
  if (domain.status === 'failed') return 'failed';

  const records = domain.records ?? [];
  if (records.length === 0) return 'pending';

  const verified = records.filter(r => r.status === 'verified').length;
  const failed = records.some(r => r.status === 'failed');
  const started = records.some(r => r.status && r.status !== 'not_started');

  if (failed) return 'failed';
  if (verified === records.length) return 'verified';
  if (started) return 'dns_configured';
  return 'pending';
}
