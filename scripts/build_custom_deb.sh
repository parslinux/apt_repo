#!/usr/bin/env bash
set -e

# ==============================================================================
# build_custom_deb.sh
#
# Herhangi bir Linux dağıtımında (Arch, Debian, Fedora vb.) harici araç
# gerektirmeden standart 'tar' ve 'ar' ile %100 geçerli .deb paketi üretir.
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/custom_packages"

PKG_NAME="${1:-benim-arac}"
PKG_VERSION="${2:-1.0.0}"
PKG_ARCH="${3:-all}"
PKG_DESC="${4:-Ozel gelistirilmis ornek Debian paketi}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}              ÖZEL DEBIAN (.deb) PAKETİ ÜRETİCİ                 ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Paket Adı    : ${GREEN}$PKG_NAME${NC}"
echo -e "Sürüm        : ${GREEN}$PKG_VERSION${NC}"
echo -e "Mimari       : ${GREEN}$PKG_ARCH${NC}"
echo -e "Açıklama     : ${CYAN}$PKG_DESC${NC}"
echo "----------------------------------------------------------------"

mkdir -p "$OUTPUT_DIR"
BUILD_TMP=$(mktemp -d /tmp/deb_build_XXXXXX)
trap 'rm -rf "$BUILD_TMP"' EXIT

# 1. Dizin Hiyerarşisi Hazırla
DATA_DIR="$BUILD_TMP/data"
CONTROL_DIR="$BUILD_TMP/control"
mkdir -p "$DATA_DIR/usr/local/bin"
mkdir -p "$CONTROL_DIR"

# 2. Örnek Çalıştırılabilir Betik / Program Yerleştir
APP_FILE="$DATA_DIR/usr/local/bin/$PKG_NAME"
cat << 'EOF' > "$APP_FILE"
#!/usr/bin/env bash
echo "=================================================="
echo " Tebrikler! Bu program özel APT deposundan kuruldu."
echo " Sistem: $(uname -s -m) | Tarih: $(date)"
echo "=================================================="
EOF
chmod 755 "$APP_FILE"

# 3. DEBIAN/control Dosyasını Üret
cat << EOF > "$CONTROL_DIR/control"
Package: $PKG_NAME
Version: $PKG_VERSION
Architecture: $PKG_ARCH
Maintainer: Gelistirici <gelistirici@yerel.lan>
Installed-Size: 10
Section: utils
Priority: optional
Description: $PKG_DESC
 Bu paket yerel APT deposu ile dağıtılmak üzere üretilmiştir.
EOF

# 4. debian-binary Dosyasını Üret
echo "2.0" > "$BUILD_TMP/debian-binary"

# 5. Arşivleri Sıkıştır (tar.gz)
(cd "$CONTROL_DIR" && tar -czf "$BUILD_TMP/control.tar.gz" ./*)
(cd "$DATA_DIR" && tar -czf "$BUILD_TMP/data.tar.gz" ./*)

# 6. .deb Dosyasını 'ar' ile Paketle (Debian paket standardı)
DEB_FILENAME="${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}.deb"
DEB_FILEPATH="$OUTPUT_DIR/$DEB_FILENAME"

(cd "$BUILD_TMP" && ar -rc "$DEB_FILEPATH" debian-binary control.tar.gz data.tar.gz)

echo -e "\n${GREEN}[BAŞARILI] Paket üretildi:${NC} ${BOLD}$DEB_FILEPATH${NC}"
echo -e "Paket Boyutu : $(du -h "$DEB_FILEPATH" | cut -f1)"

# 7. İsteğe Bağlı Olarak Depoya Ekleme
echo ""
echo -e "${YELLOW}Bu yeni paketi doğrudan yerel depoya eklemek ister misiniz?${NC}"
echo -ne "Hedef depo adı [Örn: demo-depo veya boş geçin]: "
read -r TARGET_REPO

if [ -n "$TARGET_REPO" ]; then
    "$ROOT_DIR/scripts/02_add_package.sh" "$TARGET_REPO" "$DEB_FILEPATH"
    echo -e "${GREEN}Paket '$TARGET_REPO' deposuna eklendi!${NC}"
    echo -e "Yayını güncellemek için: ${YELLOW}./scripts/03_publish_repo.sh $TARGET_REPO${NC}"
fi
