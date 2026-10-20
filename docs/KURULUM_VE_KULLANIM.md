# 📖 APT Deposu Kurulum ve Kullanım Rehberi

Bu doküman; Debian, Ubuntu ve türevi Linux dağıtımları için yerel veya ağ üzerinden erişilebilir bir **APT deposu (Debian Repository)** kurma, paket ekleme, yayınlama ve istemci makinelerden paket kurma süreçlerini baştan sona açıklar.

---

## 📑 İçindekiler
1. [APT Deposu Nasıl Çalışır? (Mimari)](#1-apt-deposu-nasıl-çalışır-mimari)
2. [Hazır Betikler (.sh) ile Hızlı Kullanım](#2-hazır-betikler-sh-ile-hızlı-kullanım)
3. [Adım Adım Depo Yönetimi](#3-adım-adım-depo-yönetimi)
4. [İstemci (Debian/Ubuntu) Tarafında Depoyu Tanımlama](#4-istemci-debianubuntu-tarafında-depoyu-tanımlama)
5. [GPG ile Depo İmzalama (Güvenli / Production Modu)](#5-gpg-ile-depo-imzalama-güvenli--production-modu)
6. [Sıkça Sorulan Sorular ve İpuçları](#6-sıkça-sorulan-sorular-ve-ipuçları)

---

## 1. APT Deposu Nasıl Çalışır? (Mimari)

Bir APT deposu aslında standart bir web sunucusu (veya dosya dizini) üzerinde belirli bir hiyerarşide duran dosyalardan ibarettir:

```
~/.aptly/public/
├── dists/
│   └── bookworm/                          <-- Dağıtım (Distribution)
│       ├── Release                        <-- Depo meta verisi ve Packages dosyalarının SHA256 özetleri
│       ├── Release.gpg                    <-- GPG imzası (varsa)
│       └── main/                          <-- Bileşen (Component)
│           └── binary-amd64/              <-- Mimari
│               ├── Packages               <-- Paketlerin listesi, açıklamaları, sürümleri ve yolları
│               └── Packages.gz            <-- Sıkıştırılmış paket listesi
└── pool/
    └── main/
        └── h/
            └── hello/
                └── hello_2.10-3_amd64.deb  <-- Gerçek .deb dosyası
```

### Akış:
1. İstemci `sudo apt update` dediğinde önce `dists/<kod-adi>/Release` dosyasını çeker.
2. Ardından mimarisine uygun `Packages.gz` dosyasını indirerek depoda hangi paketlerin olduğunu öğrenir.
3. İstemci `sudo apt install paket` dediğinde `pool/` altındaki `.deb` dosyasını indirir ve `dpkg -i` ile sisteme kurar.

---

## 2. Hazır Betikler (.sh) ile Hızlı Kullanım

Proje kök dizininde yer alan `scripts/` klasöründe tüm aşamalar için pratik betikler hazırlanmıştır:

| Betik / Araç | Görevi | Örnek Kullanım |
| :--- | :--- | :--- |
| **`./manage.sh`** | 🎛️ Tüm işlemleri tek ekrandan yöneten interaktif kontrol konsolu. | `./manage.sh` |
| **`scripts/quick_demo.sh`** | Uçtan uca test deposu açar, örnek paket ekler ve yayınlar. | `./scripts/quick_demo.sh` |
| **`scripts/build_custom_deb.sh`** | Sıfırdan %100 geçerli özel `.deb` paketi üretir. | `./scripts/build_custom_deb.sh arac 1.0 all` |
| **`scripts/setup_gpg_keys.sh`** | Güvenli depo imzalamak için RSA 4096-bit GPG anahtarı üretir. | `./scripts/setup_gpg_keys.sh` |
| **`scripts/07_multiarch_setup.sh`** | Çoklu mimari (amd64, arm64, armhf, i386) deposu kurar. | `./scripts/07_multiarch_setup.sh` |
| **`scripts/01_create_repo.sh`** | Yeni bir yerel depo havuzu oluşturur. | `./scripts/01_create_repo.sh ozel-depo bookworm main` |
| **`scripts/02_add_package.sh`** | Depoya `.deb` paketi ekler. | `./scripts/02_add_package.sh ozel-depo /yol/paket.deb` |
| **`scripts/03_publish_repo.sh`** | Depoyu istemcilerin görebileceği web formatına yayınlar (`publish`). | `./scripts/03_publish_repo.sh ozel-depo` |
| **`scripts/06_start_web_dashboard.sh`** | Modern görsel web arayüzünü ve API/APT sunucusunu başlatır. | `./scripts/06_start_web_dashboard.sh 8080` |
| **`scripts/04_serve_repo.sh`** | Standart Aptly dahili HTTP sunucusunu başlatır. | `./scripts/04_serve_repo.sh 8080` |
| **`scripts/client_connect.sh`** | Depo URL'sini test eder ve istemci makineye bağlar. | `./scripts/client_connect.sh http://IP:8080` |
| **`scripts/install_client_oneline.sh`** | İstemcide tek satırla kurulum yapar (`/install.sh` servisi). | `curl .../install.sh \| sudo bash` |
| **`scripts/08_cleanup_and_optimize.sh`** | Yetim dosyaları temizler ve veritabanını sıkıştırır. | `./scripts/08_cleanup_and_optimize.sh` |
| **`scripts/05_status_info.sh`** | Mevcut depoları, paketleri ve yayınları raporlar. | `./scripts/05_status_info.sh` |
| **`scripts/download_apt_tools.sh`** | İnternetten en güncel resmi binary ve kaynak kodlarını indirir. | `./scripts/download_apt_tools.sh --all` |
| **`scripts/update_apt_tools.sh`** | Kurulu binary ve kaynak kod depolarını günceller. | `./scripts/update_apt_tools.sh` |

---

## 3. Adım Adım Depo Yönetimi

Betikler yerine doğrudan `./bin/aptly` komutunu kullanarak tam kontrol sağlamak isterseniz:

### Adım 1: Depo Oluşturma
```bash
./bin/aptly repo create -comment="Üretim Deposu" -component="main" -distribution="bookworm" uretim-depo
```

### Adım 2: Paket Ekleme
Herhangi bir `.deb` dosyasını veya bir dizindeki tüm paketleri ekleyin:
```bash
./bin/aptly repo add uretim-depo /home/kullanici/paketler/
```

### Adım 3: Depodaki Paketleri Görüntüleme
```bash
./bin/aptly repo show -with-packages uretim-depo
```

### Adım 4: Yayınlama (Publish)
```bash
# Test ortamı için imzasız yayın:
./bin/aptly publish repo -skip-signing uretim-depo
```
> **Not:** Depoya yeni paketler ekledikten sonra yayını güncellemek için:
> ```bash
> ./bin/aptly publish update -skip-signing bookworm
> ```

### Adım 5: Sunucuyu Çalıştırma
```bash
./bin/aptly serve -listen=:8080
```

---

## 4. İstemci (Debian/Ubuntu) Tarafında Depoyu Tanımlama

Deponuzun çalıştığı sunucunun IP adresi örneğin `192.168.1.100` olsun:

### 1. Depoyu sources.list.d içine ekleyin:
İstemci makinede `/etc/apt/sources.list.d/yerel-depo.list` adında bir dosya oluşturup içine yazın:
```bash
echo "deb [trusted=yes] http://192.168.1.100:8080/ bookworm main" | sudo tee /etc/apt/sources.list.d/yerel-depo.list
```
*(Not: `trusted=yes` parametresi, GPG imzası olmadan çalışan test depolarında `InRelease is not signed` uyarısını aşmak içindir).*

### 2. İstemcide Güncelleme Yapıp Paketi Kurun:
```bash
sudo apt update
sudo apt install hello
```

---

## 5. GPG ile Depo İmzalama (Güvenli / Production Modu)

Üretim ortamında `trusted=yes` kullanmak güvenlik açığı yaratabilir. Bunun yerine deponuzu GPG anahtarınızla imzalayabilirsiniz:

### 1. GPG Anahtarı Oluşturun (Sunucuda):
```bash
gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: APT Depo Yoneticisi
Name-Email: repo@sirket.com
Expire-Date: 0
%no-protection
%commit
EOF
```

### 2. Depoyu İmzalı Olarak Yayınlayın:
```bash
./bin/aptly publish repo uretim-depo
```
*(Aptly varsayılan olarak sistemdeki varsayılan GPG anahtarını bulup imzayı `Release.gpg` ve `InRelease` olarak oluşturur).*

### 3. Genel Anahtarı İstemcilere Dağıtın:
```bash
# Sunucuda genel anahtarı dışa aktarın:
gpg --export --armor "repo@sirket.com" > public.key

# İstemci makinede bu anahtarı APT anahtarlıklarına ekleyin:
cat public.key | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/yerel-depo.gpg

# İstemcide sources list'e 'trusted=yes' olmadan ekleyin:
deb http://192.168.1.100:8080/ bookworm main
```

---

## 6. Sıkça Sorulan Sorular ve İpuçları

* **Depo verileri nerede saklanır?**
  Aptly varsayılan olarak paket havuzunu ve yayınlanan dosyaları `~/.aptly/` altında tutar. Ayarları değiştirmek için `~/.aptly.conf` dosyasını düzenleyebilirsiniz.
* **Nginx veya Apache ile yayınlayabilir miyim?**
  Evet. `./bin/aptly serve` yerine Nginx root dizinini `~/.aptly/public` olarak ayarlayarak profesyonel bir web sunucusu üzerinden çok yüksek trafikli servis verebilirsiniz.
* **Uzak resmi bir depoyu kopyalayabilir miyim (Mirror)?**
  Evet. `aptly mirror create ...` ve `aptly mirror update ...` komutlarıyla resmi Ubuntu/Debian depolarının birebir yerel yansılarını (mirror) oluşturabilirsiniz.
