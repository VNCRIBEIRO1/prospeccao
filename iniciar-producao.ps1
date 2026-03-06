# ============================================
# Script de Inicialização - Prospeccao 24/7
# Inicia WPPConnect Docker + Cloudflare Tunnel
# A API roda na Vercel (sempre ativa)
# ============================================

$ErrorActionPreference = "Continue"
$projectDir = "c:\Users\Administrador\Desktop\prospeccao\projeto"
$tunnelLog = "$projectDir\tunnel.log"
$startupLog = "$projectDir\startup.log"

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $startupLog -Value $line
}

Write-Log "========== INICIANDO PROSPECCAO =========="

# 1. Verificar Docker Desktop
Write-Log "Verificando Docker..."
$docker = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "ERRO: Docker nao esta rodando. Iniciando Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Start-Sleep -Seconds 30
    $retry = 0
    while ($retry -lt 10) {
        $docker = docker info 2>&1
        if ($LASTEXITCODE -eq 0) { break }
        Write-Log "Aguardando Docker... ($retry/10)"
        Start-Sleep -Seconds 10
        $retry++
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERRO FATAL: Docker nao iniciou. Abortando."
        exit 1
    }
}
Write-Log "Docker OK"

# 2. Limpar locks do Chromium (previne erro de SingletonLock)
Write-Log "Limpando locks do Chromium..."
docker run --rm -v projeto_wppconnect_data:/data alpine sh -c "find /data -name 'Singleton*' -type f -exec rm -f {} \;" 2>&1 | Out-Null
Write-Log "Locks limpos"

# 3. Iniciar WPPConnect
Write-Log "Iniciando WPPConnect Docker..."
Set-Location $projectDir
docker compose up -d wppconnect 2>&1 | ForEach-Object { Write-Log $_ }

# Aguardar sessao iniciar
Write-Log "Aguardando sessao WhatsApp..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 5
    $logs = docker logs wppconnect-server --tail 5 2>&1
    if ($logs -match "Started Session") {
        $ready = $true
        break
    }
    Write-Log "Aguardando WPPConnect... ($i/30)"
}
if ($ready) {
    Write-Log "WPPConnect ONLINE - Sessao ativa!"
} else {
    Write-Log "AVISO: WPPConnect pode nao ter iniciado completamente"
}

# 4. Iniciar Cloudflare Tunnel
Write-Log "Iniciando Cloudflare Tunnel..."

# Matar tunnel anterior se existir
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Limpar log anterior
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

# Iniciar tunnel
$tunnelProc = Start-Process cloudflared -ArgumentList "tunnel","--url","http://localhost:21465" `
    -RedirectStandardError $tunnelLog -WindowStyle Hidden -PassThru

Write-Log "Tunnel PID: $($tunnelProc.Id)"

# Aguardar URL do tunnel
$tunnelUrl = ""
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 3
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw
        if ($content -match "(https://[a-z0-9-]+\.trycloudflare\.com)") {
            $tunnelUrl = $Matches[1]
            break
        }
    }
    Write-Log "Aguardando tunnel URL... ($i/20)"
}

if ($tunnelUrl) {
    Write-Log "Tunnel ONLINE: $tunnelUrl"
    
    # 5. Atualizar WPPCONNECT_URL na Vercel
    Write-Log "Atualizando WPPCONNECT_URL na Vercel..."
    
    Set-Location "$projectDir\frontend"
    
    # Remover valor antigo
    vercel env rm WPPCONNECT_URL production --yes 2>&1 | Out-Null
    
    # Adicionar novo valor (sem newline)
    $tunnelUrl | vercel env add WPPCONNECT_URL production 2>&1 | Out-Null
    
    Write-Log "Vercel WPPCONNECT_URL atualizada para: $tunnelUrl"
    
    # 6. Redeploy na Vercel para aplicar nova env var
    Write-Log "Fazendo redeploy na Vercel..."
    $deployOutput = vercel --prod --yes 2>&1
    $vercelUrl = ($deployOutput | Select-String "Aliased:").ToString() -replace ".*Aliased:\s*",""  -replace "\s.*",""
    Write-Log "Vercel deploy: $vercelUrl"
    
} else {
    Write-Log "ERRO: Nao conseguiu obter URL do tunnel"
    Write-Log "Verifique $tunnelLog para detalhes"
}

# 7. Resumo final
Write-Log ""
Write-Log "========== PROSPECCAO ATIVO =========="
Write-Log "Vercel (API):     https://prospeccao-delta.vercel.app"
Write-Log "Tunnel (WPPConnect): $tunnelUrl"
Write-Log "Webhook:          https://prospeccao-delta.vercel.app/api/webhook/whatsapp"
Write-Log "Dashboard:        https://prospeccao-delta.vercel.app"
Write-Log ""
Write-Log "Para parar tudo:"
Write-Log "  docker compose stop wppconnect"
Write-Log "  Get-Process cloudflared | Stop-Process"
Write-Log "======================================"
