# 🌐 APT Deposu URL Bağlantı ve İstemci Kılavuzu

Bu doküman; yayınlanan bir APT deposunun URL adresine (`http://<IP>:<PORT>/`) nasıl bağlanılacağını, istemci makinelerde (Debian, Ubuntu, Linux Mint, Pardus vb.) bu deponun nasıl tanımlanacağını ve olası bağlantı sorunlarının nasıl çözüleceğini detaylı olarak açıklar.

---

## 📑 İçindekiler
1. [APT URL Anatomisi](#1-apt-url-anatomisi)
2. [Hızlı Bağlantı Yolları](#2-hızlı-bağlantı-yolları)
3. [Farklı Ağ Senaryolarında Bağlantı](#3-farklı-ağ-senaryolarında-bağlantı)
4. [Bağlantıyı Test Etme ve Doğrulama](#4-bağlantıyı-test-etme-ve-doğrulama)
5. [Güvenli Bağlantı (GPG & HTTPS)](#5-güvenli-bağlantı-gpg--https)
6. [Sorun Giderme (Troubleshooting)](#6-sorun-giderme-troubleshooting)

---

## 1. APT URL Anatomisi

APT istemcisi bir depoya bağlanırken standart bir URL yapısını takip eder. Örneğin sunucunuz `http://192.168.1.50:8080/` adresinde çalışıyorsa:

| Uç Nokta (Endpoint) | Açıklama |
| :--- | :--- |
| **`http://.../`** | Depo ana kök dizini |
| **`http://.../dists/bookworm/Release`** | Deponun kimlik, dağıtım ve checksum bilgilerini içeren meta dosya |
| **`http://.../dists/bookworm/main/binary-amd64/Packages`** | Depodaki mevcut tüm `.deb` paketlerinin indeks listesi |
| **`http://.../pool/main/.../paket.deb`** | İndirilecek gerçek paket dosyası |

---

## 2. Hızlı Bağlantı Yolları

### Yöntem A: Hazır Betikle Otomatik Bağlanma (Tavsiye Edilen)
Depo dizininde yer alan `client_connect.sh` betiğini çalıştırın:

```bash
# 1. Betiği çalıştırın (URL'yi parametre olarak verebilir veya interaktif girebilirsiniz):
./scripts/client_connect.sh http://192.168.1.50:8080 bookworm main
```

Bu betik:
- URL'nin ayakta olup olmadığını ve `Release` dosyasını test eder.
- İstemci makineye uygun `sources.list` yapılandırmasını otomatik olarak hazırlar.

---

### Yöntem B: Manuel Tek Satır Komutla Ekleme
İstemci makinenin terminaline geçip şu adımları izleyin:

```bash
# 1. Depo satırını /etc/apt/sources.list.d/ altına yazın:
echo "deb [trusted=yes] http://192.168.1.50:8080/ bookworm main" | sudo tee /etc/apt/sources.list.d/ozel-depo.list

# 2. İstemcide indeksleri güncelleyin:
sudo apt update

# 3. Depodaki paketi kurun:
sudo apt install hello
```

> **Not:** `[trusted=yes]` parametresi, test aşamasındaki imzasız depolar için `InRelease is not signed` güvenlik uyarısını atlamak amacıyla kullanılır.

---

## 3. Farklı Ağ Senaryolarında Bağlantı

### Senaryo 1: Aynı Makine İçinde Test (Localhost)
Depo sunucusu ve test ettiğiniz makine aynı bilgisayarsa:
* **URL:** `http://localhost:8080/` veya `http://127.0.0.1:8080/`
* **Satır:** `deb [trusted=yes] http://localhost:8080/ bookworm main`

### Senaryo 2: Yerel Ağdaki Başka Bir Makineden (LAN / Wi-Fi)
Deponun çalıştığı makinenin yerel IP adresini öğrenin (`ip a` veya `hostname -I`).
Örneğin IP `192.168.1.100` ise:
* **URL:** `http://192.168.1.100:8080/`
* **Satır:** `deb [trusted=yes] http://192.168.1.100:8080/ bookworm main`

### Senaryo 3: Uzak Sunucu / İnternet (Domain veya Genel IP)
Eğer deponuzu bir VPS'e kurup Nginx ile 80/443 portundan yayınlıyorsanız:
* **URL:** `https://depo.sirketiniz.com/`
* **Satır:** `deb https://depo.sirketiniz.com/ bookworm main`

---

## 4. Bağlantıyı Test Etme ve Doğrulama

İstemciye eklemeden önce bağlantının çalıştığından emin olmak için şu komutları kullanabilirsiniz:

### 1. HTTP Erişilebilirliğini Doğrulayın:
```bash
curl -I http://192.168.1.50:8080/dists/bookworm/Release
```
*Beklenen Çıktı:* `HTTP/1.1 200 OK`

### 2. Depodaki Paketleri Uzaktan Listeleyin:
```bash
curl -s http://192.168.1.50:8080/dists/bookworm/main/binary-amd64/Packages | grep -E '^Package:|^Version:'
```

### 3. İstemcide Paketin Hangi Depodan Geldiğini Sorgulayın:
```bash
apt-cache policy hello
```
*Bu komut, `hello` paketinin sizin yerel deponuzdan mı yoksa resmi Debian/Ubuntu depolarından mı indirileceğini gösterir.*

---

## 5. Güvenli Bağlantı (GPG & HTTPS)

Production ortamlarında `[trusted=yes]` kullanmak yerine GPG anahtarı tanımlanmalıdır:

1. **Sunucuda Açık Anahtarı Paylaşın:**
   ```bash
   gpg --export --armor "repo@sirket.com" > public.key
   ```
2. **İstemcide Anahtarı Ekleyin:**
   ```bash
   curl -fsSL http://192.168.1.50:8080/public.key | sudo gpg --dearmor -o /etc/apt/keyrings/ozel-depo.gpg
   ```
3. **İstemci Sources Dosyasına `signed-by` ile Ekleyin:**
   ```bash
   echo "deb [signed-by=/etc/apt/keyrings/ozel-depo.gpg] http://192.168.1.50:8080/ bookworm main" | sudo tee /etc/apt/sources.list.d/ozel-depo.list
   ```

---

## 6. Sorun Giderme (Troubleshooting)

| Hata Mesajı | Sebebi | Çözüm |
| :--- | :--- | :--- |
| **`Connection refused`** | Web sunucusu çalışmıyor veya port yanlış. | Sunucu makinesinde `./scripts/04_serve_repo.sh 8080` komutunun açık olduğunu doğrulayın. |
| **`No route to host` / Zaman aşımı** | Güvenlik duvarı (Firewall / UFW) engelliyor. | Sunucuda porta izin verin: `sudo ufw allow 8080/tcp` |
| **`404 Not Found` (Release file)** | Depo henüz yayınlanmamış (published) değil. | Sunucuda `./scripts/03_publish_repo.sh` betiğini çalıştırın. |
| **`The repository ... is not signed`** | GPG imzası olmadan bağlantı yapılmaya çalışılıyor. | `sources.list` satırına `[trusted=yes]` ekleyin veya depoyu GPG ile imzalayın. |
| **`Unable to locate package`** | `sudo apt update` yapılmamış veya paket adı yanlış. | İstemcide `sudo apt update` komutunu yeniden çalıştırın. |
