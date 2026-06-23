import { useState, useEffect } from "react";
import { isTauri } from "@/lib/desktop";

interface UpdateInfo {
  available: boolean;
  version: string;
  notes: string;
}

export function useAppUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    available: false,
    version: "",
    notes: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar updates ao montar o componente
  useEffect(() => {
    if (!isTauri()) return;

    const checkForUpdate = async () => {
      try {
        // Importar dinamicamente apenas no Tauri
        const { check } = await import("@tauri-apps/plugin-updater");
        // No Tauri 2, check() retorna Update | null (null = sem atualização)
        const update = await check();
        if (update) {
          setUpdateInfo({
            available: true,
            version: update.version,
            notes: update.body || "",
          });
        }
      } catch (err) {
        console.error("Erro ao verificar atualização:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      }
    };

    checkForUpdate();

    // Verificar a cada 30 minutos
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const installUpdate = async () => {
    try {
      setIsUpdating(true);
      // Importar dinamicamente apenas no Tauri
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (update) {
        // Baixa e instala a atualização
        await update.downloadAndInstall();
        // Reinicia o app para aplicar a nova versão
        await relaunch();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      setError(message);
      console.error("Erro durante atualização:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const dismissUpdate = () => {
    setUpdateInfo({
      available: false,
      version: "",
      notes: "",
    });
  };

  return {
    updateInfo,
    isUpdating,
    error,
    installUpdate,
    dismissUpdate,
  };
}
