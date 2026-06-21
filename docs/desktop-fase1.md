# Fase 1 — Pré-requisitos para o app nativo (Tauri)

> Objetivo: deixar o código pronto para empacotar a área interna (`/app`) num app
> desktop (Tauri 2, Fase 2+) **sem** quebrar a versão web. Mudanças de baixo risco +
> decisões documentadas + confirmação de pré-condições.

## 1. Seam da URL pública — `VITE_PUBLIC_WEB_URL`

**Problema:** links compartilháveis (`/p/:slug`), QR codes e redirects de auth
usavam `window.location.origin`. No navegador isso é correto, mas num app Tauri o
runtime roda sob `tauri://localhost` (ou `http://tauri.localhost`), então
`window.location.origin` geraria links/redirects **quebrados**.

**Solução:** seam tipado em [`src/lib/publicUrl.ts`](../src/lib/publicUrl.ts):

- `getPublicWebUrl()` → usa `VITE_PUBLIC_WEB_URL` se definida; senão cai em
  `window.location.origin`.
- `publicUrl(path)` → monta URL pública absoluta.

Tipagem da env em [`src/vite-env.d.ts`](../src/vite-env.d.ts).

**Usos trocados:**
- `src/pages/Auth.tsx` — `emailRedirectTo` (signup) e `redirectTo` (reset de senha).
- `src/pages/Movement.tsx` — link "Compartilhar" e QR do cabeçalho de impressão.

> `PublicMovement.tsx` mantém `window.location.href` (canonical/QR da própria
> página) — correto, pois essa página é sempre vista no **navegador**, nunca no Tauri.

**Build web:** deixe `VITE_PUBLIC_WEB_URL` vazio/ausente → comportamento idêntico
ao de hoje. **Build desktop:** defina `VITE_PUBLIC_WEB_URL=https://<dominio-web>`.

> Nota: e-mails de confirmação/reset abrem a **versão web** no navegador (os
> redirects do Supabase precisam ser http(s), nunca `tauri://`). Deep-link de volta
> ao app desktop é escopo de Fase 4+.

## 2. Decisão de Router — manter `BrowserRouter`

`src/App.tsx` usa `BrowserRouter`. Decisão da Fase 1: **não mudar agora.**

- **Se a casca Tauri (Fase 2) carregar a URL remota** (`https://.../app`):
  `BrowserRouter` funciona normalmente (origin HTTP real, servidor resolve as rotas)
  e a versão web fica idêntica. **Caminho recomendado.**
- **Se a casca Tauri empacotar os assets localmente** (protocolo `tauri://`):
  refresh/deep-link a rotas como `/app/movimento` exige `HashRouter` **ou** fallback
  do lado do Tauri para `index.html`. Só então faria sentido trocar o Router.

O seam da seção 1 já desacopla os links públicos do runtime — que é o único ponto
que realmente quebraria entre Browser/Hash no nosso caso. A escolha concreta fica
para a Fase 2, junto da estratégia de carregamento do Tauri.

## 3. Smoke tests

- [`src/lib/publicUrl.test.ts`](../src/lib/publicUrl.test.ts) — 7 casos (fallback web,
  override desktop, trim de barras, junção de paths). `npm test` ✅
- `npx tsc -p tsconfig.app.json --noEmit` — sem novos erros nos arquivos tocados
  (erros pré-existentes só em `Knowledge.tsx`, ver seção 5).
- `npm run build` — build de produção + geração do PWA OK.

## 4. RLS de `/p/:slug` — ⚠️ CONFIRMADO COM PROBLEMAS

Confirmação feita contra o backend real (anon key, GET read-only):

| Tabela | Leitura anônima (sem login) | Esperado p/ página pública |
|---|---|---|
| `companies` | 🔒 bloqueado (`[]`) | precisa ler por slug |
| `fiscal_config` | 🔒 bloqueado (`[]`) | precisa ler |
| `fiscal_movement` | 🔴 **471 linhas expostas** | só da empresa do slug |

