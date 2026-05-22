import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("approved, status, email, username, access_requested_at, customer_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    profile,
    isLoading,
    isBlocked: profile?.status === "bloqueado",
    isActive: profile?.status === "ativo",
    isCustomer: !!profile?.customer_id,
    customerId: profile?.customer_id ?? null,
  };
}
