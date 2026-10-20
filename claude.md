# Claude / LLM Asistan Kılavuzu: APT Depo Yönetim Araçları

Bu belge, bu depoda çalışacak yapay zeka asistanları (Claude, Gemini vb.) için proje yapısını, mimari kararları ve çalışma kurallarını tanımlar.

---

## 🎯 Projenin Amacı ve Kapsamı
Bu proje, Debian ve Ubuntu tabanlı sistemler için **özel APT depoları (Debian Archive / Repository)** oluşturmayı, yönetmeyi, güncellemeyi ve yayınlamayı sağlayan açık kaynaklı araçları bir arada sunar.

---

## ⚠️ Temel Kurallar ve İlkeler

1. **Forklama Yok (No Forking):**
   - Kaynak kodlar veya araçlar herhangi bir fork yapılmadan doğrudan Debian Salsa veya resmi GitHub kaynaklarından (`git clone --depth 1`) orijinal haliyle indirilir.
2. **Modüler Betik Mimarisi:**
   - Tüm otomasyon `scripts/` dizininde toplanır.
   - Betiklerde `set -e` kullanılır ve renkli durum çıktıları verilir.
   - Çalıştırılabilir ikili dosya olarak daima `bin/aptly` referans alınır.
3. **Büyük Dosyalar Git'e Eklenmez:**
   - 90MB+ boyutundaki `bin/aptly` ikili dosyası ve `.deb` paketleri `.claudeignore` / `.gitignore` ile dışlanır. İhtiyaç halinde `scripts/download_apt_tools.sh` ile indirilir.

---

## 📁 Dizin Organizasyonu

```
apt_dopo/
├── manage.sh                  # 🎛️ Ana interaktif kontrol konsolu
├── compose.yaml               # Docker Compose ana yapılandırma dosyası
├── bin/                       # Çalıştırılabilir araçlar (bin/aptly)
├── sources/                   # Resmi açık kaynak depoları (aptly, reprepro, apt, debmirror)
├── web/                       # Modern Web Dashboard (HTML5, Vanilla CSS, JS, server.py)
├── docker/                    # Dockerfile, compose.yaml ve container betikleri
├── deploy/                    # Üretim Nginx ve Caddy ters proxy konfigürasyonları
├── .github/workflows/         # Otomatik CI/CD paket yayınlama pipeline'ı
├── custom_packages/           # build_custom_deb.sh ile üretilen özel .deb paketleri
├── sample_packages/           # Test amaçlı kullanılan hafif .deb paketleri
├── scripts/                   # Yönetim, kurulum, çalıştırma ve güncelleme betikleri
│   ├── download_apt_tools.sh  # İnternetten araçları indirir
│   ├── update_apt_tools.sh    # Kurulu araç ve kaynak kodlarını günceller
│   ├── quick_demo.sh          # Uçtan uca hızlı test
│   ├── build_custom_deb.sh    # Özel .deb paketi üretici
│   ├── setup_gpg_keys.sh      # GPG imza anahtarı otomasyonu
│   ├── 01_create_repo.sh      # Depo oluşturma
│   ├── 02_add_package.sh      # Paket ekleme
│   ├── 03_publish_repo.sh     # Depoyu yayınlama (publish/update)
│   ├── 04_serve_repo.sh       # Standart HTTP sunucusu başlatma
│   ├── 06_start_web_dashboard.sh # Modern görsel web paneli başlatıcı
│   ├── 07_multiarch_setup.sh  # Çoklu mimari (amd64, arm64, armhf) deposu kurucu
│   ├── 08_cleanup_and_optimize.sh # Yetim dosya ve veritabanı temizliği
│   ├── client_connect.sh      # İstemci bağlantı ve doğrulama aracı
│   ├── install_client_oneline.sh # Tek satırlık curl kurulum servisi
│   └── 05_status_info.sh      # Depo ve paket durum raporu
├── docs/                      # Detaylı dokümantasyon klasörü
│   ├── KURULUM_VE_KULLANIM.md # Depo mimarisi ve yönetim rehberi
│   ├── URL_BAGLANTISI.md      # URL bağlantısı ve istemci kurulum rehberi
│   └── DOCKER_KURULUMU.md     # Docker kurulum, yetkilendirme ve hata çözümleri
├── install.md                 # Temel kurulum rehberi
├── progress.md                # Proje ilerleme ve yapılacaklar takibi
├── claude.md                  # LLM / Claude bağlam dokümanı
└── README.md                  # Ana proje tanıtımı
```

---

## 🛠️ Temel Komutlar ve Kullanım

* **İnteraktif Kontrol Konsolu:** `./manage.sh`
* **Modern Web Dashboard:** `./scripts/06_start_web_dashboard.sh 8080`
* **Docker ile Başlatma:** `docker compose up -d`
* **Hızlı Doğrulama:** `./scripts/quick_demo.sh`
* **Yeni Araç İndirme:** `./scripts/download_apt_tools.sh`
* **Araçları Güncelleme:** `./scripts/update_apt_tools.sh`
* **Depo Temizliği:** `./scripts/08_cleanup_and_optimize.sh`
