#!/usr/bin/env bash
set -e

# ==============================================================================
# 07_multiarch_setup.sh
# 
# Çoklu mimari (amd64, arm64, armhf, i386, all) destekli APT deposu oluşturur
# ve her mimari için otomatik Packages indekslerini üretir.
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"

REPO_NAME="${1:-multiarch-depo}"
DIST="${2:-bookworm}"
COMP="${3:-main}"
ARCHS="${4:-amd64,arm64,armhf,i386}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}       ÇOKLU MİMARİ (MULTI-ARCH) DEPO KURULUM SİHİRBAZI         ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Depo Adı      : ${GREEN}$REPO_NAME${NC}"
echo -e "Dağıtım       : ${GREEN}$DIST${NC}"
echo -e "Bileşen       : ${GREEN}$COMP${NC}"
echo -e "Desteklenen   : ${CYAN}$ARCHS${NC}"
echo "----------------------------------------------------------------"

# 1. Çoklu Mimari Destekli Depo Oluştur
if "$APTLY" repo show "$REPO_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}[BİLGİ] '$REPO_NAME' adında bir depo zaten mevcut.${NC}"
else
    "$APTLY" repo create \
        -architectures="$ARCHS" \
        -distribution="$DIST" \
        -component="$COMP" \
        -comment="Coklu Mimari Destekli APT Deposu" \
        "$REPO_NAME"
    echo -e "${GREEN}--> '$REPO_NAME' deposu oluşturuldu.${NC}"
fi

# 2. Her Mimari İçin Örnek Paketler Üret ve Ekle
echo -e "\n${YELLOW}--> Her mimari için örnek paketler üretiliyor...${NC}"
IFS=',' read -ra ADDR <<< "$ARCHS"
for arch in "${ADDR[@]}"; do
    PKG_FILE="$ROOT_DIR/custom_packages/arac_${arch}_1.0.0_${arch}.deb"
    if [ ! -f "$PKG_FILE" ]; then
        "$ROOT_DIR/scripts/build_custom_deb.sh" "arac-$arch" "1.0.0" "$arch" "Ornek $arch paketi" <<< "" >/dev/null 2>&1 || true
    fi
    if [ -f "$PKG_FILE" ]; then
        "$APTLY" repo add "$REPO_NAME" "$PKG_FILE" >/dev/null 2>&1 || true
        echo -e "    ${GREEN}[+]${NC} arac-$arch ($arch) eklendi."
    fi
done

# 3. Yayınla (Publish)
echo -e "\n${YELLOW}--> Çoklu mimari olarak yayınlanıyor...${NC}"
PUBLISHED=$("$APTLY" publish list -raw 2>/dev/null | grep "$DIST" || true)

if [ -n "$PUBLISHED" ]; then
    "$APTLY" publish update -skip-signing "$DIST"
else
    "$APTLY" publish repo -skip-signing -architectures="$ARCHS" "$REPO_NAME"
fi

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}ÇOKLU MİMARİ DEPOSU BAŞARIYLA YAYINLANDI!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Oluşturulan mimari indeksleri:"
for arch in "${ADDR[@]}"; do
    echo -e "  • ${CYAN}dists/$DIST/$COMP/binary-$arch/Packages${NC}"
done
echo ""
echo -e "İstemciler kendi mimarilerine göre paketi tek komutla kurabilir:"
echo -e "  ${YELLOW}sudo apt install arac-amd64${NC}  (x86_64 PC'lerde)"
echo -e "  ${YELLOW}sudo apt install arac-arm64${NC}  (Raspberry Pi 4/5 ve Apple Silicon VM'lerde)"
echo ""
