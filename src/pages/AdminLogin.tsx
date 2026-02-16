import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Rocket, Check, Zap, Building2, Mail, Send, Play, X } from 'lucide-react';
import { SEO } from '@/components/SEO';

const PILOT_FEATURES = [
  'Automated social media posting',
  'Automated video generation',
  'Company website (Optional)',
  'Property listings management',
  'CRM & contact management',
  'Email automation',
  'AI assistant',
  'Priority support',
];

export default function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestFullName, setRequestFullName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestAvgListings, setRequestAvgListings] = useState('');
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const videoSessionIdRef = useRef<string | null>(null);
  const videoMilestonesRef = useRef<Set<string>>(new Set());
  const videoStartTimeRef = useRef<number | null>(null);

  const trackVideoEvent = async (eventType: string, maxPercentage: number = 0) => {
    if (!videoSessionIdRef.current) return;
    
    const watchTimeSeconds = videoStartTimeRef.current 
      ? Math.floor((Date.now() - videoStartTimeRef.current) / 1000)
      : 0;
    
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-video-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: videoSessionIdRef.current,
          event_type: eventType,
          max_percentage: maxPercentage,
          video_duration_seconds: videoRef.current?.duration ? Math.floor(videoRef.current.duration) : null,
          watch_time_seconds: watchTimeSeconds,
          referrer: document.referrer || null,
        }),
      });
    } catch (error) {
      console.error('Failed to track video event:', error);
    }
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    trackVideoEvent('complete', 100);
  };

  const handleVideoPause = () => {
    setIsVideoPlaying(false);
    if (videoRef.current) {
      const percentage = Math.floor((videoRef.current.currentTime / videoRef.current.duration) * 100);
      trackVideoEvent('pause', percentage);
    }
  };

  const handleVideoPlay = () => {
    setIsVideoPlaying(true);
    if (!videoSessionIdRef.current) {
      videoSessionIdRef.current = crypto.randomUUID();
      videoMilestonesRef.current.clear();
      videoStartTimeRef.current = Date.now();
      trackVideoEvent('play', 0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !videoSessionIdRef.current) return;
    
    const percentage = Math.floor((videoRef.current.currentTime / videoRef.current.duration) * 100);
    
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      if (percentage >= milestone && !videoMilestonesRef.current.has(`progress_${milestone}`)) {
        videoMilestonesRef.current.add(`progress_${milestone}`);
        trackVideoEvent(`progress_${milestone}`, percentage);
      }
    }
  };

  useEffect(() => {
    if (isVideoDialogOpen) {
      const timer = setTimeout(() => {
        setIsVideoReady(true);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVideoDialogOpen]);

  useEffect(() => {
    console.log('Auth state:', { loading, user: !!user, isAdmin, returnUrl });
    
    if (!loading && user && isAdmin) {
      const targetUrl = returnUrl || '/admin/listings';
      console.log('Redirecting to:', targetUrl);
      
      if (returnUrl && (returnUrl.startsWith('http://') || returnUrl.startsWith('https://'))) {
        setTimeout(() => {
          console.log('Redirecting to external URL:', returnUrl);
          window.location.replace(returnUrl);
        }, 100);
      } else {
        navigate(targetUrl);
      }
    } else if (!loading && user && !isAdmin) {
      console.log('User authenticated but not admin');
      setNotAuthorized(true);
    }
  }, [user, isAdmin, loading, navigate, returnUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (mode === 'password' && !password) {
      toast.error('Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        toast.success('Login successful!');
      } else {
        const redirectTo = returnUrl 
          ? `${window.location.origin}/admin/login?returnUrl=${encodeURIComponent(returnUrl)}`
          : `${window.location.origin}/admin/login`;
        
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        
        if (error) throw error;
        setEmailSent(true);
        toast.success('Check your email for the login link!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requestFullName) {
      toast.error('Please enter your full name');
      return;
    }

    if (!requestEmail) {
      toast.error('Please enter your email');
      return;
    }

    setIsRequestSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-pilot-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            fullName: requestFullName,
            email: requestEmail,
            phone: requestPhone,
            avgListings: requestAvgListings,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send request');
      }

      setRequestSent(true);
      toast.success('Request sent successfully!');
    } catch (error: any) {
      console.error('Request error:', error);
      toast.error(error.message || 'Failed to send request. Please try again.');
    } finally {
      setIsRequestSubmitting(false);
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
        title="Admin Login"
        description="Sign in to access the admin dashboard"
      />
      <div className="min-h-screen overflow-auto bg-background p-4 flex items-start lg:items-center justify-center">
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl my-auto py-4">
          <Card className="bg-[#4338CA] text-white flex-1">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="/autolisting-logo.png" 
                  alt="AutoListing.io" 
                  className="h-14 w-14 rounded-lg"
                  data-testid="img-autolisting-logo"
                />
                <div>
                  <CardTitle className="text-2xl">AutoListing.io</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Rocket className="h-4 w-4" />
                    <span className="text-sm font-medium opacity-90">Pilot Program</span>
                  </div>
                </div>
              </div>
              <CardDescription className="text-white/80">
                We're currently in a Pilot Program and not available to the public yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-white/10">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Full Platform Access</p>
                    <p className="text-sm text-white/70">All features unlocked</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-white/10">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Unlimited Credits</p>
                    <p className="text-sm text-white/70">Use all AI & automation features</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-white/10">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Your Own Organization</p>
                    <p className="text-sm text-white/70">Create a dedicated workspace</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">What's included:</p>
                <ul className="space-y-1">
                  {PILOT_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-400 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setIsVideoDialogOpen(true)}
                className="w-full relative rounded-lg overflow-hidden transition-colors cursor-pointer group"
                data-testid="button-open-demo-video"
              >
                <div 
                  className="aspect-video flex items-center justify-center bg-cover bg-center"
                  style={{ backgroundImage: 'url(https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/video-thumbnail.png)' }}
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-all group-hover:scale-110 shadow-lg">
                    <Play className="w-7 h-7 text-[#4338CA] ml-1" fill="currentColor" />
                  </div>
                </div>
                <p className="text-base font-medium text-white text-center py-3">Watch the 2 min demo video</p>
              </button>

              <Dialog open={isVideoDialogOpen} onOpenChange={(open) => {
                setIsVideoDialogOpen(open);
                if (!open && videoRef.current) {
                  videoRef.current.pause();
                  setIsVideoPlaying(false);
                  setIsVideoReady(false);
                  videoSessionIdRef.current = null;
                  videoMilestonesRef.current.clear();
                  videoStartTimeRef.current = null;
                }
              }}>
                <DialogContent className="max-w-[75vw] p-0 bg-black border-none overflow-hidden [&>button]:hidden">
                  <div className="relative">
                    <button
                      onClick={() => setIsVideoDialogOpen(false)}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                      data-testid="button-close-video"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                    <div className="aspect-video">
                      {!isVideoReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                          <div className="text-center">
                            <Loader2 className="w-10 h-10 text-white animate-spin mx-auto mb-2" />
                            <p className="text-white/70 text-sm">Loading video...</p>
                          </div>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        className={`w-full h-full object-contain ${!isVideoReady ? 'opacity-0' : 'opacity-100'}`}
                        onEnded={handleVideoEnded}
                        onPause={handleVideoPause}
                        onPlay={handleVideoPlay}
                        onTimeUpdate={handleVideoTimeUpdate}
                        controls
                        preload="auto"
                        poster="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/video-thumbnail.png"
                        data-testid="video-demo"
                      >
                        <source src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/pilot-program-demo.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex gap-2">
                <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="secondary" 
                      className="flex-1 gap-2"
                      data-testid="button-request-access"
                    >
                      <Mail className="h-4 w-4" />
                      Join Waiting List
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Your Details</DialogTitle>
                  </DialogHeader>
                  {!requestSent ? (
                    <form onSubmit={handleRequestAccess} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="request-fullname">Full Name</Label>
                        <Input
                          id="request-fullname"
                          type="text"
                          placeholder="John Smith"
                          value={requestFullName}
                          onChange={(e) => setRequestFullName(e.target.value)}
                          required
                          data-testid="input-request-fullname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="request-email">Email</Label>
                        <Input
                          id="request-email"
                          type="email"
                          placeholder="you@example.com"
                          value={requestEmail}
                          onChange={(e) => setRequestEmail(e.target.value)}
                          required
                          data-testid="input-request-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="request-phone">Phone Number</Label>
                        <Input
                          id="request-phone"
                          type="tel"
                          placeholder="+353 87 123 4567"
                          value={requestPhone}
                          onChange={(e) => setRequestPhone(e.target.value)}
                          data-testid="input-request-phone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="request-listings">Average Active Listings</Label>
                        <Input
                          id="request-listings"
                          type="text"
                          placeholder="e.g., 10-20"
                          value={requestAvgListings}
                          onChange={(e) => setRequestAvgListings(e.target.value)}
                          data-testid="input-request-listings"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full gap-2" 
                        disabled={isRequestSubmitting}
                        data-testid="button-submit-request"
                      >
                        {isRequestSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Join Waiting List
                          </>
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">Request Sent!</p>
                        <p className="text-sm text-muted-foreground">
                          We'll review your request and get back to you soon.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setRequestDialogOpen(false);
                          setRequestSent(false);
                          setRequestFullName('');
                          setRequestEmail('');
                          setRequestPhone('');
                          setRequestAvgListings('');
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </DialogContent>
                </Dialog>
                <Button 
                  className="flex-1 bg-[#4338CA] hover:bg-[#4338CA]/90"
                  onClick={() => window.location.href = '/pilot-access'}
                  data-testid="button-pilot-invite-code"
                >
                  Enter Pilot Invite Code
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex-1 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>
                {notAuthorized
                  ? "You're signed in but don't have admin access. Please contact an administrator."
                  : emailSent
                  ? "Check your email for a login link. It may take a few minutes to arrive."
                  : "Enter your credentials to sign in"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!emailSent ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-muted rounded-lg mb-4">
                    <Button
                      type="button"
                      variant={mode === 'password' ? 'default' : 'ghost'}
                      size="sm"
                      className={`flex-1 ${mode === 'password' ? 'bg-[#4338CA] hover:bg-[#4338CA]/90' : ''}`}
                      onClick={() => setMode('password')}
                      data-testid="button-mode-password"
                    >
                      Password
                    </Button>
                    <Button
                      type="button"
                      variant={mode === 'magic' ? 'default' : 'ghost'}
                      size="sm"
                      className={`flex-1 ${mode === 'magic' ? 'bg-[#4338CA] hover:bg-[#4338CA]/90' : ''}`}
                      onClick={() => setMode('magic')}
                      data-testid="button-mode-magic"
                    >
                      Magic Link
                    </Button>
                  </div>

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
                      data-testid="input-email"
                    />
                  </div>

                  {mode === 'password' && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        data-testid="input-password"
                      />
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full bg-[#4338CA] hover:bg-[#4338CA]/90" 
                    disabled={isSubmitting}
                    data-testid="button-login"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {mode === 'password' ? 'Logging in...' : 'Sending link...'}
                      </>
                    ) : (
                      mode === 'password' ? 'Login' : 'Send Login Link'
                    )}
                  </Button>

                  </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-sm text-muted-foreground">
                    <p>A secure login link has been sent to your email.</p>
                    <p className="mt-2">Click the link in the email to sign in.</p>
                  </div>
                  <Button 
                    onClick={() => setEmailSent(false)} 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-send-another"
                  >
                    Send Another Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </>
  );
}
