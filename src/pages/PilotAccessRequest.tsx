import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, Mail, ArrowLeft, KeyRound, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function PilotAccessRequest() {
  const navigate = useNavigate();
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleInviteCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setIsValidating(true);

    try {
      const { data, error } = await (supabase as any)
        .from('pilot_invite_codes')
        .select('id, code, is_active, usage_count')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error validating invite code:', error);
        toast.error('Error validating code. Please try again.');
        setIsValidating(false);
        return;
      }

      if (data) {
        // Atomically increment usage count
        const { error: incrementError } = await (supabase as any)
          .rpc('increment_invite_code_usage', { code_value: data.code });
        
        if (incrementError) {
          console.warn('Failed to increment usage count:', incrementError);
        }

        toast.success('Invite code accepted! Redirecting to signup...');
        navigate('/signup?invited=true');
      } else {
        toast.error('Invalid invite code. Please check and try again.');
        setIsValidating(false);
      }
    } catch (err) {
      console.error('Error validating invite code:', err);
      toast.error('Error validating code. Please try again.');
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pilot Program</CardTitle>
          <CardDescription className="text-base">
            This site is currently in a Pilot Program phase before public release.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              To request access to the Pilot Program please email:
            </p>
            <a 
              href="mailto:peter@streamlinedai.tech"
              className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
              data-testid="link-pilot-email"
            >
              <Mail className="h-4 w-4" />
              peter@streamlinedai.tech
            </a>
          </div>

          <div className="pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowInviteCode(!showInviteCode)}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              data-testid="button-toggle-invite-code"
            >
              <KeyRound className="h-4 w-4" />
              Have an invite code?
              {showInviteCode ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showInviteCode && (
              <form onSubmit={handleInviteCodeSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    data-testid="input-invite-code"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="text-center uppercase"
                    autoComplete="off"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gap-2" 
                  disabled={isValidating}
                  data-testid="button-submit-invite-code"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Submit Invite Code
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
          
          <div className="pt-4 border-t">
            <Link to="/admin/login">
              <Button variant="outline" className="w-full gap-2" data-testid="button-back-to-login">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
