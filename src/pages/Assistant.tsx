import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Trash2, Send, MessageSquare, Building2, Sparkles, Square, Search, X, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Thread = {
  id: string;
  title: string;
  company_ids: string[];
  updated_at: string;
};

type DbMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: any;
  created_at: string;
};

function partsToText(parts: any[]): string {
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (p?.type === "text" ? p.text : "")).join("");
}

export default function Assistant() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies } = useCompany();
  const qc = useQueryClient();

  // Threads list
  const { data: threads = [], refetch: refetchThreads } = useQuery({
    queryKey: ["ai_threads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .select("id, title, company_ids, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Thread[];
    },
  });

  // Auto-create or navigate to first thread
  useEffect(() => {
    if (!user) return;
    if (threadId) return;
    if (threads.length > 0) {
      navigate(`/assistente/${threads[0].id}`, { replace: true });
      return;
    }
    // create
    (async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .insert({ user_id: user.id, title: "Nova conversa", company_ids: [] })
        .select()
        .single();
      if (error) {
        toast.error("Erro ao criar conversa");
        return;
      }
      await refetchThreads();
      navigate(`/assistente/${data.id}`, { replace: true });
    })();
  }, [user, threadId, threads, navigate, refetchThreads]);

  const activeThread = threads.find((t) => t.id === threadId) ?? null;

  const handleNewThread = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: user.id, title: "Nova conversa", company_ids: [] })
      .select()
      .single();
    if (error) return toast.error("Erro ao criar conversa");
    await refetchThreads();
    navigate(`/assistente/${data.id}`);
  };

  const handleDeleteThread = async (id: string) => {
    const { error } = await supabase.from("ai_threads").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    await refetchThreads();
    if (id === threadId) {
      const next = threads.find((t) => t.id !== id);
      navigate(next ? `/assistente/${next.id}` : "/assistente", { replace: true });
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Thread list */}
      <aside className="w-64 shrink-0 flex flex-col rounded-xl border bg-card">
        <div className="p-3 border-b">
          <Button onClick={handleNewThread} className="w-full" size="sm">
            <Plus className="size-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 flex flex-col gap-1">
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">Sem conversas ainda.</p>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer hover:bg-muted",
                  t.id === threadId && "bg-muted",
                )}
                onClick={() => navigate(`/assistente/${t.id}`)}
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{t.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteThread(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat */}
      <section className="flex-1 min-w-0 flex flex-col rounded-xl border bg-card overflow-hidden">
        {activeThread ? (
          <ChatWindow
            key={activeThread.id}
            thread={activeThread}
            companies={companies}
            onThreadUpdated={() => {
              qc.invalidateQueries({ queryKey: ["ai_threads", user?.id] });
            }}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            Carregando…
          </div>
        )}
      </section>
    </div>
  );
}

