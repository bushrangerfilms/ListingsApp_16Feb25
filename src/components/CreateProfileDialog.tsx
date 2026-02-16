import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrganization } from "@/contexts/OrganizationContext";

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileType: "seller" | "buyer";
  onSuccess: () => void;
}

const SELLER_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'valuation_scheduled', label: 'Valuation Scheduled' },
  { value: 'valuation_complete', label: 'Valuation Complete' },
  { value: 'listed', label: 'Listed' },
  { value: 'under_offer', label: 'Under Offer' },
  { value: 'sold', label: 'Sold' },
  { value: 'lost', label: 'Lost' },
];

const BUYER_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'viewing_scheduled', label: 'Viewing Scheduled' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'offer_made', label: 'Offer Made' },
  { value: 'sale_agreed', label: 'Sale Agreed' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'lost', label: 'Lost' },
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

export function CreateProfileDialog({ open, onOpenChange, profileType, onSuccess }: CreateProfileDialogProps) {
  const { organization } = useOrganization();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    property_address: '',
    stage: 'lead',
    notes: '',
    bedrooms: [] as number[],
    budget_min: '',
    budget_max: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organization) {
      toast.error('Organization not loaded');
      return;
    }

    setSubmitting(true);

    try {
      if (profileType === "seller") {
        const { error } = await supabase
          .from('seller_profiles')
          .insert({
            organization_id: organization.id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            property_address: formData.property_address || null,
            stage: formData.stage as any,
            source: 'manual',
            notes: formData.notes || null,
          } as any);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('buyer_profiles')
          .insert({
            organization_id: organization.id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            bedrooms_required: formData.bedrooms.length > 0 ? formData.bedrooms : null,
            stage: formData.stage as any,
            source: 'manual',
            notes: formData.notes || null,
            budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
            budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
          } as any);

        if (error) throw error;
      }

      toast.success(`${profileType === 'seller' ? 'Seller' : 'Buyer'} profile created`);
      onSuccess();
      onOpenChange(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        property_address: '',
        stage: 'lead',
        notes: '',
        bedrooms: [],
        budget_min: '',
        budget_max: '',
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBedroomToggle = (bedroom: number) => {
    setFormData(prev => ({
      ...prev,
      bedrooms: prev.bedrooms.includes(bedroom)
        ? prev.bedrooms.filter(b => b !== bedroom)
        : [...prev.bedrooms, bedroom].sort((a, b) => a - b)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create {profileType === 'seller' ? 'Seller' : 'Buyer'} Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Stage *</Label>
              <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(profileType === 'seller' ? SELLER_STAGES : BUYER_STAGES).map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {profileType === 'seller' && (
            <div className="space-y-2">
              <Label htmlFor="property_address">Property Address</Label>
              <Input
                id="property_address"
                value={formData.property_address}
                onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
              />
            </div>
          )}

          {profileType === 'buyer' && (
            <>
              <div className="space-y-2">
                <Label>Bedrooms Required</Label>
                <div className="flex gap-4">
                  {BEDROOM_OPTIONS.map((bedroom) => (
                    <div key={bedroom} className="flex items-center gap-2">
                      <Checkbox
                        id={`bedroom-${bedroom}`}
                        checked={formData.bedrooms.includes(bedroom)}
                        onCheckedChange={() => handleBedroomToggle(bedroom)}
                      />
                      <Label htmlFor={`bedroom-${bedroom}`} className="cursor-pointer">
                        {bedroom === 5 ? '5+' : bedroom}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_min">Budget Min (€)</Label>
                  <Input
                    id="budget_min"
                    type="number"
                    value={formData.budget_min}
                    onChange={(e) => setFormData({ ...formData, budget_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_max">Budget Max (€)</Label>
                  <Input
                    id="budget_max"
                    type="number"
                    value={formData.budget_max}
                    onChange={(e) => setFormData({ ...formData, budget_max: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
