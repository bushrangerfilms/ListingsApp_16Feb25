import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  Building2, 
  LayoutDashboard,
  Mail,
  Sparkles,
  Calendar,
  Clock
} from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { TRIAL_CREDITS } from '@/lib/billing/billingClient';
import { format, formatDistanceToNow } from 'date-fns';

interface LocationState {
  trialEndsAt?: string;
  trialCredits?: number;
  businessName?: string;
  isPilot?: boolean;
}

export default function SignupSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  
  const [countdown, setCountdown] = useState(15);
  
  const trialCredits = state?.trialCredits || TRIAL_CREDITS;
  const businessName = state?.businessName || 'your organization';
  const trialEndsAt = state?.trialEndsAt ? new Date(state.trialEndsAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const isPilot = state?.isPilot || false;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/admin/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <MarketingLayout hideHeader hideFooter>
      <div className="min-h-screen py-12 px-4 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">
              {isPilot ? 'Welcome to the Pilot Program!' : 'Welcome to AutoListing.io!'}
            </CardTitle>
            <CardDescription>
              {isPilot 
                ? 'Thank you for joining our exclusive pilot' 
                : 'Your 14-day free trial has started'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Organization
                </span>
                <span className="font-medium text-sm text-foreground">{businessName}</span>
              </div>
              {isPilot ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Access Level
                  </span>
                  <Badge variant="secondary">Pilot Member</Badge>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Trial Credits
                    </span>
                    <Badge variant="secondary">{trialCredits} credits</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Trial Ends
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {format(trialEndsAt, 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time Remaining
                    </span>
                    <Badge variant="outline">
                      {formatDistanceToNow(trialEndsAt, { addSuffix: false })}
                    </Badge>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                What's Next?
              </h3>
              <ul className="space-y-2 text-sm">
                {!isPilot && (
                  <li className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>Check your email to verify your account and sign in</span>
                  </li>
                )}
                <li className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>Customise your organisation settings and branding</span>
                </li>
                <li className="flex items-start gap-3">
                  <LayoutDashboard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>Add your first property listing</span>
                </li>
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">
                    {isPilot ? 'Full access included' : 'Your trial includes full access'}
                  </p>
                  <p className="text-muted-foreground">
                    {isPilot 
                      ? 'As a pilot member, you have full access to all features. Your feedback helps us improve the platform.'
                      : `Use your ${trialCredits} trial credits to try AI features and automation. When you're ready, choose a plan starting at €29/month.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                className="w-full" 
                onClick={() => navigate('/admin/login')}
                data-testid="button-go-login"
              >
                Sign In to Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Redirecting to login in {countdown} seconds...
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
