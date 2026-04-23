import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
}

export interface CompanyTag {
  company_id: string;
  tag_id: string;
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tags")
        .select("id, name, color, created_by")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}

export function useCompanyTags() {
  return useQuery({
    queryKey: ["company_tags"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("company_tags")
        .select("company_id, tag_id");
      if (error) throw error;
      return (data ?? []) as CompanyTag[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tags")
        .insert({ name: input.name.trim(), color: input.color, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tag> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("tags").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["company_tags"] });
    },
  });
}

export function useToggleCompanyTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ company_id, tag_id, attach }: { company_id: string; tag_id: string; attach: boolean }) => {
      if (attach) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("company_tags").insert({ company_id, tag_id });
        if (error && !String(error.message || "").includes("duplicate")) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("company_tags").delete()
          .eq("company_id", company_id).eq("tag_id", tag_id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company_tags"] }),
  });
}