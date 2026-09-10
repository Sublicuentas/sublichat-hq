@echo off
setlocal
cd /d "%~dp0"
if not exist "worker.js" goto incomplete
if not exist "..\tv-browser\manager.js" goto incomplete
if not exist "..\activar-tv-platforms.js" goto incomplete
where node.exe >nul 2>nul
if errorlevel 1 goto node_missing
where npm.cmd >nul 2>nul
if errorlevel 1 goto node_missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto node_missing
if exist "node_modules\wrangler\package.json" goto check
call npm.cmd ci
if errorlevel 1 goto failed
:check
call npm.cmd run check
if errorlevel 1 goto failed
echo.
echo Se publicara la correccion tv-20260910-2 en su cuenta de Cloudflare.
echo Complete el acceso en el navegador.
call npx.cmd --no-install wrangler login
if errorlevel 1 goto failed
call npm.cmd run deploy
if errorlevel 1 goto failed
echo.
echo PUBLICACION COMPLETADA.
echo Conserve la misma TV_BROWSER_URL y TV_BROWSER_SECRET de Vercel.
echo No necesita generar otra clave de conexion.
echo Abra la URL workers.dev mostrada arriba, seguida de /healthz.
echo Debe mostrar la version tv-20260910-2.
echo Despues publique tambien los archivos de Sublichat en Vercel.
pause
exit /b 0
:incomplete
echo Copie primero TODO el contenido de SUBLICHAT sobre su proyecto actual.
echo Conserve las carpetas tv-cloudflare y tv-browser junto a activar-tv-platforms.js.
pause
exit /b 1
:node_missing
echo Necesita Node.js 22 o superior con npm en Windows.
echo Instale Node.js y vuelva a abrir este archivo.
pause
exit /b 1
:failed
echo.
echo La actualizacion no termino. Conserve el error que aparece arriba.
pause
exit /b 1
