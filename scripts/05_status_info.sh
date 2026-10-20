#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}          APT DEPO DURUM RAPORU                ${NC}"
echo -e "${BLUE}================================================${NC}"

echo -e "\n${CYAN}1. Tanımlı Yerel Depolar:${NC}"
"$APTLY" repo list

echo -e "\n${CYAN}2. Depolardaki Paketler:${NC}"
REPOS=$("$APTLY" repo list -raw 2>/dev/null || true)
if [ -n "$REPOS" ]; then
    for r in $REPOS; do
        echo -e "${YELLOW}--> Depo: $r${NC}"
        "$APTLY" repo show -with-packages "$r" | grep -A 999 "Packages:" || echo "    (Paket yok)"
    done
else
    echo "    (Henüz tanımlı depo yok)"
fi

echo -e "\n${CYAN}3. Yayınlanmış (Published) Dağıtımlar:${NC}"
"$APTLY" publish list

echo -e "\n${CYAN}4. Disk Kullanımı (~/.aptly):${NC}"
if [ -d "$HOME/.aptly" ]; then
    du -sh "$HOME/.aptly" 2>/dev/null || true
    echo -e "Yayınlanan dosyalar dizini: $HOME/.aptly/public"
else
    echo "    (~/.aptly dizini henüz oluşmamış)"
fi

echo -e "${BLUE}================================================${NC}"
