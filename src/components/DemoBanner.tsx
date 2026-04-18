import { useState } from "react";
import { AlertCircle, Loader2, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useApproval } from "@/hooks/useApproval";

export function DemoBanner() {
  const { user } = useAuth();
  const { approved, accessRequestedAt, isLoading, refetch } = useApproval();
  const [submitting, setSubmitting] = useState(false);

  if (!user || isLoading || approved) return null;

  const requested = !!accessRequestedAt;

  const requestAccess = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ access_requested_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada! O administrador será notificado.");
    refetch();
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <div>
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Modo demonstração
            </span>{" "}
            <span className="text-amber-800/90 dark:text-amber-200/80">
              — você está vendo dados fictícios. Solicite acesso para usar com seus próprios dados.
            </span>
          </div>
        </div>
        {requested ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Acesso solicitado — aguardando aprovação
          </div>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={requestAccess}
            disabled={submitting}
            className="shrink-0"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            Solicitar acesso
          </Button>
        )}
      </div>
    </div>
  );
}
