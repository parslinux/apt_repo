#!/usr/bin/env bash
set -e

# ==============================================================================
# install_client_oneline.sh
# 
# Uzak Debian / Ubuntu istemcisinde TEK BİR CURL KOMUTUYLA deponun sisteme
# eklenmesini ve paket listelerinin güncellenmesini sağlayan kurulum betiği.
#
# Kullanım (İstemcide):
#   curl -sSL http://<SUNUCU_IP>:8080/install.sh | sudo bash
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[HATA] Bu betik root (sudo) yetkisiyle çalıştırılmalıdır.${NC}"
    echo "Lütfen şu şekilde çalıştırın: curl -sSL ... | sudo bash"
    exit 1
fi

# Sunucu URL'si (web/server.py tarafından dinamik enjekte edilir veya ortamdan alınır)
REPO_URL="${REPO_SERVER_URL:-http://localhost:8080}"
REPO_URL="${REPO_URL%/}"
DIST="${REPO_DIST:-bookworm}"
COMP="${REPO_COMP:-main}"
LIST_FILE="/etc/apt/sources.list.d/ozel-depo.list"
KEYRING_DIR="/etc/apt/keyrings"
KEY_FILE="$KEYRING_DIR/ozel-depo.gpg"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}       ÖZEL APT DEPOSU İSTEMCİ KURULUM SİHİRBAZI                ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Bağlanılacak Depo : ${CYAN}$REPO_URL${NC}"
echo -e "Hedef Dağıtım     : ${GREEN}$DIST${NC}"
echo -e "Bileşen           : ${GREEN}$COMP${NC}"
echo "----------------------------------------------------------------"

# 1. Gerekli araçları kontrol et
for tool in curl gpg; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo -e "${YELLOW}--> Eksik araç ($tool) kuruluyor...${NC}"
        apt-get update -qq && apt-get install -y -qq "$tool"
    fi
done

# 2. GPG Anahtarını İndir (Varsa)
HAS_GPG=false
mkdir -p "$KEYRING_DIR"

if curl -s -f -o /tmp/repo_pub.key "$REPO_URL/public.key" 2>/dev/null; then
    echo -e "${GREEN}--> GPG anahtarı bulundu, anahtarlığa ekleniyor...${NC}"
    gpg --dearmor --yes -o "$KEY_FILE" /tmp/repo_pub.key
    rm -f /tmp/repo_pub.key
    chmod 644 "$KEY_FILE"
    HAS_GPG=true
fi

# 3. Sources List Satırını Yaz
if [ "$HAS_GPG" = true ]; then
    echo "deb [signed-by=$KEY_FILE] $REPO_URL/ $DIST $COMP" > "$LIST_FILE"
    echo -e "${GREEN}--> Güvenli (GPG imzalı) kaynak dosyası oluşturuldu: $LIST_FILE${NC}"
else
    echo "deb [trusted=yes] $REPO_URL/ $DIST $COMP" > "$LIST_FILE"
    echo -e "${YELLOW}--> Kaynak dosyası oluşturuldu: $LIST_FILE (trusted=yes)${NC}"
fi

# 4. Paket Listelerini Güncelle
echo -e "${YELLOW}--> Paket indeksleri güncelleniyor (apt-get update)...${NC}"
apt-get update -qq

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}DEPO BAŞARIYLA SİSTEME EKLENDİ!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Artık depodaki paketleri kurabilirsiniz:"
echo -e "  ${BOLD}${YELLOW}sudo apt install <paket-adi>${NC}"
echo ""
