@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo   CAI DAT HE THONG CHAM BAI TRAC NGHIEM
echo ============================================
echo.

cd /d "%~dp0"

REM ---------- Kiem tra Node ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js
    echo       Tai tai: https://nodejs.org  ^(ban 18 tro len^)
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v

REM ---------- Kiem tra Python ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay Python
    echo       Tai tai: https://python.org  ^(ban 3.10 tro len^)
    echo       Nho tich "Add Python to PATH" khi cai
    pause
    exit /b 1
)
for /f "delims=" %%v in ('python --version') do echo [OK] %%v
echo.

REM ---------- 1/3 json-server ----------
echo [1/3] Cai API du lieu ^(json-server^)...
cd fake-backend-crud
call npm install --silent
if errorlevel 1 (
    echo [LOI] npm install that bai trong fake-backend-crud
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Xong.
echo.

REM ---------- 2/3 frontend ----------
echo [2/3] Cai giao dien ^(Next.js^)... mat vai phut
cd frontend
call npm install --silent
if errorlevel 1 (
    echo [LOI] npm install that bai trong frontend
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Xong.
echo.

REM ---------- 3/3 backend Python ----------
echo [3/3] Cai backend cham bai ^(Python + OpenCV^)...
cd backend
if not exist ".venv" (
    python -m venv .venv
    if errorlevel 1 (
        echo [LOI] Khong tao duoc moi truong ao
        cd ..
        pause
        exit /b 1
    )
)
call .venv\Scripts\python.exe -m pip install --upgrade pip --quiet
call .venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [LOI] pip install that bai
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Xong.
echo.

echo ============================================
echo   CAI DAT HOAN TAT
echo.
echo   Chay du an bang lenh:  start.bat
echo ============================================
echo.
pause
