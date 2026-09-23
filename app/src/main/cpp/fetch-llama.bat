@echo off
rem  Puts llama.cpp where the Android build expects it:  app\src\main\cpp\llama.cpp
rem  pinned to the exact commit Attune's engine was written and tested against.
rem  Double-click it once, before the first build. Needs Git for Windows.
setlocal
set PIN=7ab4ee7baad2d920464cbacfad4f4b07cf111fd2
cd /d "%~dp0"

if exist "llama.cpp\.git" (
  echo llama.cpp is already here. Nothing to do.
  pause
  goto :eof
)

git --version >nul 2>&1 || goto :nogit
git config --global core.longpaths true >nul 2>&1

echo Downloading llama.cpp (about 100 MB)...
git clone https://github.com/ggml-org/llama.cpp llama.cpp || goto :fail
cd llama.cpp
git checkout %PIN% || goto :fail
echo.
echo Done. Now open the project in Android Studio and build the APK.
pause
goto :eof

:nogit
echo Git is not installed. Install it from https://git-scm.com/download/win
echo (keep the default options), then double-click this file again.
pause
goto :eof

:fail
echo.
echo Something went wrong. Check the internet connection and run this again.
pause
