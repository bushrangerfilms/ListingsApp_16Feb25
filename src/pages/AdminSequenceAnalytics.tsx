import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PlatformHeader } from '@/components/PlatformHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  TrendingUp, 
  Mail, 
  Eye, 
  MousePointer, 
  Users,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface SequenceMetrics {
  sequence_id: string;
  sequence_name: string;
  profile_type: string;
  is_active: boolean;
  total_enrolled: number;
  total_sent: number;
  unique_opened: number;
  unique_clicked: number;
  completed: number;
  cancelled: number;
  open_rate: number;
  click_rate: number;
  completion_rate: number;
}

interface StepMetrics {
  sequence_id: string;
  step_number: number;
  template_key: string;
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
}

export default function AdminSequenceAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sequenceMetrics, setSequenceMetrics] = useState<SequenceMetrics[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [stepMetrics, setStepMetrics] = useState<StepMetrics[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (selectedSequence) {
      fetchStepMetrics(selectedSequence);
    }
  }, [selectedSequence]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all sequences
      const { data: sequences, error: seqError } = await supabase
        .from('email_sequences')
        .select('*')
        .order('created_at', { ascending: false });

      if (seqError) throw seqError;

      // Calculate metrics for each sequence
      const metrics: SequenceMetrics[] = [];

      for (const sequence of sequences || []) {
        // Get queue stats
        const { data: queueData } = await supabase
          .from('profile_email_queue')
          .select('id, status, buyer_profile_id, seller_profile_id')
          .eq('sequence_id', sequence.id);

        const totalEnrolled = new Set([
          ...((queueData || []).filter(q => q.buyer_profile_id).map(q => q.buyer_profile_id)),
          ...((queueData || []).filter(q => q.seller_profile_id).map(q => q.seller_profile_id))
        ]).size;

        const sentQueues = (queueData || []).filter(q => q.status === 'sent' || q.status === 'completed');
        const totalSent = sentQueues.length;
        const completed = (queueData || []).filter(q => q.status === 'completed').length;
        const cancelled = (queueData || []).filter(q => q.status === 'cancelled').length;

        // Get tracking data
        const queueIds = sentQueues.map(q => q.id);
        if (queueIds.length > 0) {
          const { data: trackingData } = await supabase
            .from('email_tracking')
            .select('profile_email_queue_id, event_type')
            .in('profile_email_queue_id', queueIds);

          const uniqueOpens = new Set(
            (trackingData || []).filter(t => t.event_type === 'opened').map(t => t.profile_email_queue_id)
          ).size;

          const uniqueClicks = new Set(
            (trackingData || []).filter(t => t.event_type === 'clicked').map(t => t.profile_email_queue_id)
          ).size;

          metrics.push({
            sequence_id: sequence.id,
            sequence_name: sequence.name,
            profile_type: sequence.profile_type,
            is_active: sequence.is_active,
            total_enrolled: totalEnrolled,
            total_sent: totalSent,
            unique_opened: uniqueOpens,
            unique_clicked: uniqueClicks,
            completed,
            cancelled,
            open_rate: totalSent > 0 ? Math.round((uniqueOpens / totalSent) * 100) : 0,
            click_rate: uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 100) : 0,
            completion_rate: totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0,
          });
        } else {
          metrics.push({
            sequence_id: sequence.id,
            sequence_name: sequence.name,
            profile_type: sequence.profile_type,
            is_active: sequence.is_active,
            total_enrolled: totalEnrolled,
            total_sent: 0,
            unique_opened: 0,
            unique_clicked: 0,
            completed,
            cancelled,
            open_rate: 0,
            click_rate: 0,
            completion_rate: 0,
          });
        }
      }

      setSequenceMetrics(metrics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchStepMetrics = async (sequenceId: string) => {
    try {
      // Get all steps for this sequence
      const { data: steps } = await supabase
        .from('email_sequence_steps')
        .select('step_number, template_key')
        .eq('sequence_id', sequenceId)
        .order('step_number');

      if (!steps) return;

      const stepMetricsData: StepMetrics[] = [];

      for (const step of steps) {
        // Get queue items for this step
        const { data: queueData } = await supabase
          .from('profile_email_queue')
          .select('id, status')
          .eq('sequence_id', sequenceId)
          .eq('step_number', step.step_number);

        const sentQueues = (queueData || []).filter(q => q.status === 'sent' || q.status === 'completed');
        const sent = sentQueues.length;

        if (sent > 0) {
          const queueIds = sentQueues.map(q => q.id);
          const { data: trackingData } = await supabase
            .from('email_tracking')
            .select('profile_email_queue_id, event_type')
            .in('profile_email_queue_id', queueIds);

          const opened = new Set(
            (trackingData || []).filter(t => t.event_type === 'opened').map(t => t.profile_email_queue_id)
          ).size;

          const clicked = new Set(
            (trackingData || []).filter(t => t.event_type === 'clicked').map(t => t.profile_email_queue_id)
          ).size;

          stepMetricsData.push({
            sequence_id: sequenceId,
            step_number: step.step_number,
            template_key: step.template_key,
            sent,
            opened,
            clicked,
            open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
            click_rate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
          });
        } else {
          stepMetricsData.push({
            sequence_id: sequenceId,
            step_number: step.step_number,
            template_key: step.template_key,
            sent: 0,
            opened: 0,
            clicked: 0,
            open_rate: 0,
            click_rate: 0,
          });
        }
      }

      setStepMetrics(stepMetricsData);
    } catch (error) {
      console.error('Error fetching step metrics:', error);
    }
  };

  const OverviewMetrics = () => {
    const totals = sequenceMetrics.reduce(
      (acc, m) => ({
        enrolled: acc.enrolled + m.total_enrolled,
        sent: acc.sent + m.total_sent,
        opened: acc.opened + m.unique_opened,
        clicked: acc.clicked + m.unique_clicked,
      }),
      { enrolled: 0, sent: 0, opened: 0, clicked: 0 }
    );

    const avgOpenRate = sequenceMetrics.length > 0
      ? Math.round(sequenceMetrics.reduce((sum, m) => sum + m.open_rate, 0) / sequenceMetrics.length)
      : 0;

    const avgClickRate = sequenceMetrics.length > 0
      ? Math.round(sequenceMetrics.reduce((sum, m) => sum + m.click_rate, 0) / sequenceMetrics.length)
      : 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold">{totals.enrolled}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{totals.sent}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Open Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold">{avgOpenRate}%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Click Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <MousePointer className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">{avgClickRate}%</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/email-sequences')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Email Sequences
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <BarChart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Sequence Performance</h1>
              <p className="text-muted-foreground">
                Analytics and insights for email automation sequences
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sequences">By Sequence</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewMetrics />

            <Card>
              <CardHeader>
                <CardTitle>All Sequences Performance</CardTitle>
                <CardDescription>
                  Compare performance metrics across all email sequences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sequenceMetrics.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No sequence data available yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sequenceMetrics.map((metric) => (
                      <div
                        key={metric.sequence_id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedSequence(metric.sequence_id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{metric.sequence_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {metric.profile_type}
                              </Badge>
                              {metric.is_active ? (
                                <Badge className="text-xs">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Paused</Badge>
                              )}
                            </div>
                          </div>
                          <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Enrolled</p>
                            <p className="font-semibold">{metric.total_enrolled}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sent</p>
                            <p className="font-semibold">{metric.total_sent}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Opened</p>
                            <p className="font-semibold">{metric.unique_opened}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Clicked</p>
                            <p className="font-semibold">{metric.unique_clicked}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Open Rate</p>
                            <p className="font-semibold">{metric.open_rate}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Click Rate</p>
                            <p className="font-semibold">{metric.click_rate}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sequences" className="space-y-6">
            {!selectedSequence ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    Select a sequence from the Overview tab to view detailed step-by-step analytics
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {(() => {
                  const sequence = sequenceMetrics.find(m => m.sequence_id === selectedSequence);
                  if (!sequence) return null;

                  return (
                    <>
                      <Card>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle>{sequence.sequence_name}</CardTitle>
                              <CardDescription>Step-by-step performance breakdown</CardDescription>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSequence(null)}
                            >
                              View All
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div>
                              <p className="text-sm text-muted-foreground">Total Enrolled</p>
                              <p className="text-2xl font-bold">{sequence.total_enrolled}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Completion Rate</p>
                              <p className="text-2xl font-bold">{sequence.completion_rate}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Open Rate</p>
                              <p className="text-2xl font-bold">{sequence.open_rate}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Click Rate</p>
                              <p className="text-2xl font-bold">{sequence.click_rate}%</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Email Steps Performance</CardTitle>
                          <CardDescription>Individual performance for each step in the sequence</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {stepMetrics.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              No step data available yet
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {stepMetrics.map((step) => (
                                <div key={step.step_number} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h4 className="font-semibold">Step {step.step_number}</h4>
                                      <p className="text-sm text-muted-foreground">{step.template_key}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Sent</p>
                                      <p className="font-semibold">{step.sent}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Opened</p>
                                      <p className="font-semibold">{step.opened}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Clicked</p>
                                      <p className="font-semibold">{step.clicked}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Open Rate</p>
                                      <p className="font-semibold">{step.open_rate}%</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Click Rate</p>
                                      <p className="font-semibold">{step.click_rate}%</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}