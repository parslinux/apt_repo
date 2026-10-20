#!/usr/bin/env bash
set -e

# ==============================================================================
# publish_to_s3.sh
# 
# APT deposunu AWS S3, Cloudflare R2 veya MinIO gibi bulut nesne depolama
# servislerine doğrudan yayınlar (CDN üzerinden sınırsız indirme sağlar).
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"
CONF_FILE="$ROOT_DIR/deploy/s3_aptly.conf"

REPO_NAME="${1:-demo-depo}"
ENDPOINT_NAME="${2:-bulut-depo}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}       S3 / CLOUDFLARE R2 BULUT DEPO YAYINLAMA SİHİRBAZI        ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Yayınlanacak Depo : ${GREEN}$REPO_NAME${NC}"
echo -e "Hedef S3 Uç Nokta : ${CYAN}s3:$ENDPOINT_NAME:${NC}"
echo -e "Ayar Dosyası      : $CONF_FILE"
echo "----------------------------------------------------------------"

# Kontrol: Ayar dosyası var mı ve placeholder'lar düzenlenmiş mi?
if grep -q "ERISIM_ANAHTARI_BURAYA" "$CONF_FILE"; then
    echo -e "${RED}[UYARI] '$CONF_FILE' dosyasındaki erişim anahtarları henüz düzenlenmemiş!${NC}"
    echo -e "Lütfen önce ${YELLOW}deploy/s3_aptly.conf${NC} dosyasını açıp S3 / Cloudflare R2 bilgilerinizi girin:"
    echo "  - bucket"
    echo "  - endpoint"
    echo "  - awsAccessKeyID"
    echo "  - awsSecretAccessKey"
    echo ""
    exit 1
fi

echo -e "${YELLOW}--> Buluta yayınlanıyor...${NC}"
"$APTLY" -config="$CONF_FILE" publish repo -skip-signing "$REPO_NAME" "s3:$ENDPOINT_NAME:"

echo -e "\n${GREEN}[BAŞARILI] Depo bulut depolama alanına yayınlandı!${NC}"
