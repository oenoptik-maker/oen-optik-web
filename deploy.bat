@echo off
echo ========================================
echo   OEN OPTIK - Vercel Deploy
echo ========================================
echo.
echo ONCELIKLE:
echo 1. GitHub hesabiniz olmali (ucretsiz)
echo 2. Vercel hesabiniz olmali (ucretsiz)
echo 3. Turso hesabiniz olmali (ucretsiz)
echo.
echo ADIM 1: GitHub'a yukleme
echo -------------------------
echo su komutlari sirayla calistirin:
echo.
echo   cd %~dp0
echo   git init
echo   git add .
echo   git commit -m "OEN OPTIK web app"
echo   git remote add origin https://github.com/KULLANICI_ADINIZ/oen-optik-web.git
echo   git push -u origin master
echo.
echo ADIM 2: Vercel'e deploy
echo -------------------------
echo 1. https://vercel.com adresine gidin
echo 2. "Sign in with GitHub" ile giris yapin
echo 3. "New Project" tiklayin
echo 4. "oen-optik-web" reposunu secin
echo 5. "Deploy" tiklayin
echo.
echo ADIM 3: Turso veritabani
echo -------------------------
echo 1. https://turso.tech adresine gidin
echo 2. "Sign in with GitHub" ile giris yapin
echo 3. "Create Database" tiklayin
echo 4. "oen-optik" adini verin
echo 5. "Edge" secin (yakin bolge)
echo 6. "Create Token" ile token olusturun
echo 7. Vercel dashboard > Settings > Environment Variables
echo    TURSO_DATABASE_URL = turso://...
echo    TURSO_AUTH_TOKEN = eyJhbGc...
echo 8. "Redeploy" tiklayin
echo.
echo ADIM 4: Google Sites'a ekle
echo -------------------------
echo Vercel'den aldiginiz URL'i Google Sites'a iframe olarak ekleyin
echo.
echo TAMAM!
echo ========================================
pause
