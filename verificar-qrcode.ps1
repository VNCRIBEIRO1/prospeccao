# ============================================
# verificar-qrcode.ps1 — Verifica conexão e abre QR Code se necessário
# Chamado automaticamente pelo iniciar-servidor.bat
# Funciona de qualquer conta do Windows
# ============================================

param(
    [string]$WppUrl = "http://localhost:21465",
    [string]$Session = "prospeccao",
    [string]$Secret = "prospeccao-secret-2024"
)

$ErrorActionPreference = "Continue"
$QR_HTML = "$PSScriptRoot\qrcode.html"

function Write-Status($msg) {
    Write-Host "       $msg"
}

# 1. Obter token
Write-Status "Autenticando no WPPConnect..."
try {
    $tokenRes = Invoke-RestMethod -Uri "$WppUrl/api/$Session/$Secret/generate-token" `
        -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 15
    $token = $tokenRes.token
    if (-not $token) {
        Write-Status "ERRO: Token nao retornado"
        exit 1
    }
    Write-Status "Token OK"
} catch {
    Write-Status "ERRO ao gerar token: $($_.Exception.Message)"
    Write-Status "WPPConnect pode ainda estar iniciando. Tente novamente em 30s."
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

# 2. Verificar se já está conectado
Write-Status "Verificando conexao WhatsApp..."
try {
    $status = Invoke-RestMethod -Uri "$WppUrl/api/$Session/check-connection-session" `
        -Method GET -Headers $headers -TimeoutSec 10
    
    if ($status.status -eq $true -or $status.message -eq "Connected") {
        Write-Status ""
        Write-Host ""
        Write-Host "    ============================================" -ForegroundColor Green
        Write-Host "     WhatsApp CONECTADO! Tudo funcionando." -ForegroundColor Green
        Write-Host "    ============================================" -ForegroundColor Green
        Write-Host ""
        exit 0
    }
} catch {
    Write-Status "Sessao nao conectada, buscando QR Code..."
}

