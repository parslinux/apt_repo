#!/usr/bin/env bash

# ==============================================================================
# manage.sh
# 
# APT Depo Yönetim Sistemi - İnteraktif Ana Kontrol Konsolu
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_menu() {
    clear
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BOLD}            APT DEPO YÖNETİM SİSTEMİ - KONTROL PANELİ           ${NC}"
    echo -e "${BLUE}================================================================${NC}"
    echo -e "  Dizin: ${CYAN}$ROOT_DIR${NC}"
    echo -e "----------------------------------------------------------------"
    echo -e "  ${BOLD}[TEMEL İŞLEMLER]${NC}"
    echo -e "  ${GREEN}1)${NC} 🚀 Uçtan Uca Hızlı Demo Çalıştır (quick_demo.sh)"
    echo -e "  ${GREEN}2)${NC} ➕ Yeni Bir Depo Havuzu Oluştur (01_create_repo.sh)"
    echo -e "  ${GREEN}3)${NC} 📥 Depoya .deb Paketi Ekle (02_add_package.sh)"
    echo -e "  ${GREEN}4)${NC} 🔨 Özel .deb Paketi Üret (build_custom_deb.sh)"
    echo -e "  ${GREEN}5)${NC} 🌐 Çoklu Mimari (amd64, arm64, armhf) Depo Kur (07_multiarch_setup.sh)"
    echo -e "  ${GREEN}6)${NC} 📢 Depoyu Yayınla / Güncelle (03_publish_repo.sh)"
    echo ""
    echo -e "  ${BOLD}[SERVİSLER VE İSTEMCİ]${NC}"
    echo -e "  ${CYAN}7)${NC} 🖥️  Modern Web Dashboard'u Başlat (06_start_web_dashboard.sh)"
    echo -e "  ${CYAN}8)${NC} 🔗 İstemci Bağlantısı & Sources.list Testi (client_connect.sh)"
    echo -e "  ${CYAN}9)${NC} 🔐 GPG Depo İmza Anahtarı Üret (setup_gpg_keys.sh)"
    echo ""
    echo -e "  ${BOLD}[RAPORLAMA, TEMİZLİK VE DOCKER]${NC}"
    echo -e "  ${YELLOW}10)${NC}📊 Depo ve Paket Durum Raporu (05_status_info.sh)"
    echo -e "  ${YELLOW}11)${NC}🧹 Depo ve Disk Temizliği Yap (08_cleanup_and_optimize.sh)"
    echo -e "  ${YELLOW}12)${NC}🔄 İnternetten Araçları Güncelle (update_apt_tools.sh)"
    echo -e "  ${MAGENTA}13)${NC}🐳 Docker Container Olarak Başlat (run_container.sh)"
    echo -e "  ${MAGENTA}14)${NC}🛑 Docker Container'ı Durdur (stop_container.sh)"
    echo ""
    echo -e "  ${RED}0)${NC} ❌ Çıkış"
    echo -e "${BLUE}================================================================${NC}"
}

pause() {
    echo ""
    echo -ne "${YELLOW}Devam etmek için [ENTER] tuşuna basın...${NC}"
    read -r
}

