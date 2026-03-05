import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, Mail, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function PilotAccessRequest() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleInviteCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      setCodeError('Please enter an invite code');
      return;
    }

    setCodeError(null);
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
        setCodeError('Something went wrong. Please try again.');
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

        setCodeError(null);
        toast.success('Invite code accepted! Redirecting to signup...');
        navigate('/signup?invited=true');
      } else {
        setCodeError('This invite code is not valid. Please double-check the code from your invitation email — codes are not case sensitive but must match exactly.');
        setIsValidating(false);
      }
    } catch (err) {
      console.error('Error validating invite code:', err);
      setCodeError('Something went wrong. Please try again.');
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
          <form onSubmit={handleInviteCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite Code</Label>
              <Input
                id="inviteCode"
                data-testid="input-invite-code"
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setCodeError(null); }}
                className={`text-center uppercase ${codeError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                autoComplete="off"
                autoFocus
              />
              {codeError && (
                <p className="text-sm text-red-600 dark:text-red-400">{codeError}</p>
              )}
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

          <div className="pt-4 border-t text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Don't have an invite code? Apply to join our pilot program and we'll be in touch.
            </p>
            <Link to="/admin/login?waitingList=true">
              <Button variant="secondary" className="w-full gap-2" data-testid="button-join-waiting-list">
                <Mail className="h-4 w-4" />
                Join Waiting List
              </Button>
            </Link>
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
