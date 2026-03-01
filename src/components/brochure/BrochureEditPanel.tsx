import { useState, useCallback } from 'react';
import type { BrochureContent } from '@/lib/brochure/types';
import { BrochureSectionHeader } from './BrochureSectionHeader';
import { BrochureCoverEditor } from './BrochureCoverEditor';
import { BrochureDescriptionEditor } from './BrochureDescriptionEditor';
import { BrochureRoomsEditor } from './BrochureRoomsEditor';
import { BrochureFeaturesEditor } from './BrochureFeaturesEditor';
import { BrochureLocationEditor } from './BrochureLocationEditor';
import { BrochureLegalEditor } from './BrochureLegalEditor';
import { BrochureGalleryEditor } from './BrochureGalleryEditor';

interface BrochureEditPanelProps {
  content: BrochureContent;
  onChange: (content: BrochureContent) => void;
  photos: string[];
  onRegenerateSection?: (section: string) => void;
  regeneratingSection?: string | null;
}

export function BrochureEditPanel({
  content,
  onChange,
  photos,
  onRegenerateSection,
  regeneratingSection,
}: BrochureEditPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    cover: true,
    description: true,
    rooms: true,
    features: false,
    location: false,
    gallery: false,
    floorPlans: false,
    legal: false,
  });

  const toggleExpand = useCallback((section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const toggleVisible = useCallback((section: string) => {
    onChange({
      ...content,
      visibleSections: {
        ...content.visibleSections,
        [section]: !content.visibleSections[section],
      },
    });
  }, [content, onChange]);

  const isVisible = (section: string) => content.visibleSections[section] !== false;

  return (
    <div className="space-y-1.5 overflow-y-auto">
      {/* Cover */}
      <div>
        <BrochureSectionHeader
          title="Cover"
          isExpanded={expanded.cover}
          isVisible={isVisible('cover')}
          onToggleExpand={() => toggleExpand('cover')}
          onToggleVisible={() => toggleVisible('cover')}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection('cover') : undefined}
          isRegenerating={regeneratingSection === 'cover'}
        />
        {expanded.cover && (
          <BrochureCoverEditor
            cover={content.cover}
            onChange={(cover) => onChange({ ...content, cover })}
            photos={photos}
          />
        )}
      </div>

      {/* Description */}
      <div>
        <BrochureSectionHeader
          title="Description"
          isExpanded={expanded.description}
          isVisible={isVisible('description')}
          onToggleExpand={() => toggleExpand('description')}
          onToggleVisible={() => toggleVisible('description')}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection('description') : undefined}
          isRegenerating={regeneratingSection === 'description'}
        />
        {expanded.description && (
          <BrochureDescriptionEditor
            description={content.description}
            onChange={(description) => onChange({ ...content, description })}
          />
        )}
      </div>

      {/* Rooms */}
      <div>
        <BrochureSectionHeader
          title={`Rooms (${content.rooms.length})`}
          isExpanded={expanded.rooms}
          isVisible={isVisible('rooms')}
          onToggleExpand={() => toggleExpand('rooms')}
          onToggleVisible={() => toggleVisible('rooms')}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection('rooms') : undefined}
          isRegenerating={regeneratingSection === 'rooms'}
        />
        {expanded.rooms && (
          <BrochureRoomsEditor
            rooms={content.rooms}
            onChange={(rooms) => onChange({ ...content, rooms })}
            photos={photos}
          />
        )}
      </div>

      {/* Features */}
      <div>
        <BrochureSectionHeader
          title="Features & Services"
          isExpanded={expanded.features}
          isVisible={isVisible('features')}
          onToggleExpand={() => toggleExpand('features')}
          onToggleVisible={() => toggleVisible('features')}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection('features') : undefined}
          isRegenerating={regeneratingSection === 'features'}
        />
        {expanded.features && (
          <BrochureFeaturesEditor
            features={content.features}
            onChange={(features) => onChange({ ...content, features })}
          />
        )}
      </div>

      {/* Location */}
      <div>
        <BrochureSectionHeader
          title="Location"
          isExpanded={expanded.location}
          isVisible={isVisible('location')}
          onToggleExpand={() => toggleExpand('location')}
          onToggleVisible={() => toggleVisible('location')}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection('location') : undefined}
          isRegenerating={regeneratingSection === 'location'}
        />
        {expanded.location && (
          <BrochureLocationEditor
            location={content.location}
            onChange={(location) => onChange({ ...content, location })}
          />
        )}
      </div>

      {/* Gallery */}
      <div>
        <BrochureSectionHeader
          title={`Accent Photos (${content.gallery.length}/4)`}
          isExpanded={expanded.gallery}
          isVisible={isVisible('gallery')}
          onToggleExpand={() => toggleExpand('gallery')}
          onToggleVisible={() => toggleVisible('gallery')}
        />
        {expanded.gallery && (
          <BrochureGalleryEditor
            gallery={content.gallery}
            onChange={(gallery) => onChange({ ...content, gallery })}
            availablePhotos={photos}
          />
        )}
      </div>

      {/* Legal */}
      <div>
        <BrochureSectionHeader
          title="Legal"
          isExpanded={expanded.legal}
          isVisible={isVisible('legal')}
          onToggleExpand={() => toggleExpand('legal')}
          onToggleVisible={() => toggleVisible('legal')}
        />
        {expanded.legal && (
          <BrochureLegalEditor
            legal={content.legal}
            onChange={(legal) => onChange({ ...content, legal })}
          />
        )}
      </div>
    </div>
  );
}
