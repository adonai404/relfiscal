# Script para gerar chaves de assinatura do Tauri
Write-Host "Gerando chaves de assinatura para Tauri..." -ForegroundColor Cyan

# Navegar para src-tauri
Push-Location src-tauri

# Verificar se tauri CLI está instalado
$tauriCmd = npm list -g @tauri-apps/cli 2>$null
if (-not $tauriCmd) {
    Write-Host "Instalando @tauri-apps/cli globalmente..." -ForegroundColor Yellow
    npm install -g @tauri-apps/cli
}

# Gerar as chaves
Write-Host "Gerando chaves..." -ForegroundColor Yellow
tauri signer generate -- --write-keys

# Voltar ao diretório raiz
Pop-Location

# Verificar se foram criadas
if (Test-Path "src-tauri\tauri.key" -and (Test-Path "src-tauri\tauri.key.pub")) {
    Write-Host "`n✓ Chaves geradas com sucesso!" -ForegroundColor Green
    Write-Host "Chave pública:" -ForegroundColor Cyan
    Get-Content "src-tauri\tauri.key.pub"
    Write-Host "`n⚠ Chave privada guardada em: src-tauri\tauri.key" -ForegroundColor Yellow
    Write-Host "NÃO envie esta chave ao Git!" -ForegroundColor Red
} else {
    Write-Host "`n✗ Erro ao gerar as chaves. Verifique os logs acima." -ForegroundColor Red
}
