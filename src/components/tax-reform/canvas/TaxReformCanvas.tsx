import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  addEdge,
  ConnectionMode,
  MarkerType,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { CanvasCardNode, type CanvasCardData } from "./CanvasCardNode";
import {
  Plus,
  Minus,
  Grid3X3,
  Maximize2,
  Loader2,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Deve ficar fora do componente para evitar re-renders em todos os nós
const NODE_TYPES = { canvasCard: CanvasCardNode };

const EDGE_DEFAULTS = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: "#73030D" },
  style: { strokeWidth: 2, stroke: "#73030D" },
};

// ── Inner canvas (needs ReactFlowProvider above) ─────────────────────────────

function CanvasFlow() {
  const { fitView, getViewport, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showGrid,   setShowGrid]   = useState(true);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isSaving,   setIsSaving]   = useState(false);

  // Refs to avoid stale closures and skip initial save
  const mounted        = useRef(false);
  const saveTimer      = useRef<ReturnType<typeof setTimeout>>();
  const nodesRef       = useRef(nodes);
  const edgesRef       = useRef(edges);
  nodesRef.current     = nodes;
  edgesRef.current     = edges;

  // ── Load from Supabase ─────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [{ data: nRows, error: nErr }, { data: eRows, error: eErr }] =
        await Promise.all([
          supabase.from("tax_reform_canvas_nodes").select("*"),
          supabase.from("tax_reform_canvas_edges").select("*"),
        ]);

      if (nErr || eErr) {
        toast.error("Erro ao carregar o canvas");
        setIsLoading(false);
        return;
      }

      if (nRows && nRows.length > 0) {
        setNodes(
          nRows.map((row) => ({
            id: row.node_id,
            type: "canvasCard",
            position: { x: row.position_x, y: row.position_y },
            data: {
              title:       row.title,
              description: row.description ?? "",
              notes:       row.notes ?? "",
              link:        row.link ?? "",
              color:       row.color,
            } as CanvasCardData,
          })),
        );
      }

      if (eRows && eRows.length > 0) {
        setEdges(
          eRows.map((row) => ({
            id:     row.edge_id,
            source: row.source_node_id,
            target: row.target_node_id,
            ...EDGE_DEFAULTS,
          })),
        );
      }

      setIsLoading(false);
      // Fit view after data loads
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
        mounted.current = true;
      }, 100);
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save (debounced 2s) ───────────────────────────────────────────

  const saveCanvas = useCallback(async () => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    setIsSaving(true);

    // Upsert nodes
    if (currentNodes.length > 0) {
      const { error } = await supabase
        .from("tax_reform_canvas_nodes")
        .upsert(
          currentNodes.map((n) => {
            const d = n.data as CanvasCardData;
            return {
              node_id:     n.id,
              title:       d.title,
              description: d.description || null,
              notes:       d.notes || null,
              link:        d.link || null,
              color:       d.color,
              position_x:  n.position.x,
              position_y:  n.position.y,
            };
          }),
          { onConflict: "node_id" },
        );
      if (error) toast.error("Erro ao salvar canvas");
    }

    // Upsert edges
    if (currentEdges.length > 0) {
      await supabase
        .from("tax_reform_canvas_edges")
        .upsert(
          currentEdges.map((e) => ({
            edge_id:        e.id,
            source_node_id: e.source,
            target_node_id: e.target,
          })),
          { onConflict: "edge_id" },
        );
    }

    setIsSaving(false);
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveCanvas, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, saveCanvas]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge({ ...conn, id: `edge_${Date.now()}`, ...EDGE_DEFAULTS }, eds),
      ),
    [setEdges],
  );

  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    const ids = deleted.map((n) => n.id);
    await supabase.from("tax_reform_canvas_nodes").delete().in("node_id", ids);
    await supabase.from("tax_reform_canvas_edges")
      .delete()
      .or(ids.flatMap((id) => [
        `source_node_id.eq.${id}`,
        `target_node_id.eq.${id}`,
      ]).join(","));
  }, []);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    const ids = deleted.map((e) => e.id);
    await supabase.from("tax_reform_canvas_edges").delete().in("edge_id", ids);
  }, []);

  const addNode = useCallback(() => {
    const { x, y, zoom } = getViewport();
    const cx = (window.innerWidth  / 2 - x) / zoom;
    const cy = (window.innerHeight / 2 - y) / zoom;
    const newNode: Node = {
      id:   `node_${Date.now()}`,
      type: "canvasCard",
      position: { x: cx - 112, y: cy - 80 },
      data: {
        title:       "Novo Card",
        description: "",
        notes:       "",
        link:        "",
        color:       "#ffffff",
      } as CanvasCardData,
    };
    setNodes((ns) => [...ns, newNode]);
  }, [getViewport, setNodes]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      nodeTypes={NODE_TYPES}
      connectionMode={ConnectionMode.Loose}
      deleteKeyCode={["Delete", "Backspace"]}
      multiSelectionKeyCode="Control"
      fitView={false}
      minZoom={0.1}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      className="rounded-2xl"
    >
      {showGrid && (
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="hsl(var(--border))"
        />
      )}

      {/* ── Controles de zoom customizados (bottom-left) ───────────── */}
      <Panel position="bottom-left">
        <div className="flex flex-col items-center gap-0.5 overflow-hidden rounded-xl border border-border/30 bg-card shadow-sm dark:border-border/20">
          <button
            type="button"
            title="Aproximar"
            onClick={() => zoomIn({ duration: 250 })}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-6 w-full items-center justify-center border-y border-border/20 bg-muted/30">
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <button
            type="button"
            title="Afastar"
            onClick={() => zoomOut({ duration: 250 })}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="h-px w-full bg-border/20" />
          <button
            type="button"
            title="Ajustar tudo"
            onClick={() => fitView({ padding: 0.15, duration: 400 })}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Panel>

      {/* ── MiniMap ─────────────────────────────────────────────────── */}
      <MiniMap
        nodeColor={(n) => (n.data as CanvasCardData).color ?? "#ffffff"}
        maskColor="hsl(var(--background) / 0.75)"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border) / 0.3)",
          borderRadius: "0.75rem",
        }}
        pannable
        zoomable
      />

      {/* ── Top toolbar ─────────────────────────────────────────────── */}
      <Panel position="top-left">
        <div className="flex items-center gap-2 rounded-2xl border border-border/30 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-md dark:bg-neutral-900/90">
          {/* Add card */}
          <button
            type="button"
            onClick={addNode}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" /> Novo card
          </button>

          <div className="h-4 w-px bg-border/50" />

          {/* Grid toggle */}
          <button
            type="button"
            onClick={() => setShowGrid((p) => !p)}
            title="Alternar grid"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              showGrid
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>

          {/* Save indicator */}
          {isSaving && (
            <>
              <div className="h-4 w-px bg-border/50" />
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
              </span>
            </>
          )}
        </div>
      </Panel>

      {/* Empty state */}
      {nodes.length === 0 && (
        <Panel position="top-center">
          <div className="mt-20 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <GitBranch className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Canvas vazio</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Clique em "Novo card" para começar a montar seu fluxo.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Arraste entre os pontos dos cards para criar conexões.
            </p>
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}

// ── Exported component (wraps CanvasFlow with provider) ──────────────────────

export function TaxReformCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}
