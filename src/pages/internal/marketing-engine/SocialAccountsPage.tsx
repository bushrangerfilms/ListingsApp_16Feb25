// Marketing-engine social accounts.
//
// Single-tenant equivalent of the customer-facing Socials > Social
// Accounts page. Same look + feel (per-platform cards, OAuth-popup
// connect flow, status badges) but writes to brand_assets instead of
// per-org tables.
//
// All data flow goes through the marketing-engine-social-accounts
// edge function (auth via super_admin JWT). Actions:
//   - status:        list profile + connected accounts + saved page IDs
//   - create-profile: create or claim the AutoListing-marketing profile
//   - connect-url:   OAuth URL for a single platform (opened in new window)
//   - list-pages:    list LinkedIn / Facebook / Pinterest pages on the profile
//   - save-target:   write a page id to brand_assets

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Save,
} from "lucide-react";
import { SiTiktok, SiThreads, SiPinterest } from "react-icons/si";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Platform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "x"
  | "threads"
  | "pinterest";

interface ConnectedAccount {
  platform: string;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
}

interface BrandTargets {
  linkedin_page_id: string | null;
  facebook_page_id: string | null;
  instagram_business_id: string | null;
}

interface StatusResponse {
  ok: boolean;
  configured: boolean;
  profile: string | null;
  accounts: ConnectedAccount[];
  brand_targets: BrandTargets;
  profile_missing_upstream?: boolean;
  error?: string;
}

interface ListPagesResponse {
  ok: boolean;
  platform?: string;
  pages?: Array<{ id: string; name: string; picture: string | null }>;
  error?: string;
}

const ALL_PLATFORMS: Array<{ key: Platform; label: string; needsPageId: false | "linkedin_page_id" | "facebook_page_id" | "instagram_business_id" }> = [
  { key: "linkedin", label: "LinkedIn", needsPageId: "linkedin_page_id" },
  { key: "instagram", label: "Instagram", needsPageId: "instagram_business_id" },
  { key: "facebook", label: "Facebook", needsPageId: "facebook_page_id" },
  { key: "tiktok", label: "TikTok", needsPageId: false },
  { key: "youtube", label: "YouTube", needsPageId: false },
  { key: "x", label: "X / Twitter", needsPageId: false },
  { key: "threads", label: "Threads", needsPageId: false },
  { key: "pinterest", label: "Pinterest", needsPageId: false },
];

const PLATFORM_ICON: Record<Platform, React.FC<{ className?: string }>> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  x: Twitter,
  tiktok: ({ className }) => <SiTiktok className={className} />,
  threads: ({ className }) => <SiThreads className={className} />,
  pinterest: ({ className }) => <SiPinterest className={className} />,
};

const PLATFORM_BG: Record<Platform, string> = {
  linkedin: "bg-[#0077B5] text-white",
  facebook: "bg-[#1877F2] text-white",
  instagram: "bg-gradient-to-br from-[#FFDC80] via-[#F77737] to-[#C13584] text-white",
  tiktok: "bg-black text-white",
  youtube: "bg-[#FF0000] text-white",
  x: "bg-black text-white",
  threads: "bg-black text-white",
  pinterest: "bg-[#E60023] text-white",
};

