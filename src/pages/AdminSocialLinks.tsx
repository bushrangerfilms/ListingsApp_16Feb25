import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Facebook, Instagram, Youtube, Save, Plus, AlertCircle } from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  enabled: boolean;
  display_order: number;
}

const DEFAULT_PLATFORMS = [
  { platform: 'facebook', display_order: 1 },
  { platform: 'instagram', display_order: 2 },
  { platform: 'tiktok', display_order: 3 },
  { platform: 'youtube', display_order: 4 },
];

export default function AdminSocialLinks() {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableError, setTableError] = useState(false);
  const { toast } = useToast();
  const { organization } = useOrganization();

  useEffect(() => {
    if (organization?.id) {
      fetchSocialLinks();
    }
  }, [organization?.id]);

  const fetchSocialLinks = async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    setTableError(false);
    
    try {
      const { data, error } = await supabase
        .from('social_links' as any)
        .select('*')
        .eq('organization_id', organization.id)
        .order('display_order');

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableError(true);
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load social links',
            variant: 'destructive',
          });
        }
      } else if (data && data.length > 0) {
        setSocialLinks(data as SocialLink[]);
      } else {
        setSocialLinks([]);
      }
    } catch (err) {
      console.error('Error fetching social links:', err);
      setTableError(true);
    }
    setLoading(false);
  };

  const initializeSocialLinks = async () => {
    if (!organization?.id) return;
    
    setSaving(true);
    
    try {
      const newLinks = DEFAULT_PLATFORMS.map(p => ({
        organization_id: organization.id,
        platform: p.platform,
        url: '',
        enabled: false,
        display_order: p.display_order,
      }));

      const { data, error } = await supabase
        .from('social_links' as any)
        .insert(newLinks)
        .select();

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableError(true);
        }
        toast({
          title: 'Error',
          description: 'Failed to initialize social links. The social_links table may need to be created in Supabase.',
          variant: 'destructive',
        });
      } else if (data) {
        setSocialLinks(data as SocialLink[]);
        toast({
          title: 'Success',
          description: 'Social links initialized successfully',
        });
      }
    } catch (err) {
      console.error('Error initializing social links:', err);
      setTableError(true);
    }
    setSaving(false);
  };

  const handleUpdate = (id: string, field: keyof SocialLink, value: any) => {
    setSocialLinks(prev =>
      prev.map(link => link.id === id ? { ...link, [field]: value } : link)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    
    for (const link of socialLinks) {
      const { error } = await supabase
        .from('social_links' as any)
        .update({
          url: link.url,
          enabled: link.enabled,
        })
        .eq('id', link.id);

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to update ${link.platform}`,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
    }

    toast({
      title: 'Success',
      description: 'Social links updated successfully',
    });
    setSaving(false);
  };

  const getSocialIcon = (platform: string) => {
    const iconClass = "h-6 w-6";
    switch (platform) {
      case 'facebook':
        return <Facebook className={iconClass} />;
      case 'instagram':
        return <Instagram className={iconClass} />;
      case 'tiktok':
        return <SiTiktok className={iconClass} />;
      case 'youtube':
        return <Youtube className={iconClass} />;
      default:
        return null;
    }
  };

  if (tableError) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Social Media Links</h1>
            <p className="text-muted-foreground">
              Manage your social media links that appear in the footer
            </p>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database Setup Required</AlertTitle>
            <AlertDescription>
              The social_links table needs to be created in your Supabase database. 
              Please run the following SQL in your Supabase SQL Editor:
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, platform)
);

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social links for their organization"
  ON public.social_links FOR SELECT
  USING (organization_id IN (
    SELECT ou.organization_id FROM public.organization_users ou WHERE ou.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage social links for their organization"
  ON public.social_links FOR ALL
  USING (organization_id IN (
    SELECT ou.organization_id FROM public.organization_users ou WHERE ou.user_id = auth.uid()
  ));`}
              </pre>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Website Social Icons</h1>
          <p className="text-muted-foreground">
            Add links to your social media profiles that appear as clickable icons in your public website footer
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These are display links only - visitors click these icons to visit your social profiles. 
            To connect accounts for posting content, use the Socials companion app settings.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Footer Social Icons</CardTitle>
            <CardDescription>
              Configure which social media icons appear in your website footer and where they link to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : socialLinks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No social icons configured yet. Click below to add social media icons to your website footer.
                </p>
                <Button onClick={initializeSocialLinks} disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" />
                  {saving ? 'Initializing...' : 'Add Social Icons'}
                </Button>
              </div>
            ) : (
              <>
                {socialLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="text-primary">
                      {getSocialIcon(link.platform)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="capitalize">{link.platform} Profile URL</Label>
                      <Input
                        type="url"
                        placeholder={`https://${link.platform}.com/yourprofile`}
                        value={link.url}
                        onChange={(e) => handleUpdate(link.id, 'url', e.target.value)}
                        data-testid={`input-social-${link.platform}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={link.enabled}
                        onCheckedChange={(checked) => handleUpdate(link.id, 'enabled', checked)}
                        data-testid={`switch-social-${link.platform}`}
                      />
                      <Label className="text-sm text-muted-foreground">
                        {link.enabled ? 'Show icon' : 'Hide icon'}
                      </Label>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                  data-testid="button-save-social-links"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
