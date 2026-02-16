import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SellerProfileCard } from "@/components/SellerProfileCard";
import { BuyerProfileCard } from "@/components/BuyerProfileCard";

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_address: string | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
}

interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  bedrooms_required: number[] | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
  interested_properties: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
}

interface ProfileDetailDialogProps {
  profile: SellerProfile | BuyerProfile | null;
  type: "seller" | "buyer";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ProfileDetailDialog({
  profile,
  type,
  open,
  onOpenChange,
  onUpdate,
}: ProfileDetailDialogProps) {
  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
        </DialogHeader>
        {type === "seller" ? (
          <SellerProfileCard seller={profile as SellerProfile} onUpdate={onUpdate} />
        ) : (
          <BuyerProfileCard buyer={profile as BuyerProfile} onUpdate={onUpdate} />
        )}
      </DialogContent>
    </Dialog>
  );
}
