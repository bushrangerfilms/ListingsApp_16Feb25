import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Video, Globe, Mail } from 'lucide-react';

const DISPLAY_LOCATIONS = [
  { icon: FileText, label: 'PDF property brochures' },
  { icon: Video, label: 'Video end cards (Reels & Shorts)' },
  { icon: Globe, label: 'Your public website footer' },
  { icon: Mail, label: 'Lead capture pages' },
];

interface ConfirmBusinessEmailProps {
  currentEmail: string;
  businessName: string;
  onConfirm: (email: string) => void;
}

export function ConfirmBusinessEmail({
  currentEmail,
  businessName,
  onConfirm,
}: ConfirmBusinessEmailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(currentEmail);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Confirm your business email</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          This is the public contact email for {businessName}.
        </p>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            autoFocus
          />
          <Button
            className="w-full"
            onClick={() => onConfirm(editEmail.trim())}
            disabled={!editEmail.trim() || !editEmail.includes('@')}
          >
            Save & Continue
          </Button>
        </div>
      ) : (
        <div className="rounded-md bg-muted/50 border px-3 py-2.5 text-sm font-medium">
          {currentEmail}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">
          This email will appear on:
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {DISPLAY_LOCATIONS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {!isEditing && (
        <div className="space-y-2">
          <Button className="w-full" onClick={() => onConfirm(currentEmail)}>
            This is my business email
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsEditing(true)}
          >
            Use a different email?
          </button>
        </div>
      )}
    </div>
  );
}
