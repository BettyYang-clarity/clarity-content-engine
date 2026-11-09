@echo off
title Clarity Content Engine
cd /d "%~dp0"

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"

node run.js
if %errorlevel% neq 0 pause
