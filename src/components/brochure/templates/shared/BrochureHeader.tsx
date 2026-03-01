import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureBranding } from '@/lib/brochure/types';
import {
  SPACING,
  COLORS,
  TYPE,
  ACCENT_STRIP_HEIGHT,
  RULE_WEIGHT,
  RULE_WEIGHT_HEAVY,
} from '@/lib/brochure/designTokens';

interface BrochureHeaderProps {
  branding: BrochureBranding;
  compact?: boolean;
  margins?: { paddingLeft: number; paddingRight: number };
}

export function BrochureHeader({ branding, compact = false, margins }: BrochureHeaderProps) {
  const accentColor = branding.secondaryColor || '#c53030';
  const frameStyle = branding.styleOptions?.frameStyle || 'classic';
  const pl = margins?.paddingLeft ?? 30;
  const pr = margins?.paddingRight ?? 30;

  return (
    <View>
      {/* Accent strip — classic frame style only */}
      {frameStyle === 'classic' && (
        <View style={{ height: ACCENT_STRIP_HEIGHT, backgroundColor: accentColor, width: '100%' }} />
      )}

      {/* Header content */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: pl,
        paddingRight: pr,
        paddingVertical: compact ? 8 : 10,
        borderBottomWidth: frameStyle === 'classic' ? RULE_WEIGHT_HEAVY : RULE_WEIGHT,
        borderBottomColor: frameStyle === 'classic' ? accentColor : COLORS.rule,
      }}>
        <View style={{ flexDirection: 'column' }}>
          <Text style={compact ? TYPE.headerBusinessNameCompact : TYPE.headerBusinessName}>
            {branding.businessName}
          </Text>
          <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginTop: 2 }}>
            {[branding.contactPhone, branding.contactEmail].filter(Boolean).join(' | ')}
          </Text>
          {!compact && branding.businessAddress && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginTop: 1 }}>
              {branding.businessAddress}
            </Text>
          )}
          {branding.psrLicenceNumber && (
            <Text style={{ ...TYPE.headerLicence, color: COLORS.textMuted, marginTop: 2 }}>
              Licence No: {branding.psrLicenceNumber}
            </Text>
          )}
        </View>
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            style={{ maxWidth: 100, maxHeight: 50, objectFit: 'contain' }}
          />
        )}
      </View>
    </View>
  );
}
