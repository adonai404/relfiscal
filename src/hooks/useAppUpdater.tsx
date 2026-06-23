import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/api/process";
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
        const update = await check();
        if (update?.shouldUpdate && update.manifest) {
          setUpdateInfo({
            available: true,
            version: update.manifest.version,
            notes: update.manifest.body || "",
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
      const update = await check();
      if (update?.shouldUpdate) {
        await update.downloadAndInstall();
        // Reiniciar o app
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
