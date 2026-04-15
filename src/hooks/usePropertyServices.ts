import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  PropertyService, 
  DEFAULT_PROPERTY_SERVICES, 
  isServiceEnabled,
  categoryToService,
  PROPERTY_SERVICES
} from '@/lib/billing/types';

export interface PropertyServicesConfig {
  services: PropertyService[];
  salesEnabled: boolean;
  rentalsEnabled: boolean;
  holidayRentalsEnabled: boolean;
  enabledCategories: ('Listing' | 'Rental' | 'Holiday Rental')[];
  isLoading: boolean;
}

export function usePropertyServices(): PropertyServicesConfig {
  const { organization, loading } = useOrganization();
  
  const services: PropertyService[] = organization?.property_services ?? DEFAULT_PROPERTY_SERVICES;
  
  const salesEnabled = isServiceEnabled(services, 'sales');
  const rentalsEnabled = isServiceEnabled(services, 'rentals');
  const holidayRentalsEnabled = isServiceEnabled(services, 'holiday_rentals');
  
  const enabledCategories: ('Listing' | 'Rental' | 'Holiday Rental')[] = [];
  if (salesEnabled) enabledCategories.push('Listing');
  if (rentalsEnabled) enabledCategories.push('Rental');
  if (holidayRentalsEnabled) enabledCategories.push('Holiday Rental');
  
  return {
    services,
    salesEnabled,
    rentalsEnabled,
    holidayRentalsEnabled,
    enabledCategories,
    isLoading: loading,
  };
}

export function isCategoryAllowed(
  services: PropertyService[] | undefined | null,
  category: 'Listing' | 'Rental' | 'Holiday Rental'
): boolean {
  const service = categoryToService(category);
  return isServiceEnabled(services, service);
}

export { PROPERTY_SERVICES, DEFAULT_PROPERTY_SERVICES };
export type { PropertyService };
