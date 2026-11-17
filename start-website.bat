@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY=C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.14.3\python.exe"

if exist "%PY%" goto FOUND
where python >nul 2>nul
if %errorlevel%==0 goto USEPYTHON
where py >nul 2>nul
if %errorlevel%==0 goto USEPY
echo 未找到 Python，请先安装 Python 3，或手动运行 python -m http.server 8080
pause
exit /b 1

:USEPYTHON
set "PY=python"
goto FOUND

:USEPY
set "PY=py"
goto FOUND

:FOUND
echo Paper Book Portfolio starting at http://localhost:8080
start "Paper Book Portfolio Server" cmd /c ""%PY%" -m http.server 8080 --directory "%~dp0""
timeout /t 3 >nul
start "" http://localhost:8080
echo Server is running. Close the "Paper Book Portfolio Server" window to stop it.
timeout /t 5 >nul
