import { useState, useCallback } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import { Trash2, Copy, Link, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CanvasCardData extends Record<string, unknown> {
  title: string;
  description: string;
  notes: string;
  link: string;
  color: string;
}

const CARD_COLORS = [
  { hex: "#ffffff", label: "Branco"        },
  { hex: "#fef2f2", label: "Vermelho claro"},
  { hex: "#fff7ed", label: "Laranja claro" },
  { hex: "#fefce8", label: "Amarelo claro" },
  { hex: "#f0fdf4", label: "Verde claro"   },
  { hex: "#eff6ff", label: "Azul claro"    },
  { hex: "#faf5ff", label: "Roxo claro"    },
  { hex: "#f1f5f9", label: "Cinza claro"   },
  { hex: "#73030D", label: "Carmesim"      },
  { hex: "#732F3B", label: "Bordô"         },
  { hex: "#1e3a5f", label: "Azul escuro"   },
  { hex: "#1e293b", label: "Slate escuro"  },
];

function isDark(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const HANDLE_BASE =
  "!h-3 !w-3 !rounded-full !border-2 !border-white !bg-primary !opacity-0 !transition-opacity group-hover:!opacity-100";

export function CanvasCardNode({ id, data, selected }: NodeProps) {
  const { setNodes, updateNodeData } = useReactFlow();
  const d = data as CanvasCardData;

  const [localTitle, setLocalTitle]   = useState(d.title);
  const [localDesc,  setLocalDesc]    = useState(d.description || "");
  const [localNotes, setLocalNotes]   = useState(d.notes || "");
  const [localLink,  setLocalLink]    = useState(d.link || "");
  const [showExtra,  setShowExtra]    = useState(false);
  const [showColors, setShowColors]   = useState(false);

  const dark      = isDark(d.color);
  const textCls   = dark ? "text-white placeholder:text-white/40" : "text-foreground placeholder:text-muted-foreground/40";
  const mutedCls  = dark ? "text-white/60" : "text-muted-foreground";
  const dividerCls = dark ? "bg-white/15" : "bg-border/30";

  const sp = (e: React.SyntheticEvent) => e.stopPropagation();

  const handleDelete = useCallback(() => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
  }, [id, setNodes]);

  const handleDuplicate = useCallback(() => {
    setNodes((ns) => {
      const src = ns.find((n) => n.id === id);
      if (!src) return ns;
      return [
        ...ns,
        {
          ...src,
          id: `node_${Date.now()}`,
          position: { x: src.position.x + 24, y: src.position.y + 24 },
          selected: false,
        },
      ];
    });
  }, [id, setNodes]);

  return (
    <div
      className={cn(
        "group relative w-56 rounded-2xl border-2 shadow-md transition-all",
        selected
          ? "border-primary shadow-[0_0_0_3px_rgba(115,3,13,0.15)]"
          : "border-transparent shadow-sm hover:shadow-md",
      )}
      style={{ backgroundColor: d.color }}
    >
      {/* ── Handles ─────────────────────────────────────────────────────── */}
      <Handle type="source" position={Position.Top}    id="t" className={HANDLE_BASE} style={{ top: -7 }} />
      <Handle type="source" position={Position.Right}  id="r" className={HANDLE_BASE} style={{ right: -7 }} />
      <Handle type="source" position={Position.Bottom} id="b" className={HANDLE_BASE} style={{ bottom: -7 }} />
      <Handle type="source" position={Position.Left}   id="l" className={HANDLE_BASE} style={{ left: -7 }} />

      {/* ── Floating toolbar ─────────────────────────────────────────────── */}
      <div
        className="absolute -top-8 right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        onMouseDown={sp}
        onClick={sp}
      >
        {/* Color swatch */}
        <div className="relative">
          <button
            type="button"
            title="Cor"
            onClick={(e) => { sp(e); setShowColors((p) => !p); }}
            className="h-6 w-6 rounded-full border-2 border-white shadow transition-transform hover:scale-110"
            style={{ backgroundColor: d.color }}
          />
          {showColors && (
            <div
              className="absolute bottom-8 right-0 z-50 flex flex-wrap gap-1.5 rounded-xl border border-border/30 bg-white/95 p-2 shadow-lg backdrop-blur-sm dark:bg-neutral-900/95"
              style={{ width: 128 }}
              onMouseDown={sp}
              onClick={sp}
            >
              {CARD_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  onClick={() => { updateNodeData(id, { color: c.hex }); setShowColors(false); }}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.hex,
                    borderColor: d.color === c.hex ? "#000" : "#e2e8f0",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          title="Duplicar"
          onClick={(e) => { sp(e); handleDuplicate(); }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-white/90 text-muted-foreground shadow backdrop-blur-sm hover:text-foreground"
        >
          <Copy className="h-3 w-3" />
        </button>

        <button
          type="button"
          title="Excluir"
          onClick={(e) => { sp(e); handleDelete(); }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-white/90 text-muted-foreground shadow backdrop-blur-sm hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* ── Card content ─────────────────────────────────────────────────── */}
      <div className="space-y-2 p-3">
        {/* Title */}
        <input
          className={cn(
            "nodrag w-full bg-transparent text-sm font-semibold outline-none",
            textCls,
          )}
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => localTitle !== d.title && updateNodeData(id, { title: localTitle })}
          onMouseDown={sp}
          onKeyDown={sp}
          placeholder="Título…"
        />

        <div className={cn("h-px", dividerCls)} />

        {/* Description */}
        <textarea
          className={cn(
            "nodrag w-full resize-none bg-transparent text-xs leading-relaxed outline-none",
            textCls,
          )}
          rows={3}
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={() => localDesc !== d.description && updateNodeData(id, { description: localDesc })}
          onMouseDown={sp}
          onKeyDown={sp}
          placeholder="Descrição…"
        />

        {/* Toggle extras */}
        <button
          type="button"
          className={cn("nodrag flex items-center gap-1 text-[10px] font-medium hover:underline underline-offset-2", mutedCls)}
          onClick={(e) => { sp(e); setShowExtra((p) => !p); }}
          onMouseDown={sp}
        >
          {showExtra ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showExtra ? "Ocultar extras" : "Notas e link"}
        </button>

        {showExtra && (
          <div className="space-y-2 pt-0.5" onMouseDown={sp}>
            <div className={cn("h-px", dividerCls)} />

            {/* Notes */}
            <div className="flex items-start gap-1.5">
              <StickyNote className={cn("mt-0.5 h-3 w-3 shrink-0", mutedCls)} />
              <textarea
                className={cn("nodrag flex-1 resize-none bg-transparent text-xs leading-relaxed outline-none", textCls)}
                rows={2}
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={() => localNotes !== d.notes && updateNodeData(id, { notes: localNotes })}
                onKeyDown={sp}
                placeholder="Observações…"
              />
            </div>

            {/* Link */}
            <div className="flex items-center gap-1.5">
              <Link className={cn("h-3 w-3 shrink-0", mutedCls)} />
              <input
                type="url"
                className={cn("nodrag flex-1 truncate bg-transparent text-xs outline-none", textCls)}
                value={localLink}
                onChange={(e) => setLocalLink(e.target.value)}
                onBlur={() => localLink !== d.link && updateNodeData(id, { link: localLink })}
                onKeyDown={sp}
                placeholder="https://…"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
