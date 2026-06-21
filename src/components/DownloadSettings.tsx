import { useState } from "react";
import { FolderDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  isTauri, getDownloadRules, setDownloadRules, pickFolder, type DownloadRules,
} from "@/lib/desktop";

interface Site {
  label: string;
  url: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Configura para onde vão os downloads do navegador interno (Opção A):
 * uma pasta padrão + uma pasta por site. Só aparece no app desktop.
 */
export function DownloadSettings({ sites }: { sites: Site[] }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<DownloadRules>(getDownloadRules());

  if (!isTauri()) return null;

  const save = (next: DownloadRules) => {
    setRules(next);
    setDownloadRules(next);
  };

  const chooseDefault = async () => {
    const dir = await pickFolder("Pasta padrão de downloads");
    if (dir) save({ ...rules, default: dir });
  };

  const chooseSite = async (host: string) => {
    const dir = await pickFolder(`Pasta de downloads — ${host}`);
    if (dir) save({ ...rules, bySite: { ...(rules.bySite ?? {}), [host]: dir } });
  };

  const clearSite = (host: string) => {
    const bySite = { ...(rules.bySite ?? {}) };
    delete bySite[host];
    save({ ...rules, bySite });
  };

  // De-dup por host, preservando o primeiro rótulo.
  const hosts = Array.from(
    new Map(sites.map((s) => [hostOf(s.url), s.label])).entries(),
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setRules(getDownloadRules());
          setOpen(true);
        }}
      >
        <FolderDown className="h-4 w-4" /> Pasta de downloads
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Downloads do navegador interno</DialogTitle>
            <DialogDescription>
              Defina para onde vão os arquivos baixados de cada site — sem precisar
              escolher a cada download. Vale para os sites abertos dentro do app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium">Pasta padrão</div>
              <div className="mt-1 break-all text-xs text-muted-foreground">
                {rules.default || "Não definida (usa a pasta Downloads do sistema)"}
              </div>
              <Button size="sm" variant="secondary" className="mt-2" onClick={chooseDefault}>
                Escolher pasta
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Por site</div>
              {hosts.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum site cadastrado ainda.</p>
              )}
              {hosts.map(([host, label]) => (
                <div key={host} className="rounded-lg border p-3">
                  <div className="text-sm">{label}</div>
                  <div className="break-all text-xs text-muted-foreground">{host}</div>
                  <div className="mt-1 break-all text-xs">
                    {rules.bySite?.[host]
                      ? `→ ${rules.bySite[host]}`
                      : "→ usa a pasta padrão"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => chooseSite(host)}>
                      Escolher pasta
                    </Button>
                    {rules.bySite?.[host] && (
                      <Button size="sm" variant="ghost" onClick={() => clearSite(host)}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
