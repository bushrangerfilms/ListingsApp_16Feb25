import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { isPublicSite, detectOrganizationFromDomain } from "@/lib/domainDetection";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OrgData {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  domain: string | null;
}

interface LinkItem {
  type_key: string;
  display_name: string;
  description: string;
}

interface ServiceArea {
  name: string;
  is_primary: boolean;
}

// Only these types are currently area-aware at the landing-page level.
// Free Valuation goes to an external form; Tips & Advice content is universal.
const AREA_AWARE_TYPES = new Set(["market-update"]);

const TYPE_DESCRIPTIONS: Record<string, string> = {
  "ready-to-sell": "Find out if your property is ready for market",
  "worth-estimate": "Get an instant estimate of your property's value",
  "market-update": "See the latest property market insights in your area",
  "tips-advice": "Expert tips to help you sell for more",
  "free-valuation": "Request a free, no-obligation property valuation",
};

const TYPE_ICONS: Record<string, string> = {
  "ready-to-sell": "📋",
  "worth-estimate": "💰",
  "market-update": "📊",
  "tips-advice": "💡",
  "free-valuation": "🏠",
};

export default function LinksPage() {
  const { orgSlug: orgSlugParam } = useParams<{ orgSlug: string }>();
  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(orgSlugParam || null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve org slug from custom domain if not in URL params
  useEffect(() => {
    if (orgSlugParam) {
      setResolvedOrgSlug(orgSlugParam);
      return;
    }
    if (isPublicSite()) {
      detectOrganizationFromDomain().then((domainOrg) => {
        if (domainOrg?.slug) {
          setResolvedOrgSlug(domainOrg.slug);
        } else {
          setError("Could not detect organization");
          setLoading(false);
        }
      });
    } else {
      setError("Invalid URL");
      setLoading(false);
    }
  }, [orgSlugParam]);

  // Load org data and enabled lead magnet types
  useEffect(() => {
    if (!resolvedOrgSlug) return;

    const loadData = async () => {
      try {
        // Fetch org
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id, slug, business_name, logo_url, domain, custom_domain_status")
          .eq("slug", resolvedOrgSlug)
          .single();

        if (orgError || !orgData) {
          setError("Organization not found");
          setLoading(false);
          return;
        }
        setOrg(orgData);

        // Fetch enabled lead magnet types for this org
        const { data: lmData } = await supabase
          .from("lead_magnets")
          .select("type, is_enabled")
          .eq("organization_id", orgData.id)
          .eq("is_enabled", true);

        // Fetch quiz type definitions for display names
        const { data: typeDefs } = await supabase
          .from("quiz_type_definitions")
          .select("type_key, display_name")
          .eq("is_enabled_globally", true);

        const typeDefMap = new Map(
          (typeDefs || []).map((td) => [td.type_key, td.display_name])
        );

        // Build links from enabled types
        const enabledTypes = (lmData || []).map((lm) => {
          const typeKey = lm.type.toLowerCase().replace(/_/g, "-");
          return {
            type_key: typeKey,
            display_name: typeDefMap.get(typeKey) || typeKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            description: TYPE_DESCRIPTIONS[typeKey] || "",
          };
        });

        setLinks(enabledTypes);

        // Fetch public service areas so the picker can default to primary
        // without requiring direct DB access (RLS locks org_service_areas to
        // service_role). We just swallow errors — worst case, no picker renders.
        try {
          const areasRes = await fetch(
            `${SUPABASE_URL}/functions/v1/lead-magnet-api/service-areas/${encodeURIComponent(resolvedOrgSlug)}`,
          );
          if (areasRes.ok) {
            const areasData: { areas?: ServiceArea[] } = await areasRes.json();
            const areas = areasData.areas ?? [];
            setServiceAreas(areas);
            const primary = areas.find((a) => a.is_primary) || areas[0];
            if (primary) setSelectedArea(primary.name);
          }
        } catch {
          // Silent — area picker just won't render.
        }

        setLoading(false);
      } catch {
        setError("Failed to load page");
        setLoading(false);
      }
    };

    loadData();
  }, [resolvedOrgSlug]);

  const getQuizUrl = (typeKey: string) => {
    // Only route through the custom domain form when the org's custom
    // domain is actually verified. Protects against stale `domain` values
    // that pre-date the verification flow.
    const hasVerifiedDomain =
      !!org?.domain && (org as any)?.custom_domain_status === "verified";
    const base = hasVerifiedDomain
      ? `/q/${typeKey}?s=linkinbio`
      : `/q/${org?.slug}/${typeKey}?s=linkinbio`;
    // Only append area to landing pages that actually use it. For now only the
    // Market Update report is area-aware; Tips and Free Valuation ignore the param.
    if (selectedArea && AREA_AWARE_TYPES.has(typeKey)) {
      return `${base}&area=${encodeURIComponent(selectedArea)}`;
    }
    return base;
  };

  const showAreaPicker = serviceAreas.length > 1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{error || "Page not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Org branding */}
        <div className="text-center mb-8">
          {org.logo_url && (
            <img
              src={org.logo_url}
              alt={org.business_name}
              className="h-16 w-auto mx-auto mb-3 object-contain"
            />
          )}
          <h1 className="text-xl font-semibold text-gray-900">{org.business_name}</h1>
          <p className="text-sm text-gray-500 mt-1">Helpful tools & resources</p>
        </div>

        {/* Area picker — only for orgs that cover multiple service areas.
            Defaults to primary; the selection only threads into area-aware
            landing pages (Market Update right now). */}
        {showAreaPicker && (
          <div className="mb-5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <MapPin className="h-3 w-3" />
              Your area
            </label>
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceAreas.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}{a.is_primary ? " (primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-400 mt-1.5">
              We'll tailor the Market Update report to this area.
            </p>
          </div>
        )}

        {/* Link cards */}
        <div className="space-y-3">
          {links.map((link) => (
            <a
              key={link.type_key}
              href={getQuizUrl(link.type_key)}
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">
                  {TYPE_ICONS[link.type_key] || "🔗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {link.display_name}
                  </p>
                  {link.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{link.description}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
              </div>
            </a>
          ))}

          {links.length === 0 && (
            <p className="text-center text-gray-400 py-8">No tools available yet</p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <a
              href="https://autolisting.io"
              className="hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              AutoListing
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
