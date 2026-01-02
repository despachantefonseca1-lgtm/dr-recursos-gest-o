@echo off
echo ==========================================
echo    Dr. Recursos - GitHub Auto-Sync
echo ==========================================

echo [1/4] Adicionando alteracoes...
git add .

echo [2/4] Criando commit...
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~6,2%/%datetime:~4,2%/%datetime:~0,4% %datetime:~8,2%:%datetime:~10,2%
git commit -m "Auto-sync: %timestamp%"

echo [3/4] Atualizando repositorio local (Pull)...
git pull origin main --rebase

echo [4/4] Enviando para o GitHub (Push)...
git push origin main

echo.
echo ==========================================
echo    Sincronizacao Concluida com Sucesso!
echo ==========================================
pause
