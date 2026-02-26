import { ClassicBrochureTemplate } from './ClassicBrochureTemplate';

export interface BrochureTemplateDefinition {
  id: string;
  name: string;
  description: string;
  component: typeof ClassicBrochureTemplate;
}

export const BROCHURE_TEMPLATES: Record<string, BrochureTemplateDefinition> = {
  'classic-1': {
    id: 'classic-1',
    name: 'Classic Estate Agent',
    description: 'Traditional 4-page brochure with hero photo cover, room-by-room details, and features.',
    component: ClassicBrochureTemplate,
  },
};

export function getTemplate(templateId: string): BrochureTemplateDefinition {
  return BROCHURE_TEMPLATES[templateId] || BROCHURE_TEMPLATES['classic-1'];
}
