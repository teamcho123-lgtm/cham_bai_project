@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ============================================
echo   KHOI DONG HE THONG CHAM BAI
echo ============================================
echo.

REM ---------- Kiem tra da cai chua ----------
if not exist "backend\.venv" (
    echo [LOI] Chua cai dat. Hay chay setup.bat truoc.
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo [LOI] Chua cai dat. Hay chay setup.bat truoc.
    pause
    exit /b 1
)
if not exist "fake-backend-crud\node_modules" (
    echo [LOI] Chua cai dat. Hay chay setup.bat truoc.
    pause
    exit /b 1
)

echo Dang mo 3 cua so...
echo.

REM ---------- 1. API du lieu : cong 8000 ----------
start "API du lieu :8000" cmd /k "cd /d "%~dp0fake-backend-crud" && npm start"

REM ---------- 2. API cham bai : cong 8001 ----------
REM PYTHONIOENCODING de console Windows in duoc tieng Viet co dau
start "API cham bai :8001" cmd /k "cd /d "%~dp0backend" && set PYTHONIOENCODING=utf-8 && .venv\Scripts\uvicorn.exe main:app --reload --port 8001"

REM ---------- 3. Giao dien : cong 3000 ----------
start "Giao dien :3000" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [1] API du lieu    http://localhost:8000
echo [2] API cham bai   http://127.0.0.1:8001
echo [3] Giao dien      http://localhost:3000
echo.
echo Doi khoang 15 giay cho ca 3 khoi dong xong,
echo roi mo trinh duyet tai:  http://localhost:3000
echo.
echo Dong cua so nao de tat tien trinh do.
echo.
pause
