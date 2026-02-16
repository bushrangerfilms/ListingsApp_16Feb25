import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, MailCheck, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';

export default function EmailPreferences() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState<'unsubscribe' | 'resubscribe' | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchProfileInfo();
  }, [token]);

  const fetchProfileInfo = async () => {
    try {
      // Try to find profile with this token
      const { data: buyerProfile } = await supabase
        .from('buyer_profiles')
        .select('name, email, email_unsubscribed')
        .eq('email_preferences_token', token)
        .maybeSingle();

      if (buyerProfile) {
        setProfile({ ...buyerProfile, type: 'buyer' });
        setLoading(false);
        return;
      }

      const { data: sellerProfile } = await supabase
        .from('seller_profiles')
        .select('name, email, email_unsubscribed')
        .eq('email_preferences_token', token)
        .maybeSingle();

      if (sellerProfile) {
        setProfile({ ...sellerProfile, type: 'seller' });
        setLoading(false);
        return;
      }

      // Token not found
      setProfile(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const handleUpdatePreferences = async (preferenceAction: 'unsubscribe' | 'resubscribe') => {
    if (!token) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-email-preferences', {
        body: {
          token,
          action: preferenceAction,
        },
      });

      if (error) throw error;

      setAction(preferenceAction);
      toast.success(
        preferenceAction === 'unsubscribe'
          ? 'Successfully unsubscribed from email communications'
          : 'Successfully resubscribed to email communications'
      );

      // Refresh profile info
      await fetchProfileInfo();
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update email preferences');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!token || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="Email Preferences - Invalid Link"
          description="Manage your email preferences"
        />
        <PublicHeader />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>Invalid Link</CardTitle>
                  <CardDescription>
                    This email preferences link is invalid or has expired
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Please use the link provided in your most recent email, or contact us if you
                continue to experience issues.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (action) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="Email Preferences Updated"
          description="Your email preferences have been updated"
        />
        <PublicHeader />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle>Preferences Updated</CardTitle>
                  <CardDescription>
                    Your email preferences have been successfully updated
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="font-medium">{profile.name}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <p className="text-sm mt-2">
                  Status:{' '}
                  <span className="font-medium">
                    {action === 'unsubscribe' ? 'Unsubscribed' : 'Subscribed'}
                  </span>
                </p>
              </div>

              {action === 'unsubscribe' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Changed your mind? You can resubscribe at any time.
                  </p>
                  <Button
                    onClick={() => handleUpdatePreferences('resubscribe')}
                    disabled={processing}
                    className="gap-2"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MailCheck className="h-4 w-4" />
                    )}
                    Resubscribe
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Email Preferences"
        description="Manage your email communication preferences"
      />
      <PublicHeader />
      <main className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  Manage your email communication preferences
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4">
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="text-sm mt-2">
                Current Status:{' '}
                <span className="font-medium">
                  {profile.email_unsubscribed ? 'Unsubscribed' : 'Subscribed'}
                </span>
              </p>
            </div>

            {profile.email_unsubscribed ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm">
                    You are currently unsubscribed from our email communications. You won't
                    receive automated emails or updates from us.
                  </p>
                </div>
                <Button
                  onClick={() => handleUpdatePreferences('resubscribe')}
                  disabled={processing}
                  className="gap-2 w-full"
                  size="lg"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailCheck className="h-4 w-4" />
                  )}
                  Resubscribe to Emails
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm">
                    You are currently subscribed to receive email communications from us. This
                    includes property updates, notifications, and relevant information based on
                    your preferences.
                  </p>
                </div>
                <Button
                  onClick={() => handleUpdatePreferences('unsubscribe')}
                  disabled={processing}
                  variant="destructive"
                  className="gap-2 w-full"
                  size="lg"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Unsubscribe from Emails
                </Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-4 border-t">
              <p>
                Note: Unsubscribing will stop all automated email communications. You may still
                receive essential service-related emails.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}