import { useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDomainType } from "@/lib/domainDetection";

// SPA hosts return 200 OK for unmatched paths, so without an explicit noindex
// any stray URL (e.g. /seo) gets indexed by Google as a real page.
const NoindexMeta = () => {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    const previous = existing?.getAttribute('content') ?? null;
    const el = existing ?? document.createElement('meta');
    if (!existing) {
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previous === null) {
        el.parentElement?.removeChild(el);
      } else {
        el.setAttribute('content', previous);
      }
    };
  }, []);
  return null;
};

const NotFound = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const domainType = getDomainType();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NoindexMeta />
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // On admin domain, redirect unauthenticated users to login
  if (domainType === 'admin' && !user) {
    return <Navigate to="/admin/login" replace />;
  }

  const homeLink = domainType === 'admin' && user ? '/admin/listings' : '/';
  const homeLinkText = domainType === 'admin' && user ? 'Back to Dashboard' : 'Return to Home';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <NoindexMeta />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href={homeLink} className="text-blue-500 underline hover:text-blue-700">
          {homeLinkText}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
