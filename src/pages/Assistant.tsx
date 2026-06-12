import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Building2, Sparkles, Square, Search, X, Check, Tag as TagIcon, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useTags, useCompanyTags } from "@/hooks/useTags";
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

function partsToText(parts: any[]): string {
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (p?.type === "text" ? p.text : "")).join("");
}

export default function Assistant() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const { data: tags = [] } = useTags();
  const { data: companyTags = [] } = useCompanyTags();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [savingScope, setSavingScope] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>("[]");

  // Bootstrap: load the user's single active conversation (or create one).
  // Keep ONLY one thread per user — delete any extras (older ones).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBootstrapping(true);
      const { data: threads, error: tErr } = await supabase
        .from("ai_threads")
        .select("id, company_ids, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (tErr) {
        toast.error("Erro ao carregar conversa");
        setBootstrapping(false);
        return;
      }
      let activeId: string | null = null;
      let scope: string[] = [];
      if (threads && threads.length > 0) {
        activeId = threads[0].id;
        scope = (threads[0].company_ids as string[]) ?? [];
        // Delete extras if any
        const extras = threads.slice(1).map((t) => t.id);
        if (extras.length > 0) {
          await supabase.from("ai_threads").delete().in("id", extras);
        }
      } else {
        const { data: created, error: cErr } = await supabase
          .from("ai_threads")
          .insert({ user_id: user.id, title: "Conversa", company_ids: [] })
          .select("id")
          .single();
        if (cErr || !created) {
          toast.error("Erro ao iniciar conversa");
          setBootstrapping(false);
          return;
        }
        activeId = created.id;
      }

      // Load messages
      const { data: rows } = await supabase
        .from("ai_messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", activeId)
        .order("created_at", { ascending: true });
      const initial: UIMessage[] = (rows ?? []).map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        parts: (r.parts as any) ?? [],
      }));

      if (cancelled) return;
      setCompanyIds(scope);
      lastPersistedRef.current = JSON.stringify([...scope].sort());
      setInitialMessages(initial);
      setThreadId(activeId);
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Indexes for tag selection
  const companyIdsByTag = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const ct of companyTags) {
      const arr = m.get(ct.tag_id) ?? [];
      arr.push(ct.company_id);
      m.set(ct.tag_id, arr);
    }
    return m;
  }, [companyTags]);

  const tagsWithCompanies = useMemo(
    () =>
      tags
        .map((t) => ({ ...t, companyIds: companyIdsByTag.get(t.id) ?? [] }))
        .filter((t) => t.companyIds.length > 0),
    [tags, companyIdsByTag],
  );

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
        let body = init?.body;
        if (typeof body === "string" && threadId) {
          try {
            const parsed = JSON.parse(body);
            parsed.threadId = threadId;
            body = JSON.stringify(parsed);
          } catch {/* ignore */}
        }
        return fetch(url, { ...init, headers, body });
      },
    });
  }, [apiUrl, threadId]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId ?? "pending",
    messages: initialMessages,
    transport,
    onError: (e) => {
      toast.error(e.message || "Erro no assistente");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";
  const canSend =
    input.trim().length > 0 && companyIds.length > 0 && !isLoading && !!threadId;

  const persistScope = (ids: string[]) => {
    if (!threadId) return;
    const key = JSON.stringify([...ids].sort());
    if (key === lastPersistedRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setSavingScope(true);
    persistTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("ai_threads")
        .update({ company_ids: ids })
        .eq("id", threadId);
      setSavingScope(false);
      if (error) {
        toast.error("Erro ao salvar seleção de empresas");
        return;
      }
      lastPersistedRef.current = key;
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

  // Tag selection: toggles ALL companies of that tag together
  const tagFullySelected = (tagId: string) => {
    const ids = companyIdsByTag.get(tagId) ?? [];
    if (ids.length === 0) return false;
    return ids.every((id) => companyIds.includes(id));
  };

  const toggleTag = (tagId: string) => {
    const ids = companyIdsByTag.get(tagId) ?? [];
    if (ids.length === 0) return;
    const allSelected = tagFullySelected(tagId);
    const next = allSelected
      ? companyIds.filter((id) => !ids.includes(id))
      : Array.from(new Set([...companyIds, ...ids]));
    setCompanyIds(next);
    persistScope(next);
  };

  const handleNewConversation = async () => {
    if (!user || !threadId) return;
    // Cancel pending scope save
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    // Delete current thread (cascade removes ai_messages)
    const { error: delErr } = await supabase
      .from("ai_threads")
      .delete()
      .eq("id", threadId);
    if (delErr) {
      toast.error("Erro ao excluir conversa atual");
      return;
    }
    // Reset local state
    setInput("");
    setCompanyIds([]);
    lastPersistedRef.current = "[]";
    setInitialMessages([]);
    setThreadId(null);
    // Create fresh thread
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: user.id, title: "Conversa", company_ids: [] })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Erro ao iniciar conversa");
      return;
    }
    setThreadId(data.id);
  };

  const handleSend = async () => {
    if (!canSend || !threadId) return;
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const key = JSON.stringify([...companyIds].sort());
      if (key !== lastPersistedRef.current) {
        const { error: scopeErr } = await supabase
          .from("ai_threads")
          .update({ company_ids: companyIds })
          .eq("id", threadId);
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
    await sendMessage({ text });
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] max-md:h-[calc(100dvh-6rem)]">
      <section className="flex-1 min-w-0 flex flex-col rounded-xl border bg-card overflow-hidden">
        {/* Header — scope picker */}
        <div className="border-b p-3 flex items-center gap-2 flex-wrap">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">Assistente IA · Movimento</span>
          <div className="ml-auto flex items-center gap-2">
            {savingScope && (
              <span className="text-xs text-muted-foreground">Salvando…</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConversation}
              disabled={isLoading}
              title="Nova conversa"
            >
              <RefreshCw className="size-4" /> Nova conversa
            </Button>
            <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Building2 className="size-4" />
                  {companyIds.length === 0
                    ? "Selecionar empresas"
                    : `${companyIds.length} empresa${companyIds.length > 1 ? "s" : ""}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
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

                {/* Tag chips */}
                {tagsWithCompanies.length > 0 && (
                  <div className="p-2 border-b">
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                      <TagIcon className="size-3" />
                      <span>Selecionar por tag</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tagsWithCompanies.map((t) => {
                        const active = tagFullySelected(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTag(t.id)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                              active
                                ? "border-transparent text-white"
                                : "bg-background hover:bg-muted",
                            )}
                            style={
                              active
                                ? { backgroundColor: t.color, borderColor: t.color }
                                : { borderColor: t.color, color: t.color }
                            }
                            title={`${t.companyIds.length} empresa(s)`}
                          >
                            {active && <Check className="size-3" />}
                            <span className="truncate max-w-[140px]">{t.name}</span>
                            <span className="opacity-70">({t.companyIds.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  ? "Selecione ao menos uma empresa (ou uma tag) para começar."
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
              disabled={companyIds.length === 0 || !threadId}
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
      </section>
    </div>
  );
}