@echo off
REM ============================================================
REM  Price Tracker - chay bang cach double-click file nay.
REM  Lan dau chay se tu cai dat (can co internet), cac lan sau
REM  se nhanh hon vi da cai san.
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo === Buoc 1/4: Kiem tra Node.js ===
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [LOI] May nay chua cai Node.js.
    echo Hay tai va cai Node.js tai: https://nodejs.org/ ^(ban LTS^)
    echo Sau khi cai xong, chay lai file run.bat nay.
    echo.
    pause
    exit /b 1
)
echo OK - da co Node.js

echo.
echo === Buoc 2/4: Cai thu vien ^(npm install^) ===
cd scraper
if not exist "node_modules" (
    echo Dang cai lan dau, vui long cho...
    call npm install
    if errorlevel 1 (
        echo [LOI] Cai thu vien that bai. Kiem tra ket noi internet roi thu lai.
        pause
        exit /b 1
    )
) else (
    echo OK - thu vien da duoc cai tu truoc
)

echo.
echo === Buoc 3/4: Cai trinh duyet Chromium ^(lan dau co the mat vai phut^) ===
call npx playwright install chromium
if errorlevel 1 (
    echo [LOI] Cai Chromium that bai. Kiem tra ket noi internet roi thu lai.
    pause
    exit /b 1
)

echo.
echo === Buoc 4/4: Cao du lieu gia moi nhat ===
call npm run scrape:all
cd ..

echo.
echo === Mo trang xem ket qua ===
start "" http://localhost:5173
node viewer\serve.js

endlocal
