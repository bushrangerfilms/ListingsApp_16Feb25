import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { OrganizationLogoUploader } from "@/components/OrganizationLogoUploader";
import { useLocale } from "@/hooks/useLocale";
import { OrganizationFaviconUploader } from "@/components/OrganizationFaviconUploader";
import { CustomDomainSetup } from "@/components/CustomDomainSetup";
import { PropertyServicesSelector } from "@/components/PropertyServicesSelector";
import { updateOrganizationProfile } from "@/lib/organizationHelpers";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Loader2 } from "lucide-react";
import { getRegionConfig } from "@/lib/regionConfig";
import type { SupportedLocale } from "@/lib/i18n";
import { detectLocaleFromAddress, type AddressLocaleHit } from "@/lib/locale/detectFromAddress";
import { LOCALE_NAMES } from "@/lib/locale/markets";
import { DEFAULT_LOCALE } from "@/lib/locale/config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const organizationSchema = z.object({
  business_name: z.string().min(1, "Business name is required").max(100),
  contact_name: z.string().max(100).optional(),
  contact_email: z.string().email("Must be a valid email").max(255).optional().or(z.literal("")),
  contact_phone: z.string().max(20).optional(),
  business_address: z.string().max(500).optional(),
  psr_licence_number: z.string().max(50).optional(),
  domain: z.string().max(255).optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function AdminOrganizationSettings() {
  const { organization, loading, refreshOrganization } = useOrganization();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView, isSuperAdmin } = useOrganizationView();
  const [searchParams] = useSearchParams();
  const logoRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const { isComplete: onboardingComplete, isDismissed: onboardingDismissed } = useOnboarding();

  // Use the viewed organization if super admin is viewing as another org
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const regionConfig = getRegionConfig((targetOrg?.locale || DEFAULT_LOCALE) as SupportedLocale);
  const regulatory = regionConfig.legal.regulatory;

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      business_name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      business_address: "",
      psr_licence_number: "",
      domain: "",
    },
  });

  useEffect(() => {
    if (targetOrg) {
      console.log('[AdminOrganizationSettings] Loading organization data:', targetOrg);
      form.reset({
        business_name: targetOrg.business_name || "",
        contact_name: targetOrg.contact_name || "",
        contact_email: targetOrg.contact_email || "",
        contact_phone: targetOrg.contact_phone || "",
        business_address: targetOrg.business_address || "",
        psr_licence_number: targetOrg.psr_licence_number || "",
        domain: targetOrg.domain || "",
      });
      setLogoUrl(targetOrg.logo_url);
      setFaviconUrl(targetOrg.favicon_url);
      setCustomDomain(targetOrg.custom_domain);
    }
  }, [targetOrg, viewAsOrganizationId]);

  useEffect(() => {
    if (searchParams.get('section') === 'logo' && logoRef.current) {
      logoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchParams, loading]);

  // Pending state for the locale-mismatch confirmation dialog. Populated when an
  // edit to business_address surfaces a country different from the org's current
  // country_code AND the org already had an address (so the user has already
  // committed to a locale at some point).
  const [pendingLocaleDecision, setPendingLocaleDecision] = useState<{
    formData: OrganizationFormData;
    hit: AddressLocaleHit;
  } | null>(null);

  const performSave = async (data: OrganizationFormData, localeOverride: AddressLocaleHit | null) => {
    if (!targetOrg) return;
    setIsSaving(true);
    try {
      await updateOrganizationProfile(targetOrg.id, {
        ...data,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        ...(localeOverride && {
          country_code: localeOverride.country,
          locale: localeOverride.locale,
          currency: localeOverride.currency,
          timezone: localeOverride.timezone,
        }),
      });

      // Refresh org context so onboarding auto-detection sees updated data
      await refreshOrganization();

      // Defer invalidation so React re-renders with fresh org data before detection re-runs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['onboarding-detection'] });
        if (!onboardingComplete && !onboardingDismissed) {
          window.dispatchEvent(new CustomEvent('onboarding:resume'));
        }
      }, 0);

      if (localeOverride) {
        toast.success(`Locale set to ${LOCALE_NAMES[localeOverride.locale]} based on your address`);
      } else {
        toast.success(`${t('admin:organisations.details')} saved successfully`);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update organization");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: OrganizationFormData) => {
    if (!targetOrg) return;

    // Look at the new address for a recognisable postcode and decide whether to
    // touch the org's locale fields. Three branches:
    //   1. No detection or detected country matches current → save as normal.
    //   2. Mismatch and the org had no prior business_address → silent flip
    //      with a toast (the user is committing for the first time).
    //   3. Mismatch and the org already had a business_address → prompt before
    //      changing locale; the address change saves either way.
    const hit = detectLocaleFromAddress(data.business_address);
    const currentCountry = (targetOrg as { country_code?: string | null }).country_code ?? null;
    const hadPriorAddress = !!(targetOrg.business_address && targetOrg.business_address.trim());

    if (!hit || hit.country === currentCountry) {
      await performSave(data, null);
      return;
    }
    if (!hadPriorAddress) {
      await performSave(data, hit);
      return;
    }
    setPendingLocaleDecision({ formData: data, hit });
  };

  const confirmSwitchLocale = async () => {
    if (!pendingLocaleDecision) return;
    const { formData, hit } = pendingLocaleDecision;
    setPendingLocaleDecision(null);
    await performSave(formData, hit);
  };

  const declineSwitchLocale = async () => {
    if (!pendingLocaleDecision) return;
    const { formData } = pendingLocaleDecision;
    setPendingLocaleDecision(null);
    await performSave(formData, null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>You are not associated with any organization</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('admin:organisations.settings')}</h2>
        <p className="text-muted-foreground">{t('admin:organisations.settingsSubtitle')}</p>
      </div>

      <div ref={logoRef}>
        <OrganizationLogoUploader
          currentLogoUrl={logoUrl}
          organizationId={organization.id}
          onLogoUpdate={(newUrl) => setLogoUrl(newUrl)}
        />
      </div>

      <OrganizationFaviconUploader
        currentFaviconUrl={faviconUrl}
        fallbackLogoUrl={logoUrl}
        organizationId={organization.id}
        onFaviconUpdate={(newUrl) => setFaviconUrl(newUrl)}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>{t('admin:organisations.basicDetails', "Your organisation's basic details")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Business Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="psr_licence_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{regulatory.licenceFieldLabel}</FormLabel>
                    <FormControl>
                      <Input placeholder={regulatory.licencePlaceholder} {...field} />
                    </FormControl>
                    {regulatory.licenceNote && (
                      <FormDescription>{regulatory.licenceNote}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input placeholder="yourbusiness.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your business domain (used for video end cards and branding)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>{t('admin:organisations.contactDetails', 'Primary contact details for your organisation')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@yourbusiness.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+353 1 234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Main Street, Dublin, Ireland"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} data-testid="button-save-org-settings">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>

      <PropertyServicesSelector
        organizationId={targetOrg?.id || ""}
        currentServices={targetOrg?.property_services}
      />

      <CustomDomainSetup
        organizationId={targetOrg?.id || ""}
        organizationName={targetOrg?.business_name || ""}
        organizationSlug={targetOrg?.slug || ""}
        currentDomain={customDomain}
        cnameTarget={targetOrg?.custom_domain_cname_target}
        domainStatus={targetOrg?.custom_domain_status as any}
        onDomainChange={(domain) => {
          setCustomDomain(domain || null);
        }}
      />

      <AlertDialog
        open={!!pendingLocaleDecision}
        onOpenChange={(open) => { if (!open) setPendingLocaleDecision(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch account locale?</AlertDialogTitle>
            <AlertDialogDescription>
              Your business address looks {pendingLocaleDecision ? LOCALE_NAMES[pendingLocaleDecision.hit.locale] : ''}-based, but your account is set to{' '}
              {LOCALE_NAMES[(targetOrg?.locale || DEFAULT_LOCALE) as keyof typeof LOCALE_NAMES]}. Switching changes the currency on your billing page,
              the regulatory body label, and other locale-driven defaults. The address itself
              will save either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={declineSwitchLocale} disabled={isSaving}>
              Keep current
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchLocale} disabled={isSaving}>
              Switch to {pendingLocaleDecision ? LOCALE_NAMES[pendingLocaleDecision.hit.locale] : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
