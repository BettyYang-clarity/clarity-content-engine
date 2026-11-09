@echo off
chcp 65001 >nul
title Clarity Content Engine
cd /d "%~dp0"

echo ====================================================
echo   🌿 Clarity Content Engine 啟動中...
echo ====================================================
echo.
echo 正在釋放通訊埠 (3002, 5174)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3002,5174 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo 正在啟動服務並於 3 秒後自動開啟瀏覽器...
start /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5174'"

echo.
echo ====================================================
echo   ✓ 服務已成功啟動！
echo   🌐 網址：http://localhost:5174
echo.
echo   ※ 提示：使用期間請保持此視窗開啟；關閉視窗即可退出。
echo ====================================================
echo.

call npm run dev
pause
