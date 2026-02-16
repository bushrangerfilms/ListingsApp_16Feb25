import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function AdminSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminExists, setAdminExists] = useState(false);

  // Check if admin exists and redirect if already logged in
  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .maybeSingle();
      
      setAdminExists(!!data);
    };
    
    checkAdmin();
    
    if (!loading && user) {
      const targetUrl = returnUrl || '/admin/listings';
      if (returnUrl && (returnUrl.startsWith('http://') || returnUrl.startsWith('https://'))) {
        window.location.replace(returnUrl);
      } else {
        navigate(targetUrl);
      }
    }
  }, [user, loading, navigate, returnUrl]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!gdprConsent) {
      toast.error('Please accept the privacy policy to continue');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetUrl = returnUrl || '/admin/listings';
      const redirectUrl = returnUrl 
        ? `${window.location.origin}/admin/signup?returnUrl=${encodeURIComponent(returnUrl)}`
        : `${window.location.origin}/admin/listings`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      if (data.user) {
        // Attempt to bootstrap first admin
        await supabase
          .from('user_roles')
          .insert({ user_id: data.user.id, role: 'admin' })
          .select()
          .maybeSingle();
        
        toast.success('Account created successfully!');
        
        if (returnUrl && (returnUrl.startsWith('http://') || returnUrl.startsWith('https://'))) {
          window.location.replace(returnUrl);
        } else {
          navigate(targetUrl);
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Admin Signup"
        description="Create an admin account"
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>
              {adminExists 
                ? "Admin account already configured. Please log in instead."
                : "Sign up to become the administrator"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {adminExists ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  An administrator account has already been set up for this system.
                </p>
                <Link to="/admin/login">
                  <Button className="w-full">Go to Login</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="gdpr"
                  checked={gdprConsent}
                  onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                  required
                />
                <label
                  htmlFor="gdpr"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{' '}
                  <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
                    Privacy Policy
                  </Link>
                  {' '}and{' '}
                  <Link to="/terms-conditions" className="text-primary hover:underline" target="_blank">
                    Terms & Conditions
                  </Link>
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link to="/admin/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
