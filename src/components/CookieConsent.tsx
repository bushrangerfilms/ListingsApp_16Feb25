import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_VERSION = '1.0';

function getDefaultPreferences(): CookiePreferences {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(getDefaultPreferences());

  useEffect(() => {
    const stored = localStorage.getItem('cookiePreferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookiePreferences;
        if (parsed.version === CONSENT_VERSION) {
          setPreferences(parsed);
          return;
        }
        localStorage.removeItem('cookiePreferences');
        localStorage.removeItem('cookieConsent');
        setShowBanner(true);
        return;
      } catch {
        localStorage.removeItem('cookiePreferences');
        localStorage.removeItem('cookieConsent');
      }
    }
    
    const legacyConsent = localStorage.getItem('cookieConsent');
    if (legacyConsent) {
      localStorage.removeItem('cookieConsent');
    }
    setShowBanner(true);
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const toSave = {
      ...prefs,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem('cookiePreferences', JSON.stringify(toSave));
    localStorage.setItem('cookieConsent', prefs.functional || prefs.analytics ? 'accepted' : 'rejected');
    setPreferences(toSave);
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleAcceptAll = () => {
    savePreferences({
      ...preferences,
      functional: true,
      analytics: true,
    });
  };

  const handleRejectNonEssential = () => {
    savePreferences({
      ...preferences,
      functional: false,
      analytics: false,
    });
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom" data-testid="cookie-banner">
      <Card className="max-w-4xl mx-auto p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Cookie Preferences</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We use cookies to provide essential functionality and improve your experience. 
              You can choose which types of cookies to allow.{' '}
              <Link to="/cookie-policy" className="text-primary hover:underline">
                Learn more
              </Link>
            </p>
            
            <Collapsible open={showPreferences} onOpenChange={setShowPreferences}>
              <div className="flex flex-wrap gap-3 items-center">
                <Button onClick={handleAcceptAll} size="sm" data-testid="button-accept-cookies">
                  Accept All
                </Button>
                <Button onClick={handleRejectNonEssential} variant="outline" size="sm" data-testid="button-reject-cookies">
                  Reject Non-Essential
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-cookie-preferences">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Preferences
                    {showPreferences ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="necessary" className="font-medium">Strictly Necessary</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Essential for the website to function. Cannot be disabled.
                      </p>
                    </div>
                    <Switch
                      id="necessary"
                      checked={true}
                      disabled
                      data-testid="switch-necessary-cookies"
                    />
                  </div>
                  
                  <div className="border-t pt-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="functional" className="font-medium">Functional</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Remember your preferences like theme and sidebar state.
                      </p>
                    </div>
                    <Switch
                      id="functional"
                      checked={preferences.functional}
                      onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, functional: checked }))}
                      data-testid="switch-functional-cookies"
                    />
                  </div>
                  
                  <div className="border-t pt-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="analytics" className="font-medium">Analytics</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Help us understand how you use the site to improve it.
                      </p>
                    </div>
                    <Switch
                      id="analytics"
                      checked={preferences.analytics}
                      onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, analytics: checked }))}
                      data-testid="switch-analytics-cookies"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSavePreferences} size="sm" data-testid="button-save-cookie-preferences">
                    Save Preferences
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={handleRejectNonEssential}
            data-testid="button-close-cookie-banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
