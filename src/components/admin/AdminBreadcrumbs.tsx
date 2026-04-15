import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const routeLabels: Record<string, string> = {
  'internal': 'Super Admin',
  'organizations': 'Organizations',
  'users': 'Users',
  'billing': 'Billing & Revenue',
  'discounts': 'Discount Codes',
  'feature-flags': 'Feature Flags',
  'support': 'Support Tools',
  'analytics': 'Analytics',
  'gdpr': 'GDPR Compliance',
  'alerts': 'Alerts',
  'audit-log': 'Audit Log',
  'email-queue': 'Email Queue',
};

export function AdminBreadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  if (pathSegments.length <= 1) {
    return null;
  }

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = routeLabels[segment] || segment;
    const isLast = index === pathSegments.length - 1;
    
    return { path, label, isLast };
  });

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex items-center gap-1 text-sm text-muted-foreground"
      data-testid="admin-breadcrumbs"
    >
      <Link 
        to="/internal" 
        className="flex items-center hover:text-foreground transition-colors"
        data-testid="breadcrumb-home"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.slice(1).map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          {crumb.isLast ? (
            <span 
              className="font-medium text-foreground"
              data-testid={`breadcrumb-${crumb.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors"
              data-testid={`breadcrumb-link-${crumb.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
