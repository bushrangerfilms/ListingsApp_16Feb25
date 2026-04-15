import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';

interface AnnouncementBarProps {
  organizationId: string;
}

interface AnnouncementContent {
  headline: string | null;
  subheadline: string | null;
  paragraph_1: string | null;
  paragraph_2: string | null;
  image_url: string | null;
  is_enabled: boolean;
}

interface ExtraSettings {
  scroll_enabled: boolean;
  scroll_speed: number;
  use_custom_color: boolean;
  custom_bg: string;
  custom_text: string;
}

const ANNOUNCEMENT_COLORS: Record<string, { bg: string; text: string }> = {
  primary: { bg: '#1e40af', text: '#ffffff' },
  secondary: { bg: '#475569', text: '#ffffff' },
  success: { bg: '#16a34a', text: '#ffffff' },
  warning: { bg: '#ea580c', text: '#ffffff' },
  info: { bg: '#0891b2', text: '#ffffff' },
  dark: { bg: '#1e293b', text: '#ffffff' },
};

export function AnnouncementBar({ organizationId }: AnnouncementBarProps) {
  const [announcement, setAnnouncement] = useState<AnnouncementContent | null>(null);
  const [extraSettings, setExtraSettings] = useState<ExtraSettings>({
    scroll_enabled: false,
    scroll_speed: 60,
    use_custom_color: false,
    custom_bg: '#1e40af',
    custom_text: '#ffffff',
  });
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('marketing_content')
          .select('headline, subheadline, paragraph_1, paragraph_2, image_url, is_enabled')
          .eq('organization_id', organizationId)
          .eq('section_key', 'announcement_bar')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('[AnnouncementBar] Error fetching:', error);
        }

        if (data && data.is_enabled && data.headline) {
          setAnnouncement(data);
          
          if (data.paragraph_2) {
            try {
              const parsed = JSON.parse(data.paragraph_2);
              setExtraSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
              console.error('[AnnouncementBar] Failed to parse extra settings:', e);
            }
          }
        }
      } catch (error) {
        console.error('[AnnouncementBar] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchAnnouncement();
    }
  }, [organizationId]);

  if (loading || !announcement || dismissed) {
    return null;
  }

  const colorKey = announcement.image_url || 'primary';
  const presetColors = ANNOUNCEMENT_COLORS[colorKey] || ANNOUNCEMENT_COLORS.primary;
  const colors = extraSettings.use_custom_color 
    ? { bg: extraSettings.custom_bg, text: extraSettings.custom_text }
    : presetColors;

  const messageContent = (
    <>
      <span>{announcement.headline}</span>
      {announcement.paragraph_1 && (
        <span className="ml-2 underline font-medium">
          {announcement.paragraph_1}
        </span>
      )}
    </>
  );

  const content = announcement.subheadline ? (
    <a 
      href={announcement.subheadline}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:opacity-90 transition-opacity inline-flex items-center"
      data-testid="link-announcement"
    >
      {messageContent}
    </a>
  ) : (
    <span className="inline-flex items-center">{messageContent}</span>
  );

  const scrollDuration = ((150 - extraSettings.scroll_speed) / 2.5) * 4;

  return (
    <div 
      className="relative py-2.5 text-sm font-medium overflow-hidden"
      style={{ 
        backgroundColor: colors.bg, 
        color: colors.text 
      }}
      data-testid="announcement-bar"
    >
      {extraSettings.scroll_enabled ? (
        <div className="flex whitespace-nowrap">
          <div 
            ref={scrollRef}
            className="animate-marquee flex items-center"
            style={{
              animationDuration: `${scrollDuration}s`,
            }}
          >
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
          </div>
          <div 
            className="animate-marquee2 flex items-center absolute top-0 left-0 py-2.5"
            style={{
              animationDuration: `${scrollDuration}s`,
            }}
          >
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
            <span className="px-16">{content}</span>
          </div>
        </div>
      ) : (
        <div className="text-center px-12">
          {content}
        </div>
      )}
      
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20 transition-colors z-10"
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-announcement"
      >
        <X className="h-4 w-4" />
      </button>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes marquee2 {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
        .animate-marquee2 {
          animation: marquee2 linear infinite;
        }
      `}</style>
    </div>
  );
}
