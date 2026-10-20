#!/usr/bin/env bash
set -e

# ==============================================================================
# 08_cleanup_and_optimize.sh
# 
# Depo havuzunu ve Aptly LevelDB veritabanını temizler, yetim (orphaned) dosyaları
# siler ve disk alanını optimize eder.
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}       APT DEPO TEMİZLİK VE OPTİMİZASYON SİHİRBAZI             ${NC}"
echo -e "${BLUE}================================================================${NC}"

# Öncesi Disk Durumu
BEFORE_SIZE=$(du -sh "$HOME/.aptly" 2>/dev/null | awk '{print $1}' || echo "0")
echo -e "Temizlik Öncesi Disk Kullanımı: ${YELLOW}$BEFORE_SIZE${NC}"
echo "----------------------------------------------------------------"

# 1. Aptly Veritabanı Temizliği (Yetim Paket ve Dosya Referansları)
echo -e "${YELLOW}[1/2] Veritabanı temizleniyor (db cleanup)...${NC}"
"$APTLY" db cleanup -verbose=false
echo -e "${GREEN}--> Yetim paket referansları ve indeksler temizlendi.${NC}"

# 2. Arşivleri ve Logları Kontrol Et
echo -e "\n${YELLOW}[2/2] Geçici dosyalar taranıyor...${NC}"
find /tmp -name "deb_build_*" -type d -exec rm -rf {} + 2>/dev/null || true
echo -e "${GREEN}--> Geçici derleme klasörleri temizlendi.${NC}"

# Sonrası Disk Durumu
AFTER_SIZE=$(du -sh "$HOME/.aptly" 2>/dev/null | awk '{print $1}' || echo "0")
echo "----------------------------------------------------------------"
echo -e "${GREEN}${BOLD}OPTİMİZASYON TAMAMLANDI!${NC}"
echo -e "Güncel Disk Kullanımı: ${BOLD}${GREEN}$AFTER_SIZE${NC}"
echo ""
