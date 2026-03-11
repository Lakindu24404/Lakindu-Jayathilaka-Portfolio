@echo off
setlocal
rem Always work from this file's own folder, whatever directory Explorer,
rem a shortcut or a double-click hands us.
cd /d "%~dp0"

rem This launcher normally sits in frontend\ next to the app. If a copy is run
rem from the repository root instead, step into frontend\ rather than failing.
if not exist "package.json" (
  if exist "frontend\package.json" (
    cd /d "%~dp0frontend"
  ) else (
    echo Could not find the Next.js app.
    echo Expected package.json next to this file, or a frontend\ folder beside it.
    pause
    exit /b 1
  )
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-local.ps1"

if errorlevel 1 (
  echo.
  echo The local preview stopped with an error.
  pause
)
