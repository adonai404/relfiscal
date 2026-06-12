## Visão geral

Nova página `/assistente` (item "Assistente IA" na sidebar) com chat baseado no AI SDK + Lovable AI Gateway. A IA responde **apenas** com base nos dados de `fiscal_movement` das empresas que o usuário escolher por conversa. Histórico em threads persistidas no Lovable Cloud.

## Arquitetura

```text
[Sidebar] -> /assistente
                 │
                 ├── Lista de threads (lateral)
                 │       └── nova / selecionar / excluir
                 │
                 └── /assistente/:threadId  (rota dedicada)
                         ├── Seletor de empresas da conversa (multi-select)
                         ├── Transcript (AI Elements: Conversation/Message)
                         └── Composer (PromptInput)
                                  │ POST
                                  ▼
                    Edge Function: assistant-chat
                       ├── valida JWT + acesso às empresas
                       ├── carrega fiscal_movement das empresas escolhidas
                       ├── monta system prompt + contexto (JSON compacto)
                       ├── streamText (google/gemini-3-flash-preview)
                       └── onFinish -> salva mensagem assistente no banco
```

## Backend (Lovable Cloud)

Novas tabelas:

- `ai_threads`
  - `id uuid pk`, `user_id uuid`, `title text`, `company_ids uuid[]` (escopo escolhido), `created_at`, `updated_at`
- `ai_messages`
  - `id uuid pk`, `thread_id uuid fk -> ai_threads`, `role text` (`user|assistant`), `parts jsonb` (UIMessage parts), `created_at`

RLS: dono (`user_id = auth.uid()`) lê/escreve seus threads; mensagens herdam acesso pelo thread. GRANTs para `authenticated` + `service_role`.

Edge function `assistant-chat` (verify_jwt, usa `LOVABLE_API_KEY`):
1. Recebe `{ threadId, messages }`.
2. Confere ownership do thread e lê `company_ids`.
3. Valida acesso de cada empresa via `user_has_company_access`.
4. Busca linhas de `fiscal_movement` (todas as competências) + nome das empresas.
5. Injeta no `system` prompt: instruções (responder somente sobre esses dados; recusar fora do escopo; valores em BRL; competência YYYY-MM) + um bloco JSON compacto com os movimentos. Se o volume passar de um limite, agrega por competência e mantém detalhe das últimas 24 competências.
6. `streamText` → `toUIMessageStreamResponse({ originalMessages, onFinish })` que persiste a mensagem do assistente.

## Frontend

- Rota `/assistente` e `/assistente/:threadId` em `App.tsx` (dentro do `MainLayout`).
- Item "Assistente IA" no `AppSidebar`.
- Componentes via AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`).
- `useChat` com `id = threadId`, `DefaultChatTransport` apontando para a edge function (URL via `VITE_SUPABASE_URL`, header `Authorization` com publishable key + token do usuário).
- Sidebar interna de threads: criar, selecionar (navega para `/assistente/:id`), renomear (auto-título a partir da 1ª mensagem) e excluir.
- Painel "Empresas desta conversa": multi-select das empresas do usuário; salva em `ai_threads.company_ids`. Mensagens ficam desabilitadas até pelo menos 1 empresa selecionada.
- Render de `message.parts` com markdown; estado de loading com `Shimmer` ("Pensando...").
- Foco automático no textarea ao abrir/enviar/trocar de thread.

## Detalhes técnicos

- Modelo: `google/gemini-3-flash-preview` (default).
- Provider helper compartilhado em `supabase/functions/_shared/ai-gateway.ts` (se ainda não existir).
- Contexto enviado ao modelo é recomputado a cada request (sempre dados atuais), não cacheado no histórico.
- Estratégia anti-overflow: se `rows > 400`, enviar (a) agregados mensais de todas as competências + (b) detalhe das 24 mais recentes.
- Erros do gateway (`402`, `429`) propagados como toast no chat.
- Sem mocks; sem alterar comportamento da página Movimento.

## Entregáveis

1. Migração SQL: tabelas + RLS + GRANTs.
2. Edge function `assistant-chat` + helper de gateway.
3. Página `src/pages/Assistant.tsx` (+ subcomponentes: `ThreadList`, `CompanyScopePicker`, `ChatWindow`).
4. Rotas e item de menu.
5. Instalação dos componentes AI Elements necessários.