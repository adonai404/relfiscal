import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const { isCustomer, isLoading } = useProfile();
  if (loading || (user && isLoading))
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={isCustomer ? "/portal" : "/app"} replace />;
};

export default Index;
