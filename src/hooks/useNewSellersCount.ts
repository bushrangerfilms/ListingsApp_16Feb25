import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";

// localStorage key for the per-org "last acknowledged" timestamp. When the
// user visits /admin/crm, we bump this forward to now() — the sidebar badge
// count is `seller_profiles` created after this timestamp.
const CRM_LAST_ACK_PREFIX = "crm_last_ack_";

// Fallback when a user has never visited the CRM before — 30 days ago.
// Keeps the initial badge count reasonable rather than showing every
// historical lead.
const FALLBACK_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function fallbackAck(): string {
  return new Date(Date.now() - FALLBACK_LOOKBACK_MS).toISOString();
}

export function getCrmLastAck(orgId: string | undefined): string {
  if (!orgId) return fallbackAck();
  try {
    const stored = localStorage.getItem(`${CRM_LAST_ACK_PREFIX}${orgId}`);
    return stored || fallbackAck();
  } catch {
    return fallbackAck();
  }
}

export function setCrmLastAck(orgId: string | undefined): void {
  if (!orgId) return;
  try {
    localStorage.setItem(`${CRM_LAST_ACK_PREFIX}${orgId}`, new Date().toISOString());
  } catch {
    /* storage full or disabled */
  }
}

/**
 * Returns the count of seller_profiles created since the current user's
 * last acknowledged visit to the CRM. Refreshes in realtime via a Supabase
 * postgres_changes INSERT subscription on the seller_profiles table,
 * filtered by organization_id.
 *
 * Mirrors the pattern used by PlatformHeader's bell badge
 * (see PlatformHeader.tsx:206-344).
 */
export function useNewSellersCount(): { count: number; lastAck: string } {
  const { organization } = useOrganization();
  const { isOrganizationView, selectedOrganization } = useOrganizationView();
  const queryClient = useQueryClient();

  // Mirror AdminCRM's org resolution so the sidebar badge counts against
  // the same org whose ack timestamp gets bumped on CRM page mount.
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const orgId = targetOrg?.id;

  // Read lastAck inside queryFn (not in the key) so invalidation after
  // setCrmLastAck picks up the updated timestamp on the next fetch.
  const lastAck = getCrmLastAck(orgId);

  const { data: count = 0 } = useQuery({
    queryKey: ["crm-new-sellers-count", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const ack = getCrmLastAck(orgId);
      const { count: rowCount, error } = await supabase
        .from("seller_profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gt("created_at", ack);
      if (error) {
        console.error("[useNewSellersCount] query failed:", error);
        return 0;
      }
      return rowCount ?? 0;
    },
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });

  // Realtime INSERT subscription — invalidate on fire so the badge updates
  // without a page refresh.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`crm-new-sellers-${orgId}`)
      .on(
        "postgres_changes",
        {
          // seller_profiles lives in the `crm` schema — matches the existing
          // realtime pattern in AdminCRM.tsx:87-99 and PostgREST queries
          // (which are routed via a view in public).
          event: "INSERT",
          schema: "crm",
          table: "seller_profiles",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["crm-new-sellers-count", orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  return { count, lastAck };
}
