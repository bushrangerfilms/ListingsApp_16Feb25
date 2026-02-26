import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { BrochureBranding, BrochureLegal } from '@/lib/brochure/types';

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
  },
  disclaimer: {
    fontSize: 6.5,
    fontFamily: 'Helvetica',
    color: '#888',
    lineHeight: 1.4,
    textAlign: 'center',
  },
  contactBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  contactText: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#666',
    marginHorizontal: 8,
  },
});

interface BrochureFooterProps {
  branding: BrochureBranding;
  legal: BrochureLegal;
  showContact?: boolean;
}

export function BrochureFooter({ branding, legal, showContact = false }: BrochureFooterProps) {
  return (
    <View style={styles.footer}>
      {showContact && (
        <View style={styles.contactBar}>
          {branding.contactPhone && (
            <Text style={styles.contactText}>Tel: {branding.contactPhone}</Text>
          )}
          {branding.contactEmail && (
            <Text style={styles.contactText}>{branding.contactEmail}</Text>
          )}
          {branding.businessAddress && (
            <Text style={styles.contactText}>{branding.businessAddress}</Text>
          )}
        </View>
      )}
      {legal.disclaimer && (
        <Text style={styles.disclaimer}>{legal.disclaimer}</Text>
      )}
    </View>
  );
}
