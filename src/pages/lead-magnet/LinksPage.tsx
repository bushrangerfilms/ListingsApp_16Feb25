import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { isPublicSite, detectOrganizationFromDomain } from "@/lib/domainDetection";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";

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
          .select("id, slug, business_name, logo_url, domain")
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
        setLoading(false);
      } catch {
        setError("Failed to load page");
        setLoading(false);
      }
    };

    loadData();
  }, [resolvedOrgSlug]);

  const getQuizUrl = (typeKey: string) => {
    if (org?.domain) {
      return `/q/${typeKey}?s=linkinbio`;
    }
    return `/q/${org?.slug}/${typeKey}?s=linkinbio`;
  };

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
