import { useState, lazy, Suspense, Component, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Image, Share2, Bot, Palette, FileText, Loader2, AlertTriangle } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { getRegionConfig } from "@/lib/locale/config";

// Lazy-load ALL sub-components to isolate import-level failures
const AdminBranding = lazy(() => import("./AdminBranding"));
const AdminContent = lazy(() => import("./AdminContent"));
const AdminTestimonials = lazy(() => import("./AdminTestimonials"));
const AdminMarketingContent = lazy(() => import("./AdminMarketingContent"));
const AdminSocialLinks = lazy(() => import("./AdminSocialLinks"));
const AdminAIAssistant = lazy(() => import("./AdminAIAssistant"));

// Error boundary for individual sub-tabs
class SubTabErrorBoundary extends Component<
  { children: ReactNode; name: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[AdminWebsiteSettings] ${this.props.name} crashed:`, error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load {this.props.name}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="text-sm text-primary underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TabLoader = () => (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function LazyTab({ name, children }: { name: string; children: ReactNode }) {
  return (
    <SubTabErrorBoundary name={name}>
      <Suspense fallback={<TabLoader />}>
        {children}
      </Suspense>
    </SubTabErrorBoundary>
  );
}

export default function AdminWebsiteSettings() {
  const [activeTab, setActiveTab] = useState("branding");
  const { locale } = useLocale();
  const customizeWord = getRegionConfig(locale).spelling === 'american' ? 'Customize' : 'Customise';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Website Settings</h2>
        <p className="text-muted-foreground">{customizeWord} your public-facing website content and features</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 justify-start p-1 mb-6">
          <TabsTrigger value="branding" className="gap-2" data-testid="tab-website-branding">
            <Palette className="h-4 w-4" />
            <span>Branding</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2" data-testid="tab-website-content">
            <FileText className="h-4 w-4" />
            <span>Content</span>
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-2" data-testid="tab-website-testimonials">
            <Star className="h-4 w-4" />
            <span>Testimonials</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2" data-testid="tab-website-marketing">
            <Image className="h-4 w-4" />
            <span>Marketing</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2" data-testid="tab-website-social">
            <Share2 className="h-4 w-4" />
            <span>Social Links</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2" data-testid="tab-website-ai">
            <Bot className="h-4 w-4" />
            <span>AI Assistant</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-0">
          <LazyTab name="Branding">
            <AdminBranding />
          </LazyTab>
        </TabsContent>
        <TabsContent value="content" className="mt-0">
          <LazyTab name="Content">
            <AdminContent />
          </LazyTab>
        </TabsContent>
        <TabsContent value="testimonials" className="mt-0">
          <LazyTab name="Testimonials">
            <AdminTestimonials />
          </LazyTab>
        </TabsContent>
        <TabsContent value="marketing" className="mt-0">
          <LazyTab name="Marketing">
            <AdminMarketingContent />
          </LazyTab>
        </TabsContent>
        <TabsContent value="social" className="mt-0">
          <LazyTab name="Social Links">
            <AdminSocialLinks />
          </LazyTab>
        </TabsContent>
        <TabsContent value="ai" className="mt-0">
          <LazyTab name="AI Assistant">
            <AdminAIAssistant />
          </LazyTab>
        </TabsContent>
      </Tabs>
    </div>
  );
}
