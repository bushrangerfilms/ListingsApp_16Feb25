import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/PublicHeader";
import { SEO } from "@/components/SEO";
import { Bell, BellOff, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PropertyAlert {
  id: string;
  name: string;
  email: string;
  phone: string;
  bedrooms: number[];
  status: string;
  created_at: string;
  notification_count: number;
  last_notified_at: string | null;
}

export default function UpdateAlertPreferences() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<PropertyAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const bedroomOptions = [1, 2, 3, 4, 5]; // 5 represents "5+"

  useEffect(() => {
    if (token) {
      fetchAlertDetails();
    } else {
      setError('Invalid preferences link');
      setLoading(false);
    }
  }, [token]);

  const fetchAlertDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('property_alerts')
        .select('*')
        .eq('preferences_token', token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Property alert not found. The link may be invalid or expired.');
        return;
      }

      setAlert(data);
      setSelectedBedrooms(data.bedrooms);
    } catch (err) {
      console.error('Error fetching alert details:', err);
      setError('Failed to load your preferences. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleBedroomToggle = (bedroom: number) => {
    setSelectedBedrooms(prev => 
      prev.includes(bedroom)
        ? prev.filter(b => b !== bedroom)
        : [...prev, bedroom].sort((a, b) => a - b)
    );
  };

  const handleUpdatePreferences = async () => {
    if (selectedBedrooms.length === 0) {
      toast.error('Please select at least one bedroom option');
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase.functions.invoke('update-alert-preferences', {
        body: {
          token,
          action: 'update',
          bedrooms: selectedBedrooms,
        },
      });

      if (error) throw error;

      toast.success('Your preferences have been updated successfully!');
      fetchAlertDetails(); // Refresh the data
    } catch (err) {
      console.error('Error updating preferences:', err);
      toast.error('Failed to update preferences. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelAlerts = async () => {
    try {
      setUpdating(true);

      const { error } = await supabase.functions.invoke('update-alert-preferences', {
        body: {
          token,
          action: 'cancel',
        },
      });

      if (error) throw error;

      toast.success('Your property alerts have been cancelled');
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Error cancelling alerts:', err);
      toast.error('Failed to cancel alerts. Please try again.');
      setUpdating(false);
    }
  };

  const formatBedroomText = (bedroom: number) => {
    if (bedroom === 5) return '5+ Bedrooms';
    return `${bedroom} Bedroom${bedroom > 1 ? 's' : ''}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="Property Alerts - Invalid Link"
          description="Manage your property alert preferences"
        />
        <PublicHeader />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <CardTitle className="text-2xl">Link Not Found</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {error || 'We couldn\'t find your property alert preferences.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  This link may have expired or is invalid. If you need assistance,
                  please contact us directly using the information in the footer.
                </p>
                <Button onClick={() => navigate('/')} className="mt-4">
                  Return to Homepage
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = alert.status === 'cancelled';

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Manage Property Alerts"
        description="Update your property alert preferences"
      />
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Property Alert Preferences</h1>
            <p className="text-lg text-muted-foreground">
              Manage your notification settings
            </p>
          </div>

          {/* Alert Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {isCancelled ? (
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Bell className="h-6 w-6 text-primary" />
                )}
                <div>
                  <CardTitle>Hi {alert.name}!</CardTitle>
                  <CardDescription>
                    {isCancelled ? 'Your alerts are currently cancelled' : 'Your alerts are active'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{alert.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{alert.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registered</p>
                  <p className="font-medium">{formatDate(alert.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Notifications Sent</p>
                  <p className="font-medium">{alert.notification_count}</p>
                </div>
              </div>

              {alert.last_notified_at && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Last notified: {formatDate(alert.last_notified_at)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences Update Card */}
          {!isCancelled && (
            <Card>
              <CardHeader>
                <CardTitle>Update Your Preferences</CardTitle>
                <CardDescription>
                  Select the number of bedrooms you're interested in. You'll receive email
                  notifications when new properties matching your criteria are listed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm font-semibold">I'm interested in properties with:</p>
                  <div className="space-y-3">
                    {bedroomOptions.map((bedroom) => (
                      <div key={bedroom} className="flex items-center space-x-3">
                        <Checkbox
                          id={`bedroom-${bedroom}`}
                          checked={selectedBedrooms.includes(bedroom)}
                          onCheckedChange={() => handleBedroomToggle(bedroom)}
                        />
                        <label
                          htmlFor={`bedroom-${bedroom}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {formatBedroomText(bedroom)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t flex gap-3">
                  <Button 
                    onClick={handleUpdatePreferences}
                    disabled={updating || selectedBedrooms.length === 0 || 
                      JSON.stringify(selectedBedrooms.sort()) === JSON.stringify(alert.bedrooms.sort())}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {updating ? 'Updating...' : 'Update Preferences'}
                  </Button>

                  {JSON.stringify(selectedBedrooms.sort()) !== JSON.stringify(alert.bedrooms.sort()) && (
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedBedrooms(alert.bedrooms)}
                      disabled={updating}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancel Alerts Card */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">
                {isCancelled ? 'Alerts Cancelled' : 'Cancel All Alerts'}
              </CardTitle>
              <CardDescription>
                {isCancelled 
                  ? 'Your property alerts have been cancelled. You will no longer receive notifications about new listings.'
                  : 'Stop receiving property notifications from Bridge Auctioneers.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isCancelled && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={updating}>
                      Cancel All Alerts
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop all property notifications. You can always sign up
                        again later if you change your mind.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, keep my alerts</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleCancelAlerts}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Yes, cancel alerts
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Need help? Contact Bridge Auctioneers directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
