import { useAppUpdater } from "@/hooks/useAppUpdater";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, X, Loader2 } from "lucide-react";

export function UpdateNotification() {
  const { updateInfo, isUpdating, error, installUpdate, dismissUpdate } =
    useAppUpdater();

  if (!updateInfo.available) {
    return null;
  }

  return (
    <Alert className="bg-blue-50 border-blue-200 border-2 fixed bottom-4 right-4 max-w-sm shadow-lg">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-blue-900">
            Atualização disponível: v{updateInfo.version}
          </AlertTitle>
          <AlertDescription className="text-blue-800 text-sm mt-1">
            {updateInfo.notes
              ? updateInfo.notes.substring(0, 100) + "..."
              : "Baixe a versão mais recente"}
          </AlertDescription>
          {error && (
            <div className="text-red-600 text-xs mt-1">Erro: {error}</div>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={installUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Atualizar agora
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="text-blue-600 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
