@echo off
echo ========================================
echo   OEN OPTIK - Sunucu Kurulum
echo ========================================
echo.

echo [1/5] Node.js kontrol ediliyor...
node --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Node.js yuklu degil!
    echo https://nodejs.org adresinden LTS surumunu indirin
    pause
    exit /b 1
)
echo Node.js: 
node --version

echo.
echo [2/5] Bağımlılıklar kuruluyor...
cd /d "%~dp0"
call npm install
if errorlevel 1 (
    echo HATA: npm install basarisiz!
    pause
    exit /b 1
)

echo.
echo [3/5] Veritabani klasoru olusturuluyor...
if not exist "db" mkdir db
if not exist "data\yedekler" mkdir data\yedekler
if not exist "data\uploads" mkdir data\uploads

echo.
echo [4/5] PM2 yukleniyor (opsiyonel)...
npm install -g pm2 2>nul

echo.
echo [5/5] Sunucu baslatiliyor...
echo.
echo ========================================
echo   KURULUM TAMAMLANDI
echo ========================================
echo.
echo Tarayicida acin: http://localhost:3000
echo Veya sunucu IP: http://SUNUCU_IP:3000
echo.
echo Kalici baslatma icin: pm2 start server.js --name oen-optik
echo.
pause
