import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  category: string;
  subject: string;
  body_html: string;
  available_variables: any;
  description: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const inferCategory = (templateKey: string): string => {
  const adminKeywords = ['admin', 'notification', 'reminder', 'summary', 'invitation', 'team'];
  return adminKeywords.some(kw => templateKey.toLowerCase().includes(kw)) ? 'admin' : 'customer';
};

export default function AdminEmailTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("customer");

  const { data: emailTemplates = [], isLoading: loading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('email_templates')
        .select('id, template_key, template_name, category, subject, body_html, available_variables, description, is_active, last_sent_at')
        .order('template_name', { ascending: true });

      if (error) throw error;

      const templatesWithCategory = (data || []).map((t: any) => ({
        ...t,
        category: t.category || inferCategory(t.template_key)
      })) as EmailTemplate[];

      return templatesWithCategory;
    },
  });

  // Set up real-time subscription to invalidate the query cache
  useEffect(() => {
    const channel = supabase
      .channel('email-templates-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_templates' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['email-templates'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleSaveTemplate = async (template: EmailTemplate) => {
    try {
      const { error } = await (supabase as any)
        .from('email_templates')
        .update({
          subject: template.subject,
          body_html: template.body_html,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template updated successfully');
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const customerTemplates = emailTemplates.filter(t => t.category === 'customer');
  const adminTemplates = emailTemplates.filter(t => t.category === 'admin');

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/communications")}
          className="mb-4 gap-2"
          data-testid="button-back-communications"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communications
        </Button>
        <h1 className="text-3xl font-bold mb-2">Email Templates</h1>
        <p className="text-muted-foreground">
          Manage email templates for customer communications and admin notifications
        </p>
      </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList>
            <TabsTrigger value="customer">
              Customer Emails ({customerTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="admin">
              Admin Notifications ({adminTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="space-y-4 mt-6">
            {customerTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">
                    No customer email templates found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {customerTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{template.template_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <p className="text-sm font-mono text-muted-foreground">
                            Key: {template.template_key}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={template.is_active ? 'default' : 'secondary'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Subject:</p>
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      </div>
                      {template.last_sent_at && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Send className="h-4 w-4" />
                          <span>Last sent: {formatDate(template.last_sent_at)}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t">
                        <Dialog open={templateDialogOpen && editingTemplate?.id === template.id} onOpenChange={(open) => {
                          setTemplateDialogOpen(open);
                          if (!open) setEditingTemplate(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="gap-2"
                              onClick={() => setEditingTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                              Edit Template
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Email Template</DialogTitle>
                              <DialogDescription>
                                Update the subject and body of the email template. Available variables are shown below.
                              </DialogDescription>
                            </DialogHeader>
                            {editingTemplate && editingTemplate.id === template.id && (
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="subject">Subject</Label>
                                  <Input
                                    id="subject"
                                    value={editingTemplate.subject}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="body">Email Body (HTML)</Label>
                                  <Textarea
                                    id="body"
                                    value={editingTemplate.body_html}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, body_html: e.target.value })}
                                    rows={12}
                                    className="mt-1 font-mono text-sm"
                                  />
                                </div>
                                <div className="p-4 bg-muted rounded-lg">
                                  <p className="text-sm font-semibold mb-2">Available Variables:</p>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {Object.entries(editingTemplate.available_variables || {}).map(([key, description]) => (
                                      <div key={key} className="font-mono">
                                        <span className="text-primary">{`{${key}}`}</span> - {String(description)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => {
                                    setTemplateDialogOpen(false);
                                    setEditingTemplate(null);
                                  }}>
                                    Cancel
                                  </Button>
                                  <Button onClick={() => handleSaveTemplate(editingTemplate)}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="admin" className="space-y-4 mt-6">
            {adminTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">
                    No admin email templates found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {adminTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{template.template_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <p className="text-sm font-mono text-muted-foreground">
                            Key: {template.template_key}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={template.is_active ? 'default' : 'secondary'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Subject:</p>
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      </div>
                      {template.last_sent_at && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Send className="h-4 w-4" />
                          <span>Last sent: {formatDate(template.last_sent_at)}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t">
                        <Dialog open={templateDialogOpen && editingTemplate?.id === template.id} onOpenChange={(open) => {
                          setTemplateDialogOpen(open);
                          if (!open) setEditingTemplate(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="gap-2"
                              onClick={() => setEditingTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                              Edit Template
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Email Template</DialogTitle>
                              <DialogDescription>
                                Update the subject and body of the email template. Available variables are shown below.
                              </DialogDescription>
                            </DialogHeader>
                            {editingTemplate && editingTemplate.id === template.id && (
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="subject">Subject</Label>
                                  <Input
                                    id="subject"
                                    value={editingTemplate.subject}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="body">Email Body (HTML)</Label>
                                  <Textarea
                                    id="body"
                                    value={editingTemplate.body_html}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, body_html: e.target.value })}
                                    rows={12}
                                    className="mt-1 font-mono text-sm"
                                  />
                                </div>
                                <div className="p-4 bg-muted rounded-lg">
                                  <p className="text-sm font-semibold mb-2">Available Variables:</p>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {Object.entries(editingTemplate.available_variables || {}).map(([key, description]) => (
                                      <div key={key} className="font-mono">
                                        <span className="text-primary">{`{${key}}`}</span> - {String(description)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => {
                                    setTemplateDialogOpen(false);
                                    setEditingTemplate(null);
                                  }}>
                                    Cancel
                                  </Button>
                                  <Button onClick={() => handleSaveTemplate(editingTemplate)}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
