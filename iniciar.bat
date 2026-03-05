@echo off
echo ============================================
echo   PROSPECCAO - Iniciando Servicos
echo ============================================
echo.

:: 1) Docker (WPPConnect, Redis, n8n)
echo [1/3] Verificando Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao esta rodando! Inicie o Docker Desktop.
    pause
    exit /b 1
)

cd /d "%~dp0"
echo [1/3] Iniciando containers Docker...
docker-compose up -d
if errorlevel 1 (
    echo AVISO: docker-compose falhou, containers podem ja estar rodando.
)
echo [1/3] Docker OK
echo.

:: 2) Aguardar WPPConnect-Server
echo [2/3] Aguardando WPPConnect-Server (porta 21465)...
:wait_wppconnect
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:21465/api/health 2>nul
if errorlevel 1 goto wait_wppconnect
echo [2/3] WPPConnect-Server OK
echo.

:: 3) Next.js Frontend
echo [3/3] Iniciando Next.js na porta 3000...
cd /d "%~dp0frontend"

:: Matar processos antigos na porta 3000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

start "NextJS-Prospeccao" cmd /c "npx next dev -p 3000"

:: Aguardar Next.js
echo Aguardando Next.js iniciar...
:wait_nextjs
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:3000/api/metricas 2>nul
if errorlevel 1 goto wait_nextjs
echo [3/3] Next.js OK
echo.

echo ============================================
echo   TUDO PRONTO!
echo ============================================
echo.
echo   Frontend:        http://localhost:3000
echo   WPPConnect:      http://localhost:21465
echo   n8n:             http://localhost:5678
echo.
echo   Abra o navegador em http://localhost:3000
echo ============================================

:: Abrir no browser
start http://localhost:3000

pause
