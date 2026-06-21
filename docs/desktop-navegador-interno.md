# Navegador interno + download por site + download da IA

> Recursos desktop (Tauri). No **web** tudo degrada graciosamente (links abrem em
> nova aba; o download da IA vira um download direto do navegador).

## 1. Navegador interno (Opção A)

No app desktop, clicar num **link externo** (`target="_blank"`, http/https) — nas
páginas Ferramentas, Conhecimento ou em qualquer lugar — abre o site numa **janela
interna do próprio app** (WebView2), em vez do navegador do sistema.

- Funciona com **qualquer site** (inclusive fisco, que bloqueia iframe).
- A janela do site **não** tem acesso às APIs do app (capability só cobre a janela
  `main`) → sandbox seguro.
- Interceptação central em `src/App.tsx` (`DesktopExternalLinks`) — não precisa
  mexer em cada link.

> Escolha do usuário: **janelas** (Opção A). Abrir vários sites abre várias janelas.
> "Abas numa janela só" exigiria a API instável de multi-webview (Opção C) — fora de escopo.

## 2. Download por site (site X → pasta Y)

Cada janela interna captura os downloads (handler `on_download`, lado Rust) e salva
**direto na pasta configurada, sem o diálogo "Salvar como"**.

- Regras em `localStorage` (`imperial.browserDownloadRules`): uma **pasta padrão** +
  **pasta por host**. Resolução: regra do site > padrão > pasta Downloads do sistema.
- Configuração: página **Ferramentas → botão "Pasta de downloads"** (só no desktop) —
  componente `src/components/DownloadSettings.tsx`. Lista os sites e deixa escolher a
  pasta de cada um (seletor nativo via plugin `dialog`).
- **Fronteira:** vale só para sites abertos **dentro do app**. O app não controla os
  downloads do Chrome/Edge do usuário.

## 3. Download do resultado da IA (corrigido)

O botão "Baixar resposta" do Assistente (`src/pages/Assistant.tsx`) agora **gera um
arquivo HTML** (mesmo visual formatado de antes) e baixa de verdade:

- **Web:** download direto (Blob + `<a download>`).
- **Desktop:** "Salvar como" (plugin `dialog`) + grava via comando Rust `write_text_file`.

Antes, no desktop, `window.open` não abria popup e a função só mostrava um aviso — por
isso "não dava pra baixar". Agora funciona nos dois.

## Implementação (resumo técnico)

**Rust** (`src-tauri/src/lib.rs`):
- comando `open_internal_browser(url, label, dir)` → cria `WebviewWindowBuilder` com
  `on_download` que reescreve o destino para `dir`.
- comando `write_text_file(path, contents)` (grava sem precisar de escopo amplo do fs).
- plugins: `shell` (já tinha) + **`dialog`** (novo). Capability: `dialog:default`.

**Frontend** (`src/lib/desktop.ts`):
- `openInAppBrowser(url)`, `saveTextFile(name, contents)`, `pickFolder()`,
  `getDownloadRules()/setDownloadRules()`, `downloadDirForUrl()`.

**Pacotes:** `@tauri-apps/plugin-dialog` (+ `tauri-plugin-dialog` no Cargo).

## Correções aplicadas (2026-06-21)

- **Janela em branco ao abrir site** → o comando `open_internal_browser` precisa ser
  `async`. No Windows, criar uma `WebviewWindow` num comando **síncrono** trava o main
  thread e o WebView2 não navega (janela branca).
- **Link abria no app E no navegador** → o Tauri abre `target="_blank"` no navegador do
  SO nativamente e `preventDefault()` NÃO segura. Solução: o `DesktopExternalLinks`
  (App.tsx) **neutraliza** os links externos (guarda a URL em `data-inapp-href`, remove
  `target`/`href`) para o Tauri nunca disparar o open externo; o clique abre só a janela
  interna.
- **Sem pasta definida → "Salvar como"** → no `on_download`, quando não há regra (nem
  site nem padrão), abre o diálogo nativo de salvar via `rfd` (numa thread separada, p/
  não travar o callback). Cancelar = cancela o download.

> ⚠️ **Build: use SEMPRE `npm run tauri:build` (ou `tauri:dev`), nunca `cargo build`
> avulso.** Rodar `cargo build` fora da CLI pode compilar em modo **dev** (o app tenta
> carregar `localhost:8080` em vez dos assets embutidos → erro ERR_CONNECTION_REFUSED).

## Limitações / próximos passos

- A configuração de pastas é **local** (por máquina) — não sincroniza via Supabase
  (é caminho de disco, específico do PC). Correto para o caso de uso.
- Sem barra de navegação (voltar/avançar/recarregar) na janela interna ainda — abre o
  site direto. Dá pra adicionar depois.
- Encaixa na **Fase 3**: o download capturado por site é um gatilho limpo para a
  automação (parsear o PDF e enviar ao Supabase em modo assistido).
