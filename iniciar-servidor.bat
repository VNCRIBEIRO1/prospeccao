@echo off
setlocal EnableDelayedExpansion
title Prospeccao WhatsApp - Servidor

REM ============================================
REM Iniciar Prospeccao WhatsApp
REM Funciona de qualquer conta do Windows
REM ============================================

echo.
echo ========================================================
echo    PROSPECCAO WHATSAPP - INICIANDO SERVIDOR...
echo ========================================================
echo.

set "PROJECT_DIR=c:\Users\Administrador\Desktop\prospeccao\projeto"

if not exist "%PROJECT_DIR%" (
    echo ERRO: Pasta do projeto nao encontrada!
    echo Caminho: %PROJECT_DIR%
    pause
    exit /b 1
)

echo [%date% %time%] Inicio do servidor >> "%PROJECT_DIR%\startup.log"

REM ============================================
REM 1. Verificar e iniciar Docker Desktop
REM ============================================
echo [1/5] Verificando Docker Desktop...
docker info >nul 2>&1
if !errorlevel! equ 0 (
    echo       Docker OK!
    goto passo2
)

echo       Docker nao esta rodando. Iniciando...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo       Aguardando Docker iniciar...

set "DTRY=0"
:loop_docker
timeout /t 10 /nobreak >nul
docker info >nul 2>&1
if !errorlevel! equ 0 goto docker_pronto
set /a DTRY+=1
if !DTRY! geq 12 (
    echo       ERRO: Docker nao iniciou apos 2 minutos.
    echo       Inicie o Docker Desktop manualmente e rode novamente.
    pause
    exit /b 1
)
echo       Aguardando Docker... (!DTRY!/12)
goto loop_docker

:docker_pronto
echo       Docker OK!

:passo2
echo.

REM ============================================
REM 2. Limpar locks do Chromium
REM ============================================
echo [2/5] Limpando locks do Chromium...
docker run --rm -v projeto_wppconnect_data:/data alpine sh -c "find /data -name 'Singleton*' -type f -exec rm -f {} \;" >nul 2>&1
echo       Locks limpos!
echo.

REM ============================================
REM 3. Iniciar WPPConnect via Docker Compose
REM ============================================
echo [3/5] Iniciando WPPConnect (WhatsApp)...
cd /d "%PROJECT_DIR%"
docker compose up -d wppconnect

echo       Aguardando sessao WhatsApp...
set "WTRY=0"
:loop_wpp
timeout /t 5 /nobreak >nul
REM Verificar nos ultimos 50 logs (Started Session pode nao estar nas ultimas 5 linhas)
docker logs wppconnect-server --tail 50 2>&1 | findstr /i "Started Session" >nul
if !errorlevel! equ 0 (
    echo       WPPConnect ONLINE - Sessao ativa!
    goto passo4
)
REM Verificar tambem se ja esta conectado via API (401 = server alive)
curl -s -o nul -w "%%{http_code}" http://localhost:21465/api/prospeccao/check-connection-session 2>nul | findstr /r "200 401" >nul
if !errorlevel! equ 0 (
    echo       WPPConnect ONLINE - API respondendo!
    goto passo4
)
set /a WTRY+=1
if !WTRY! geq 30 (
    echo       AVISO: WPPConnect pode nao ter iniciado completamente
    goto passo4
)
echo       Aguardando WPPConnect... (!WTRY!/30)
goto loop_wpp

:passo4
echo.

REM ============================================
REM 3b. Verificar conexao WhatsApp / QR Code
REM ============================================
echo [3b]  Verificando conexao WhatsApp (QR Code se necessario)...
powershell -ExecutionPolicy Bypass -File "%PROJECT_DIR%\verificar-qrcode.ps1"
echo.

REM ============================================
REM 4. Iniciar Cloudflare Tunnel (via PowerShell)
REM ============================================
echo [4/5] Iniciando Cloudflare Tunnel...

REM Limpar URL antiga
if exist "%PROJECT_DIR%\tunnel_url.txt" del /f "%PROJECT_DIR%\tunnel_url.txt"

powershell -ExecutionPolicy Bypass -File "%PROJECT_DIR%\iniciar-tunnel.ps1" -ProjectDir "%PROJECT_DIR%"

set "TUNNEL_URL="
if exist "%PROJECT_DIR%\tunnel_url.txt" (
    set /p TUNNEL_URL=<"%PROJECT_DIR%\tunnel_url.txt"
)

if not defined TUNNEL_URL (
    echo       AVISO: Nao conseguiu obter URL do tunnel
    goto passo5
)

echo       Tunnel OK: !TUNNEL_URL!

:passo5
echo.

REM ============================================
REM 5. Atualizar Vercel (se tunnel OK)
REM ============================================
if not defined TUNNEL_URL (
    echo [5/5] AVISO: Pulando Vercel - tunnel nao disponivel
    goto fim
)

echo [5/5] Atualizando Vercel com nova URL do tunnel...
cd /d "%PROJECT_DIR%\frontend"

echo       Removendo env antiga...
call vercel env rm WPPCONNECT_URL production --yes >nul 2>&1

echo       Adicionando nova URL: !TUNNEL_URL!
echo !TUNNEL_URL!| call vercel env add WPPCONNECT_URL production >nul 2>&1

echo       Fazendo redeploy na Vercel (pode levar 1-2 min)...
call vercel --prod --yes
echo       Vercel atualizada!

:fim
echo.
echo ========================================================
echo    PROSPECCAO WHATSAPP - SERVIDOR ATIVO!
echo ========================================================
echo.
echo    Dashboard: https://prospeccao-delta.vercel.app
if defined TUNNEL_URL echo    Tunnel:    !TUNNEL_URL!
echo.
echo    MANTENHA ESTA JANELA ABERTA para o servidor funcionar.
echo    Para parar: feche esta janela.
echo ========================================================
echo.
echo [%date% %time%] Servidor ativo >> "%PROJECT_DIR%\startup.log"

REM Manter a janela aberta - servidor rodando
:manter_aberto
echo.
echo Servidor rodando... (pressione qualquer tecla para PARAR)
pause >nul

echo.
echo Deseja realmente parar o servidor? (S/N)
set /p "CONFIRMA="
if /i "!CONFIRMA!" neq "S" goto manter_aberto

echo.
echo Parando servicos...
cd /d "%PROJECT_DIR%"
docker compose stop wppconnect >nul 2>&1
taskkill /im cloudflared.exe /f >nul 2>&1
echo Servicos parados.
echo [%date% %time%] Servidor parado >> "%PROJECT_DIR%\startup.log"
timeout /t 3 /nobreak >nul
exit /b 0
