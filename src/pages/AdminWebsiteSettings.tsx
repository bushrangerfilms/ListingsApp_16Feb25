import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Image, Share2, Bot, Palette, FileText } from "lucide-react";

import AdminTestimonials from "./AdminTestimonials";
import AdminMarketingContent from "./AdminMarketingContent";
import AdminSocialLinks from "./AdminSocialLinks";
import AdminAIAssistant from "./AdminAIAssistant";
import AdminBranding from "./AdminBranding";
import AdminContent from "./AdminContent";

export default function AdminWebsiteSettings() {
  const [activeTab, setActiveTab] = useState("branding");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Website Settings</h2>
        <p className="text-muted-foreground">Customise your public-facing website content and features</p>
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
          <AdminBranding />
        </TabsContent>
        <TabsContent value="content" className="mt-0">
          <AdminContent />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-0">
          <AdminTestimonials />
        </TabsContent>
        <TabsContent value="marketing" className="mt-0">
          <AdminMarketingContent />
        </TabsContent>
        <TabsContent value="social" className="mt-0">
          <AdminSocialLinks />
        </TabsContent>
        <TabsContent value="ai" className="mt-0">
          <AdminAIAssistant />
        </TabsContent>
      </Tabs>
    </div>
  );
}
