// Formula engine for custom columns.
// Tokens are stored as JSON: { tokens: Token[] } where each Token is one of:
//   { t: "col", key: string }      // built-in or custom column key
//   { t: "num", v: number }        // numeric literal
//   { t: "op",  v: "+"|"-"|"*"|"/" }
//   { t: "lp" } | { t: "rp" }      // parentheses
//
// Evaluator uses shunting-yard → RPN. Safe (no eval, no JS exec).

export type FormulaToken =
  | { t: "col"; key: string }
  | { t: "num"; v: number }
  | { t: "pct"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

export interface Formula {
  tokens: FormulaToken[];
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

export function tokenToText(tk: FormulaToken, labelOf: (key: string) => string): string {
  switch (tk.t) {
    case "col": return labelOf(tk.key);
    case "num": return String(tk.v);
    case "pct": return `${tk.v}%`;
    case "op":  return ` ${tk.v} `;
    case "lp":  return "(";
    case "rp":  return ")";
  }
}

export function formulaToText(f: Formula | null | undefined, labelOf: (key: string) => string): string {
  if (!f?.tokens?.length) return "";
  return f.tokens.map((t) => tokenToText(t, labelOf)).join("").replace(/\s+/g, " ").trim();
}

// Validate brackets and operator placement. Returns null on success or a message.
export function validateFormula(f: Formula): string | null {
  const tk = f.tokens;
  if (tk.length === 0) return "Fórmula vazia";
  let depth = 0;
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    const prev = tk[i - 1];
    if (t.t === "lp") depth++;
    if (t.t === "rp") {
      depth--;
      if (depth < 0) return "Parêntese fechado sem abrir";
    }
    if (t.t === "op") {
      if (!prev || prev.t === "op" || prev.t === "lp") {
        // allow leading minus as 0-x — handled below
        if (t.v !== "-") return "Operador em posição inválida";
      }
    }
    if ((t.t === "num" || t.t === "col") && prev && (prev.t === "num" || prev.t === "col" || prev.t === "rp")) {
      return "Faltando operador";
    }
  }
  if (depth !== 0) return "Parênteses desbalanceados";
  const last = tk[tk.length - 1];
  if (last.t === "op") return "Termina em operador";
  return null;
}

// Convert infix to RPN. Caller is responsible for validation.
function toRPN(tokens: FormulaToken[]): FormulaToken[] {
  const out: FormulaToken[] = [];
  const stack: FormulaToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    if (t.t === "num" || t.t === "col") {
      out.push(t);
    } else if (t.t === "op") {
      // unary minus: insert 0 before it
      if (t.v === "-" && (!prev || prev.t === "op" || prev.t === "lp")) {
        out.push({ t: "num", v: 0 });
      }
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "op" && PRECEDENCE[top.v] >= PRECEDENCE[t.v]) {
          out.push(stack.pop()!);
        } else break;
      }
      stack.push(t);
    } else if (t.t === "lp") {
      stack.push(t);
    } else if (t.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") {
        out.push(stack.pop()!);
      }
      stack.pop(); // discard lp
    }
  }
  while (stack.length) out.push(stack.pop()!);
  return out;
}

export function evaluateFormula(
  f: Formula | null | undefined,
  resolve: (key: string) => number,
): number {
  if (!f?.tokens?.length) return 0;
  if (validateFormula(f)) return 0;
  const rpn = toRPN(f.tokens);
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.t === "num") stack.push(t.v);
    else if (t.t === "col") stack.push(Number(resolve(t.key) || 0));
    else if (t.t === "op") {
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      let r = 0;
      switch (t.v) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/": r = b === 0 ? 0 : a / b; break;
      }
      stack.push(r);
    }
  }
  return stack[0] ?? 0;
}

// Extract distinct column keys referenced by a formula (for dependency ordering)
export function formulaDependencies(f: Formula | null | undefined): string[] {
  const set = new Set<string>();
  f?.tokens?.forEach((t) => { if (t.t === "col") set.add(t.key); });
  return Array.from(set);
}

// Slugify a label into a safe column key
export function slugifyKey(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "col";
}