import { ClassicBrochureTemplate } from './ClassicBrochureTemplate';
import { ClassicBrochureA5Reader, ClassicBrochureA5PrintReady } from './ClassicBrochureA5';
import type { FC } from 'react';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';

type BrochureComponent = FC<{ content: BrochureContent; branding: BrochureBranding }>;

export interface BrochureTemplateDefinition {
  id: string;
  name: string;
  description: string;
  component: BrochureComponent;
  a5ReaderComponent?: BrochureComponent;
  a5PrintReadyComponent?: BrochureComponent;
}

export const BROCHURE_TEMPLATES: Record<string, BrochureTemplateDefinition> = {
  'classic-1': {
    id: 'classic-1',
    name: 'Classic Estate Agent',
    description: 'Traditional 4-page brochure with hero photo cover, room-by-room details, and features.',
    component: ClassicBrochureTemplate,
    a5ReaderComponent: ClassicBrochureA5Reader,
    a5PrintReadyComponent: ClassicBrochureA5PrintReady,
  },
};

export function getTemplate(templateId: string): BrochureTemplateDefinition {
  return BROCHURE_TEMPLATES[templateId] || BROCHURE_TEMPLATES['classic-1'];
}
