import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Mail, Building2, Trash2, Key, Power, PowerOff, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  user_id: string | null;
  status: "ativo" | "bloqueado" | string;
  company_ids: string[];
}

interface CompanyOpt {
  id: string;
  nome_fantasia: string;
  cnpj: string;
}

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-customers", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminCustomers() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [resetting, setResetting] = useState<CustomerRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_customers"],
    queryFn: async () => (await callAdmin("list")) as { customers: CustomerRow[] },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["admin_companies_for_link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome_fantasia, cnpj")
        .order("nome_fantasia");
      if (error) throw error;
      return (data ?? []) as CompanyOpt[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin_customers"] });

  const setStatus = useMutation({
    mutationFn: (v: { user_id: string; status: "ativo" | "bloqueado" }) =>
      callAdmin("set_status", v),
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCustomer = useMutation({
    mutationFn: (v: { user_id: string; customer_id: string }) => callAdmin("delete", v),
    onSuccess: () => {
      toast.success("Cliente removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie acessos do portal e vincule empresas.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (data?.customers?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data!.customers.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <Badge variant={c.status === "ativo" ? "default" : "destructive"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {c.company_ids.length} empresa
                      {c.company_ids.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                    <Building2 className="mr-2 h-3.5 w-3.5" /> Empresas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetting(c)}>
                    <Key className="mr-2 h-3.5 w-3.5" /> Senha
                  </Button>
                  {c.user_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setStatus.mutate({
                          user_id: c.user_id!,
                          status: c.status === "ativo" ? "bloqueado" : "ativo",
                        })
                      }
                    >
                      {c.status === "ativo" ? (
                        <PowerOff className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Power className="mr-2 h-3.5 w-3.5" />
                      )}
                      {c.status === "ativo" ? "Desativar" : "Ativar"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!c.user_id) return;
                      if (confirm(`Remover ${c.name}? Esta ação não pode ser desfeita.`)) {
                        removeCustomer.mutate({ user_id: c.user_id, customer_id: c.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={companies}
        onDone={invalidate}
      />
      <CompaniesDialog
        customer={editing}
        onClose={() => setEditing(null)}
        companies={companies}
        onDone={invalidate}
      />
      <ResetPasswordDialog customer={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  companies,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: CompanyOpt[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      await callAdmin("create", { ...form, company_ids: picked });
      toast.success("Cliente criado com sucesso");
      setForm({ name: "", email: "", password: "" });
      setPicked([]);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Crie credenciais de acesso ao portal e vincule as empresas que ele pode visualizar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="mín. 6 caracteres"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Empresas vinculadas</Label>
            <ScrollArea className="h-56 rounded-md border p-2">
              {companies.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma empresa disponível.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {companies.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        checked={picked.includes(c.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) =>
                            v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                          )
                        }
                      />
                      <span className="text-sm">{c.nome_fantasia}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{c.cnpj}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesDialog({
  customer,
  onClose,
  companies,
  onDone,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  companies: CompanyOpt[];
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync when opening
  useState(() => {});
  if (customer && picked.length === 0 && customer.company_ids.length > 0) {
    // initialize once per open
  }

  const isOpen = !!customer;
  // reset picked whenever customer changes
  useStateInit(customer?.id, () => setPicked(customer?.company_ids ?? []));

  const save = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      await callAdmin("set_companies", { customer_id: customer.id, company_ids: picked });
      toast.success("Vínculos atualizados");
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Empresas vinculadas</DialogTitle>
          <DialogDescription>{customer?.name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 rounded-md border p-2">
          <div className="space-y-1.5">
            {companies.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={picked.includes(c.id)}
                  onCheckedChange={(v) =>
                    setPicked((prev) =>
                      v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                    )
                  }
                />
                <span className="text-sm">{c.nome_fantasia}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{c.cnpj}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const isOpen = !!customer;

  const submit = async () => {
    if (!customer?.user_id) return;
    if (pwd.length < 6) return toast.error("Mínimo 6 caracteres");
    setLoading(true);
    try {
      await callAdmin("reset_password", { user_id: customer.user_id, password: pwd });
      toast.success("Senha atualizada");
      setPwd("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>{customer?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <Input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="mín. 6 caracteres"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper to reset state when a key value changes
function useStateInit(key: unknown, fn: () => void) {
  const ref = (useStateInit as unknown as { _: Map<symbol, unknown> })._ ??
    ((useStateInit as unknown as { _: Map<symbol, unknown> })._ = new Map());
  const id = (useStateInit as unknown as { _id?: symbol })._id ??
    ((useStateInit as unknown as { _id?: symbol })._id = Symbol());
  if (ref.get(id) !== key) {
    ref.set(id, key);
    fn();
  }
}