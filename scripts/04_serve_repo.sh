#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APTLY="$ROOT_DIR/bin/aptly"
PORT="${1:-8080}"

echo -e "${BLUE}=== 4. APT Deposu Web Servisi Başlatılıyor ===${NC}"

PUBLISHED=$("$APTLY" publish list -raw 2>/dev/null || true)
if [ -z "$PUBLISHED" ]; then
    echo -e "${YELLOW}[UYARI] Henüz yayınlanmış (publish edilmiş) bir depo bulunmuyor.${NC}"
    echo -e "Önce ${CYAN}./scripts/03_publish_repo.sh${NC} betiğini çalıştırmanız önerilir."
    echo ""
fi

# Yerel IP adresini tespit etmeye çalış
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || echo "localhost")

echo -e "Sunucu Portu  : ${GREEN}$PORT${NC}"
echo -e "Yerel URL     : ${GREEN}http://localhost:${PORT}/${NC}"
echo -e "Ağ Üzerinden  : ${GREEN}http://${LOCAL_IP}:${PORT}/${NC}"
echo "--------------------------------------------------------"
echo -e "${CYAN}Debian / Ubuntu İstemcisinde Kullanım:${NC}"
echo -e "İstemci makinede ${YELLOW}/etc/apt/sources.list.d/benim-depo.list${NC} dosyasına şu satırı ekleyin:"
echo ""
echo -e "  ${GREEN}deb [trusted=yes] http://${LOCAL_IP}:${PORT}/ bookworm main${NC}"
echo ""
echo -e "Ardından istemcide:"
echo -e "  ${GREEN}sudo apt update${NC}"
echo -e "  ${GREEN}sudo apt install <paket-adi>${NC}"
echo "--------------------------------------------------------"
echo -e "${YELLOW}Servis çalışıyor... Durdurmak için [CTRL + C] tuşlarına basın.${NC}"
echo ""

"$APTLY" serve -listen=":${PORT}"
