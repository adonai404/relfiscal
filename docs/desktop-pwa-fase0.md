# Fase 0 — PoC do App Desktop (PWA instalável)

> Objetivo: validar se a **área interna (`/app`)** pode virar um "app de computador" via
> **PWA instalável** no Windows 10/11, **sem** mexer em funcionalidades e **mantendo**
> Portal (`/portal`) e página pública (`/p/:slug`) como web normal.
>
> Decisão de tecnologia: **PWA primeiro** (menor risco/manutenção). Tauri 2 fica reservado
> e só entra se, depois deste PoC, for exigido um instalador empacotado/assinado (.msi/.exe).

## O que foi implementado nesta fase

- `vite-plugin-pwa` (gera `manifest.webmanifest` + service worker no build).
- Manifest com `scope`/`start_url = /app`, nome **Imperial App**, tema verde da marca,
  ícones a partir da logo Imperial (`/favicon.svg` e `/pwa-maskable.svg`).
- Service worker **conservador**:
  - Pré-cacheia só o app-shell estático (JS/CSS/HTML/ícones/worker).
  - **Não** cacheia chamadas ao Supabase/Edge Functions → dados fiscais sempre frescos.
  - App-shell offline (`navigateFallback`) restrito a `/app` (`navigateFallbackAllowlist`),
    então Portal e página pública seguem indo direto à rede.
  - `registerType: autoUpdate` → atualiza sozinho quando há novo deploy.
  - `devOptions.enabled: false` → sem service worker em desenvolvimento.

Arquivos tocados: `vite.config.ts`, `index.html`, `public/pwa-maskable.svg` (novo),
`package.json` (devDependency).

## Como testar localmente (Windows 10/11 + Edge)

> PWA só funciona em build de produção (não no `npm run dev`).

```sh
npm run build
npm run preview   # sobe um servidor local (porta exibida no terminal)
```

Abra o endereço do `preview` no **Edge** e faça os testes abaixo.
Para instalar: ícone de "Instalar app" na barra de endereços do Edge
(ou menu ⋯ → Apps → Instalar este site como um app).

> Observação: ao instalar, o app abre em `/app` (start_url). Faça login primeiro
> se ainda não estiver autenticado.

## Critérios de aceite

- [ ] **Instalação**: Edge oferece "Instalar app"; instala e abre em janela própria com ícone Imperial.
- [ ] **Escopo correto**: o app instalado abre direto em `/app`.
- [ ] **Login**: autenticação Supabase funciona dentro do app instalado.
- [ ] **Sessão persistente**: fechar e reabrir o app mantém o login.
- [ ] **Impressão A4**: imprimir um Movimento sai igual ao navegador.
- [ ] **PDF do Assistente**: "Salvar como PDF" abre e imprime normalmente.
- [ ] **Compartilhar link/QR**: o link público gerado no Movimento está correto (`https://.../p/<slug>`).
- [ ] **Portal/Público intactos**: `/portal` e `/p/:slug` continuam abrindo normalmente no navegador.
- [ ] **Auto-update**: após um novo deploy, reabrir o app carrega a versão nova (pode exigir 1 reabertura).

## Pontos de atenção observados (não bloqueiam o PoC)

- **Bundle grande**: `index-*.js` ~2,8 MB (828 KB gzip), sem code-splitting → precache de ~4 MB.
  Funciona, mas a Fase 1+ pode dividir o bundle (dynamic import) para reduzir cache/tempo de carga.
- **Lockfiles**: o repo tem `bun.lock`/`bun.lockb` e `package-lock.json`. Esta instalação foi via
  **npm** (bun indisponível localmente) → `package-lock.json` foi atualizado. Conferir qual o
  gerenciador oficial do build (Lovable) e sincronizar o lockfile correspondente.

## Próximas fases (resumo — só se aprovado)

- **Fase 1**: seam `VITE_PUBLIC_WEB_URL` (tipado) trocando os `window.location.origin` de
  links/QR e redirects de auth; smoke tests dos fluxos críticos; confirmar RLS de `/p/:slug`.
- **Fase 2 (condicional)**: empacotar com **Tauri 2** se for exigido instalador assinado.
- **Fase 3**: distribuição, canal de auto-update, documentação interna.
