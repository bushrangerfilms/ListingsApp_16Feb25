import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowRight } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { getSignupUrl } from '@/lib/appUrls';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate(returnUrl || '/admin/listings', { replace: true });
    }
  }, [user, isAdmin, loading, navigate, returnUrl]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please check your email to verify your account');
        } else {
          toast.error(error.message);
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/admin/listings`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      toast.error('Failed to send login link');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/50 to-background px-4">
      <SEO title="Log in — AutoListing.io" description="Sign in to your AutoListing account" />

      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <img
              src="/autolisting-logo.png"
              alt="AutoListing.io"
              className="h-10 w-10"
            />
            <span className="text-2xl font-bold">AutoListing.io</span>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex rounded-lg border p-1 gap-1">
              <button
                type="button"
                onClick={() => { setMode('password'); setEmailSent(false); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'password' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setMode('magic'); setEmailSent(false); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'magic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Magic Link
              </button>
            </div>

            {emailSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a login link to <strong>{email}</strong>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailSent(false)}
                >
                  Send Another Link
                </Button>
              </div>
            ) : mode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log in'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="you@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Login Link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Signup Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <a href={getSignupUrl()} className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              Start free <ArrowRight className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
