import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Settings, LineChart, TestTube, Rocket } from "lucide-react";
import { KnowledgeBaseUploader } from "@/components/ai-assistant/KnowledgeBaseUploader";
import { DocumentsList } from "@/components/ai-assistant/DocumentsList";
import { PropertyDataConfig } from "@/components/ai-assistant/PropertyDataConfig";
import { TrainingConfig } from "@/components/ai-assistant/TrainingConfig";
import { TrainingMetrics } from "@/components/ai-assistant/TrainingMetrics";
import { TrainingActions } from "@/components/ai-assistant/TrainingActions";
import { ChatTester } from "@/components/ai-assistant/ChatTester";
import { ConversationExamples } from "@/components/ai-assistant/ConversationExamples";
import { IntegrationConfig } from "@/components/ai-assistant/IntegrationConfig";
import { useLocale } from "@/hooks/useLocale";

const AdminAIAssistant = () => {
  const [activeTab, setActiveTab] = useState("knowledge");
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-ai-assistant-title">
          {t('ai-assistant.page.title')}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t('ai-assistant.page.description')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="knowledge" className="flex items-center gap-2" data-testid="tab-knowledge">
            <Database className="h-4 w-4" />
            {t('ai-assistant.tabs.knowledge')}
          </TabsTrigger>
          <TabsTrigger value="training" className="flex items-center gap-2" data-testid="tab-training">
            <Settings className="h-4 w-4" />
            {t('ai-assistant.tabs.training')}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2" data-testid="tab-metrics">
            <LineChart className="h-4 w-4" />
            {t('ai-assistant.tabs.metrics')}
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2" data-testid="tab-testing">
            <TestTube className="h-4 w-4" />
            {t('ai-assistant.tabs.testing')}
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2" data-testid="tab-integration">
            <Rocket className="h-4 w-4" />
            {t('ai-assistant.tabs.integration')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-6">
          <PropertyDataConfig />
          
          <div className="grid gap-6 md:grid-cols-2">
            <KnowledgeBaseUploader 
              onUploadComplete={() => {
                // Refresh documents list
                window.location.reload();
              }} 
            />
            <DocumentsList />
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-6">
          <TrainingConfig />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <TrainingMetrics />
          <TrainingActions />
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <ChatTester />
          <ConversationExamples />
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          <IntegrationConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAIAssistant;
