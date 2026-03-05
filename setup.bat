@echo off
REM ============================================
REM Setup Automático — Sistema de Prospecção WhatsApp (Windows)
REM Execute: setup.bat
REM ============================================

echo.
echo ========================================
echo    SISTEMA DE PROSPECCAO WHATSAPP
echo    Setup Automatico (Windows)
echo ========================================
echo.

REM Verificar Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Docker nao encontrado!
    echo Instale: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)
echo [OK] Docker encontrado

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js encontrado

REM Criar diretórios
if not exist "logs" mkdir logs

REM Instalar dependências backend
echo.
echo [2/7] Instalando backend...
cd backend
call npm install --legacy-peer-deps
cd ..
echo [OK] Backend instalado

REM Instalar dependências frontend
echo.
echo [3/7] Instalando frontend...
cd frontend
call npm install --legacy-peer-deps
cd ..
echo [OK] Frontend instalado

REM Subir containers
echo.
echo [4/7] Subindo containers Docker...
docker compose up -d
echo Aguardando containers (15s)...
timeout /t 15 /nobreak >nul
echo [OK] Containers rodando

REM Migrations
echo.
echo [5/7] Configurando banco de dados...
cd backend
call npx prisma generate
call npx prisma migrate dev --name init --skip-generate
cd ..
echo [OK] Banco configurado

REM Iniciar backend
echo.
echo [6/7] Iniciando backend...
cd backend
start /B node server.js
cd ..
timeout /t 3 /nobreak >nul

REM Iniciar frontend
echo.
echo [7/7] Iniciando frontend...
cd frontend
start /B npx next dev -p 3000
cd ..
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo    SISTEMA RODANDO LOCALMENTE
echo ========================================
echo.
echo   Dashboard:      http://localhost:3000
echo   Backend API:    http://localhost:3001
echo   n8n:            http://localhost:5678  (admin/admin123)
echo   Evolution API:  http://localhost:8080
echo.
echo   Abra o Dashboard e va em Configuracoes
echo   para conectar o WhatsApp via QR Code
echo.
pause
