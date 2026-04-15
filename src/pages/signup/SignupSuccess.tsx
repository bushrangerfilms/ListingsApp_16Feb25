import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LayoutDashboard } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ConfirmBusinessEmail } from '@/components/onboarding/ConfirmBusinessEmail';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface LocationState {
  businessName?: string;
  email?: string;
  plan?: string;
}

export default function SignupSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { organization } = useOrganization();

  const businessName = state?.businessName || organization?.business_name || 'your organisation';
  const currentEmail = state?.email || (organization as any)?.contact_email || '';

  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmEmail = async (email: string) => {
    const orgId = organization?.id;
    if (orgId && email !== currentEmail) {
      const { error } = await (supabase as any)
        .from('organizations')
        .update({ contact_email: email })
        .eq('id', orgId);

      if (error) {
        console.error('Failed to update contact email:', error);
        toast.error('Failed to update email. You can change it later in Settings.');
      } else {
        toast.success('Business email updated');
      }
    }
    setConfirmed(true);
  };

  return (
    <MarketingLayout hideHeader hideFooter>
      <div className="min-h-screen py-12 px-4 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">You're all set!</CardTitle>
            <p className="text-muted-foreground mt-2">
              <strong>{businessName}</strong> has been created on the Free plan.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!confirmed ? (
              <ConfirmBusinessEmail
                currentEmail={currentEmail}
                businessName={businessName}
                onConfirm={handleConfirmEmail}
              />
            ) : (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">What's next:</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                      <span>Complete your profile (name, logo, contact details)</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                      <span>Add your first property listing</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                      <span>Connect your social media accounts</span>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => navigate('/admin/listings')}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
