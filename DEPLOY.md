# OEN OPTİK Web Uygulaması - Deploy Kılavuzu

## 1. Sunucu Gereksinimleri

- **Node.js** v18+ (v20 LTS önerilir)
- **npm** v9+
- **Ubuntu/Debian** (önerilen) veya Windows Server
- **Minimum:** 1 CPU, 1GB RAM, 10GB disk

## 2. Sunucuya Dosya Yükleme

```bash
# Sunucuya bağlan
ssh kullanici@sunucu-ip

# Proje dizinini oluştur
mkdir -p /var/www/oen-optik
cd /var/www/oen-optik

# Dosyaları yükle (scp veya rsync)
scp -r C:\Users\MGC_Local\oen-optik-web\* kullanici@sunucu-ip:/var/www/oen-optik/
```

Veya Git kullanıyorsanız:
```bash
cd /var/www/oen-optik
git clone https://github.com/kullanici/oen-optik-web.git .
```

## 3. Sunucu Bağımlılıklarını Kurma

```bash
cd /var/www/oen-optik
npm install --production
```

## 4. Mevcut Verileri İçe Aktarma (İsteğe Bağlı)

Eski Electron uygulamasından verileri aktarmak için:
```bash
# Excel dosyasını sunucuya yükle
scp "C:\Users\MGC_Local\OEN-OPTİK\resources\app\data\siparisler.xlsx" kullanici@sunucu-ip:/var/www/oen-optik/data/

# Import scriptini çalıştır
node import-data.js
```

## 5. PM2 ile Kalıcı Çalıştırma

```bash
# PM2'yi global kur
npm install -g pm2

# Uygulamayı başlat
cd /var/www/oen-optik
pm2 start server.js --name oen-optik

# Otomatik başlangıç ayarla
pm2 save
pm2 startup

# Durum kontrol
pm2 status
pm2 logs oen-optik
```

## 6. Nginx Reverse Proxy Kurulumu

```bash
# Nginx kur
sudo apt update
sudo apt install nginx

# Nginx yapılandırma dosyası oluştur
sudo nano /etc/nginx/sites-available/oen-optik
```

İçerik:
```nginx
server {
    listen 80;
    server_name oenoptik.com www.oenoptik.com;

    # HTTP → HTTPS yönlendirmesi (SSL kurulduktan sonra)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Statik dosyalar için önbellek
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1d;
        expires 1d;
    }

    # Upload limiti
    client_max_body_size 50M;
}
```

```bash
# Etkinleştir
sudo ln -s /etc/nginx/sites-available/oen-optik /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 7. SSL Sertifikası (Let's Encrypt)

```bash
# Certbot kur
sudo apt install certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d oenoptik.com -d www.oenoptik.com

# Otomatik yenileme testi
sudo certbot renew --dry-run
```

## 8. DNS Ayarları

Domain sağlayıcınızda (oenoptik.com) şu DNS kayıtlarını ayarlayın:

| Tip | İsim | Değer |
|-----|------|-------|
| A | @ | SUNUCU_IP |
| A | www | SUNUCU_IP |
| AAAA | @ | SUNUCU_IPV6 (varsa) |

## 9. Güvenlik Duvarı

```bash
# UFW ile
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 10. Test

1. Tarayıcıda `https://oenoptik.com` açın
2. Kayıt olun ve giriş yapın
3. Sipariş ekleyin
4. Ürün yönetimini test edin

## Sorun Giderme

```bash
# PM2 logları
pm2 logs oen-optik

# Nginx logları
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Port kontrol
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 80

# PM2 yeniden başlat
pm2 restart oen-optik

# Veritabanı boyutu
ls -lh /var/www/oen-optik/db/oen-optik.db
```

## Yedekleme

Otomatik yedekleme için cron job:
```bash
# Her gün saat 02:00'de yedekle
crontab -e
0 2 * * * cd /var/www/oen-optik && node -e "require('./db/database').getDb().then(() => { const fs = require('fs'); const path = require('path'); const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19); fs.copyFileSync('db/oen-optik.db', 'data/yedekler/backup_' + ts + '.db'); })"
```