function ChatWindow({
  thread,
  companies,
  onThreadUpdated,
}: {
  thread: Thread;
  companies: { id: string; nome_fantasia: string; razao_social: string }[];
  onThreadUpdated: () => void;
}) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [companyIds, setCompanyIds] = useState<string[]>(thread.company_ids ?? []);
  const [input, setInput] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [savingScope, setSavingScope] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>(JSON.stringify(thread.company_ids ?? []));

  // Sort companies alphabetically + filter by search
  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) =>
      (a.nome_fantasia || a.razao_social || "").localeCompare(
        b.nome_fantasia || b.razao_social || "",
        "pt-BR",
        { sensitivity: "base" },
      ),
    );
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return sortedCompanies;
    return sortedCompanies.filter((c) =>
      `${c.nome_fantasia ?? ""} ${c.razao_social ?? ""}`.toLowerCase().includes(q),
    );
  }, [sortedCompanies, companySearch]);

  // Load history
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Erro ao carregar histórico");
        setInitialMessages([]);
        return;
      }
      const ui: UIMessage[] = (data ?? []).map((m: DbMessage) => ({
        id: m.id,
        role: m.role as any,
        parts: Array.isArray(m.parts) && m.parts.length > 0
          ? m.parts
          : [{ type: "text", text: "" }],
      }));
      setInitialMessages(ui);
    })();
  }, [thread.id]);

  const apiUrl = useMemo(
    () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`,
    [],
  );

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: apiUrl,
      fetch: async (url, init) => {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const headers = new Headers(init?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        headers.set("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        // Inject threadId into body
        let body = init?.body;
        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            parsed.threadId = thread.id;
            body = JSON.stringify(parsed);
          } catch {/* ignore */}
        }
        return fetch(url, { ...init, headers, body });
      },
    });
  }, [apiUrl, thread.id]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: thread.id,
    messages: initialMessages ?? [],
    transport,
    onError: (e) => {
      toast.error(e.message || "Erro no assistente");
    },
    onFinish: () => {
      onThreadUpdated();
    },
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [thread.id, status]);

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0 && companyIds.length > 0 && !isLoading;

  // Debounced persistence — instant UI, single DB write
  const persistScope = (ids: string[]) => {
    const key = JSON.stringify([...ids].sort());
    if (key === lastPersistedRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setSavingScope(true);
    persistTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("ai_threads")
        .update({ company_ids: ids })
        .eq("id", thread.id);
      setSavingScope(false);
      if (error) {
        toast.error("Erro ao salvar seleção de empresas");
        return;
      }
      lastPersistedRef.current = key;
      onThreadUpdated();
    }, 400);
  };

  const toggleCompany = (id: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...companyIds, id]))
      : companyIds.filter((x) => x !== id);
    setCompanyIds(next);
    persistScope(next);
  };

  const selectAllFiltered = () => {
    const next = Array.from(new Set([...companyIds, ...filteredCompanies.map((c) => c.id)]));
    setCompanyIds(next);
    persistScope(next);
  };

  const clearScope = () => {
    setCompanyIds([]);
    persistScope([]);
  };

  // Flush pending write on unmount / thread switch
  useEffect(() => {
    return () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        const key = JSON.stringify([...companyIds].sort());
        if (key !== lastPersistedRef.current) {
          supabase.from("ai_threads").update({ company_ids: companyIds }).eq("id", thread.id);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const handleSend = async () => {
    if (!canSend) return;
    // Flush pending scope write before sending so the edge function sees latest scope
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const key = JSON.stringify([...companyIds].sort());
      if (key !== lastPersistedRef.current) {
        const { error: scopeErr } = await supabase
          .from("ai_threads")
          .update({ company_ids: companyIds })
          .eq("id", thread.id);
        if (scopeErr) {
          toast.error("Erro ao salvar seleção de empresas");
          return;
        }
        lastPersistedRef.current = key;
        setSavingScope(false);
      }
    }
    const text = input.trim();
    setInput("");
    // Auto-title from first user msg
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("ai_threads").update({ title }).eq("id", thread.id);
      onThreadUpdated();
    }
    await sendMessage({ text });
  };

  return (
    <>
      {/* Header — scope picker */}
      <div className="border-b p-3 flex items-center gap-2 flex-wrap">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">Assistente IA · Movimento</span>
        <div className="ml-auto flex items-center gap-2">
          {savingScope && (
            <span className="text-xs text-muted-foreground">Salvando…</span>
          )}
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Building2 className="size-4" />
                {companyIds.length === 0
                  ? "Selecionar empresas"
                  : `${companyIds.length} empresa${companyIds.length > 1 ? "s" : ""}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-2 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Buscar empresa…"
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {companyIds.length} de {companies.length} selecionada
                    {companies.length === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={selectAllFiltered}
                      disabled={filteredCompanies.length === 0}
                    >
                      <Check className="size-3" /> Todas
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={clearScope}
                      disabled={companyIds.length === 0}
                    >
                      <X className="size-3" /> Limpar
                    </Button>
                  </div>
                </div>
              </div>
              <ScrollArea className="max-h-72">
                <div className="p-2 flex flex-col gap-0.5">
                  {companies.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Nenhuma empresa disponível. Cadastre uma empresa primeiro.
                    </p>
                  )}
                  {companies.length > 0 && filteredCompanies.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Nenhuma empresa corresponde à busca.
                    </p>
                  )}
                  {filteredCompanies.map((c) => {
                    const checked = companyIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleCompany(c.id, !!v)}
                        />
                        <span className="truncate flex-1">
                          {c.nome_fantasia || c.razao_social}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected scope summary */}
      {companyIds.length > 0 && (
        <div className="border-b px-3 py-2 flex flex-wrap gap-1.5 bg-muted/30">
          {companyIds.map((id) => {
            const c = companies.find((x) => x.id === id);
            if (!c) return null;
            return (
              <Badge key={id} variant="secondary" className="font-normal gap-1 pr-1">
                {c.nome_fantasia || c.razao_social}
                <button
                  type="button"
                  onClick={() => toggleCompany(id, false)}
                  className="rounded-full hover:bg-background/60 p-0.5"
                  aria-label="Remover empresa"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-sm text-muted-foreground mt-8 max-w-md mx-auto space-y-2">
            <Sparkles className="size-8 mx-auto text-primary/60" />
            <p className="font-medium text-foreground">Pergunte sobre os movimentos</p>
            <p>
              {companyIds.length === 0
                ? "Selecione ao menos uma empresa para começar."
                : "Ex.: \"Qual o ICMS total nos últimos 6 meses?\" ou \"Compare o faturamento das empresas\"."}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {messages.map((m) => {
            const text = partsToText(m.parts as any);
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "…"}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">
                Pensando…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              companyIds.length === 0
                ? "Selecione empresas para começar…"
                : "Pergunte algo sobre os movimentos…"
            }
            disabled={companyIds.length === 0}
            rows={2}
            className="resize-none min-h-[52px]"
          />
          {isLoading ? (
            <Button onClick={() => stop()} variant="outline" size="icon" className="size-[52px]">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className="size-[52px]"
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive mt-2 text-center">{error.message}</p>
        )}
      </div>
    </>
  );
}