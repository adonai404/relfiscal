# Fase 2 — PoC do app desktop com Tauri 2

> Objetivo: empacotar a área interna (`/app`) como app desktop Windows (`.exe`/`.msi`)
> usando **Tauri 2**, com os assets do front **empacotados localmente** (offline,
> sem depender da web no ar). Portal (`/portal`) e página pública (`/p/:slug`)
> continuam "web" (abrem no navegador externo). É o **gate de validação** antes de
> investir na automação de pastas (Fase 3).

## Decisões desta fase

- **Carregamento: assets locais** (escolhido pelo usuário). O build do Vite vai
  dentro do `.exe`; o app funciona offline e dá controle total para a automação da
  Fase 3. (A alternativa "carregar URL remota" foi descartada.)
- **Router: `HashRouter` no desktop, `BrowserRouter` no web.** Como os assets locais
  são servidos via `tauri://`, deep-link/refresh precisam das rotas no fragmento
  (`#/...`). No web seguimos com URLs limpas (importante p/ SEO de `/p/:slug`).
  Decisão fechada aqui (estava pendente da Fase 1).
- **Ponte web↔desktop:** `src/lib/desktop.ts` com `isTauri()` e `openExternal()`.

## Pré-requisitos (Windows) — instalados nesta máquina

- **Rust** `1.96.0` (`stable-x86_64-pc-windows-msvc`) via `rustup` (winget
  `Rustlang.Rustup`).
- **VS 2022 Build Tools** com componente **VC++ x64** (linker MSVC) — já presente.
- **WebView2** — já vem no Windows 11 (via Edge).
- **Node 22 / npm 10**.

## Estrutura criada

- `src-tauri/` (scaffold do `tauri init`):
  - `tauri.conf.json` — `productName: "Imperial App"`, `identifier: com.imperial.app`,
    `frontendDist: ../dist`, `devUrl: http://localhost:8080`, janela 1280×800
    (min 1024×700, centralizada).
  - `Cargo.toml` / `src/lib.rs` — registra `tauri-plugin-shell` (abrir links externos).
  - `capabilities/default.json` — permissão `shell:allow-open`.
- Pacotes JS: `@tauri-apps/cli`, `@tauri-apps/api`, `@tauri-apps/plugin-shell`.

## Mudanças no front (só ativam no desktop)

- `vite.config.ts` — quando `TAURI_ENV_PLATFORM` está setado (build via CLI do Tauri):
  `base: "./"` (assets relativos) e **PWA desativado** (Service Worker não faz sentido
  sob `tauri://`). No web nada muda.
- `src/App.tsx` — `Router = isTauri() ? HashRouter : BrowserRouter`.
- `src/lib/desktop.ts` — `isTauri()` / `openExternal()` (Portal e público abrem no
  navegador externo via shell do Tauri).
- `src/pages/Assistant.tsx` — exportar PDF degrada com aviso no desktop (ver limitações).

## Como rodar

```sh
# Dev (hot reload do Vite dentro da janela nativa)
npm run tauri:dev

# Build de produção (.exe + instaladores)
npm run tauri:build
```

Saída do build em `src-tauri/target/release/`:
- `Imperial App.exe` (binário)
- `bundle/msi/*.msi` (instalador WiX)
- `bundle/nsis/*-setup.exe` (instalador NSIS)

> O **primeiro** `tauri:build` é lento (compila centenas de crates Rust e baixa
> WiX/NSIS). Builds seguintes são incrementais.

## Gate de validação (checklist do PoC)

- [ ] App abre em janela própria e cai no login/`/app` (não na landing web).
- [ ] Login Supabase funciona dentro do app.
- [ ] Navegação interna (Movimento, Empresas, etc.) funciona com HashRouter.
- [ ] Impressão A4 do Movimento sai correta.
- [ ] "Compartilhar link público" copia a URL **web** correta (seam `VITE_PUBLIC_WEB_URL`).
- [ ] Instalador `.msi`/`.exe` instala e o app abre com ícone.

## Limitações conhecidas do PoC (não bloqueiam o gate)

- **Exportar PDF do Assistente**: usa `window.open` (popup), que não existe no Tauri.
  Hoje mostra aviso. Solução nativa (gravar HTML temporário + abrir no navegador com
  `shell.open`) fica para uma próxima iteração — precisa do `tauri-plugin-fs`.
- **`VITE_PUBLIC_WEB_URL`**: para o build desktop, definir essa env apontando para a
  URL web de produção, senão links/QR/redirects caem em `tauri://` (ver `desktop-fase1.md`).
- **Bundle único ~2,8 MB** sem code-split (herdado); empacota também Portal/Público
  (que no desktop só abrem via navegador externo).
- **Sem assinatura de código / updater** — Fase 5.

## Próxima fase

- **Fase 3**: automação de pastas em modo assistido (watch → parse → revisão → envio),
  exigindo `tauri-plugin-fs` + watcher. Ver memória `desktop-app-migration`.
