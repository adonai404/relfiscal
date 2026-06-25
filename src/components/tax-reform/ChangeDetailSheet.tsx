import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  CheckSquare,
  ListTodo,
  Paperclip,
  Plus,
  Trash2,
  Loader2,
  Download,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  TaxReformChange,
  TaxReformChecklistItem,
  TaxReformTask,
  TaxReformAttachment,
  TaxReformTaskStatus,
  TaxReformUrgency,
} from "./types";

const BUCKET = "tax-reform-files";

// ── Urgência ─────────────────────────────────────────────────────────────────

const URGENCY_DOT: Record<TaxReformUrgency, string> = {
  critical:      "bg-[#73030D]",
  important:     "bg-[#732F3B]",
  informational: "bg-[#8C8C8C]",
};

const URGENCY_LABEL: Record<TaxReformUrgency, string> = {
  critical:      "Crítico",
  important:     "Importante",
  informational: "Informativo",
};

const URGENCY_PILL: Record<TaxReformUrgency, string> = {
  critical:
    "bg-[#73030D]/10 text-[#73030D] ring-1 ring-[#73030D]/20 dark:bg-[#73030D]/20 dark:text-rose-300",
  important:
    "bg-[#732F3B]/10 text-[#732F3B] ring-1 ring-[#732F3B]/20 dark:bg-[#732F3B]/20 dark:text-rose-400",
  informational:
    "bg-[#8C8C8C]/10 text-[#5a5a5a] ring-1 ring-[#8C8C8C]/20 dark:bg-[#8C8C8C]/10 dark:text-stone-400",
};

// ── Status de tarefa ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: TaxReformTaskStatus;
  label: string;
  dot: string;
  pill: string;
}[] = [
  {
    value: "pending",
    label: "Pendente",
    dot:  "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "completed",
    label: "Concluída",
    dot:  "bg-green-500",
    pill: "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-400",
  },
  {
    value: "overdue",
    label: "Em Atraso",
    dot:  "bg-red-500",
    pill: "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400",
  },
  {
    value: "paused",
    label: "Pausado",
    dot:  "bg-amber-400",
    pill: "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  },
  {
    value: "waiting",
    label: "Aguardando",
    dot:  "bg-purple-400",
    pill: "bg-purple-50 text-purple-600 ring-1 ring-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
  },
];

function statusOption(v: TaxReformTaskStatus) {
  return STATUS_OPTIONS.find((o) => o.value === v) ?? STATUS_OPTIONS[0];
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type TabKey = "notes" | "checklist" | "tasks" | "attachments";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "notes",       label: "Anotações", icon: FileText    },
  { key: "checklist",   label: "Checklist", icon: CheckSquare },
  { key: "tasks",       label: "Tarefas",   icon: ListTodo    },
  { key: "attachments", label: "Anexos",    icon: Paperclip   },
];

// ── Utils ─────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

