#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}     APT DEPOSU HIZLI BAŞLANGIÇ DEMOSU (UÇTAN UCA)  ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Adım 1
echo -e "\n${CYAN}>>> Adım 1: 'demo-depo' oluşturuluyor...${NC}"
"$ROOT_DIR/scripts/01_create_repo.sh" "demo-depo" "bookworm" "main" "Hızlı Demo Deposu"

# Adım 2
echo -e "\n${CYAN}>>> Adım 2: Örnek paket indirilip depoya ekleniyor...${NC}"
"$ROOT_DIR/scripts/02_add_package.sh" "demo-depo"

# Adım 3
echo -e "\n${CYAN}>>> Adım 3: Depo yayınlanıyor (Publish)...${NC}"
"$ROOT_DIR/scripts/03_publish_repo.sh" "demo-depo"

# Adım 4
echo -e "\n${CYAN}>>> Adım 4: Durum kontrol ediliyor...${NC}"
"$ROOT_DIR/scripts/05_status_info.sh"

echo -e "\n${GREEN}Tebrikler! Yerel APT deponuz hazır.${NC}"
echo -e "Web sunucusunu başlatıp test etmek için:"
echo -e "  ${YELLOW}./scripts/04_serve_repo.sh${NC}"
