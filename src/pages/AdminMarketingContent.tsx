import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Image, FileText, Megaphone, Pipette, ClipboardCopy, Link2, FileQuestion } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface MarketingContent {
  id?: string;
  organization_id: string;
  section_key: string;
  headline: string | null;
  subheadline: string | null;
  paragraph_1: string | null;
  paragraph_2: string | null;
  paragraph_3: string | null;
  image_url: string | null;
  is_enabled: boolean;
  display_order: number;
}

interface LeadMagnetConfig {
  id: string;
  organization_id: string;
  type: "READY_TO_SELL" | "WORTH_ESTIMATE";
  is_enabled: boolean;
  brand_config: Record<string, unknown>;
}

const sellPropertySchema = z.object({
  headline: z.string().min(1, "Headline is required").max(200),
  paragraph_1: z.string().min(1, "First paragraph is required").max(500),
  paragraph_2: z.string().max(500).optional(),
  paragraph_3: z.string().max(500).optional(),
  image_url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  is_enabled: z.boolean().default(true),
});

const whyChooseSchema = z.object({
  headline: z.string().min(1, "Headline is required").max(200),
  subheadline: z.string().max(300).optional(),
  paragraph_1: z.string().max(500).optional(),
  is_enabled: z.boolean().default(true),
});

const announcementBarSchema = z.object({
  headline: z.string().max(200).optional(),
  subheadline: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  paragraph_1: z.string().max(50).optional(),
  image_url: z.string().max(20).optional(),
  is_enabled: z.boolean().default(false),
  scroll_enabled: z.boolean().default(false),
  scroll_speed: z.number().min(10).max(100).default(50),
  use_custom_color: z.boolean().default(false),
  custom_bg: z.string().default("#1e40af"),
  custom_text: z.string().default("#ffffff"),
});

const ANNOUNCEMENT_COLORS = [
  { value: "primary", label: "Primary Blue", bg: "#1e40af", text: "#ffffff" },
  { value: "secondary", label: "Slate Gray", bg: "#475569", text: "#ffffff" },
  { value: "success", label: "Success Green", bg: "#16a34a", text: "#ffffff" },
  { value: "warning", label: "Warning Orange", bg: "#ea580c", text: "#ffffff" },
  { value: "info", label: "Info Cyan", bg: "#0891b2", text: "#ffffff" },
  { value: "dark", label: "Dark", bg: "#1e293b", text: "#ffffff" },
];

type SellPropertyFormData = z.infer<typeof sellPropertySchema>;
type WhyChooseFormData = z.infer<typeof whyChooseSchema>;
type AnnouncementBarFormData = z.infer<typeof announcementBarSchema>;

