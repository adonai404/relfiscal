import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useApproval() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile_approval", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("approved, access_requested_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    approved: data?.approved ?? false,
    accessRequestedAt: data?.access_requested_at ?? null,
    isLoading,
    refetch,
  };
}
