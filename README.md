# APT Depo Yönetim Araçları ve Rehberi

Bu dizin, Debian/Ubuntu tabanlı sistemler için **APT deposu oluşturma, yönetme ve yansılama (mirroring)** işlemlerinde kullanılan en güncel açık kaynak araçları içermektedir (herhangi bir fork yapılmadan doğrudan resmi depolardan indirilmiştir).

---

## 📁 Dizin Yapısı

- **`scripts/`**: Depo kurma, paket ekleme, yayınlama ve web sunucusunu başlatma için otomatikleştirilmiş `.sh` betikleri.
- **`docs/KURULUM_VE_KULLANIM.md`**: Mimari detaylar, istemci yapılandırması ve GPG imzalama rehberi.
- **`bin/aptly`**: Aptly'nin en güncel (v1.6.3, 64-bit Linux) çalıştırılabilir ikili (binary) dosyası.
- **`sources/aptly`**: Aptly'nin resmi GitHub kaynak kodları (forksuz doğrudan klon).
- **`sources/reprepro`**: Debian Reprepro kaynak kodları (Salsa deposu).

## 🎛️ Tek Komutla Yönetim Konsolu (Tavsiye Edilen)

Tüm işlemleri (depo kurma, paket ekleme, özel .deb üretme, yayınlama, web paneli açma vb.) interaktif bir menüden yönetmek için:

```bash
./manage.sh
```

---

## ⚡ Hazır Betikler (.sh)

İşlemleri doğrudan bağımsız betiklerle çalıştırmak isterseniz:

```bash
# 0. Tüm APT araçlarını ve kaynak kodlarını internetten indirme
./scripts/download_apt_tools.sh

# 1. Mevcut APT araçlarını ve kaynak kodlarını en son sürüme güncelleme
./scripts/update_apt_tools.sh

# 2. Uçtan uca hızlı demo (Depo oluşturur, örnek paket indirir, ekler ve yayınlar)
./scripts/quick_demo.sh

# 2. Özel bir depo oluşturma
./scripts/01_create_repo.sh ozel-depo bookworm main

# 3. Depoya paket ekleme (.deb)
./scripts/02_add_package.sh ozel-depo /yol/paket.deb

# 4. Depoyu yayınlama (publish/update)
./scripts/03_publish_repo.sh ozel-depo

# 5. Standart Aptly HTTP sunucusunu başlatma (Sadece CLI/Düz dosya)
./scripts/04_serve_repo.sh 8080

# 6. Çoklu mimari (amd64, arm64, armhf, i386) deposu kurma
./scripts/07_multiarch_setup.sh multiarch-depo bookworm main

# 7. Modern Web Dashboard & APT Sunucusunu Başlatma (Görsel Arayüz + Depo)
./scripts/06_start_web_dashboard.sh 8080

# 8. Depo URL'sine bağlanma ve istemciyi yapılandırma (İstemci tarafı)
./scripts/client_connect.sh http://IP:8080 bookworm main

# 9. Depo ve disk temizliği / veritabanı optimizasyonu
./scripts/08_cleanup_and_optimize.sh

# 10. Depoların durumunu ve paketleri listeleme
./scripts/05_status_info.sh
```

Ayrıntılı rehberler:
- 📖 [docs/KURULUM_VE_KULLANIM.md](docs/KURULUM_VE_KULLANIM.md) (Depo mimarisi ve yönetim rehberi)
- 🌐 [docs/URL_BAGLANTISI.md](docs/URL_BAGLANTISI.md) (URL bağlantısı ve istemci kurulum rehberi)
- 🐳 [docs/DOCKER_KURULUMU.md](docs/DOCKER_KURULUMU.md) (Docker kurulumu, yetkilendirme ve sorun giderme)

---

## 🚀 1. Aptly ile 3 Adımda APT Deposu Oluşturma

Aptly; paket ekleme, anlık görüntü (snapshot) alma ve yayınlama (publish) işlemlerini otomatikleştirir.

### 1.1. Yerel Bir Depo Tanımlayın
```bash
./bin/aptly repo create -comment="Benim Test Depom" -component="main" -distribution="bookworm" my-repo
```

### 1.2. Bir `.deb` Paketini Depoya Ekleyin
```bash
./bin/aptly repo add my-repo /paketlerin/bulundugu/dizin/
```

### 1.3. Depoyu Yayınlayın (Publish)
GPG anahtarı olmadan yerel test için:
```bash
./bin/aptly publish repo -skip-signing my-repo
```

### 1.4. Depoyu HTTP Üzerinden Yayına Açın
Aptly dahili bir HTTP sunucusuna sahiptir:
```bash
./bin/aptly serve -listen=:8080
```
Artık depoya istemci makinelerden `http://<IP>:8080/` adresiyle erişilebilir.

---

## 🛠️ 2. İstemcilerin (Ubuntu/Debian) Bu Depoyu Kullanması

Oluşturduğunuz depoyu bir istemci makinede `/etc/apt/sources.list.d/test.list` içine eklemek için:

```bash
deb [trusted=yes] http://<SUNUCU_IP>:8080/ bookworm main
```

Ardından paket listesi güncellenir:
```bash
sudo apt update
```

---

## 📌 3. Araç Karşılaştırması

| Özellik | **Aptly** (Tavsiye Edilen) | **Reprepro** |
| :--- | :--- | :--- |
| **Geliştirildiği Dil** | Go (Modern, tek ikili dosya) | C (Debian klasik) |
| **Özellikler** | Snapshot, REST API, S3/OpenStack desteği, CLI | Klasik Debian arşiv mimarisi, CLI |
| **REST API Desteği**| Var (`aptly api serve`) | Yok |
| **Kullanım Kolaylığı** | Çok yüksek | Orta / Konfigürasyon dosyası gerektirir |

---

## 📜 Lisans

Bu proje **GNU General Public License v2.0 (GPL-2.0)** ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakabilirsiniz.

