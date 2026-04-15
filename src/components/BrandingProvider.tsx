import { useEffect, useState, ReactNode } from 'react';

interface BrandingColors {
  primary: string;
  secondary: string;
}

interface BrandingProviderProps {
  children: ReactNode;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

const DEFAULT_COLORS: BrandingColors = {
  primary: '#1e3a5f',
  secondary: '#f0f4f8',
};

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getLuminance(hex: string): number {
  let r = 0, g = 0, b = 0;
  
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  
  r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function BrandingProvider({ children, primaryColor, secondaryColor }: BrandingProviderProps) {
  const [colors, setColors] = useState<BrandingColors>({
    primary: primaryColor || DEFAULT_COLORS.primary,
    secondary: secondaryColor || DEFAULT_COLORS.secondary,
  });

  useEffect(() => {
    setColors({
      primary: primaryColor || DEFAULT_COLORS.primary,
      secondary: secondaryColor || DEFAULT_COLORS.secondary,
    });
  }, [primaryColor, secondaryColor]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from same origin or trusted admin domains
      const trustedOrigins = [
        window.location.origin,
        'https://app.autolisting.io',
      ];
      
      if (!trustedOrigins.includes(event.origin)) {
        console.log('[BrandingProvider] Ignoring message from untrusted origin:', event.origin);
        return;
      }
      
      if (event.data?.type === 'BRANDING_PREVIEW') {
        const { colors: previewColors } = event.data;
        if (previewColors) {
          setColors({
            primary: previewColors.primary || colors.primary,
            secondary: previewColors.secondary || colors.secondary,
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [colors]);

  useEffect(() => {
    const root = document.documentElement;
    
    const primaryHsl = hexToHsl(colors.primary);
    const primaryLuminance = getLuminance(colors.primary);
    const primaryForeground = primaryLuminance > 0.5 ? '0 0% 0%' : '0 0% 100%';
    
    const secondaryHsl = hexToHsl(colors.secondary);
    const secondaryLuminance = getLuminance(colors.secondary);
    const secondaryForeground = secondaryLuminance > 0.5 ? '0 0% 0%' : '0 0% 100%';
    
    root.style.setProperty('--org-primary', primaryHsl);
    root.style.setProperty('--org-primary-foreground', primaryForeground);
    root.style.setProperty('--org-secondary', secondaryHsl);
    root.style.setProperty('--org-secondary-foreground', secondaryForeground);
    
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--primary-foreground', primaryForeground);
    
    return () => {
      root.style.removeProperty('--org-primary');
      root.style.removeProperty('--org-primary-foreground');
      root.style.removeProperty('--org-secondary');
      root.style.removeProperty('--org-secondary-foreground');
    };
  }, [colors]);

  return <>{children}</>;
}
