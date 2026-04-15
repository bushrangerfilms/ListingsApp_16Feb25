import { ClassicBrochureTemplate } from './ClassicBrochureTemplate';
import { ClassicBrochureA5Reader, ClassicBrochureA5PrintReady } from './ClassicBrochureA5';
import { ModernLuxuryTemplate } from './ModernLuxuryTemplate';
import { ModernLuxuryA5Reader, ModernLuxuryA5PrintReady } from './ModernLuxuryA5';
import { ElegantTraditionalTemplate } from './ElegantTraditionalTemplate';
import { ElegantTraditionalA5Reader, ElegantTraditionalA5PrintReady } from './ElegantTraditionalA5';
import { ArchitecturalTemplate } from './ArchitecturalTemplate';
import { ArchitecturalA5Reader, ArchitecturalA5PrintReady } from './ArchitecturalA5';
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
    name: 'Classic',
    description: 'Traditional layout with header, room-by-room details, and feature columns.',
    component: ClassicBrochureTemplate,
    a5ReaderComponent: ClassicBrochureA5Reader,
    a5PrintReadyComponent: ClassicBrochureA5PrintReady,
  },
  'modern-luxury': {
    id: 'modern-luxury',
    name: 'Modern Luxury',
    description: 'Full-bleed hero, address overlay, photo-rich interior, clean contact card.',
    component: ModernLuxuryTemplate,
    a5ReaderComponent: ModernLuxuryA5Reader,
    a5PrintReadyComponent: ModernLuxuryA5PrintReady,
  },
  'elegant-traditional': {
    id: 'elegant-traditional',
    name: 'Elegant',
    description: 'Refined cover with italic sale method, 2-column features, photo mosaic.',
    component: ElegantTraditionalTemplate,
    a5ReaderComponent: ElegantTraditionalA5Reader,
    a5PrintReadyComponent: ElegantTraditionalA5PrintReady,
  },
  'architectural': {
    id: 'architectural',
    name: 'Architectural',
    description: 'Minimal editorial style with specs bar, side-by-side layout, floor plan.',
    component: ArchitecturalTemplate,
    a5ReaderComponent: ArchitecturalA5Reader,
    a5PrintReadyComponent: ArchitecturalA5PrintReady,
  },
};

export function getTemplate(templateId: string): BrochureTemplateDefinition {
  return BROCHURE_TEMPLATES[templateId] || BROCHURE_TEMPLATES['classic-1'];
}
