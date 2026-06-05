import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import ContentProtection from "@/components/security/ContentProtection";

export const ProtectedRoute = ({
  children
}: {
  children: React.ReactElement;
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <ContentProtection>{children}</ContentProtection>;
};