async function getSignedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  change: TaxReformChange | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function ChangeDetailSheet({ change, open, onClose, onRefresh }: Props) {
  const qc        = useQueryClient();
  const changeId  = change?.id;

  const [activeTab, setActiveTab] = useState<TabKey>("notes");

  // Notes autosave
  const [localNotes, setLocalNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline add inputs
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newTaskTitle, setNewTaskTitle]         = useState("");
  const [isUploading, setIsUploading]           = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirm-delete targets
  const [deleteTask,       setDeleteTask]       = useState<TaxReformTask | null>(null);
  const [deleteCheckItem,  setDeleteCheckItem]  = useState<TaxReformChecklistItem | null>(null);
  const [deleteAttachment, setDeleteAttachment] = useState<TaxReformAttachment | null>(null);

  // Reset when change switches
  useEffect(() => {
    setLocalNotes(change?.notes ?? "");
    setSaveStatus("idle");
    setActiveTab("notes");
  }, [change?.id]);

  // Debounced autosave for notes
  useEffect(() => {
    if (!changeId || localNotes === (change?.notes ?? "")) return;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("tax_reform_changes")
        .update({ notes: localNotes })
        .eq("id", changeId);
      if (!error) {
        setSaveStatus("saved");
        onRefresh();
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [localNotes, changeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: checklist = [] } = useQuery({
    queryKey: ["tax_reform_checklist", changeId],
    enabled: open && !!changeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_checklist").select("*")
        .eq("change_id", changeId!).order("position").order("created_at");
      if (error) throw error;
      return data as TaxReformChecklistItem[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tax_reform_tasks", changeId],
    enabled: open && !!changeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_tasks").select("*")
        .eq("change_id", changeId!).order("position").order("created_at");
      if (error) throw error;
      return data as TaxReformTask[];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["tax_reform_attachments", changeId],
    enabled: open && !!changeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_attachments").select("*")
        .eq("change_id", changeId!).order("created_at");
      if (error) throw error;
      return data as TaxReformAttachment[];
    },
  });

  const refreshChecklist   = () => qc.invalidateQueries({ queryKey: ["tax_reform_checklist",   changeId] });
  const refreshTasks       = () => qc.invalidateQueries({ queryKey: ["tax_reform_tasks",        changeId] });
  const refreshAttachments = () => qc.invalidateQueries({ queryKey: ["tax_reform_attachments",  changeId] });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddChecklistItem = async () => {
    if (!newChecklistText.trim() || !changeId) return;
    const { error } = await supabase.from("tax_reform_checklist").insert({
      change_id: changeId, text: newChecklistText.trim(), position: checklist.length,
    });
    if (error) toast.error("Erro ao adicionar item");
    else { setNewChecklistText(""); refreshChecklist(); }
  };

  const handleToggleChecklist = async (item: TaxReformChecklistItem) => {
    await supabase.from("tax_reform_checklist")
      .update({ checked: !item.checked }).eq("id", item.id);
    refreshChecklist();
  };

  const handleDeleteChecklistItem = async (item: TaxReformChecklistItem) => {
    await supabase.from("tax_reform_checklist").delete().eq("id", item.id);
    refreshChecklist(); setDeleteCheckItem(null);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !changeId) return;
    const { error } = await supabase.from("tax_reform_tasks").insert({
      change_id: changeId, title: newTaskTitle.trim(), position: tasks.length,
    });
    if (error) toast.error("Erro ao adicionar tarefa");
    else { setNewTaskTitle(""); refreshTasks(); }
  };

  const handleUpdateTaskStatus = async (task: TaxReformTask, status: TaxReformTaskStatus) => {
    await supabase.from("tax_reform_tasks").update({ status }).eq("id", task.id);
    refreshTasks();
  };

  const handleDeleteTask = async (task: TaxReformTask) => {
    await supabase.from("tax_reform_tasks").delete().eq("id", task.id);
    refreshTasks(); setDeleteTask(null);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !changeId) return;
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) { toast.error("Máximo 50 MB."); return; }
    setIsUploading(true);
    const path = `${changeId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) { toast.error("Erro ao fazer upload"); setIsUploading(false); return; }
    const { error: dbErr } = await supabase.from("tax_reform_attachments").insert({
      change_id: changeId, file_name: file.name,
      file_path: path, file_size: file.size, file_mime: file.type,
    });
    setIsUploading(false);
    if (dbErr) toast.error("Erro ao registrar arquivo"); else refreshAttachments();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (att: TaxReformAttachment) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) { toast.error("Erro ao gerar link"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = att.file_name; a.click();
  };

  const handleDeleteAttachment = async (att: TaxReformAttachment) => {
    await supabase.storage.from(BUCKET).remove([att.file_path]);
    await supabase.from("tax_reform_attachments").delete().eq("id", att.id);
    refreshAttachments(); setDeleteAttachment(null);
  };

  const checkedCount = checklist.filter((c) => c.checked).length;

  if (!change) return null;

  const category = change.tax_reform_categories;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
        >

          {/* ── Header ─────────────────────────────────────────────────── */}
          <SheetHeader className="shrink-0 border-b border-border/30 bg-white/60 px-6 py-4 backdrop-blur-md dark:bg-black/20">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", URGENCY_DOT[change.urgency])} />
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", URGENCY_PILL[change.urgency])}>
                {URGENCY_LABEL[change.urgency]}
              </span>
              {category && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </span>
              )}
            </div>

            <SheetTitle className="mt-2 pr-8 text-[18px] font-semibold leading-snug text-foreground">
              {change.title}
            </SheetTitle>

            {change.description && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {change.description}
              </p>
            )}

            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(change.exact_date)}</span>
            </div>
          </SheetHeader>

          {/* ── Segment tabs ───────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-border/30 bg-white/40 px-5 py-3 backdrop-blur-sm dark:bg-black/10">
            <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                    activeTab === key
                      ? "bg-white text-foreground shadow-sm dark:bg-white/15"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ────────────────────────────────────────────── */}

          {/* NOTES */}
          {activeTab === "notes" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Anotações livres
                </span>
                <span className={cn(
                  "text-xs transition-all",
                  saveStatus === "idle"   && "opacity-0",
                  saveStatus === "saving" && "text-muted-foreground opacity-100",
                  saveStatus === "saved"  && "text-green-600 opacity-100 dark:text-green-400",
                )}>
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
                    </span>
                  )}
                  {saveStatus === "saved" && "Salvo"}
                </span>
              </div>
              <Textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Escreva suas anotações sobre esta mudança…"
                className="flex-1 resize-none rounded-2xl border-border/40 bg-white/70 text-sm leading-relaxed backdrop-blur-sm dark:bg-white/5"
              />
            </div>
          )}

          {/* CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
              {checklist.length > 0 && (
                <div className="shrink-0 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{checkedCount} de {checklist.length} itens concluídos</span>
                    <span className="font-semibold">{Math.round((checkedCount / checklist.length) * 100)}%</span>
                  </div>
                  <Progress value={(checkedCount / checklist.length) * 100} className="h-1.5 rounded-full" />
                </div>
              )}

              <ScrollArea className="flex-1 overflow-hidden">
                <div className="overflow-hidden rounded-2xl border border-border/30 bg-white/70 backdrop-blur-sm dark:bg-white/[0.04]">
                  {checklist.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum item no checklist ainda.
                    </p>
                  ) : (
                    checklist.map((item, i) => (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30",
                          i < checklist.length - 1 && "border-b border-border/25",
                        )}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => handleToggleChecklist(item)}
                          className="mt-0.5 shrink-0"
                        />
                        <span className={cn(
                          "flex-1 text-sm leading-snug",
                          item.checked && "text-muted-foreground line-through",
                        )}>
                          {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteCheckItem(item)}
                          className="mt-0.5 shrink-0 opacity-0 transition-all group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Add input */}
              <div className="shrink-0 flex items-center gap-2 rounded-2xl border border-border/40 bg-white/70 px-4 py-2.5 backdrop-blur-sm dark:bg-white/5">
                <input
                  type="text"
                  placeholder="Adicionar item…"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistText.trim()}
                  className="rounded-full bg-primary p-1.5 text-primary-foreground transition-opacity disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TASKS */}
          {activeTab === "tasks" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="overflow-hidden rounded-2xl border border-border/30 bg-white/70 backdrop-blur-sm dark:bg-white/[0.04]">
                  {tasks.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma tarefa cadastrada ainda.
                    </p>
                  ) : (
                    tasks.map((task, i) => {
                      const s = statusOption(task.status);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30",
                            i < tasks.length - 1 && "border-b border-border/25",
                          )}
                        >
                          {/* Status dot */}
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />

                          {/* Title */}
                          <span className="flex-1 text-sm font-medium leading-snug">
                            {task.title}
                          </span>

                          {/* Status dropdown — DropdownMenu para trigger totalmente customizado */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80",
                                  s.pill,
                                )}
                              >
                                {s.label}
                                <ChevronDown className="h-3 w-3 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              {STATUS_OPTIONS.map((o) => (
                                <DropdownMenuItem
                                  key={o.value}
                                  onClick={() => handleUpdateTaskStatus(task, o.value)}
                                  className={cn(
                                    "flex items-center gap-2 cursor-pointer",
                                    task.status === o.value && "font-semibold",
                                  )}
                                >
                                  <span className={cn("h-2 w-2 shrink-0 rounded-full", o.dot)} />
                                  {o.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteTask(task)}
                            className="shrink-0 opacity-0 transition-all group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Add task input */}
              <div className="shrink-0 flex items-center gap-2 rounded-2xl border border-border/40 bg-white/70 px-4 py-2.5 backdrop-blur-sm dark:bg-white/5">
                <input
                  type="text"
                  placeholder="Adicionar tarefa…"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="rounded-full bg-primary p-1.5 text-primary-foreground transition-opacity disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ATTACHMENTS */}
          {activeTab === "attachments" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="overflow-hidden rounded-2xl border border-border/30 bg-white/70 backdrop-blur-sm dark:bg-white/[0.04]">
                  {attachments.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum arquivo anexado ainda.
                    </p>
                  ) : (
                    attachments.map((att, i) => (
                      <div
                        key={att.id}
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30",
                          i < attachments.length - 1 && "border-b border-border/25",
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{att.file_name}</p>
                          {att.file_size != null && (
                            <p className="text-xs text-muted-foreground">{formatBytes(att.file_size)}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleDownload(att)}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteAttachment(att)}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Upload button */}
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.doc,.xls,.txt"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                  ) : (
                    <><Paperclip className="h-4 w-4" /> Anexar arquivo</>
                  )}
                </button>
              </div>
            </div>
          )}

        </SheetContent>
      </Sheet>

      {/* ── Confirm dialogs ───────────────────────────────────────────────── */}

      <AlertDialog open={!!deleteTask} onOpenChange={(v) => !v && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTask?.title}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTask && handleDeleteTask(deleteTask)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCheckItem} onOpenChange={(v) => !v && setDeleteCheckItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteCheckItem?.text}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCheckItem && handleDeleteChecklistItem(deleteCheckItem)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAttachment} onOpenChange={(v) => !v && setDeleteAttachment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteAttachment?.file_name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAttachment && handleDeleteAttachment(deleteAttachment)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
