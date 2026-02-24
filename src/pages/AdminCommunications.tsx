import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, Calendar, CheckCircle, MapPin, Bell, BellOff, FileText, Edit, Send } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Enquiry {
  id: string;
  property_id: string;
  property_title: string;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  created_at: string;
  status: string;
  contacted_at: string | null;
}

interface ValuationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_address: string;
  message: string | null;
  created_at: string;
  status: string;
  contacted_at: string | null;
}

interface PropertyAlert {
  id: string;
  name: string;
  email: string;
  phone: string;
  bedrooms: number[];
  comments: string | null;
  status: string;
  created_at: string;
  contacted_at: string | null;
  last_notified_at: string | null;
  notification_count: number;
  crm_record_id: string | null;
}

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

export default function AdminCommunications() {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [valuations, setValuations] = useState<ValuationRequest[]>([]);
  const [propertyAlerts, setPropertyAlerts] = useState<PropertyAlert[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("enquiries");
  const [enquiryFilter, setEnquiryFilter] = useState<string>("all");
  const [valuationFilter, setValuationFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const targetOrgId = targetOrg?.id;

  useEffect(() => {
    if (!targetOrgId) return;
    
    fetchCommunications();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('communications-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_enquiries' },
        fetchCommunications
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'valuation_requests' },
        fetchCommunications
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_alerts' },
        fetchCommunications
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_templates' },
        fetchCommunications
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetOrgId]);

  const fetchCommunications = async () => {
    // CRITICAL: Filter by organization_id for multi-tenant security
    if (!targetOrgId) return;
    
    try {
      setLoading(true);
      
      // Fetch all in parallel - ALL QUERIES MUST INCLUDE organization_id FILTER
      const [propertyEnquiriesResult, valuationRequestsResult, propertyAlertsResult, emailTemplatesResult] = await Promise.all([
        supabase
          .from('property_enquiries')
          .select('*')
          .eq('organization_id', targetOrgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('valuation_requests')
          .select('*')
          .eq('organization_id', targetOrgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('property_alerts')
          .select('*')
          .eq('organization_id', targetOrgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('email_templates')
          .select('*')
          .eq('organization_id', targetOrgId)
          .order('category', { ascending: true })
      ]);

      if (propertyEnquiriesResult.error) throw propertyEnquiriesResult.error;
      if (valuationRequestsResult.error) throw valuationRequestsResult.error;
      if (propertyAlertsResult.error) throw propertyAlertsResult.error;
      if (emailTemplatesResult.error) throw emailTemplatesResult.error;

      setEnquiries(propertyEnquiriesResult.data || []);
      setValuations(valuationRequestsResult.data || []);
      setPropertyAlerts(propertyAlertsResult.data || []);
      setEmailTemplates(emailTemplatesResult.data || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
      toast.error('Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkContacted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('property_enquiries')
        .update({ 
          status: 'contacted',
          contacted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Marked as contacted');
      fetchCommunications();
    } catch (error) {
      console.error('Error updating enquiry:', error);
      toast.error('Failed to update enquiry');
    }
  };

  const handleMarkValuationContacted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('valuation_requests')
        .update({ 
          status: 'contacted',
          contacted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Marked as contacted');
      fetchCommunications();
    } catch (error) {
      console.error('Error updating valuation request:', error);
      toast.error('Failed to update valuation request');
    }
  };

  const handleMarkAlertContacted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('property_alerts')
        .update({ 
          contacted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Marked as contacted');
      fetchCommunications();
    } catch (error) {
      console.error('Error updating property alert:', error);
      toast.error('Failed to update property alert');
    }
  };

  const handleCancelAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('property_alerts')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Alert cancelled');
      fetchCommunications();
    } catch (error) {
      console.error('Error cancelling alert:', error);
      toast.error('Failed to cancel alert');
    }
  };

  const handleSaveTemplate = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
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
      fetchCommunications();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const filteredEnquiries = enquiries.filter(enquiry => {
    if (enquiryFilter === "all") return true;
    return enquiry.status === enquiryFilter;
  });

  const filteredValuations = valuations.filter(valuation => {
    if (valuationFilter === "all") return true;
    return valuation.status === valuationFilter;
  });

  const filteredPropertyAlerts = propertyAlerts.filter(alert => {
    if (alertFilter === "all") return true;
    return alert.status === alertFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">New</Badge>;
      case 'contacted':
        return <Badge variant="secondary">Contacted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
        <h1 className="text-3xl font-bold mb-2">Communications</h1>
        <p className="text-muted-foreground">
          Manage enquiries and valuation requests
        </p>
      </div>

        {/* Main Communication Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="enquiries">
              Property Enquiries ({enquiries.length})
            </TabsTrigger>
            <TabsTrigger value="valuations">
              Valuation Requests ({valuations.length})
            </TabsTrigger>
            <TabsTrigger value="alerts">
              Property Alerts ({propertyAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="templates">
              Email Templates ({emailTemplates.length})
            </TabsTrigger>
          </TabsList>

          {/* Property Enquiries Tab */}
          <TabsContent value="enquiries" className="space-y-6 mt-6">
            {/* Status Filters for Enquiries */}
            <Tabs value={enquiryFilter} onValueChange={setEnquiryFilter}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({enquiries.length})
                </TabsTrigger>
                <TabsTrigger value="new">
                  New ({enquiries.filter(e => e.status === 'new').length})
                </TabsTrigger>
                <TabsTrigger value="contacted">
                  Contacted ({enquiries.filter(e => e.status === 'contacted').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Enquiries List */}
            {filteredEnquiries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">
                    No property enquiries found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredEnquiries.map((enquiry) => (
                  <Card key={enquiry.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">{enquiry.property_title}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Property ID: {enquiry.property_id}
                          </p>
                        </div>
                        {getStatusBadge(enquiry.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{enquiry.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${enquiry.email}`} className="hover:underline">
                              {enquiry.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${enquiry.phone}`} className="hover:underline">
                              {enquiry.phone}
                            </a>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Received: {formatDate(enquiry.created_at)}</span>
                          </div>
                          {enquiry.contacted_at && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4" />
                              <span>Contacted: {formatDate(enquiry.contacted_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {enquiry.message && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-semibold mb-2">Message:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {enquiry.message}
                          </p>
                        </div>
                      )}

                      {enquiry.status === 'new' && (
                        <div className="pt-4 border-t flex gap-2">
                          <Button 
                            onClick={() => handleMarkContacted(enquiry.id)}
                            variant="default"
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Mark as Contacted
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => window.location.href = `mailto:${enquiry.email}`}
                          >
                            Send Email
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Valuation Requests Tab */}
          <TabsContent value="valuations" className="space-y-6 mt-6">
            {/* Status Filters for Valuations */}
            <Tabs value={valuationFilter} onValueChange={setValuationFilter}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({valuations.length})
                </TabsTrigger>
                <TabsTrigger value="new">
                  New ({valuations.filter(v => v.status === 'new').length})
                </TabsTrigger>
                <TabsTrigger value="contacted">
                  Contacted ({valuations.filter(v => v.status === 'contacted').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Valuations List */}
            {filteredValuations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">
                    No valuation requests found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredValuations.map((valuation) => (
                  <Card key={valuation.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <CardTitle className="text-xl">{valuation.property_address}</CardTitle>
                          </div>
                        </div>
                        {getStatusBadge(valuation.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{valuation.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${valuation.email}`} className="hover:underline">
                              {valuation.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${valuation.phone}`} className="hover:underline">
                              {valuation.phone}
                            </a>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Received: {formatDate(valuation.created_at)}</span>
                          </div>
                          {valuation.contacted_at && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4" />
                              <span>Contacted: {formatDate(valuation.contacted_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {valuation.message && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-semibold mb-2">Additional Information:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {valuation.message}
                          </p>
                        </div>
                      )}

                      {valuation.status === 'new' && (
                        <div className="pt-4 border-t flex gap-2">
                          <Button 
                            onClick={() => handleMarkValuationContacted(valuation.id)}
                            variant="default"
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Mark as Contacted
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => window.location.href = `mailto:${valuation.email}`}
                          >
                            Send Email
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Property Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6 mt-6">
            {/* Status Filters for Alerts */}
            <Tabs value={alertFilter} onValueChange={setAlertFilter}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({propertyAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="active">
                  Active ({propertyAlerts.filter(a => a.status === 'active').length})
                </TabsTrigger>
                <TabsTrigger value="cancelled">
                  Cancelled ({propertyAlerts.filter(a => a.status === 'cancelled').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Property Alerts List */}
            {filteredPropertyAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">
                    No property alerts found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPropertyAlerts.map((alert) => {
                  const bedroomsText = alert.bedrooms.map((b: number) => {
                    if (b === 5) return '5+ Bedrooms';
                    return `${b} Bedroom${b > 1 ? 's' : ''}`;
                  }).join(', ');

                  return (
                    <Card key={alert.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-xl flex items-center gap-2">
                              {alert.status === 'active' ? (
                                <Bell className="h-5 w-5 text-green-500" />
                              ) : (
                                <BellOff className="h-5 w-5 text-muted-foreground" />
                              )}
                              {alert.name}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Looking for: {bedroomsText}
                            </p>
                          </div>
                          <Badge variant={alert.status === 'active' ? 'default' : 'secondary'}>
                            {alert.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <a href={`mailto:${alert.email}`} className="hover:underline">
                                {alert.email}
                              </a>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <a href={`tel:${alert.phone}`} className="hover:underline">
                                {alert.phone}
                              </a>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>Registered: {formatDate(alert.created_at)}</span>
                            </div>
                            {alert.last_notified_at && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Bell className="h-4 w-4" />
                                <span>Last notified: {formatDate(alert.last_notified_at)}</span>
                              </div>
                            )}
                            {alert.contacted_at && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle className="h-4 w-4" />
                                <span>Contacted: {formatDate(alert.contacted_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline">
                            {alert.notification_count} {alert.notification_count === 1 ? 'email' : 'emails'} sent
                          </Badge>
                          {alert.crm_record_id && (
                            <span className="text-muted-foreground">
                              CRM ID: {alert.crm_record_id.substring(0, 8)}...
                            </span>
                          )}
                        </div>

                        {alert.comments && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-semibold mb-2">Comments:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {alert.comments}
                            </p>
                          </div>
                        )}

                        {alert.status === 'active' && (
                          <div className="pt-4 border-t flex gap-2">
                            {!alert.contacted_at && (
                              <Button 
                                onClick={() => handleMarkAlertContacted(alert.id)}
                                variant="default"
                                className="gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Mark as Contacted
                              </Button>
                            )}
                            <Button 
                              variant="outline"
                              onClick={() => window.location.href = `mailto:${alert.email}`}
                            >
                              Send Email
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => handleCancelAlert(alert.id)}
                            >
                              Cancel Alert
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="templates" className="space-y-6 mt-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Customer Emails</h3>
                <div className="grid gap-4">
                  {emailTemplates.filter(t => t.category === 'customer').map((template) => (
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
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Admin Notifications</h3>
                <div className="grid gap-4">
                  {emailTemplates.filter(t => t.category === 'admin').map((template) => (
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
              </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}