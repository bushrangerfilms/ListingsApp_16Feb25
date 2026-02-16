import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";

interface SequenceStep {
  id?: string;
  step_number: number;
  template_key: string;
  delay_hours: number;
}

interface EmailSequenceBuilderProps {
  sequenceId: string | null;
  onClose: () => void;
}

const SELLER_STAGES = ['lead', 'valuation_scheduled', 'valuation_complete', 'listed', 'under_offer'];
const BUYER_STAGES = ['lead', 'qualified', 'viewing_scheduled', 'viewed', 'offer_made'];

export function EmailSequenceBuilder({ sequenceId, onClose }: EmailSequenceBuilderProps) {
  const { organization } = useOrganization();
  const [name, setName] = useState("");
  const [profileType, setProfileType] = useState<'seller' | 'buyer'>('seller');
  const [triggerStage, setTriggerStage] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([{ step_number: 1, template_key: '', delay_hours: 0 }]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
    if (sequenceId) {
      fetchSequence();
    }
  }, [sequenceId]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('template_key, template_name, category')
      .eq('is_active', true)
      .order('category');
    
    setTemplates(data || []);
  };

  const fetchSequence = async () => {
    if (!sequenceId) return;

    const { data: seqData } = await (supabase as any)
      .from('email_sequences')
      .select('*')
      .eq('id', sequenceId)
      .maybeSingle();

    if (seqData) {
      setName(seqData.name);
      setProfileType(seqData.profile_type);
      setTriggerStage(seqData.trigger_stage);
    }

    const { data: stepsData } = await (supabase as any)
      .from('email_sequence_steps')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('step_number');

    if (stepsData && stepsData.length > 0) {
      setSteps(stepsData as SequenceStep[]);
    }
  };

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, template_key: '', delay_hours: 24 }]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps.map((step, i) => ({ ...step, step_number: i + 1 })));
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSave = async () => {
    if (!name || !triggerStage || steps.some(s => !s.template_key)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!organization) {
      toast.error('Organization not loaded');
      return;
    }

    setSaving(true);
    try {
      let finalSequenceId = sequenceId;

      if (sequenceId) {
        await (supabase as any)
          .from('email_sequences')
          .update({ name, profile_type: profileType, trigger_stage: triggerStage })
          .eq('id', sequenceId);

        await (supabase as any)
          .from('email_sequence_steps')
          .delete()
          .eq('sequence_id', sequenceId);
      } else {
        const { data, error } = await (supabase as any)
          .from('email_sequences')
          .insert({ 
            organization_id: organization.id,
            name, 
            profile_type: profileType, 
            trigger_stage: triggerStage 
          })
          .select()
          .single();

        if (error) throw error;
        finalSequenceId = data.id;
      }

      const stepsToInsert = steps.map(step => ({
        sequence_id: finalSequenceId,
        step_number: step.step_number,
        template_key: step.template_key,
        delay_hours: step.delay_hours,
      }));

      const { error: stepsError } = await (supabase as any)
        .from('email_sequence_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      toast.success('Sequence saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving sequence:', error);
      toast.error('Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.category === (profileType === 'seller' ? 'seller' : 'buyer')
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Button variant="ghost" onClick={onClose} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Sequences
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{sequenceId ? 'Edit' : 'Create'} Email Sequence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Sequence Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Seller Onboarding"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profile Type</Label>
              <Select value={profileType} onValueChange={(v: any) => setProfileType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Sellers</SelectItem>
                  <SelectItem value="buyer">Buyers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trigger Stage</Label>
              <Select value={triggerStage} onValueChange={setTriggerStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {(profileType === 'seller' ? SELLER_STAGES : BUYER_STAGES).map(stage => (
                    <SelectItem key={stage} value={stage}>
                      {stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Email Steps</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Step
              </Button>
            </div>

            {steps.map((step, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Email Template</Label>
                      <Select 
                        value={step.template_key} 
                        onValueChange={(v) => updateStep(index, 'template_key', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredTemplates.map(template => (
                            <SelectItem key={template.template_key} value={template.template_key}>
                              {template.template_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-32 space-y-2">
                      <Label>Delay (hours)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={step.delay_hours}
                        onChange={(e) => updateStep(index, 'delay_hours', parseInt(e.target.value))}
                      />
                    </div>

                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Sequence'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
