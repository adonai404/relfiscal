# 🚀 Guia de Release com Auto-Update

## Como Fazer um Release (Atualização)

### 1. Faça suas mudanças no código
```bash
# Edite os arquivos
git add .
git commit -m "Descrição das mudanças"
```

### 2. Atualize a versão
Edite `src-tauri/tauri.conf.json`:
```json
"version": "0.2.0"  // Incremente a versão
```

### 3. Crie uma tag e push
```bash
# Tag com a versão
git tag -a v0.2.0 -m "Release version 0.2.0"

# Push da tag (dispara GitHub Actions)
git push origin v0.2.0

# Ou push de tudo
git push origin main --tags
```

### 4. GitHub Actions Compila Automaticamente
- O workflow em `.github/workflows/build.yml` dispara
- Compila para Windows, Linux e macOS
- Gera assinatura de segurança automaticamente
- Cria Release no GitHub com os arquivos

### 5. Usuários Recebem Notificação
- Ao iniciar o app, verifica se há atualização
- Se houver, mostra notificação azul
- Clica "Atualizar agora"
- App baixa, instala e reinicia automaticamente

---

## 📋 Checklist Antes de Cada Release

- [ ] Testou as mudanças localmente?
- [ ] Atualizou a versão em `src-tauri/tauri.conf.json`?
- [ ] Fez commit e push de todas as mudanças?
- [ ] Criou a tag com semântica `v0.X.0`?
- [ ] Push da tag foi feito?

---

## 🔐 Segurança

### Chave Privada
```
src-tauri/tauri.key  ← NUNCA envie ao Git!
                      ← Está em .gitignore
                      ← Guardada localmente
```

### No GitHub (Secrets)
```
TAURI_SIGNING_PRIVATE_KEY ← Conteúdo de tauri.key
                            ← Só acessível em CI/CD
```

---

## 📱 Versioning Semântico

```
v0.2.0
│ │ │
│ │ └─ Patch (bug fixes)
│ └─── Minor (new features)
└───── Major (breaking changes)

v0.1.0  → v0.1.1  (bug fix)
v0.1.1  → v0.2.0  (new feature)
v0.2.0  → v1.0.0  (breaking change)
```

---

## 🐛 Troubleshooting

### Release não foi criado?
1. Verifique se a tag foi feita corretamente: `git v0.2.0`
2. Verifique os logs em GitHub > Actions
3. Verifique se a chave privada está em Secrets

### Auto-update não funciona?
1. App está rodando em modo desktop (Tauri)?
2. Versão no `tauri.conf.json` foi incrementada?
3. Verificou os logs da aplicação?

---

## 📞 Comandos Úteis

```bash
# Ver todas as tags
git tag -l

# Ver conteúdo de uma tag
git show v0.2.0

# Deletar tag local
git tag -d v0.2.0

# Deletar tag remota
git push origin --delete v0.2.0

# Criar release sem compilar localmente
# (confia no CI/CD do GitHub Actions)
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

---

## ✨ Resultado Final

**Antes (seu fluxo):**
```
Mudanças → Compilar localmente → Gerar .msi → Distribuir
```

**Depois (novo fluxo):**
```
Mudanças → Git push tag → GitHub compila → Usuários atualizam sozinhos ✨
```