# 3. Iniciar sessão (gera QR Code)
Write-Status "Iniciando sessao para gerar QR Code..."
try {
    Invoke-RestMethod -Uri "$WppUrl/api/$Session/start-session" `
        -Method POST -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 30 | Out-Null
} catch {
    # Pode falhar se já existe — OK
}

Start-Sleep -Seconds 5

# 4. Buscar QR Code
Write-Status "Buscando QR Code..."
$qrBase64 = $null

for ($tentativa = 1; $tentativa -le 10; $tentativa++) {
    try {
        $qrRes = Invoke-RestMethod -Uri "$WppUrl/api/$Session/qrcode-session?image=true" `
            -Method GET -Headers $headers -TimeoutSec 15
        
        $qr = $qrRes.qrcode
        if (-not $qr) { $qr = $qrRes.base64 }
        
        if ($qr -and $qr.Length -gt 50) {
            $qrBase64 = $qr
            Write-Status "QR Code obtido!"
            break
        }
    } catch {
        # Pode ser que a sessão precise de mais tempo
    }
    
    # Verificar se conectou enquanto esperava
    try {
        $st = Invoke-RestMethod -Uri "$WppUrl/api/$Session/check-connection-session" `
            -Method GET -Headers $headers -TimeoutSec 5
        if ($st.status -eq $true -or $st.message -eq "Connected") {
            Write-Host ""
            Write-Host "    ============================================" -ForegroundColor Green
            Write-Host "     WhatsApp CONECTADO durante espera!" -ForegroundColor Green
            Write-Host "    ============================================" -ForegroundColor Green
            Write-Host ""
            exit 0
        }
    } catch {}
    
    Write-Status "Aguardando QR Code... ($tentativa/10)"
    Start-Sleep -Seconds 3
}

if (-not $qrBase64) {
    Write-Host ""
    Write-Host "    AVISO: QR Code nao disponivel." -ForegroundColor Yellow
    Write-Host "    Acesse o dashboard para escanear:" -ForegroundColor Yellow
    Write-Host "    https://prospeccao-delta.vercel.app/configuracoes" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://prospeccao-delta.vercel.app/configuracoes"
    exit 0
}

# 5. Gerar HTML com QR Code e auto-refresh
$imgSrc = if ($qrBase64.StartsWith("data:")) { $qrBase64 } else { "data:image/png;base64,$qrBase64" }

$html = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="20">
    <title>WhatsApp QR Code - Prospeccao</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            font-family: 'Segoe UI', sans-serif; color: white;
        }
        .card {
            background: #1e293b; border-radius: 24px; padding: 48px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5); text-align: center;
            border: 1px solid #334155; max-width: 500px; width: 90%;
        }
        .logo { font-size: 48px; margin-bottom: 8px; }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
        .qr-container {
            background: white; border-radius: 16px; padding: 24px;
            display: inline-block; margin-bottom: 24px;
        }
        .qr-container img { width: 280px; height: 280px; display: block; }
        .instructions {
            background: #0f172a; border-radius: 12px; padding: 20px;
            text-align: left; margin-bottom: 24px;
        }
        .instructions h3 { font-size: 14px; color: #22c55e; margin-bottom: 12px; }
        .instructions ol { padding-left: 20px; }
        .instructions li { color: #cbd5e1; font-size: 13px; margin-bottom: 8px; line-height: 1.4; }
        .instructions li strong { color: white; }
        .status {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            color: #f59e0b; font-size: 13px;
        }
        .pulse {
            width: 10px; height: 10px; background: #f59e0b; border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }
        .footer { margin-top: 16px; color: #475569; font-size: 11px; }
        .connected {
            background: #052e16; border: 2px solid #22c55e; border-radius: 16px;
            padding: 32px; margin-bottom: 24px;
        }
        .connected h2 { color: #22c55e; font-size: 28px; margin-bottom: 8px; }
        .connected p { color: #86efac; }
    </style>
    <script>
        // Auto-check connection every 5 seconds
        async function checkConnection() {
            try {
                const res = await fetch('http://localhost:21465/api/prospeccao/check-connection-session', {
                    headers: { 'Authorization': 'Bearer $token' }
                });
                const data = await res.json();
                if (data.status === true || data.message === 'Connected') {
                    document.getElementById('qr-section').style.display = 'none';
                    document.getElementById('connected-section').style.display = 'block';
                    // Auto close after 5 seconds
                    setTimeout(() => { window.close(); }, 5000);
                    return;
                }
            } catch(e) {}
            setTimeout(checkConnection, 5000);
        }
        
        // Refresh QR code image every 20 seconds
        async function refreshQR() {
            try {
                const res = await fetch('http://localhost:21465/api/prospeccao/qrcode-session?image=true', {
                    headers: { 'Authorization': 'Bearer $token' }
                });
                const data = await res.json();
                const qr = data.qrcode || data.base64;
                if (qr && qr.length > 50) {
                    const src = qr.startsWith('data:') ? qr : 'data:image/png;base64,' + qr;
                    document.getElementById('qr-img').src = src;
                }
            } catch(e) {}
            setTimeout(refreshQR, 20000);
        }
        
        window.onload = () => { checkConnection(); setTimeout(refreshQR, 20000); };
    </script>
</head>
<body>
    <div class="card">
        <div class="logo">📱</div>
        <h1>Prospeccao WhatsApp</h1>
        <p class="subtitle">Escaneie o QR Code para conectar</p>
        
        <div id="qr-section">
            <div class="qr-container">
                <img id="qr-img" src="$imgSrc" alt="QR Code WhatsApp">
            </div>
            
            <div class="instructions">
                <h3>Como escanear:</h3>
                <ol>
                    <li>Abra o <strong>WhatsApp</strong> no celular</li>
                    <li>Toque em <strong>Menu (tres pontinhos)</strong> ou <strong>Configuracoes</strong></li>
                    <li>Toque em <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Aponte a camera para este QR Code</li>
                </ol>
            </div>
            
            <div class="status">
                <div class="pulse"></div>
                Aguardando escaneamento... (atualiza automaticamente)
            </div>
        </div>
        
        <div id="connected-section" style="display:none;">
            <div class="connected">
                <h2>Conectado!</h2>
                <p>WhatsApp conectado com sucesso.</p>
                <p style="margin-top: 12px; font-size: 13px;">Esta pagina fechara automaticamente...</p>
            </div>
        </div>
        
        <p class="footer">Prospeccao WhatsApp Bot &bull; QR Code atualiza a cada 20s</p>
    </div>
</body>
</html>
"@

# Salvar e abrir
$html | Out-File -FilePath $QR_HTML -Encoding UTF8 -Force
Write-Status "QR Code salvo em: $QR_HTML"

Write-Host ""
Write-Host "    ============================================" -ForegroundColor Yellow
Write-Host "     ESCANEIE O QR CODE NO NAVEGADOR" -ForegroundColor Yellow
Write-Host "     A pagina abrira automaticamente..." -ForegroundColor Yellow
Write-Host "    ============================================" -ForegroundColor Yellow
Write-Host ""

Start-Process $QR_HTML

# 6. Aguardar conexão (fica monitorando)
Write-Status "Aguardando voce escanear o QR Code..."
for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 5
    try {
        $st = Invoke-RestMethod -Uri "$WppUrl/api/$Session/check-connection-session" `
            -Method GET -Headers $headers -TimeoutSec 5
        if ($st.status -eq $true -or $st.message -eq "Connected") {
            Write-Host ""
            Write-Host "    ============================================" -ForegroundColor Green
            Write-Host "     WhatsApp CONECTADO com sucesso!" -ForegroundColor Green
            Write-Host "    ============================================" -ForegroundColor Green
            Write-Host ""
            # Limpar HTML temporário
            if (Test-Path $QR_HTML) { Remove-Item $QR_HTML -Force -ErrorAction SilentlyContinue }
            exit 0
        }
    } catch {}
    if ($i % 6 -eq 0) {
        Write-Status "Ainda aguardando... ($([math]::Floor($i*5/60))min)"
    }
}

Write-Host ""
Write-Host "    AVISO: Timeout - QR Code expirou." -ForegroundColor Yellow
Write-Host "    Acesse https://prospeccao-delta.vercel.app/configuracoes" -ForegroundColor Yellow
Write-Host ""
exit 1
