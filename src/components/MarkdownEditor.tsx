import { useRef, useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/MarkdownView";
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Link2, Quote, Code, Image as ImageIcon, Minus, Table as TableIcon,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after = before,
  placeholder = "texto",
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return { next, cursor: start + before.length + selected.length + after.length };
}

function insertLinePrefix(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  return { next, cursor: start + prefix.length };
}

function LiveBlock({
  content,
  index,
  active,
  onActivate,
  onChange,
  onMergeWithPrev,
  onSplitAt,
}: {
  content: string;
  index: number;
  active: boolean;
  onActivate: () => void;
  onChange: (v: string) => void;
  onMergeWithPrev: () => void;
  onSplitAt: (before: string, after: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (active && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [active]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = taRef.current;
    if (!el || !active) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [content, active]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = taRef.current!;
    // Backspace at pos 0 → merge with previous block
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && index > 0) {
      e.preventDefault();
      onMergeWithPrev();
      return;
    }
    // Enter (without Shift) at end of line creates a new paragraph block
    if (e.key === "Enter" && !e.shiftKey) {
      const pos = el.selectionStart;
      const val = el.value;
      // Only split into a new block if cursor is at the very end
      if (pos === val.length) {
        e.preventDefault();
        onSplitAt(val, "");
        return;
      }
    }
  };

  if (active) {
    return (
      <textarea
        ref={taRef}
        value={content}
        onChange={(e) => {
          onChange(e.target.value);
          const el = e.target;
          el.style.height = "auto";
          el.style.height = el.scrollHeight + "px";
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        className="w-full font-mono text-sm resize-none overflow-hidden rounded-sm border border-primary/30 bg-muted/20 px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40"
        placeholder="Digite em Markdown..."
      />
    );
  }

  return (
    <div
      onClick={onActivate}
      className="cursor-text rounded-sm px-2 py-1 min-h-[1.75rem] hover:bg-muted/30 transition-colors"
    >
      {content.trim() ? (
        <MarkdownView content={content} />
      ) : (
        <span className="text-muted-foreground/40 text-sm italic select-none">Parágrafo vazio</span>
      )}
    </div>
  );
}

function LiveEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = value === "" ? [""] : value.split("\n\n");

  const update = useCallback(
    (newBlocks: string[]) => onChange(newBlocks.join("\n\n")),
    [onChange],
  );

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      const last = blocks.length - 1;
      if (blocks[last] === "") {
        setActiveBlock(last);
      } else {
        const newBlocks = [...blocks, ""];
        update(newBlocks);
        setActiveBlock(newBlocks.length - 1);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="flex-1 min-h-[400px] overflow-auto p-4 space-y-2 cursor-text"
    >
      {blocks.map((block, i) => (
        <LiveBlock
          key={i}
          index={i}
          content={block}
          active={activeBlock === i}
          onActivate={() => setActiveBlock(i)}
          onChange={(v) => {
            const nb = [...blocks];
            nb[i] = v;
            update(nb);
          }}
          onMergeWithPrev={() => {
            const nb = [...blocks];
            const merged = nb[i - 1] + "\n\n" + nb[i];
            nb.splice(i - 1, 2, merged);
            update(nb);
            setActiveBlock(i - 1);
          }}
          onSplitAt={(before, after) => {
            const nb = [...blocks];
            nb.splice(i, 1, before, after);
            update(nb);
            setActiveBlock(i + 1);
          }}
        />
      ))}
    </div>
  );
}

export function MarkdownEditor({ value, onChange, className }: Props) {
  const [view, setView] = useState<"live" | "edit" | "preview" | "split">("live");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const apply = (fn: (t: HTMLTextAreaElement) => { next: string; cursor: number }) => {
    const el = ref.current;
    if (!el) return;
    const { next, cursor } = fn(el);
    onChange(next);
    requestAnimationFrame(() => {
      const e2 = ref.current;
      if (!e2) return;
      e2.focus();
      e2.setSelectionRange(cursor, cursor);
    });
  };

  const insertBlock = (block: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const value = el.value;
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const next = value.slice(0, start) + prefix + block + "\n" + value.slice(start);
    onChange(next);
    requestAnimationFrame(() => {
      const e2 = ref.current;
      if (!e2) return;
      e2.focus();
      const pos = start + prefix.length + block.length + 1;
      e2.setSelectionRange(pos, pos);
    });
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1">
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "# "))} title="Cabeçalho 1">
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "## "))} title="Cabeçalho 2">
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "### "))} title="Cabeçalho 3">
        <Heading3 className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => wrapSelection(t, "**", "**", "negrito"))} title="Negrito">
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => wrapSelection(t, "*", "*", "itálico"))} title="Itálico">
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => wrapSelection(t, "`", "`", "código"))} title="Código">
        <Code className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "- "))} title="Lista">
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "1. "))} title="Lista numerada">
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "- [ ] "))} title="Checklist">
        <CheckSquare className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => insertLinePrefix(t, "> "))} title="Citação">
        <Quote className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button type="button" size="sm" variant="ghost" onClick={() => apply((t) => wrapSelection(t, "[", "](https://)", "texto do link"))} title="Link">
        <Link2 className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("![alt](https://)")} title="Imagem">
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("| Coluna A | Coluna B |\n| --- | --- |\n| valor 1 | valor 2 |")} title="Tabela">
        <TableIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("---")} title="Separador">
        <Minus className="h-4 w-4" />
      </Button>
      <div className="ml-auto">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList className="h-8">
            <TabsTrigger value="live" className="h-7 px-2 text-xs">Live</TabsTrigger>
            <TabsTrigger value="edit" className="h-7 px-2 text-xs">Editar</TabsTrigger>
            <TabsTrigger value="split" className="h-7 px-2 text-xs">Dividido</TabsTrigger>
            <TabsTrigger value="preview" className="h-7 px-2 text-xs">Pré-visualizar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const editor = (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Digite o conteúdo em Markdown..."
      className="h-full min-h-[400px] flex-1 resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
    />
  );

  const preview = (
    <div className="h-full min-h-[400px] overflow-auto p-4 flex-1">
      {value.trim() ? (
        <MarkdownView content={value} />
      ) : (
        <p className="text-sm text-muted-foreground">Nada para pré-visualizar.</p>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col overflow-hidden rounded-md border bg-background ${className || ""}`}>
      {toolbar}
      <div className="flex-1 flex flex-col min-h-0">
        {view === "live" && <LiveEditor value={value} onChange={onChange} />}
        {view === "edit" && editor}
        {view === "preview" && preview}
        {view === "split" && (
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 md:divide-x overflow-hidden">
            {editor}
            <div className="border-t md:border-t-0 overflow-auto">{preview}</div>
          </div>
        )}
      </div>
    </div>
  );
}
