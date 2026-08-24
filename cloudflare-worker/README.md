# UTS CORS Proxy - Cloudflare Worker Kurulumu

## Neden Cloudflare Worker?
- Ücretsiz: 100.000 istek/gün
- CORS sorununu çözer
- UTS API'ye erişir (Cloudflare edge network)
- Sunucu yönetimi yok

## Kurulum Adımları

### 1. Cloudflare Hesabı Oluştur
1. https://dash.cloudflare.com/ adresine git
2. Ücretsiz hesap oluştur (email + şifre yeterli)
3. Kredi kartı gerekmez

### 2. Worker Oluştur
1. Cloudflare dashboard'da sol menüden "Workers & Pages"
2. "Create application" tıkla
3. "Create Worker" seç
4. İsim ver: `uts-proxy`
5. "Deploy" tıkla

### 3. Worker Kodunu Yükle
1. Worker sayfasında "Edit code" tıkla
2. Sol taraftaki `worker.js` dosyasını sil
3. `uts-proxy.js` dosyasının içeriğini yapıştır
4. "Save and Deploy" tıkla

### 4. Worker URL'sini Öğren
1. Worker sayfasında sağ üstte URL görünür
2. Örnek: `https://uts-proxy.your-username.workers.dev`
3. Bu URL'yi kopyala

### 5. Admin Panelinde Ayarla
1. Admin panelinde "⚙️ UTS Ayarları" tıkla
2. "Worker URL" alanına URL'yi yapıştır
3. "Kaydet" tıkla

### 6. Test Et
1. "🔄 Bekleyen Ürünleri Çek" butonuna bas
2. Ürünler yüklenmeli

## Sorun Giderme

### "Worker bulunamadı" hatası
- Worker URL'sinin doğru olduğundan emin ol
- URL'nin sonunda `/` olmamalı

### "UTS API hatası" hatası
- UTS Token'ın doğru olduğundan emin ol
- GKK (Kurum Kodu) girildiğinden emin ol

### "CORS hatası" devam ederse
- Worker'ın çalışır durumda olduğunu kontrol et
- Worker logs'ını kontrol et (Cloudflare dashboard > Workers > logs)

## Güvenlik
- Worker token'ı loglamaz veya saklamaz
- Sadece istekleri UTS'ye yönlendirir
- Tüm iletişim HTTPS üzerindendir
