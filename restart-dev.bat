@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo === cc-dashboard-max dev restart ===
echo ROOT: %ROOT%
echo.

where bun >nul 2>&1
if errorlevel 1 (
  echo [ERROR] bun not in PATH
  goto :hold
)

echo [1/3] Killing existing
call :kill 4002
call :kill 5175

timeout /t 1 /nobreak >nul

echo.
echo [2/3] Starting servers via WScript ^(no window^)
set "VBS=%TEMP%\_cc_dev_run.vbs"
> "%VBS%" echo Set sh = CreateObject^("WScript.Shell"^)
>> "%VBS%" echo sh.CurrentDirectory = "%ROOT%"
>> "%VBS%" echo sh.Run "cmd /c bun run server/index.ts", 0, False
>> "%VBS%" echo sh.CurrentDirectory = "%ROOT%\client"
>> "%VBS%" echo sh.Run "cmd /c bun run dev", 0, False
cscript //nologo //b "%VBS%"
echo   cscript exit=%errorlevel%
del "%VBS%" >nul 2>&1

echo.
echo [3/3] Waiting up to 15s
set /a A=0
:wait
set /a A+=1
set "B="
set "F="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4002 " ^| findstr "LISTENING"') do set "B=%%a"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175 " ^| findstr "LISTENING"') do set "F=%%a"
if defined B if defined F goto ok
if %A% geq 15 goto ok
<nul set /p "=."
timeout /t 1 /nobreak >nul
goto wait

:ok
echo.
echo.
echo === Result ===
if defined B (echo   [OK]   backend  4002 PID !B!  http://localhost:4002) else (echo   [FAIL] backend  4002 not responding)
if defined F (echo   [OK]   frontend 5175 PID !F!  http://localhost:5175) else (echo   [FAIL] frontend 5175 not responding)

echo.
echo Done. Servers detached. Close this window with X.
echo.

:hold
timeout /t 99999 /nobreak >nul
goto hold

:kill
set "P=%~1"
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!P! " ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo   port !P! - PID %%a kill
  taskkill /F /PID %%a >nul 2>&1
)
if not defined FOUND echo   port !P! - free
goto :eof
