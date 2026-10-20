# 🐳 Docker ve Docker Compose Kurulum & Kullanım Kılavuzu

Bu kılavuz; Linux sisteminizde Docker ve Docker Compose kurulumunu, izin ayarlarını (`permission denied` çözümü) ve bu projedeki APT deposunu Docker konteyneri olarak çalıştırmayı adım adım açıklar.

---

## 📑 İçindekiler
1. [Linux Dağıtımına Göre Docker Kurulumu](#1-linux-dağıtımına-göre-docker-kurulumu)
2. [Docker Servisini Başlatma](#2-docker-servisini-başlatma)
3. [Sudo Olmadan Çalıştırma İzni (Kritik Adım)](#3-sudo-olmadan-çalıştırma-izni-kritik-adım)
4. [Projeyi Docker ile Çalıştırma](#4-projeyi-docker-ile-çalıştırma)
5. [Yararlı Docker Komutları](#5-yararlı-docker-komutları)
6. [Sık Karşılaşılan Hatalar ve Çözümleri](#6-sık-karşılaşılan-hatalar-ve-çözümleri)

---

## 1. Linux Dağıtımına Göre Docker Kurulumu

Sisteminizde Docker veya Compose yüklü değilse dağıtımınıza uygun komutla kurun:

### 🔹 Arch Linux / CachyOS / Manjaro
```bash
sudo pacman -Syu --needed docker docker-compose
```

### 🔹 Ubuntu / Debian / Linux Mint / Pardus
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
```

### 🔹 Fedora / RHEL
```bash
sudo dnf install -y docker docker-compose-plugin
```

---

## 2. Docker Servisini Başlatma

Kurulumdan sonra Docker servisi varsayılan olarak kapalıdır. Servisi açıp her sistem başlangıcında otomatik çalışacak şekilde ayarlayın:

```bash
# Servisi hemen başlatır ve başlangıca ekler:
sudo systemctl enable --now docker

# Durumunu kontrol etmek için:
sudo systemctl status docker
```

---

## 3. Sudo Olmadan Çalıştırma İzni (Kritik Adım)

`permission denied while trying to connect to the docker API` hatası alıyorsanız, kullanıcınız `docker` grubuna ekli değildir. 

Her komutta `sudo` yazmak zorunda kalmamak için:

```bash
# 1. Kullanıcınızı docker grubuna ekleyin:
sudo usermod -aG docker $USER

# 2. İzinleri mevcut terminale anında uygulayın:
newgrp docker

# 3. İznin çalıştığını test edin:
docker ps
```
*(Artık `sudo` yazmadan tüm docker komutlarını çalıştırabilirsiniz).*

---

## 4. Projeyi Docker ile Çalıştırma

Proje kök dizininde (`apt_dopo`) iken tek komutla her şeyi konteyner içinde başlatabilirsiniz:

### 🚀 Başlatma:
```bash
docker compose up -d
```
*(veya alternatif olarak: `./docker/run_container.sh`)*

Konteyner ayağa kalktığında:
* **Web Dashboard:** `http://localhost:8080/`
* **APT Depo Uç Noktası:** `http://localhost:8080/dists/`

---

### 🛑 Durdurma:
```bash
docker compose down
```
*(veya alternatif olarak: `./docker/stop_container.sh`)*

---

## 5. Yararlı Docker Komutları

* **Çalışan Konteynerleri Listeleme:**
  ```bash
  docker ps
  ```

* **Canlı Logları İzleme (Hata takibi için):**
  ```bash
  docker compose logs -f
  ```

* **Konteyneri Yeniden Başlatma:**
  ```bash
  docker compose restart
  ```

* **Kalıcı Veri (Volume) Kontrolü:**
  Aptly veritabanı ve `.deb` paketleri `aptly_data` adında bir Docker biriminde saklanır. Konteyneri silseniz bile paketleriniz kaybolmaz:
  ```bash
  docker volume ls
  ```

---

## 6. Sık Karşılaşılan Hatalar ve Çözümleri

| Hata Mesajı | Sebebi | Çözüm |
| :--- | :--- | :--- |
| **`dial unix /var/run/docker.sock: connect: no such file or directory`** | Docker servisi (daemon) arka planda çalışmıyor. | `sudo systemctl start docker` komutunu çalıştırın. |
| **`permission denied while trying to connect to the docker API`** | Mevcut kullanıcı `docker` grubunda değil. | `sudo usermod -aG docker $USER && newgrp docker` yapın veya komutu `sudo docker compose up -d` ile çalıştırın. |
| **`no configuration file provided: not found`** | `compose.yaml` dosyasının olmadığı bir dizinde komut çalıştırılmış. | Proje kök dizininde (`apt_dopo`) olduğunuzdan emin olun. |
| **`Bind for 0.0.0.0:8080 failed: port is already allocated`** | 8080 portu başka bir servis (örn: Python web sunucusu) tarafından kullanılıyor. | Portu kullanan eski işlemi kapatın (`lsof -i :8080` ile bulun) veya `compose.yaml` içindeki portu `"8081:8080"` yapın. |
