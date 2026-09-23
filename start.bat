@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
 py -3 launcher.py --local
) else (
 python launcher.py --local
)
pause