while true; do
    show_menu
    echo -ne "Lütfen bir işlem seçin [0-14]: "
    read -r SECIM

    case "$SECIM" in
        1)
            clear
            "$ROOT_DIR/scripts/quick_demo.sh"
            pause
            ;;
        2)
            clear
            echo -e "${BLUE}=== Yeni Depo Oluşturma ===${NC}"
            echo -ne "Depo Adı [Örn: ozel-depo]: "
            read -r rname
            echo -ne "Dağıtım Kodu [Örn: bookworm / jammy]: "
            read -r rdist
            echo -ne "Bileşen [Örn: main]: "
            read -r rcomp
            "$ROOT_DIR/scripts/01_create_repo.sh" "${rname:-ozel-depo}" "${rdist:-bookworm}" "${rcomp:-main}"
            pause
            ;;
        3)
            clear
            echo -e "${BLUE}=== Depoya Paket Ekleme ===${NC}"
            echo -ne "Hedef Depo Adı [Örn: demo-depo]: "
            read -r rname
            echo -ne ".deb Dosyası veya Dizin Yolu (Boşsa örnek indirilir): "
            read -r ppath
            "$ROOT_DIR/scripts/02_add_package.sh" "${rname:-demo-depo}" "$ppath"
            pause
            ;;
        4)
            clear
            echo -e "${BLUE}=== Özel Debian (.deb) Paketi Üretici ===${NC}"
            echo -ne "Paket Adı [Örn: benim-arac]: "
            read -r pname
            echo -ne "Sürüm [Örn: 1.0.0]: "
            read -r pver
            echo -ne "Mimari [Örn: all / amd64]: "
            read -r parch
            "$ROOT_DIR/scripts/build_custom_deb.sh" "${pname:-benim-arac}" "${pver:-1.0.0}" "${parch:-all}"
            pause
            ;;
        5)
            clear
            echo -e "${BLUE}=== Çoklu Mimari (Multi-Arch) Depo Kurulumu ===${NC}"
            echo -ne "Depo Adı [Örn: multiarch-depo]: "
            read -r rname
            echo -ne "Dağıtım Kodu [Örn: bookworm]: "
            read -r rdist
            echo -ne "Bileşen [Örn: main]: "
            read -r rcomp
            echo -ne "Mimariler [Varsayılan amd64,arm64,armhf,i386]: "
            read -r rarchs
            "$ROOT_DIR/scripts/07_multiarch_setup.sh" "${rname:-multiarch-depo}" "${rdist:-bookworm}" "${rcomp:-main}" "${rarchs:-amd64,arm64,armhf,i386}"
            pause
            ;;
        6)
            clear
            echo -e "${BLUE}=== Depoyu Yayınlama ===${NC}"
            echo -ne "Yayınlanacak Depo Adı [Örn: demo-depo]: "
            read -r rname
            "$ROOT_DIR/scripts/03_publish_repo.sh" "${rname:-demo-depo}"
            pause
            ;;
        7)
            clear
            echo -e "${BLUE}=== Modern Web Dashboard Başlatılıyor ===${NC}"
            echo -ne "Port Numarası [Varsayılan 8080]: "
            read -r port
            "$ROOT_DIR/scripts/06_start_web_dashboard.sh" "${port:-8080}"
            pause
            ;;
        8)
            clear
            "$ROOT_DIR/scripts/client_connect.sh"
            pause
            ;;
        9)
            clear
            echo -e "${BLUE}=== GPG Depo İmza Anahtarı ===${NC}"
            echo -ne "Yönetici Adı [Örn: APT Depo Yoneticisi]: "
            read -r gname
            echo -ne "E-Posta [Örn: repo@yerel.lan]: "
            read -r gemail
            "$ROOT_DIR/scripts/setup_gpg_keys.sh" "${gname:-APT Depo Yoneticisi}" "${gemail:-repo@yerel.lan}"
            pause
            ;;
        10)
            clear
            "$ROOT_DIR/scripts/05_status_info.sh"
            pause
            ;;
        11)
            clear
            "$ROOT_DIR/scripts/08_cleanup_and_optimize.sh"
            pause
            ;;
        12)
            clear
            "$ROOT_DIR/scripts/update_apt_tools.sh"
            pause
            ;;
        13)
            clear
            "$ROOT_DIR/docker/run_container.sh"
            pause
            ;;
        14)
            clear
            "$ROOT_DIR/docker/stop_container.sh"
            pause
            ;;
        0|q|Q)
            echo -e "\n${GREEN}Görüşmek üzere!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Geçersiz seçim! Lütfen 0 ile 14 arasında bir sayı girin.${NC}"
            sleep 1
            ;;
    esac
done
