import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationView } from '@/contexts/OrganizationViewContext';
import { useDisplaySettingsListQuery, useCreateDisplaySettings, useUpdateDisplaySettings, useDeleteDisplaySettings } from '@/hooks/useDisplaySettings';
import { useDisplayListings } from '@/hooks/useDisplayListings';
import type { DisplaySignageConfig, DisplaySignageSettings } from '@/lib/display-signage/types';
import { DEFAULT_DISPLAY_CONFIG, ALL_DISPLAY_STATUSES } from '@/lib/display-signage/types';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Monitor, ExternalLink, Copy, BarChart3, Plus, Trash2, Pencil } from 'lucide-react';
import { useDisplayAnalyticsQuery } from '@/hooks/useDisplayAnalyticsQuery';
import { DEFAULT_LOCALE } from '@/lib/locale/config';

export default function AdminShopWindowDisplay() {
  const { organization, loading: orgLoading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: displays, isLoading: displaysLoading } = useDisplaySettingsListQuery(targetOrg?.id);
  const isLoading = orgLoading || displaysLoading;
  const createSettings = useCreateDisplaySettings();
  const updateSettings = useUpdateDisplaySettings();
  const deleteSettings = useDeleteDisplaySettings();

  // Selected display (5.1)
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(null);
  const selectedDisplay = displays?.find(d => d.id === selectedDisplayId) || displays?.[0] || null;

  // Auto-select first display when list loads
  useEffect(() => {
    if (displays?.length && !selectedDisplayId) {
      setSelectedDisplayId(displays[0].id);
    }
  }, [displays, selectedDisplayId]);

  const [isEnabled, setIsEnabled] = useState(true);
  const [config, setConfig] = useState<DisplaySignageConfig>(DEFAULT_DISPLAY_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Fetch listings for inline preview (3.2)
  const { data: displayData } = useDisplayListings(targetOrg?.id, selectedDisplay?.id);
  // Display analytics (5.2)
  const { data: analyticsData } = useDisplayAnalyticsQuery(targetOrg?.id);
  const previewListing = displayData?.listings?.[0] || null;
  const previewOrg = displayData?.organization || null;

  // Sync state from selected display
  useEffect(() => {
    if (selectedDisplay) {
      setIsEnabled(selectedDisplay.is_enabled);
      setConfig({ ...DEFAULT_DISPLAY_CONFIG, ...selectedDisplay.config });
      setDisplayName(selectedDisplay.display_name || 'Main Display');
      setHasChanges(false);
      setEditingName(false);
    }
  }, [selectedDisplay]);

  // Unsaved changes guard (3.4)
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  const updateConfig = <K extends keyof DisplaySignageConfig>(key: K, value: DisplaySignageConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleCreateDisplay = async () => {
    if (!targetOrg) return;
    try {
      const newDisplay = await createSettings.mutateAsync({
        organizationId: targetOrg.id,
        displayName: `Display ${(displays?.length || 0) + 1}`,
      });
      setSelectedDisplayId(newDisplay.id);
      toast({ title: 'Display created', description: 'New display configuration created.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create display.', variant: 'destructive' });
    }
  };

  const handleDeleteDisplay = async () => {
    if (!targetOrg || !selectedDisplay) return;
    if (displays?.length === 1) {
      toast({ title: 'Cannot delete', description: 'You need at least one display.', variant: 'destructive' });
      return;
    }
    try {
      await deleteSettings.mutateAsync({ displayId: selectedDisplay.id, organizationId: targetOrg.id });
      setSelectedDisplayId(null);
      toast({ title: 'Display deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete display.', variant: 'destructive' });
    }
  };

  const handleEnable = async () => {
    if (!targetOrg || !selectedDisplay) {
      // No displays yet — create first one
      if (!targetOrg) return;
      try {
        const newDisplay = await createSettings.mutateAsync({
          organizationId: targetOrg.id,
          displayName: 'Main Display',
        });
        setSelectedDisplayId(newDisplay.id);
        toast({ title: 'Shop window display enabled', description: 'Default settings have been applied.' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to enable display settings.', variant: 'destructive' });
      }
      return;
    }
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    try {
      await updateSettings.mutateAsync({
        displayId: selectedDisplay.id,
        organizationId: targetOrg.id,
        updates: { is_enabled: newEnabled },
      });
      toast({ title: newEnabled ? 'Display enabled' : 'Display disabled' });
    } catch (error) {
      setIsEnabled(!newEnabled);
      toast({ title: 'Error', description: 'Failed to update display settings.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!targetOrg || !selectedDisplay) return;
    try {
      await updateSettings.mutateAsync({
        displayId: selectedDisplay.id,
        organizationId: targetOrg.id,
        updates: { config },
      });
      setHasChanges(false);
      toast({ title: 'Settings saved', description: 'Display settings have been updated.' });
    } catch (error) {
      toast({ title: 'Save failed', description: 'Failed to save display settings.', variant: 'destructive' });
    }
  };

  const handleRenameSave = async () => {
    if (!targetOrg || !selectedDisplay || !displayName.trim()) return;
    try {
      await updateSettings.mutateAsync({
        displayId: selectedDisplay.id,
        organizationId: targetOrg.id,
        updates: { display_name: displayName.trim() },
      });
      setEditingName(false);
      toast({ title: 'Display renamed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to rename display.', variant: 'destructive' });
    }
  };

  const getDisplayUrl = (display?: DisplaySignageSettings | null) => {
    const base = `${window.location.origin}/admin/shop-window`;
    return display ? `${base}?display=${display.id}` : base;
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getDisplayUrl(selectedDisplay));
    toast({ title: 'URL copied', description: 'Display URL copied to clipboard.' });
  };

  const handleLaunchDisplay = () => {
    window.open(getDisplayUrl(selectedDisplay), '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasDisplays = displays && displays.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shop Window Display</h1>
        <p className="text-muted-foreground">Configure your in-store digital signage display</p>
      </div>

      {/* Header + enable toggle + launch */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Shop Window Display</CardTitle>
                <CardDescription>
                  Display a rotating slideshow of your listings on a shop window monitor
                </CardDescription>
              </div>
            </div>
            {hasDisplays && selectedDisplay && (
              <div className="flex items-center gap-2">
                <Label htmlFor="display-enabled" className="text-sm text-muted-foreground">
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="display-enabled"
                  checked={isEnabled}
                  onCheckedChange={handleEnable}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasDisplays ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No displays configured yet. Create one to get started.</p>
              <Button onClick={handleEnable} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Display
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleLaunchDisplay} className="gap-2" disabled={!isEnabled}>
                  <ExternalLink className="h-4 w-4" />
                  Open Display
                </Button>
                <Button variant="outline" onClick={handleCopyUrl} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Open this URL on your shop window monitor. Log in on that device, then navigate to this URL for a fullscreen slideshow.
                Press <kbd className="px-1.5 py-0.5 text-xs border rounded bg-muted">Esc</kbd> to exit.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Display selector (5.1) — only shown when multiple displays exist or to create more */}
      {hasDisplays && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Displays</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCreateDisplay} className="gap-1">
                <Plus className="h-4 w-4" />
                Add Display
              </Button>
            </div>
            <CardDescription>
              Each display can have its own settings — useful for front window, back office, or digital board setups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {displays?.map((display) => (
                <div
                  key={display.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-colors ${
                    selectedDisplay?.id === display.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  onClick={() => { setSelectedDisplayId(display.id); }}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className={`h-5 w-5 ${selectedDisplay?.id === display.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      {editingName && selectedDisplay?.id === display.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="h-7 w-48 text-sm"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setEditingName(false); }}
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); handleRenameSave(); }}>Save</Button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium">{display.display_name}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {display.is_enabled ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  {selectedDisplay?.id === display.id && !editingName && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setEditingName(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {(displays?.length || 0) > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteDisplay(); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDisplay && (
        <>
          {/* Display options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Orientation */}
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select value={config.orientation} onValueChange={(v) => updateConfig('orientation', v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="landscape">Landscape (horizontal)</SelectItem>
                      <SelectItem value="portrait">Portrait (vertical)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Auto-detect adjusts based on the monitor's aspect ratio</p>
                </div>

                {/* Transition */}
                <div className="space-y-2">
                  <Label>Transition</Label>
                  <Select value={config.transition_type} onValueChange={(v) => updateConfig('transition_type', v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide">Slide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Display theme (5.3) */}
                <div className="space-y-2">
                  <Label>Display Theme</Label>
                  <Select value={config.display_theme || 'classic'} onValueChange={(v) => updateConfig('display_theme', v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="modern">Modern (Full-bleed)</SelectItem>
                      <SelectItem value="minimal">Minimal (Centered)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Classic: split photo/details. Modern: full-bleed photo with overlay. Minimal: centered card.</p>
                </div>

                {/* Listing order */}
                <div className="space-y-2">
                  <Label>Listing Order</Label>
                  <Select value={config.listing_order} onValueChange={(v) => updateConfig('listing_order', v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest_first">Newest First</SelectItem>
                      <SelectItem value="price_high_to_low">Price: High to Low</SelectItem>
                      <SelectItem value="price_low_to_high">Price: Low to High</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={config.category_filter} onValueChange={(v) => updateConfig('category_filter', v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="sales">Sales Only</SelectItem>
                      <SelectItem value="rentals">Rentals Only</SelectItem>
                      <SelectItem value="holiday_rentals">Holiday Rentals Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status filter (3.1) */}
              <div className="space-y-3">
                <Label>Show Listings With Status</Label>
                <div className="flex flex-wrap gap-4">
                  {ALL_DISPLAY_STATUSES.map((status) => {
                    const checked = (config.status_filter || [...ALL_DISPLAY_STATUSES]).includes(status);
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            const current = config.status_filter || [...ALL_DISPLAY_STATUSES];
                            const updated = v
                              ? [...current, status]
                              : current.filter((s) => s !== status);
                            // Don't allow empty — keep at least one
                            if (updated.length > 0) {
                              updateConfig('status_filter', updated);
                            }
                          }}
                        />
                        <Label htmlFor={`status-${status}`} className="text-sm font-normal cursor-pointer">
                          {status}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Choose which listing statuses appear in the display</p>
              </div>

              {/* Slide duration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Slide Duration</Label>
                  <span className="text-sm font-medium">{config.slide_duration_seconds}s</span>
                </div>
                <Slider
                  value={[config.slide_duration_seconds]}
                  onValueChange={([v]) => updateConfig('slide_duration_seconds', v)}
                  min={5}
                  max={30}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">How long each listing is displayed before advancing</p>
              </div>

              {/* Max listings */}
              <div className="space-y-2">
                <Label>Max Listings</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Show all"
                  value={config.max_listings ?? ''}
                  onChange={(e) => updateConfig('max_listings', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">Leave blank to show all active listings</p>
              </div>

              {/* Photos per listing (4.1) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Photos Per Listing</Label>
                  <span className="text-sm font-medium">{config.photos_per_listing || 1}</span>
                </div>
                <Slider
                  value={[config.photos_per_listing || 1]}
                  onValueChange={([v]) => updateConfig('photos_per_listing', v)}
                  min={1}
                  max={5}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Cycle through multiple photos per listing before advancing. 1 = hero photo only.</p>
              </div>

              {/* Custom banner message (4.2) */}
              <div className="space-y-2">
                <Label>Banner Message</Label>
                <Textarea
                  placeholder="e.g. Open Viewing Saturday 2-4pm"
                  value={config.custom_message || ''}
                  onChange={(e) => updateConfig('custom_message', e.target.value || null)}
                  className="resize-none"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Optional banner displayed across the top of the display</p>
              </div>
            </CardContent>
          </Card>

          {/* Content visibility */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Visibility</CardTitle>
              <CardDescription>Choose what information to display on each slide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'show_price', label: 'Price' },
                  { key: 'show_address', label: 'Address' },
                  { key: 'show_bedrooms_bathrooms', label: 'Bedrooms & Bathrooms' },
                  { key: 'show_ber_rating', label: 'BER / Energy Rating' },
                  { key: 'show_description', label: 'Description Excerpt' },
                  { key: 'show_land_size', label: 'Land Size (for land listings)' },
                  { key: 'show_logo_on_slide', label: 'Logo on Each Slide' },
                  { key: 'show_contact_info', label: 'Contact Info & PSRA' },
                  { key: 'show_qr_code', label: 'QR Code (links to listing)' },
                  { key: 'show_clock', label: 'Clock & Date' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Switch
                      id={key}
                      checked={config[key]}
                      onCheckedChange={(v) => updateConfig(key, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Exclude listings (4.5) */}
          {displayData?.listings && displayData.listings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exclude Listings</CardTitle>
                <CardDescription>Toggle off listings you don't want shown in the display</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {displayData.listings.map((listing) => {
                    const isExcluded = (config.excluded_listing_ids || []).includes(listing.id);
                    return (
                      <div key={listing.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3 min-w-0">
                          {listing.hero_photo && (
                            <img src={listing.hero_photo} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{listing.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground">{listing.address_town}{listing.county ? `, ${listing.county}` : ''}</p>
                          </div>
                        </div>
                        <Switch
                          checked={!isExcluded}
                          onCheckedChange={(shown) => {
                            const current = config.excluded_listing_ids || [];
                            const updated = shown
                              ? current.filter((id) => id !== listing.id)
                              : [...current, listing.id];
                            updateConfig('excluded_listing_ids', updated);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Display analytics (5.2) */}
          {analyticsData && analyticsData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Display Analytics</CardTitle>
                </div>
                <CardDescription>Listing impressions from the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analyticsData.slice(0, 20).map((item) => (
                    <div key={item.listing_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.hero_photo && (
                          <img src={item.hero_photo} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.listing_title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{item.listing_address || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-medium">{item.total_views} views</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(item.total_duration_seconds / 60)} min total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inline preview (3.2) */}
          {previewListing && previewOrg && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>How your first listing will appear on the display</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="relative mx-auto rounded-lg overflow-hidden bg-black"
                  style={{ aspectRatio: '16/9', maxWidth: '640px' }}
                >
                  <PreviewSlide
                    listing={previewListing}
                    organization={previewOrg}
                    config={config}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save button */}
          {hasChanges && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
                {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Inline preview component (3.2) ──────────────────────────────────

function PreviewSlide({
  listing,
  organization,
  config,
}: {
  listing: { title: string | null; price: number | null; address_town: string | null; county: string | null; bedrooms: number | null; bathrooms: number | null; building_type: string | null; hero_photo: string | null; ber_rating: string | null; category: string | null; status: string | null; floor_area_size: number | null; land_size: number | null; description: string | null; ensuite: number | null; furnished: string | null };
  organization: { business_name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; contact_phone: string | null; domain: string | null; locale: string | null; currency: string | null };
  config: DisplaySignageConfig;
}) {
  const primary = organization.primary_color || '#1e3a5f';
  const secondary = organization.secondary_color || '#f0f4f8';
  const location = [listing.address_town, listing.county].filter(Boolean).join(', ');

  // Type-aware details
  const isLand = listing.building_type === 'Land';
  const isCommercial = listing.building_type === 'Commercial';
  const details: string[] = [];
  let showBer = true;

  if (isLand) {
    if (config.show_land_size && listing.land_size) {
      details.push(`${listing.land_size} acres`);
    }
    if (listing.building_type) details.push(listing.building_type);
    showBer = false;
  } else if (isCommercial) {
    if (listing.floor_area_size) details.push(`${listing.floor_area_size} sqm`);
    if (listing.building_type) details.push(listing.building_type);
  } else {
    if (config.show_bedrooms_bathrooms) {
      if (listing.bedrooms) details.push(`${listing.bedrooms} Bed`);
      if (listing.bathrooms) details.push(`${listing.bathrooms} Bath`);
    }
    if (listing.building_type) details.push(listing.building_type);
    if (listing.furnished && (listing.category === 'Rental' || listing.category === 'Holiday Rental')) {
      details.push(listing.furnished);
    }
  }

  let priceText = '';
  if (config.show_price && listing.price) {
    try {
      priceText = new Intl.NumberFormat(organization.locale || DEFAULT_LOCALE, {
        style: 'currency', currency: organization.currency || 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(listing.price);
      if (listing.category === 'Rental') priceText += ' /month';
      if (listing.category === 'Holiday Rental') priceText += ' /night';
    } catch {
      priceText = `${organization.currency || '€'}${listing.price.toLocaleString()}`;
    }
  }

  // Description excerpt for preview
  const descExcerpt = config.show_description && listing.description
    ? (listing.description.split(/\n\n/)[0].substring(0, 80) + (listing.description.length > 80 ? '...' : ''))
    : null;

  return (
    <div className="h-full w-full flex flex-col" style={{ padding: '2%' }}>
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Photo */}
        <div className="relative flex-[7] rounded-lg overflow-hidden">
          {listing.hero_photo ? (
            <img src={listing.hero_photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
          )}
          {listing.status && listing.status !== 'Published' && (
            <div
              className="absolute top-1 left-1 px-2 py-0.5 rounded-full text-white font-bold uppercase"
              style={{
                backgroundColor: listing.status === 'New' ? '#16a34a' : listing.status === 'Sold' ? '#dc2626' : '#d97706',
                fontSize: '0.45rem',
              }}
            >
              {listing.status}
            </div>
          )}
        </div>

        {/* Details */}
        <div
          className="flex-[3] flex flex-col justify-center gap-1 px-2 rounded-lg"
          style={{ backgroundColor: `${primary}18` }}
        >
          {config.show_logo_on_slide && organization.logo_url && (
            <img src={organization.logo_url} alt="" className="object-contain" style={{ height: '0.8rem', maxWidth: '3rem' }} />
          )}
          <p className="font-bold text-white leading-tight line-clamp-2" style={{ fontSize: '0.65rem' }}>
            {listing.title || 'Property'}
          </p>
          {priceText && (
            <p className="font-bold" style={{ fontSize: '0.7rem', color: secondary }}>
              {priceText}
            </p>
          )}
          {details.length > 0 && (
            <p className="text-white/70" style={{ fontSize: '0.45rem' }}>
              {details.join(' · ')}
            </p>
          )}
          {descExcerpt && (
            <p className="text-white/60 italic line-clamp-2" style={{ fontSize: '0.35rem' }}>
              {descExcerpt}
            </p>
          )}
          {showBer && config.show_ber_rating && listing.ber_rating && listing.ber_rating !== 'EXEMPT' && (
            <p className="text-white/70" style={{ fontSize: '0.4rem' }}>BER: {listing.ber_rating}</p>
          )}
          {config.show_address && location && (
            <p className="text-white/70" style={{ fontSize: '0.45rem' }}>{location}</p>
          )}
        </div>
      </div>

      {/* Branding bar */}
      <div
        className="flex items-center justify-between rounded-md px-2 mt-1"
        style={{ backgroundColor: primary, color: '#fff', minHeight: '1.2rem', fontSize: '0.4rem' }}
      >
        <div className="flex items-center gap-1">
          {organization.logo_url && (
            <img src={organization.logo_url} alt="" className="h-3 object-contain" />
          )}
          <span className="font-semibold">{organization.business_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {config.show_contact_info && organization.domain && (
            <span className="font-medium">{organization.domain}</span>
          )}
          {config.show_contact_info && organization.contact_phone && (
            <span>{organization.contact_phone}</span>
          )}
        </div>
      </div>
    </div>
  );
}
