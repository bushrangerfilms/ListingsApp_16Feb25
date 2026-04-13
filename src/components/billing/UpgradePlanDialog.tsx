import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Lock } from 'lucide-react';

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Feature being gated — drives copy. Defaults to "listing" for backwards compat. */
  feature?:
    | 'listing'
    | 'custom_domain'
    | 'branch'
    | 'team_member'
    | 'lead_magnet'
    | 'video_style_ai_motion'
    | 'posts_per_week'
    | 'brochure';
  /** Optional overrides — if omitted, copy is derived from `feature`. */
  title?: string;
  description?: string;
  currentCount?: number;
  maxAllowed?: number;
  planName?: string;
  /** Where the Upgrade button navigates. Defaults to /admin/billing/upgrade. */
  upgradeHref?: string;
  /** Override button label. */
  upgradeLabel?: string;
}

const FEATURE_COPY: Record<
  NonNullable<UpgradePlanDialogProps['feature']>,
  { title: string; body: (ctx: { plan: string; current?: number; max?: number }) => string; icon: 'limit' | 'lock' }
> = {
  listing: {
    title: 'Listing Limit Reached',
    body: ({ plan, current, max }) =>
      `You've reached your ${plan} plan's listing limit (${current}/${max}). Upgrade to add more listings.`,
    icon: 'limit',
  },
  custom_domain: {
    title: 'Custom Domain — Paid Plans Only',
    body: () =>
      'Custom domains are available on paid plans. Upgrade to connect your own domain (e.g. youragency.com) to your property website.',
    icon: 'lock',
  },
  branch: {
    title: 'Branch Limit Reached',
    body: ({ plan, current, max }) =>
      `You've reached your branch limit (${current}/${max}) on the ${plan} plan. Upgrade to a Multi-Branch plan for more.`,
    icon: 'limit',
  },
  team_member: {
    title: 'Team Member Limit Reached',
    body: ({ plan, current, max }) =>
      `You've reached your ${plan} plan's team member limit (${current}/${max}). Upgrade to invite more teammates.`,
    icon: 'limit',
  },
  lead_magnet: {
    title: 'Weekly Lead Magnet Limit Reached',
    body: ({ plan, current, max }) =>
      `You've used ${current}/${max} lead magnets this week on the ${plan} plan. Upgrade for more weekly lead magnets.`,
    icon: 'limit',
  },
  video_style_ai_motion: {
    title: 'AI Motion Videos — Paid Plans Only',
    body: () =>
      'AI Motion video styles (Style 2 and Style 4) are available on paid plans. Upgrade to unlock cinematic AI-generated property videos.',
    icon: 'lock',
  },
  posts_per_week: {
    title: 'Weekly Post Limit Reached',
    body: ({ plan, current, max }) =>
      `You've reached your ${plan} plan's limit of ${max} post${max === 1 ? '' : 's'} per listing per week (${current}/${max}). Upgrade to post more frequently.`,
    icon: 'limit',
  },
  brochure: {
    title: 'Brochure Generator — Paid Plans Only',
    body: () =>
      'Property brochures are available on paid plans. Upgrade to generate printable A5 brochures for every listing.',
    icon: 'lock',
  },
};

export function UpgradePlanDialog({
  open,
  onOpenChange,
  feature = 'listing',
  title,
  description,
  currentCount,
  maxAllowed,
  planName,
  upgradeHref = '/admin/billing/upgrade',
  upgradeLabel = 'Upgrade Plan',
}: UpgradePlanDialogProps) {
  const navigate = useNavigate();

  const copy = FEATURE_COPY[feature];
  const displayPlan = (planName ?? 'free').charAt(0).toUpperCase() + (planName ?? 'free').slice(1);

  const resolvedTitle = title ?? copy.title;
  const resolvedBody =
    description ??
    copy.body({ plan: displayPlan, current: currentCount, max: maxAllowed });

  const Icon = copy.icon === 'lock' ? Lock : AlertTriangle;
  const iconColor = copy.icon === 'lock' ? 'text-blue-500' : 'text-orange-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
            <DialogTitle>{resolvedTitle}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{resolvedBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate(upgradeHref);
            }}
          >
            {upgradeLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
