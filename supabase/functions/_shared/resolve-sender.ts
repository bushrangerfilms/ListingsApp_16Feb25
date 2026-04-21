import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

export interface ResolvedSender {
  /** Fully composed value for Resend's `from` field, e.g. `"Bridge Auctioneers" <noreply@em.bridgeauctioneers.ie>`. */
  from: string;
  fromEmail: string;
  fromName: string;
  /** `organizations.contact_email` when non-empty — set on the Resend `reply_to` field so agent replies land in the agency's real inbox. */
  replyTo: string | null;
  /** The `business_name` that was used (callers sometimes need it separately for subject-line templating). */
  businessName: string | null;
}

function platformFromEmail(): string {
  return Deno.env.get('FROM_EMAIL') ?? 'noreply@mail.autolisting.io';
}

function platformFromName(): string {
  return Deno.env.get('FROM_NAME') ?? 'AutoListing';
}

/**
 * Resolves the sender identity for org-scoped emails.
 *
 * Resolution order:
 *   1. `organizations.from_email` — honoured when set (grandfathers Bridge Auctioneers' verified
 *      custom sender domain). Future: populated automatically by Phase-2 Resend domain provisioning.
 *   2. `FROM_EMAIL` env var / `noreply@mail.autolisting.io` fallback for every other org.
 *
 * Friendly name always prefers `org.from_name` → `org.business_name` → platform default.
 * `replyTo` is `org.contact_email` when present, otherwise null (header omitted).
 */
export async function resolveSender(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResolvedSender> {
  const { data: org } = await supabase
    .from('organizations')
    .select('from_email, from_name, contact_email, business_name')
    .eq('id', organizationId)
    .single();

  const fromEmail = (org?.from_email && org.from_email.trim()) || platformFromEmail();
  const fromName = (org?.from_name && org.from_name.trim())
    || (org?.business_name && org.business_name.trim())
    || platformFromName();
  const replyTo = org?.contact_email && org.contact_email.trim() ? org.contact_email.trim() : null;

  return {
    from: `${fromName} <${fromEmail}>`,
    fromEmail,
    fromName,
    replyTo,
    businessName: org?.business_name ?? null,
  };
}

/** Sender for platform-level emails (no org context). */
export function resolvePlatformSender(): ResolvedSender {
  const fromEmail = platformFromEmail();
  const fromName = platformFromName();
  return {
    from: `${fromName} <${fromEmail}>`,
    fromEmail,
    fromName,
    replyTo: null,
    businessName: null,
  };
}