**Causa:** migrations `20260506141139` e `20260522182428` trocaram o SELECT para
`user_can_read_company(auth.uid(), …)` (exige login). Em `companies`/`fiscal_config`
o `DROP POLICY` acertou o nome e travou; em `fiscal_movement` o
`DROP POLICY IF EXISTS "Public read movements"` usou nome **errado** (a policy real
chama-se `"Public read fiscal"`), então a `USING(true)` sobreviveu.

**Dois problemas opostos:**
1. **Página pública quebrada:** `PublicMovement` busca `companies` por slug → vem
   `null` → renderiza "Empresa não encontrada" para qualquer visitante sem login.
2. **Vazamento:** todos os movimentos fiscais (entrada/saída/impostos) são baixáveis
   por qualquer um com a anon key.

> Pré-existente, não causado pela migração desktop — mas afeta diretamente o feature
> "Compartilhar link" e é dado sensível.

### Correção implementada (2026-06-20)

Migração [`20260620143000_public_movement_rpc_is_public.sql`](../supabase/migrations/20260620143000_public_movement_rpc_is_public.sql):

1. Coluna `companies.is_public boolean NOT NULL DEFAULT false` (opt-in; tudo privado
   por padrão).
2. RPC `SECURITY DEFINER public.get_public_movement(p_slug text)` → retorna
   `{ company, config, movements, custom_columns, custom_values }` em JSON **somente**
   para empresas com `is_public = true`, e **só as colunas necessárias** da empresa
   (nunca `api_key`/`created_by`). `GRANT EXECUTE` para `anon, authenticated`.
3. `DROP` das policies `"Public read ... USING(true)"` em `fiscal_movement`,
   `fiscal_config`, `custom_columns`, `custom_column_values` → fecha o acesso direto
   anônimo. O acesso autenticado normal segue pelas policies
   `"Users can view ... accessible companies"`.

Frontend:
- [`PublicMovement.tsx`](../src/pages/PublicMovement.tsx) agora faz **1 chamada**
  `rpc("get_public_movement", { p_slug })` em vez de 5 queries diretas.
- [`Movement.tsx`](../src/pages/Movement.tsx) → "Compartilhar" passou a marcar a
  empresa como `is_public = true` antes de copiar o link (opt-in explícito).
- `is_public` adicionado ao tipo `companies` em `src/integrations/supabase/types.ts`.

> ⚠️ **Aplicar no banco:** a migração precisa rodar na base de produção (via sync do
> Lovable ou colando o SQL no SQL Editor do Supabase). Enquanto não rodar, o
> vazamento de `fiscal_movement` continua ativo e o `/p/:slug` continua quebrado.
> A ordem importa: migração **antes** (ou junto) do deploy do frontend, senão a RPC
> ainda não existe. Revogar o público de uma empresa = `UPDATE companies SET
> is_public=false` (toggle de "tornar privado" fica como melhoria futura).

## 5. Gerenciador de pacotes / lockfiles

- Sem campo `packageManager` no `package.json`. Repo tem `bun.lock` + `bun.lockb`
  **e** `package-lock.json`.
- **Build do Lovable (nuvem):** usa **bun** (default do Lovable; `bun.lockb` presente).
  Não apagar os lockfiles do bun.
- **Local / CI do Tauri (Windows):** `bun` indisponível na máquina → usar **npm**
  (mantém `package-lock.json`). A Fase 2 (build do .exe/.msi) roda local/CI, então
  npm é o gerenciador do build desktop.
- Risco: drift entre lockfiles. Mitigação: tratar **bun como fonte de verdade do
  build Lovable** e sincronizar o `package-lock.json` quando dependências mudarem.

## Próximas fases

- **Fase 2:** PoC Tauri "casca" (decidir remoto vs. assets locais → fecha a decisão
  do Router; tratar `window.open` do PDF do Assistente; gerar .exe/.msi de teste).
- **Fase 3+:** automação de pastas (watch → parse → revisão → envio). Ver memória
  `desktop-app-migration`.
