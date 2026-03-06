@echo off
REM ============================================
REM Iniciar Prospeccao em modo producao
REM Coloque este .bat na pasta Startup do Windows
REM para iniciar automaticamente com o PC
REM ============================================

REM Aguardar rede estar disponivel
timeout /t 30 /nobreak >nul

REM Executar script PowerShell
powershell -ExecutionPolicy Bypass -File "c:\Users\Administrador\Desktop\prospeccao\projeto\iniciar-producao.ps1"
