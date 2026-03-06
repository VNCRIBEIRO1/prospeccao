# ============================================
# iniciar-tunnel.ps1 — Inicia Cloudflare Tunnel e retorna a URL
# Chamado pelo iniciar-servidor.bat
# ============================================
param(
    [string]$ProjectDir = "c:\Users\Administrador\Desktop\prospeccao\projeto"
)

$logFile = "$ProjectDir\tunnel.log"
$urlFile = "$ProjectDir\tunnel_url.txt"
$maxTentativas = 2

for ($tentativa = 1; $tentativa -le $maxTentativas; $tentativa++) {
    
    if ($tentativa -gt 1) {
        Write-Host "       Tentativa $tentativa de $maxTentativas..."
    }

    # 1. Matar tunnels anteriores
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # 2. Limpar log anterior
    if (Test-Path $logFile) { Remove-Item $logFile -Force }

    # 3. Iniciar tunnel
    $proc = Start-Process -FilePath "cloudflared" `
        -ArgumentList "tunnel", "--url", "http://localhost:21465" `
        -RedirectStandardError $logFile `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "       Tunnel PID: $($proc.Id)"

    # 4. Aguardar URL aparecer no log (max 2 minutos)
    $tunnelUrl = ""
    for ($i = 1; $i -le 24; $i++) {
        Start-Sleep -Seconds 5
        
        if (Test-Path $logFile) {
            $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
            
            # Verificar se falhou por timeout (tentar novamente)
            if ($content -match 'context deadline exceeded') {
                Write-Host "       Timeout na API do Cloudflare, reiniciando..."
                break
            }
            
            # Capturar URL real do tunnel (excluir api.trycloudflare.com)
            if ($content -match '(https://[a-z0-9]+-[a-z0-9-]+\.trycloudflare\.com)') {
                $tunnelUrl = $Matches[1]
                break
            }
        }
        
        Write-Host "       Aguardando tunnel... ($i/24)"
    }

    if ($tunnelUrl) {
        # Salvar URL em arquivo para o batch ler
        $tunnelUrl | Out-File -FilePath $urlFile -Encoding ASCII -NoNewline
        Write-Host "       Tunnel ONLINE: $tunnelUrl"
        exit 0
    }
}

# Todas as tentativas falharam
Write-Host "       ERRO: Nao conseguiu obter URL do tunnel apos $maxTentativas tentativas"
if (Test-Path $logFile) {
    Write-Host "       Ultimas linhas do log:"
    Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "         $_" }
}
exit 1
