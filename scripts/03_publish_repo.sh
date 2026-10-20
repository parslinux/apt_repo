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
SKIP_SIGNING="${2:---skip-signing}"

echo -e "${BLUE}=== 3. Depoyu Yayınlama (Publish) ===${NC}"
echo -e "Yayınlanacak Depo : ${GREEN}$REPO_NAME${NC}"

# Deponun varlığını ve dağıtım adını öğren
REPO_INFO=$("$APTLY" repo show "$REPO_NAME" 2>/dev/null || true)
if [ -z "$REPO_INFO" ]; then
    echo -e "${RED}[HATA] '$REPO_NAME' adında bir depo bulunamadı!${NC}"
    exit 1
fi

DIST=$(echo "$REPO_INFO" | grep "Default distribution:" | awk '{print $3}')
[ -z "$DIST" ] && DIST="bookworm"

echo -e "Dağıtım (Distribution): ${GREEN}$DIST${NC}"

# Yayınlanmış mı kontrol et
PUBLISHED=$("$APTLY" publish list -raw 2>/dev/null | grep "$DIST" || true)

if [ -n "$PUBLISHED" ]; then
    echo -e "${YELLOW}[BİLGİ] '$DIST' dağıtımı zaten yayınlanmış durumda. Yayın güncelleniyor (update)...${NC}"
    "$APTLY" publish update $SKIP_SIGNING "$DIST"
else
    echo -e "${GREEN}[BİLGİ] İlk defa yayınlanıyor...${NC}"
    "$APTLY" publish repo $SKIP_SIGNING "$REPO_NAME"
fi

echo ""
echo -e "${GREEN}[BAŞARILI] Depo yayınlandı!${NC}"
echo -e "Aktif yayın listesi:"
"$APTLY" publish list