export default function AdminMarketingContent() {
  const { organization, loading: orgLoading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sellPropertyContent, setSellPropertyContent] = useState<MarketingContent | null>(null);
  const [whyChooseContent, setWhyChooseContent] = useState<MarketingContent | null>(null);
  const [announcementContent, setAnnouncementContent] = useState<MarketingContent | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetConfig[]>([]);
  const [savingLeadMagnets, setSavingLeadMagnets] = useState(false);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const sellPropertyForm = useForm<SellPropertyFormData>({
    resolver: zodResolver(sellPropertySchema),
    defaultValues: {
      headline: "",
      paragraph_1: "",
      paragraph_2: "",
      paragraph_3: "",
      image_url: "",
      is_enabled: true,
    },
  });

  const whyChooseForm = useForm<WhyChooseFormData>({
    resolver: zodResolver(whyChooseSchema),
    defaultValues: {
      headline: "",
      subheadline: "",
      paragraph_1: "",
      is_enabled: true,
    },
  });

  const announcementForm = useForm<AnnouncementBarFormData>({
    resolver: zodResolver(announcementBarSchema),
    defaultValues: {
      headline: "",
      subheadline: "",
      paragraph_1: "",
      image_url: "primary",
      is_enabled: false,
      scroll_enabled: false,
      scroll_speed: 60,
      use_custom_color: false,
      custom_bg: "#1e40af",
      custom_text: "#ffffff",
    },
  });

  const fetchMarketingContent = async () => {
    if (!targetOrg) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('marketing_content')
        .select('*')
        .eq('organization_id', targetOrg.id);

      if (error) throw error;

      const sellProperty = data?.find((c: MarketingContent) => c.section_key === 'sell_property');
      const whyChoose = data?.find((c: MarketingContent) => c.section_key === 'why_choose_us');
      const announcement = data?.find((c: MarketingContent) => c.section_key === 'announcement_bar');

      setSellPropertyContent(sellProperty || null);
      setWhyChooseContent(whyChoose || null);
      setAnnouncementContent(announcement || null);

      if (sellProperty) {
        sellPropertyForm.reset({
          headline: sellProperty.headline || "",
          paragraph_1: sellProperty.paragraph_1 || "",
          paragraph_2: sellProperty.paragraph_2 || "",
          paragraph_3: sellProperty.paragraph_3 || "",
          image_url: sellProperty.image_url || "",
          is_enabled: sellProperty.is_enabled,
        });
      }

      if (whyChoose) {
        whyChooseForm.reset({
          headline: whyChoose.headline || "",
          subheadline: whyChoose.subheadline || "",
          paragraph_1: whyChoose.paragraph_1 || "",
          is_enabled: whyChoose.is_enabled,
        });
      }

      if (announcement) {
        let extraSettings = {
          scroll_enabled: false,
          scroll_speed: 60,
          use_custom_color: false,
          custom_bg: "#1e40af",
          custom_text: "#ffffff",
        };
        if (announcement.paragraph_2) {
          try {
            const parsed = JSON.parse(announcement.paragraph_2);
            extraSettings = { ...extraSettings, ...parsed };
          } catch (e) {
            console.error('[AdminMarketingContent] Failed to parse announcement extra settings:', e);
          }
        }
        announcementForm.reset({
          headline: announcement.headline || "",
          subheadline: announcement.subheadline || "",
          paragraph_1: announcement.paragraph_1 || "",
          image_url: announcement.image_url || "primary",
          is_enabled: announcement.is_enabled,
          scroll_enabled: extraSettings.scroll_enabled,
          scroll_speed: extraSettings.scroll_speed,
          use_custom_color: extraSettings.use_custom_color,
          custom_bg: extraSettings.custom_bg,
          custom_text: extraSettings.custom_text,
        });
      }
    } catch (error) {
      console.error('[AdminMarketingContent] Error fetching content:', error);
      toast({
        title: "Error",
        description: "Failed to load marketing content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetOrg) {
      fetchMarketingContent();
      fetchLeadMagnets();
    }
  }, [targetOrg]);

  const fetchLeadMagnets = async () => {
    if (!targetOrg) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('lead_magnets')
        .select('*')
        .eq('organization_id', targetOrg.id);

      if (error) throw error;
      setLeadMagnets(data || []);
    } catch (error) {
      console.error('[AdminMarketingContent] Error fetching lead magnets:', error);
    }
  };

  const toggleLeadMagnet = async (type: "READY_TO_SELL" | "WORTH_ESTIMATE", enabled: boolean) => {
    if (!targetOrg) return;
    
    setSavingLeadMagnets(true);
    try {
      const existingConfig = leadMagnets.find(lm => lm.type === type);
      
      if (existingConfig) {
        const { error } = await (supabase as any)
          .from('lead_magnets')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('lead_magnets')
          .insert({
            organization_id: targetOrg.id,
            type,
            is_enabled: enabled,
            brand_config: {},
          });

        if (error) throw error;
      }

      toast({
        title: enabled ? "Quiz enabled" : "Quiz disabled",
        description: `The ${type === "READY_TO_SELL" ? "Ready to Sell" : "Worth Estimate"} quiz has been ${enabled ? "enabled" : "disabled"}`,
      });
      
      fetchLeadMagnets();
    } catch (error) {
      console.error('[AdminMarketingContent] Error toggling lead magnet:', error);
      toast({
        title: "Error",
        description: "Failed to update lead magnet settings",
        variant: "destructive",
      });
    } finally {
      setSavingLeadMagnets(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "URL copied to clipboard",
    });
  };

  const getLeadMagnetUrl = (type: "READY_TO_SELL" | "WORTH_ESTIMATE") => {
    const slug = targetOrg?.slug || "";
    const quizPath = type === "READY_TO_SELL" ? "ready-to-sell" : "worth-estimate";
    return `https://app.autolisting.io/lead-magnet/${slug}/${quizPath}`;
  };

  const isHeroButtonVisible = (type: "READY_TO_SELL" | "WORTH_ESTIMATE") => {
    const config = leadMagnets.find(lm => lm.type === type);
    return (config?.brand_config as any)?.show_hero_button ?? false;
  };

  const toggleHeroButton = async (type: "READY_TO_SELL" | "WORTH_ESTIMATE", visible: boolean) => {
    if (!targetOrg) return;
    
    setSavingLeadMagnets(true);
    try {
      const existingConfig = leadMagnets.find(lm => lm.type === type);
      const newBrandConfig = { 
        ...((existingConfig?.brand_config as any) || {}), 
        show_hero_button: visible 
      };
      
      if (existingConfig) {
        const { error } = await (supabase as any)
          .from('lead_magnets')
          .update({ brand_config: newBrandConfig, updated_at: new Date().toISOString() })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('lead_magnets')
          .insert({
            organization_id: targetOrg.id,
            type,
            is_enabled: true,
            brand_config: newBrandConfig,
          });

        if (error) throw error;
      }

      toast({
        title: visible ? "Button visible" : "Button hidden",
        description: `The hero button for ${type === "READY_TO_SELL" ? "Ready to Sell" : "Worth Estimate"} has been ${visible ? "shown" : "hidden"}`,
      });
      
      fetchLeadMagnets();
    } catch (error) {
      console.error('[AdminMarketingContent] Error toggling hero button:', error);
      toast({
        title: "Error",
        description: "Failed to update hero button visibility",
        variant: "destructive",
      });
    } finally {
      setSavingLeadMagnets(false);
    }
  };

  const isLeadMagnetEnabled = (type: "READY_TO_SELL" | "WORTH_ESTIMATE") => {
    const config = leadMagnets.find(lm => lm.type === type);
    return config?.is_enabled ?? true;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !targetOrg) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${targetOrg.id}/marketing/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(data.path);

      sellPropertyForm.setValue('image_url', publicUrl);
      
      toast({
        title: "Image uploaded",
        description: "Your marketing image has been uploaded successfully",
      });
    } catch (error) {
      console.error('[AdminMarketingContent] Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const onSaveSellProperty = async (data: SellPropertyFormData) => {
    if (!targetOrg) return;

    setSaving(true);
    try {
      const contentData = {
        organization_id: targetOrg.id,
        section_key: 'sell_property',
        headline: data.headline,
        paragraph_1: data.paragraph_1,
        paragraph_2: data.paragraph_2 || null,
        paragraph_3: data.paragraph_3 || null,
        image_url: data.image_url || null,
        is_enabled: data.is_enabled,
        updated_at: new Date().toISOString(),
      };

      if (sellPropertyContent?.id) {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .update(contentData)
          .eq('id', sellPropertyContent.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .insert({ ...contentData, display_order: 1 });

        if (error) throw error;
      }

      toast({
        title: "Content saved",
        description: "Your 'Sell Your Property' section has been updated",
      });
      
      fetchMarketingContent();
    } catch (error) {
      console.error('[AdminMarketingContent] Error saving sell property content:', error);
      toast({
        title: "Error",
        description: "Failed to save content",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSaveWhyChoose = async (data: WhyChooseFormData) => {
    if (!targetOrg) return;

    setSaving(true);
    try {
      const contentData = {
        organization_id: targetOrg.id,
        section_key: 'why_choose_us',
        headline: data.headline,
        subheadline: data.subheadline || null,
        paragraph_1: data.paragraph_1 || null,
        is_enabled: data.is_enabled,
        updated_at: new Date().toISOString(),
      };

      if (whyChooseContent?.id) {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .update(contentData)
          .eq('id', whyChooseContent.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .insert({ ...contentData, display_order: 2 });

        if (error) throw error;
      }

      toast({
        title: "Content saved",
        description: "Your 'Why Choose Us' section has been updated",
      });
      
      fetchMarketingContent();
    } catch (error) {
      console.error('[AdminMarketingContent] Error saving why choose content:', error);
      toast({
        title: "Error",
        description: "Failed to save content",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSaveAnnouncement = async (data: AnnouncementBarFormData) => {
    if (!targetOrg) return;

    setSaving(true);
    try {
      const extraSettings = JSON.stringify({
        scroll_enabled: data.scroll_enabled,
        scroll_speed: data.scroll_speed,
        use_custom_color: data.use_custom_color,
        custom_bg: data.custom_bg,
        custom_text: data.custom_text,
      });
      
      const contentData = {
        organization_id: targetOrg.id,
        section_key: 'announcement_bar',
        headline: data.headline || null,
        subheadline: data.subheadline || null,
        paragraph_1: data.paragraph_1 || null,
        paragraph_2: extraSettings,
        image_url: data.image_url || 'primary',
        is_enabled: data.is_enabled,
        updated_at: new Date().toISOString(),
      };

      if (announcementContent?.id) {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .update(contentData)
          .eq('id', announcementContent.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('marketing_content')
          .insert({ ...contentData, display_order: 0 });

        if (error) throw error;
      }

      toast({
        title: "Content saved",
        description: "Your announcement bar has been updated",
      });
      
      fetchMarketingContent();
    } catch (error) {
      console.error('[AdminMarketingContent] Error saving announcement content:', error);
      toast({
        title: "Error",
        description: "Failed to save content",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || loading) {
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

  const currentImageUrl = sellPropertyForm.watch('image_url');
  const useCustomColor = announcementForm.watch('use_custom_color');
  const customBg = announcementForm.watch('custom_bg');
  const customText = announcementForm.watch('custom_text');
  const presetColor = ANNOUNCEMENT_COLORS.find(c => c.value === announcementForm.watch('image_url')) || ANNOUNCEMENT_COLORS[0];
  const selectedColor = useCustomColor ? { bg: customBg, text: customText } : presetColor;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Marketing Content</h2>
        <p className="text-muted-foreground">Customise the marketing sections displayed on your public listings page</p>
      </div>

      <Tabs defaultValue="sell_property" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sell_property" className="flex items-center gap-2" data-testid="tab-sell-property">
            <FileText className="h-4 w-4" />
            Sell Your Property
          </TabsTrigger>
          <TabsTrigger value="why_choose" className="flex items-center gap-2" data-testid="tab-why-choose">
            <FileText className="h-4 w-4" />
            Why Choose Us
          </TabsTrigger>
          <TabsTrigger value="announcement" className="flex items-center gap-2" data-testid="tab-announcement">
            <Megaphone className="h-4 w-4" />
            Announcement Bar
          </TabsTrigger>
          <TabsTrigger value="lead_magnets" className="flex items-center gap-2" data-testid="tab-lead-magnets">
            <FileQuestion className="h-4 w-4" />
            Lead Magnets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sell_property" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sell Your Property Section</CardTitle>
              <CardDescription>
                This section appears on your public listings page to encourage property owners to list with you.
                The organization name will be automatically inserted where you use {'{business_name}'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...sellPropertyForm}>
                <form onSubmit={sellPropertyForm.handleSubmit(onSaveSellProperty)} className="space-y-6">
                  <FormField
                    control={sellPropertyForm.control}
                    name="is_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show this section</FormLabel>
                          <FormDescription>Display the "Sell Your Property" section on your public page</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="toggle-sell-property-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sellPropertyForm.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headline</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Sell For The Best Price Faster & Easier With {business_name}!" 
                            {...field} 
                            data-testid="input-sell-property-headline"
                          />
                        </FormControl>
                        <FormDescription>Use {'{business_name}'} to insert your organization name</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sellPropertyForm.control}
                    name="paragraph_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Paragraph</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="When you sell with {business_name}, you're not just listing your home..."
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-sell-property-paragraph1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sellPropertyForm.control}
                    name="paragraph_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Second Paragraph (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Our forward-thinking use of technology..."
                            className="min-h-[80px]"
                            {...field} 
                            data-testid="input-sell-property-paragraph2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sellPropertyForm.control}
                    name="paragraph_3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Third Paragraph (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="We make the process smooth, efficient, and rewarding..."
                            className="min-h-[80px]"
                            {...field} 
                            data-testid="input-sell-property-paragraph3"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormLabel>Section Image</FormLabel>
                    
                    {currentImageUrl && (
                      <div className="relative w-full max-w-md">
                        <img 
                          src={currentImageUrl} 
                          alt="Marketing section preview" 
                          className="rounded-lg border object-cover w-full h-48"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <FormField
                        control={sellPropertyForm.control}
                        name="image_url"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input 
                                placeholder="https://example.com/image.jpg or upload below"
                                {...field} 
                                data-testid="input-sell-property-image-url"
                              />
                            </FormControl>
                            <FormDescription>Enter an image URL or upload a new image</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="max-w-xs"
                        data-testid="input-upload-marketing-image"
                      />
                      {uploadingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} data-testid="button-save-sell-property">
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="why_choose" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Why Choose Us Section</CardTitle>
              <CardDescription>
                Customise the reasons why clients should choose your agency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...whyChooseForm}>
                <form onSubmit={whyChooseForm.handleSubmit(onSaveWhyChoose)} className="space-y-6">
                  <FormField
                    control={whyChooseForm.control}
                    name="is_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show this section</FormLabel>
                          <FormDescription>Display the "Why Choose Us" section on your public page</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="toggle-why-choose-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={whyChooseForm.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headline</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Why Choose {business_name}?" 
                            {...field} 
                            data-testid="input-why-choose-headline"
                          />
                        </FormControl>
                        <FormDescription>Use {'{business_name}'} to insert your organization name</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={whyChooseForm.control}
                    name="subheadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subheadline (optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="A brief description of your unique value proposition"
                            {...field} 
                            data-testid="input-why-choose-subheadline"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={whyChooseForm.control}
                    name="paragraph_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe why clients should choose your agency..."
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-why-choose-paragraph"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} data-testid="button-save-why-choose">
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcement" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Announcement Bar</CardTitle>
              <CardDescription>
                Display an announcement banner at the top of your public website. 
                This is only visible when enabled and filled out with a message.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...announcementForm}>
                <form onSubmit={announcementForm.handleSubmit(onSaveAnnouncement)} className="space-y-6">
                  <FormField
                    control={announcementForm.control}
                    name="is_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show announcement bar</FormLabel>
                          <FormDescription>Display a banner at the top of your public website</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="toggle-announcement-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={announcementForm.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Announcement Message</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., New properties available this week!" 
                            {...field} 
                            data-testid="input-announcement-message"
                          />
                        </FormControl>
                        <FormDescription>The main text that appears in the announcement bar</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={announcementForm.control}
                    name="subheadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link URL (optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/special-offer" 
                            {...field} 
                            data-testid="input-announcement-link"
                          />
                        </FormControl>
                        <FormDescription>If provided, the announcement will be clickable</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={announcementForm.control}
                    name="paragraph_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link Text (optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Learn more" 
                            {...field} 
                            data-testid="input-announcement-link-text"
                          />
                        </FormControl>
                        <FormDescription>Text for the clickable link (shows after the message)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={announcementForm.control}
                    name="scroll_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Scrolling Marquee</FormLabel>
                          <FormDescription>Enable horizontal scrolling animation for the message</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="toggle-announcement-scroll"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {announcementForm.watch('scroll_enabled') && (
                    <FormField
                      control={announcementForm.control}
                      name="scroll_speed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scroll Speed</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">Slow</span>
                              <Slider
                                min={30}
                                max={120}
                                step={5}
                                value={[field.value]}
                                onValueChange={([value]) => field.onChange(value)}
                                className="flex-1"
                                data-testid="slider-scroll-speed"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">Fast</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Custom Color</Label>
                        <p className="text-sm text-muted-foreground">Use your own colors with the color picker</p>
                      </div>
                      <FormField
                        control={announcementForm.control}
                        name="use_custom_color"
                        render={({ field }) => (
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="toggle-custom-color"
                            />
                          </FormControl>
                        )}
                      />
                    </div>

                    {!useCustomColor && (
                      <FormField
                        control={announcementForm.control}
                        name="image_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preset Color</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "primary"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-announcement-color">
                                  <SelectValue placeholder="Select a color" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ANNOUNCEMENT_COLORS.map((color) => (
                                  <SelectItem key={color.value} value={color.value}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-4 h-4 rounded-sm border" 
                                        style={{ backgroundColor: color.bg }}
                                      />
                                      {color.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {useCustomColor && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={announcementForm.control}
                          name="custom_bg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Pipette className="h-4 w-4" />
                                Background Color
                              </FormLabel>
                              <FormControl>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={field.value}
                                    onChange={field.onChange}
                                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                    data-testid="input-custom-bg-color"
                                  />
                                  <Input 
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="#1e40af"
                                    className="font-mono text-sm"
                                    data-testid="input-custom-bg-hex"
                                  />
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={announcementForm.control}
                          name="custom_text"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Pipette className="h-4 w-4" />
                                Text Color
                              </FormLabel>
                              <FormControl>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="color"
                                    value={field.value}
                                    onChange={field.onChange}
                                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                    data-testid="input-custom-text-color"
                                  />
                                  <Input 
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="#ffffff"
                                    className="font-mono text-sm"
                                    data-testid="input-custom-text-hex"
                                  />
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {announcementForm.watch('headline') && (
                    <div className="space-y-2">
                      <FormLabel>Preview</FormLabel>
                      <div 
                        className="rounded-md py-3 text-sm font-medium overflow-hidden relative"
                        style={{ 
                          backgroundColor: selectedColor.bg, 
                          color: selectedColor.text 
                        }}
                      >
                        {announcementForm.watch('scroll_enabled') ? (
                          <>
                            <div 
                              className="flex whitespace-nowrap animate-marquee-preview"
                              style={{
                                animationDuration: `${(150 - announcementForm.watch('scroll_speed')) / 2.5}s`,
                              }}
                            >
                              <span className="px-8">
                                {announcementForm.watch('headline')}
                                {announcementForm.watch('paragraph_1') && (
                                  <span className="ml-2 underline">
                                    {announcementForm.watch('paragraph_1')}
                                  </span>
                                )}
                              </span>
                              <span className="px-8">
                                {announcementForm.watch('headline')}
                                {announcementForm.watch('paragraph_1') && (
                                  <span className="ml-2 underline">
                                    {announcementForm.watch('paragraph_1')}
                                  </span>
                                )}
                              </span>
                              <span className="px-8">
                                {announcementForm.watch('headline')}
                                {announcementForm.watch('paragraph_1') && (
                                  <span className="ml-2 underline">
                                    {announcementForm.watch('paragraph_1')}
                                  </span>
                                )}
                              </span>
                            </div>
                            <style>{`
                              @keyframes marquee-preview {
                                0% { transform: translateX(0%); }
                                100% { transform: translateX(-33.33%); }
                              }
                              .animate-marquee-preview {
                                animation: marquee-preview linear infinite;
                              }
                            `}</style>
                          </>
                        ) : (
                          <div className="text-center px-4">
                            {announcementForm.watch('headline')}
                            {announcementForm.watch('paragraph_1') && (
                              <span className="ml-2 underline">
                                {announcementForm.watch('paragraph_1')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} data-testid="button-save-announcement">
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead_magnets" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Magnet Quizzes</CardTitle>
              <CardDescription>
                Interactive quizzes to capture leads from your website and marketing campaigns.
                Toggle each quiz on or off and share the URLs in your ads, emails, or website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Ready to Sell Quiz */}
              <div className="border rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Ready to Sell Assessment</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      A 5-step quiz that scores property owners on their readiness to sell.
                      Generates a personalised action plan and captures their contact details.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ready-to-sell-toggle" className="text-sm">
                      {isLeadMagnetEnabled("READY_TO_SELL") ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="ready-to-sell-toggle"
                      checked={isLeadMagnetEnabled("READY_TO_SELL")}
                      onCheckedChange={(checked) => toggleLeadMagnet("READY_TO_SELL", checked)}
                      disabled={savingLeadMagnets}
                      data-testid="switch-ready-to-sell"
                    />
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">Public Quiz URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-background border rounded px-2 py-1 overflow-x-auto">
                      {getLeadMagnetUrl("READY_TO_SELL")}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(getLeadMagnetUrl("READY_TO_SELL"))}
                      data-testid="button-copy-ready-to-sell-url"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => window.open(getLeadMagnetUrl("READY_TO_SELL"), '_blank')}
                      data-testid="button-open-ready-to-sell"
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <Label htmlFor="ready-to-sell-hero" className="text-sm font-medium">Show in Hero Section</Label>
                    <p className="text-xs text-muted-foreground">Display a button on your public site hero</p>
                  </div>
                  <Switch
                    id="ready-to-sell-hero"
                    checked={isHeroButtonVisible("READY_TO_SELL")}
                    onCheckedChange={(checked) => toggleHeroButton("READY_TO_SELL", checked)}
                    disabled={savingLeadMagnets || !isLeadMagnetEnabled("READY_TO_SELL")}
                    data-testid="switch-ready-to-sell-hero"
                  />
                </div>
              </div>

              {/* Worth Estimate Quiz */}
              <div className="border rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Property Worth Estimate</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      A property valuation quiz that provides a conservative price range estimate.
                      Great for attracting sellers who want to know their property's value.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="worth-estimate-toggle" className="text-sm">
                      {isLeadMagnetEnabled("WORTH_ESTIMATE") ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="worth-estimate-toggle"
                      checked={isLeadMagnetEnabled("WORTH_ESTIMATE")}
                      onCheckedChange={(checked) => toggleLeadMagnet("WORTH_ESTIMATE", checked)}
                      disabled={savingLeadMagnets}
                      data-testid="switch-worth-estimate"
                    />
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">Public Quiz URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-background border rounded px-2 py-1 overflow-x-auto">
                      {getLeadMagnetUrl("WORTH_ESTIMATE")}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(getLeadMagnetUrl("WORTH_ESTIMATE"))}
                      data-testid="button-copy-worth-estimate-url"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => window.open(getLeadMagnetUrl("WORTH_ESTIMATE"), '_blank')}
                      data-testid="button-open-worth-estimate"
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <Label htmlFor="worth-estimate-hero" className="text-sm font-medium">Show in Hero Section</Label>
                    <p className="text-xs text-muted-foreground">Display a button on your public site hero</p>
                  </div>
                  <Switch
                    id="worth-estimate-hero"
                    checked={isHeroButtonVisible("WORTH_ESTIMATE")}
                    onCheckedChange={(checked) => toggleHeroButton("WORTH_ESTIMATE", checked)}
                    disabled={savingLeadMagnets || !isLeadMagnetEnabled("WORTH_ESTIMATE")}
                    data-testid="switch-worth-estimate-hero"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">UTM Tracking Supported</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  Add UTM parameters to track lead sources. Supported parameters:
                </p>
                <code className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded px-2 py-1">
                  ?utm_source=facebook&utm_campaign=spring2026&c=campaign_id&pid=post_id&v=variant
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <Image className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Default Content</h3>
              <p className="text-sm text-muted-foreground">
                If you haven't customised a section, default marketing copy will be displayed. 
                The default content uses your organisation name and generic real estate messaging.
                Customise each section to make your public page unique and compelling.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
