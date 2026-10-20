#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"

REPO_NAME="${1:-ozel-depo}"
PKG_PATH="${2}"

echo -e "${BLUE}=== 2. Depoya Paket Ekleme ===${NC}"
echo -e "Hedef Depo  : ${GREEN}$REPO_NAME${NC}"

# Deponun varlığını kontrol et
if ! "$APTLY" repo show "$REPO_NAME" >/dev/null 2>&1; then
    echo -e "${RED}[HATA] '$REPO_NAME' adında bir depo bulunamadı! Önce 01_create_repo.sh çalıştırın.${NC}"
    exit 1
fi

# Eğer paket belirtilmediyse örnek bir paket indirelim
if [ -z "$PKG_PATH" ]; then
    SAMPLE_DIR="$ROOT_DIR/sample_packages"
    mkdir -p "$SAMPLE_DIR"
    SAMPLE_DEB="$SAMPLE_DIR/hello_2.10-3_amd64.deb"
    
    if [ ! -f "$SAMPLE_DEB" ]; then
        echo -e "${YELLOW}[BİLGİ] Paket parametresi verilmedi. Test için örnek 'hello' paketi indiriliyor...${NC}"
        curl -fsSL -o "$SAMPLE_DEB" "http://ftp.debian.org/debian/pool/main/h/hello/hello_2.10-3_amd64.deb"
    fi
    PKG_PATH="$SAMPLE_DEB"
fi

if [ ! -e "$PKG_PATH" ]; then
    echo -e "${RED}[HATA] Paket veya dizin bulunamadı: $PKG_PATH${NC}"
    exit 1
fi

echo -e "Eklenecek Paket: ${GREEN}$PKG_PATH${NC}"
"$APTLY" repo add "$REPO_NAME" "$PKG_PATH"

echo -e "${GREEN}[BAŞARILI] Paket(ler) depoya eklendi.${NC}"
echo ""
echo -e "Depodaki güncel paketler:"
"$APTLY" repo show -with-packages "$REPO_NAME"
