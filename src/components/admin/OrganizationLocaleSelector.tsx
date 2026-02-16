import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/admin/adminApi';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/lib/i18n';
import { useUKLaunchFlag, useUSLaunchFlag } from '@/hooks/useFeatureFlag';

interface OrganizationLocaleSelectorProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  currentLocale?: string;
  currentCurrency?: string;
  currentTimezone?: string;
}

const LOCALE_OPTIONS: { value: SupportedLocale; label: string; currency: string; timezone: string; flagCode: string }[] = [
  { value: 'en-IE', label: 'Ireland', currency: 'EUR', timezone: 'Europe/Dublin', flagCode: 'IE' },
  { value: 'en-GB', label: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London', flagCode: 'GB' },
  { value: 'en-US', label: 'United States', currency: 'USD', timezone: 'America/New_York', flagCode: 'US' },
];

export function OrganizationLocaleSelector({
  open,
  onClose,
  organizationId,
  organizationName,
  currentLocale = 'en-IE',
  currentCurrency = 'EUR',
  currentTimezone = 'Europe/Dublin',
}: OrganizationLocaleSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { isEnabled: ukLaunchEnabled } = useUKLaunchFlag();
  const { isEnabled: usLaunchEnabled } = useUSLaunchFlag();

  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(currentLocale as SupportedLocale);
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);

  useEffect(() => {
    if (open) {
      setSelectedLocale(currentLocale as SupportedLocale);
      setSelectedCurrency(currentCurrency);
      setSelectedTimezone(currentTimezone);
    }
  }, [open, currentLocale, currentCurrency, currentTimezone]);

  const handleLocaleChange = (value: string) => {
    const locale = value as SupportedLocale;
    setSelectedLocale(locale);
    const option = LOCALE_OPTIONS.find(o => o.value === locale);
    if (option) {
      setSelectedCurrency(option.currency);
      setSelectedTimezone(option.timezone);
    }
  };

  const updateLocaleMutation = useMutation({
    mutationFn: async (data: { locale: string; currency: string; timezone: string }) => {
      return adminApi.organizations.updateRegionSettings(organizationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      onClose();
      toast({ title: 'Region settings updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update region settings', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    updateLocaleMutation.mutate({
      locale: selectedLocale,
      currency: selectedCurrency,
      timezone: selectedTimezone,
    });
  };

  const isLocaleAvailable = (locale: SupportedLocale) => {
    if (locale === 'en-IE') return true;
    if (locale === 'en-GB') return ukLaunchEnabled;
    if (locale === 'en-US') return usLaunchEnabled;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Region Settings
          </DialogTitle>
          <DialogDescription>
            Update the locale and currency for {organizationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="locale">Region / Locale</Label>
            <Select value={selectedLocale} onValueChange={handleLocaleChange}>
              <SelectTrigger data-testid="select-org-locale">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_OPTIONS.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    disabled={!isLocaleAvailable(option.value)}
                    data-testid={`option-locale-${option.value}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{option.label}</span>
                      {!isLocaleAvailable(option.value) && (
                        <Badge variant="outline" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger data-testid="select-org-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This determines the currency used for billing and display
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger data-testid="select-org-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Dublin">Europe/Dublin (GMT/IST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateLocaleMutation.isPending}
            data-testid="button-save-region-settings"
          >
            {updateLocaleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
