import { useRef, useState } from "react";
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

export function MarkdownEditor({ value, onChange }: Props) {
  const [view, setView] = useState<"edit" | "preview" | "split">("split");
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