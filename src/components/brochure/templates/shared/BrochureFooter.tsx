import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { BrochureBranding, BrochureLegal } from '@/lib/brochure/types';
import { COLORS, TYPE, RULE_WEIGHT, SPACING, normalizeText } from '@/lib/brochure/designTokens';

interface BrochureFooterProps {
  branding: BrochureBranding;
  legal: BrochureLegal;
  showContact?: boolean;
  margins?: { paddingLeft: number; paddingRight: number };
  inFlow?: boolean;
}

export function BrochureFooter({ branding, legal, showContact = false, margins, inFlow = false }: BrochureFooterProps) {
  const pl = margins?.paddingLeft ?? 30;
  const pr = margins?.paddingRight ?? 30;

  const containerStyle = inFlow
    ? { paddingTop: SPACING.HALF }
    : { position: 'absolute' as const, bottom: 24, left: pl, right: pr };

  return (
    <View style={containerStyle}>
      {/* Top rule */}
      <View style={{
        borderBottomWidth: RULE_WEIGHT,
        borderBottomColor: COLORS.rule,
        marginBottom: 6,
      }} />

      {showContact && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 6,
          paddingBottom: 6,
          borderBottomWidth: RULE_WEIGHT,
          borderBottomColor: COLORS.rule,
        }}>
          {branding.contactPhone && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginHorizontal: 8 }}>
              Tel: {branding.contactPhone}
            </Text>
          )}
          {branding.contactEmail && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginHorizontal: 8 }}>
              {branding.contactEmail}
            </Text>
          )}
        </View>
      )}
      {legal.disclaimer && (
        <Text style={{ ...TYPE.disclaimer, color: COLORS.textMuted, textAlign: 'center' }}>
          {normalizeText(legal.disclaimer)}
        </Text>
      )}
    </View>
  );
}
