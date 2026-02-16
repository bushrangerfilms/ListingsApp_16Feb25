import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

interface StatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onConfirm: (newStatus: string) => Promise<void>;
}

export function StatusUpdateDialog({
  open,
  onOpenChange,
  currentStatus,
  onConfirm,
}: StatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState("Published");
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize with current status from listing
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelectedStatus(currentStatus);
    }
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    if (selectedStatus === currentStatus) {
      onOpenChange(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onConfirm(selectedStatus);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Listing Status</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus}>
            <div className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedStatus === "Published" ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
            }`}>
              <RadioGroupItem value="Published" id="published" />
              <Label htmlFor="published" className="flex-1 cursor-pointer">
                <div className="font-medium">For Sale</div>
                <div className="text-sm text-muted-foreground">Available for viewing</div>
              </Label>
            </div>

            <div className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedStatus === "New" ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
            }`}>
              <RadioGroupItem value="New" id="new" />
              <Label htmlFor="new" className="flex-1 cursor-pointer">
                <div className="font-medium">New</div>
                <div className="text-sm text-muted-foreground">New to market - auto-expires to For Sale after 2 weeks</div>
              </Label>
            </div>

            <div className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedStatus === "Sale Agreed" ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
            }`}>
              <RadioGroupItem value="Sale Agreed" id="sale-agreed" />
              <Label htmlFor="sale-agreed" className="flex-1 cursor-pointer">
                <div className="font-medium">Sale Agreed</div>
                <div className="text-sm text-muted-foreground">Sale pending</div>
              </Label>
            </div>

            <div className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedStatus === "Sold" ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
            }`}>
              <RadioGroupItem value="Sold" id="sold" />
              <Label htmlFor="sold" className="flex-1 cursor-pointer">
                <div className="font-medium">Sold</div>
                <div className="text-sm text-muted-foreground">Property has been sold</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isUpdating || selectedStatus === currentStatus}
          >
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUpdating ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
