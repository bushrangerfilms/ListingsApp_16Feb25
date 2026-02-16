import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect authenticated admins to dashboard
  if (isAdmin) {
    return <Navigate to="/admin/listings" replace />;
  }

  // Redirect non-authenticated users to login
  // (app.autolisting.io should show login, not a specific org's public site)
  return <Navigate to="/admin/login" replace />;
};

export default Index;
