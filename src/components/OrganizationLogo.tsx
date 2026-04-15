import { Building2 } from "lucide-react";

interface OrganizationLogoProps {
  logoUrl?: string | null;
  businessName?: string | null;
  className?: string;
  onClick?: () => void;
}

export const OrganizationLogo = ({ 
  logoUrl, 
  businessName, 
  className = "h-10 w-auto",
  onClick 
}: OrganizationLogoProps) => {
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={businessName || "Organization"} 
        className={`${className} cursor-pointer object-contain`}
        onClick={onClick}
      />
    );
  }

  // Fallback: Show initials or generic icon
  const initials = businessName
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <div 
      className={`${className} bg-primary/10 rounded-md flex items-center justify-center px-3 cursor-pointer hover:bg-primary/20 transition-colors`}
      onClick={onClick}
    >
      {initials.length === 2 ? (
        <span className="text-lg font-bold text-primary">{initials}</span>
      ) : (
        <Building2 className="h-6 w-6 text-primary" />
      )}
    </div>
  );
};
