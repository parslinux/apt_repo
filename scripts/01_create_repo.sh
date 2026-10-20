#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"

if [ ! -f "$APTLY" ]; then
    echo -e "${RED}[HATA] Aptly çalıştırılabilir dosyası bulunamadı: $APTLY${NC}"
    exit 1
fi

REPO_NAME="${1:-ozel-depo}"
DIST="${2:-bookworm}"
COMP="${3:-main}"
COMMENT="${4:-Özel APT Deposu}"

echo -e "${BLUE}=== 1. Yeni APT Deposu Oluşturuluyor ===${NC}"
echo -e "Depo Adı    : ${GREEN}$REPO_NAME${NC}"
echo -e "Dağıtım     : ${GREEN}$DIST${NC}"
echo -e "Bileşen     : ${GREEN}$COMP${NC}"
echo -e "Açıklama    : ${GREEN}$COMMENT${NC}"
echo "----------------------------------------"

# Depo zaten var mı kontrol et
if "$APTLY" repo show "$REPO_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}[BİLGİ] '$REPO_NAME' adında bir depo zaten mevcut.${NC}"
else
    "$APTLY" repo create -comment="$COMMENT" -component="$COMP" -distribution="$DIST" "$REPO_NAME"
    echo -e "${GREEN}[BAŞARILI] '$REPO_NAME' deposu oluşturuldu.${NC}"
fi

echo ""
echo -e "Mevcut depolar:"
"$APTLY" repo list
