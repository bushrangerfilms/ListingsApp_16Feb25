import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationView } from '@/contexts/OrganizationViewContext';
import { supabase } from '@/integrations/supabase/client';
import { SITE_COPY_FIELDS, SITE_COPY_GROUPS, DEFAULT_LOCALE, SiteCopyField } from '@/lib/siteContentKeys';

interface ContentValues {
  [key: string]: string;
}

export default function AdminContent() {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [values, setValues] = useState<ContentValues>({});
  const [originalValues, setOriginalValues] = useState<ContentValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());

  const activeOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const organizationId = activeOrg?.id;

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    fetchContent();
  }, [organizationId]);

  const fetchContent = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_organization_site_copy', {
        org_id: organizationId,
        loc: DEFAULT_LOCALE,
      });

      if (error) {
        console.log('[AdminContent] Error fetching content:', error.message);
        setLoading(false);
        return;
      }

      const contentMap: ContentValues = {};
      ((data as { copy_key: string; copy_value: string }[]) || []).forEach(entry => {
        contentMap[entry.copy_key] = entry.copy_value;
      });
      setValues(contentMap);
      setOriginalValues(contentMap);
    } catch (err) {
      console.error('[AdminContent] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSavedFields(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const savePromises: Promise<void>[] = [];
      const newSavedFields = new Set<string>();

      for (const field of SITE_COPY_FIELDS) {
        const currentValue = values[field.key] || '';
        const originalValue = originalValues[field.key] || '';
        
        if (currentValue !== originalValue) {
          if (currentValue.trim()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            savePromises.push(
              (supabase.rpc as any)('upsert_organization_site_copy', {
                org_id: organizationId,
                loc: DEFAULT_LOCALE,
                key: field.key,
                value: currentValue.trim(),
              }).then(() => { newSavedFields.add(field.key); })
            );
          } else if (originalValue) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            savePromises.push(
              (supabase.rpc as any)('delete_organization_site_copy', {
                org_id: organizationId,
                loc: DEFAULT_LOCALE,
                key: field.key,
              }).then(() => { newSavedFields.add(field.key); })
            );
          }
        }
      }

      await Promise.all(savePromises);
      setSavedFields(newSavedFields);
      setOriginalValues({ ...values });

      toast({
        title: 'Content saved',
        description: 'Your website content has been updated successfully.',
      });
    } catch (error) {
      console.error('[AdminContent] Save error:', error);
      toast({
        title: 'Error saving content',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues({});
    setSavedFields(new Set());
  };

  const hasChanges = Object.keys(values).some(key => values[key] !== (originalValues[key] || '')) ||
    Object.keys(originalValues).some(key => !values[key] && originalValues[key]);

  const renderField = (field: SiteCopyField) => {
    const value = values[field.key] || '';
    const isSaved = savedFields.has(field.key);
    
    return (
      <div key={field.key} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.key} className="font-medium">
            {field.label}
          </Label>
          {isSaved && <Check className="h-4 w-4 text-green-500" />}
        </div>
        <p className="text-sm text-muted-foreground">{field.description}</p>
        {field.multiline ? (
          <Textarea
            id={field.key}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.defaultValue}
            className="min-h-[80px]"
            data-testid={`input-content-${field.key}`}
          />
        ) : (
          <Input
            id={field.key}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.defaultValue}
            data-testid={`input-content-${field.key}`}
          />
        )}
        {!value && (
          <p className="text-xs text-muted-foreground">
            Default: "{field.defaultValue}"
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const groupedFields = SITE_COPY_FIELDS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, SiteCopyField[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground">
            Customise the text displayed on your public website. Leave fields empty to use defaults.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || Object.keys(values).length === 0}
            data-testid="button-reset-content"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            data-testid="button-save-content"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {Object.entries(SITE_COPY_GROUPS).map(([groupKey, groupInfo]) => {
        const fields = groupedFields[groupKey];
        if (!fields?.length) return null;

        return (
          <Card key={groupKey}>
            <CardHeader>
              <CardTitle className="text-lg">{groupInfo.label}</CardTitle>
              <CardDescription>{groupInfo.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map(renderField)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