async function callApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes?.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/marketing-engine-social-accounts`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export default function MarketingEngineSocialAccountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [proposedUsername, setProposedUsername] = useState("autolisting-marketing");
  // Two-tier poll cadence so connections done outside this page (e.g.
  // direct in Upload Post's UI) still surface within 30s without the
  // user having to remember the Refresh button:
  //   - 5s  during an active Connect popup (set when Connect button is
  //     clicked, cleared after 3 min)
  //   - 30s background — cheap (1 round-trip + a small API call) and
  //     covers the cross-tab + close-popup-from-other-window cases
  // Also refetch on window focus so the very-common pattern of
  // "complete OAuth in a different tab → switch back" is instant.
  const [activePollInterval, setActivePollInterval] = useState<number | false>(false);

  const { data: status, isLoading: statusLoading } = useQuery<StatusResponse>({
    queryKey: ["me-social-accounts-status"],
    queryFn: () => callApi<StatusResponse>("status"),
    refetchInterval: activePollInterval || 30_000,
    refetchOnWindowFocus: true,
  });

  const accountsByPlatform = useMemo(() => {
    const map = new Map<string, ConnectedAccount>();
    for (const a of status?.accounts ?? []) {
      // Only first per platform — Upload Post may return multiple but
      // we treat the first as canonical for the brand.
      if (!map.has(a.platform)) map.set(a.platform, a);
    }
    return map;
  }, [status]);

  const createProfile = useMutation({
    mutationFn: (username: string) => callApi("create-profile", { username }),
    onSuccess: (data: { ok: boolean; profile?: string; already_existed?: boolean } & Record<string, unknown>) => {
      toast.success(
        data.already_existed
          ? `Claimed existing profile: ${data.profile}`
          : `Created profile: ${data.profile}`,
      );
      queryClient.invalidateQueries({ queryKey: ["me-social-accounts-status"] });
    },
    onError: (err: Error) => toast.error("Profile setup failed", { description: err.message }),
  });

  const connect = useMutation({
    mutationFn: (platform: Platform) =>
      callApi<{ ok: boolean; access_url: string }>("connect-url", {
        platform,
        redirect_url: window.location.href,
      }),
    onSuccess: (data, platform) => {
      // Open Upload Post's hosted OAuth flow in a popup. While it's open,
      // poll the status endpoint every 5s so reconnections show up here
      // automatically without a page refresh.
      const w = window.open(data.access_url, "_blank", "width=720,height=820,noopener,noreferrer");
      if (!w) {
        toast.error("Popup blocked — please allow popups and try again");
        return;
      }
      toast.success(`Opening ${platform} connect flow…`, {
        description: "Complete the connect in the popup. This page will refresh automatically.",
      });
      setActivePollInterval(5000);
      // Stop fast polling after 3 minutes so we don't keep hammering
      // forever if the user closes the popup without completing.
      // Background 30s polling continues regardless.
      window.setTimeout(() => setActivePollInterval(false), 180_000);
    },
    onError: (err: Error) => toast.error("Connect URL failed", { description: err.message }),
  });

  const saveTarget = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      callApi("save-target", { key, value }),
    onSuccess: (_data, vars) => {
      toast.success(`Saved ${vars.key}`);
      queryClient.invalidateQueries({ queryKey: ["me-social-accounts-status"] });
    },
    onError: (err: Error) => toast.error("Save failed", { description: err.message }),
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/internal/marketing-engine")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Social Accounts</h1>
          <p className="text-muted-foreground mt-1">
            AutoListing's own social presence. Connect each platform via the
            same Upload Post OAuth flow the customer-facing app uses; the
            marketing engine then publishes to these accounts when{" "}
            <code>publish_enabled</code> is on.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["me-social-accounts-status"] })}
          disabled={statusLoading}
        >
          {statusLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Step 1: Profile */}
      <Card className={!status?.configured ? "border-amber-500/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-base">1.</span>
            Upload Post profile
          </CardTitle>
          <CardDescription>
            One profile per AutoListing brand. Created in Upload Post's system,
            saved to <code>brand_assets.upload_post_profile</code>. Each platform
            gets connected to this profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status?.configured && status.profile ? (
            <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Profile: <code>{status.profile}</code>
                </div>
                {status.profile_missing_upstream ? (
                  <div className="text-xs text-amber-600 mt-0.5">
                    ⚠ Stored in brand_assets but Upload Post returned 404 — name
                    may be wrong or profile was deleted upstream.
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {status.accounts.length} connected account
                    {status.accounts.length === 1 ? "" : "s"}.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase tracking-wide">
                Profile username
              </Label>
              <div className="flex gap-2">
                <Input
                  id="username"
                  value={proposedUsername}
                  onChange={(e) => setProposedUsername(e.target.value)}
                  placeholder="autolisting-marketing"
                  className="max-w-md"
                />
                <Button
                  onClick={() => createProfile.mutate(proposedUsername)}
                  disabled={createProfile.isPending || proposedUsername.length < 3}
                >
                  {createProfile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create profile
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Alphanumeric + dashes/underscores only. If a profile with this
                name already exists in Upload Post, we'll claim it without
                creating a duplicate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Per-platform cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-base">2.</span>
            Connected accounts
          </CardTitle>
          <CardDescription>
            One card per platform. <b>Connect</b> opens Upload Post's hosted
            OAuth flow in a new window — sign in with the AutoListing account
            for that platform. This page refreshes automatically when the
            connection lands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ALL_PLATFORMS.map(({ key, label }) => {
              const acc = accountsByPlatform.get(key);
              const Icon = PLATFORM_ICON[key];
              return (
                <Card key={key} className="overflow-hidden">
                  <div className={`flex items-center justify-center h-16 ${PLATFORM_BG[key]}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{label}</div>
                      {acc ? (
                        <Badge variant="default" className="bg-emerald-500 text-xs">Connected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Not connected</Badge>
                      )}
                    </div>
                    {acc && (acc.display_name || acc.username) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {acc.display_name || acc.username}
                        {acc.username && acc.display_name && (
                          <span className="opacity-60"> @{acc.username}</span>
                        )}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant={acc ? "outline" : "default"}
                      className="w-full"
                      disabled={!status?.configured || connect.isPending}
                      onClick={() => connect.mutate(key)}
                    >
                      {connect.isPending && connect.variables === key ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : acc ? (
                        <Power className="h-3 w-3 mr-2" />
                      ) : (
                        <ExternalLink className="h-3 w-3 mr-2" />
                      )}
                      {acc ? "Reconnect" : "Connect"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!status?.configured && (
            <div className="mt-4 p-3 rounded-md bg-amber-500/5 border border-amber-500/20 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span>Create the Upload Post profile first (step 1) before connecting platforms.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Per-channel target page IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-base">3.</span>
            Per-channel page IDs
          </CardTitle>
          <CardDescription>
            LinkedIn and Facebook need an explicit page id to post to (a
            connected account can manage multiple pages). Instagram needs the
            connected business account id. Pick from the dropdowns below — the
            value is saved to <code>brand_assets</code> and the publisher uses it
            on every post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {ALL_PLATFORMS.filter((p) => p.needsPageId).map(({ key, label, needsPageId }) => (
            <PageIdRow
              key={key}
              platform={key}
              label={label}
              brandKey={needsPageId as string}
              currentValue={status?.brand_targets[needsPageId as keyof BrandTargets] ?? null}
              isAccountConnected={!!accountsByPlatform.get(key)}
              onSave={(value) => saveTarget.mutate({ key: needsPageId as string, value })}
              saving={saveTarget.isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* Step 4: Confirmation when fully wired */}
      {status?.configured && status.brand_targets.linkedin_page_id && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div>
              <div className="font-medium text-sm">Ready to publish</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Profile + at least one page id configured. Flip{" "}
                <code>publish_enabled = true</code> in{" "}
                <a className="underline" href="/internal/marketing-engine/settings">Engine Settings</a>{" "}
                to start shipping approved posts.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PageIdRow({
  platform,
  label,
  brandKey,
  currentValue,
  isAccountConnected,
  onSave,
  saving,
}: {
  platform: Platform;
  label: string;
  brandKey: string;
  currentValue: string | null;
  isAccountConnected: boolean;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");

  // Hydrate selected from current saved value when it lands.
  useEffect(() => {
    if (currentValue && !selected) setSelected(currentValue);
  }, [currentValue, selected]);

  const { data: pages, isFetching: pagesFetching, refetch: refetchPages } = useQuery<ListPagesResponse>({
    queryKey: ["me-social-accounts-pages", platform],
    queryFn: () => callApi<ListPagesResponse>("list-pages", { platform }),
    enabled: false, // user-triggered
  });

  const pageList = pages?.pages ?? [];

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label} — <code className="text-xs">{brandKey}</code>
        </Label>
        {currentValue ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
            saved: {currentValue.slice(0, 30)}{currentValue.length > 30 ? "…" : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">not set</Badge>
        )}
      </div>

      {!isAccountConnected ? (
        <p className="text-xs text-muted-foreground">
          Connect {label} above first.
        </p>
      ) : manualMode ? (
        <div className="flex gap-2">
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Paste id manually"
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => onSave(manualValue.trim())}
            disabled={saving || manualValue.trim().length === 0}
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setManualMode(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          {pageList.length > 0 ? (
            <>
              <Select value={selected ?? undefined} onValueChange={(v) => setSelected(v)}>
                <SelectTrigger className="flex-1 min-w-[200px]">
                  <SelectValue placeholder={`Choose a ${platform} ${platform === "instagram" ? "business" : "page"}`} />
                </SelectTrigger>
                <SelectContent>
                  {pageList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-muted-foreground ml-2 text-xs">({p.id})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => selected && onSave(selected)}
                disabled={saving || !selected || selected === currentValue}
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchPages()}
              disabled={pagesFetching}
            >
              {pagesFetching ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-2" />
              )}
              Load {platform === "instagram" ? "businesses" : "pages"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setManualMode(true)}>
            Enter manually
          </Button>
        </div>
      )}
      {pages?.error && (
        <p className="text-xs text-red-500">List failed: {pages.error}</p>
      )}
    </div>
  );
}
