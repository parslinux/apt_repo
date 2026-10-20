# 🚀 Kurulum Kılavuzu (Installation Guide)

Bu kılavuz, bu depodaki APT yönetim ortamını sıfırdan kurmak veya başka bir Linux makinesine taşımak için gereken adımları içerir.

---

## 1. Sistem Gereksinimleri

Betiklerin ve araçların çalışabilmesi için sisteminizde aşağıdaki temel paketlerin bulunması yeterlidir:

* **curl** (İnternetten indirme işlemleri için)
* **git** (Açık kaynak depolarını çekmek için)
* **unzip** (İkili arşivleri açmak için)

### Dağıtımınıza Göre Paket Kurulumu:

* **Ubuntu / Debian:**
  ```bash
  sudo apt update && sudo apt install -y curl git unzip
  ```

* **Arch Linux / CachyOS / Manjaro:**
  ```bash
  sudo pacman -Syu --needed curl git unzip
  ```

* **Fedora / RHEL:**
  ```bash
  sudo dnf install -y curl git unzip
  ```

---

## 2. Tek Komutla Kurulum

Depo dizinine geldikten sonra tüm araçları ve kaynak kodları tek bir komutla indirebilirsiniz:

```bash
# Betiği çalıştırılabilir yapın (gerekirse):
chmod +x scripts/*.sh

# Tüm araçları ve açık kaynak depolarını internetten indirin:
./scripts/download_apt_tools.sh
```

Bu komut:
1. `bin/aptly` dosyasını sistem mimarinize (x86_64 / arm64) göre indirir.
2. `sources/` altına Aptly, Reprepro, Debian APT ve Debmirror kaynak kodlarını çeker.
3. `sample_packages/` içine test için örnek Debian paketi koyar.

---

## 3. Kurulumu Doğrulama

Kurulumun başarılı olduğunu doğrulamak için:

```bash
# 1. Aptly sürümünü kontrol edin:
./bin/aptly version

# 2. Uçtan uca hızlı demoyu çalıştırın:
./scripts/quick_demo.sh
```

---

## 4. İnteraktif Yönetim Konsolunu Başlatma (Tavsiye Edilen)

Kurulum tamamlandıktan sonra tüm işlemleri (depo oluşturma, paket ekleme, çoklu mimari, web paneli açma vb.) interaktif menüden yönetebilirsiniz:

```bash
./manage.sh
```

---

## 5. Alternatif: Docker ile Tek Komutla Çalıştırma

Projeyi yerel sisteme hiçbir bağımlılık kurmadan izole bir container içinde çalıştırmak için:

```bash
docker compose up -d
```
*(Detaylı rehber ve yetkilendirme için: [docs/DOCKER_KURULUMU.md](docs/DOCKER_KURULUMU.md))*

---

## 6. İsteğe Bağlı: `aptly` Komutunu Global Olarak Tanımlama

`aptly` komutunu her yerden doğrudan çağırabilmek isterseniz terminal oturumunuza ekleyebilirsiniz:

```bash
# Mevcut oturum için:
export PATH="$PWD/bin:$PATH"

# Veya kalıcı olması için ~/.bashrc veya ~/.zshrc içine ekleyin:
echo "export PATH=\"$(pwd)/bin:\$PATH\"" >> ~/.bashrc
source ~/.bashrc
```

---

## 7. Güncellemeleri Denetleme

Daha sonra yeni sürümler çıktığında tüm altyapıyı güncellemek için:

```bash
./scripts/update_apt_tools.sh
```
