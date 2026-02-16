import { useMemo } from 'react';
import { useLocaleContext } from '@/lib/i18n/LocaleProvider';
import { DEFAULT_LOCALE, SupportedLocale } from '@/lib/i18n';
import { getRegionConfig, RegionConfig } from '@/lib/regionConfig';

export function useRegionConfig(): RegionConfig {
  const { locale } = useLocaleContext();
  
  const config = useMemo(() => {
    return getRegionConfig(locale || DEFAULT_LOCALE);
  }, [locale]);
  
  return config;
}

export function useEnergyRatings() {
  const config = useRegionConfig();
  return config.property.energyRatings;
}

export function useAddressConfig() {
  const config = useRegionConfig();
  return config.address;
}

export function useMeasurementConfig() {
  const config = useRegionConfig();
  return config.property.measurements;
}

export function useTaxConfig() {
  const config = useRegionConfig();
  return config.financial.tax;
}

export function useLegalTerms() {
  const config = useRegionConfig();
  return config.legal.terminology;
}

export function useComplianceConfig() {
  const config = useRegionConfig();
  return config.legal.compliance;
}

export function useBuildingTypes() {
  const config = useRegionConfig();
  return config.property.buildingTypes;
}

export function useLandMeasurements() {
  const config = useRegionConfig();
  return {
    landUnit: config.property.measurements.landUnit,
    landLabel: config.property.measurements.landLabel,
    landSymbol: config.property.measurements.landSymbol,
    convertFromAcres: config.property.measurements.convertFromAcres,
    convertToAcres: config.property.measurements.convertToAcres,
  };
}
