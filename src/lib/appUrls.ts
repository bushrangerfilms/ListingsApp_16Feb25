import { isMarketingSite } from './domainDetection';

const getAppDomain = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_DOMAIN) {
    return import.meta.env.VITE_APP_DOMAIN;
  }
  return 'https://app.autolisting.io';
};

export function getAppUrl(path: string): string {
  if (isMarketingSite()) {
    return `${getAppDomain()}${path}`;
  }
  return path;
}

export function getSignupUrl(plan?: string): string {
  const path = plan ? `/signup?plan=${plan}` : '/signup';
  return getAppUrl(path);
}

export function getLoginUrl(): string {
  return getAppUrl('/admin/login');
}

export function getDashboardUrl(): string {
  return getAppUrl('/admin/listings');
}
