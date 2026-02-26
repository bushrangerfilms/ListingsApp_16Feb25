import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureBranding } from '@/lib/brochure/types';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderBottomWidth: 3,
  },
  leftSection: {
    flexDirection: 'column',
  },
  businessName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  contactText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#444',
    marginTop: 2,
  },
  logo: {
    maxWidth: 100,
    maxHeight: 50,
    objectFit: 'contain',
  },
  licenceText: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#666',
    marginTop: 2,
  },
});

interface BrochureHeaderProps {
  branding: BrochureBranding;
  compact?: boolean;
}

export function BrochureHeader({ branding, compact = false }: BrochureHeaderProps) {
  const accentColor = branding.secondaryColor || '#c53030';

  return (
    <View style={[styles.header, { borderBottomColor: accentColor }]}>
      <View style={styles.leftSection}>
        {!compact && (
          <Text style={styles.businessName}>{branding.businessName}</Text>
        )}
        {compact && branding.businessName && (
          <Text style={[styles.businessName, { fontSize: 10 }]}>{branding.businessName}</Text>
        )}
        <Text style={styles.contactText}>
          {[branding.contactPhone, branding.contactEmail].filter(Boolean).join(' | ')}
        </Text>
        {branding.businessAddress && !compact && (
          <Text style={styles.contactText}>{branding.businessAddress}</Text>
        )}
        {branding.psrLicenceNumber && (
          <Text style={styles.licenceText}>Licence No: {branding.psrLicenceNumber}</Text>
        )}
      </View>
      {branding.logoUrl && (
        <Image src={branding.logoUrl} style={styles.logo} />
      )}
    </View>
  );
}
