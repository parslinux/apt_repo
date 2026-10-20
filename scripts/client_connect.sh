#!/usr/bin/env bash
set -e

# ==============================================================================
# client_connect.sh
#
# Bu betik, yayınlanan bir APT depo URL'sine bağlanmayı, depoyu doğrulamayı ve
# bir Debian/Ubuntu istemcisine bu depoyu otomatik veya manuel olarak eklemeyi sağlar.
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Argümanlar
REPO_URL="${1}"
DIST="${2:-bookworm}"
COMP="${3:-main}"
LIST_NAME="${4:-ozel-apt-depo}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}             APT DEPOSU URL BAĞLANTI VE İSTEMCİ KURUCU          ${NC}"
echo -e "${BLUE}================================================================${NC}"

# Eğer URL verilmediyse yerel IP'yi ve varsayılan 8080 portunu öner
if [ -z "$REPO_URL" ]; then
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || echo "localhost")
    DEFAULT_URL="http://${LOCAL_IP}:8080"
    
    echo -e "Depo URL'si belirtilmedi."
    echo -ne "Lütfen bağlanılacak depo URL'sini girin [Varsayılan: ${CYAN}${DEFAULT_URL}${NC}]: "
    read -r USER_INPUT
    REPO_URL="${USER_INPUT:-$DEFAULT_URL}"
fi

# URL sonundaki eğik çizgiyi kaldır
REPO_URL="${REPO_URL%/}"

echo ""
echo -e "Bağlanılacak URL : ${GREEN}$REPO_URL${NC}"
echo -e "Hedef Dağıtım    : ${GREEN}$DIST${NC}"
echo -e "Bileşen (Comp)   : ${GREEN}$COMP${NC}"
echo "----------------------------------------------------------------"

# 1. URL ve Depo Sağlığı Testi (Release dosyası kontrolü)
echo -e "${YELLOW}[1/3] Depo URL'si ve Release meta verisi test ediliyor...${NC}"
RELEASE_URL="${REPO_URL}/dists/${DIST}/Release"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 4 "$RELEASE_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}--> [BAŞARILI] Depo erişilebilir! (HTTP 200 OK)${NC}"
    echo -e "    Release dosyası: ${CYAN}$RELEASE_URL${NC}"
    
    # Release dosyasından bazı bilgileri göster
    ORIGIN=$(curl -s "$RELEASE_URL" | grep "^Origin:" | head -n 1 || true)
    ARCHS=$(curl -s "$RELEASE_URL" | grep "^Architectures:" | head -n 1 || true)
    [ -n "$ORIGIN" ] && echo -e "    $ORIGIN"
    [ -n "$ARCHS" ] && echo -e "    $ARCHS"
else
    echo -e "${RED}[UYARI] '$RELEASE_URL' adresine erişilemedi! (HTTP Kodu: $HTTP_STATUS)${NC}"
    echo -e "${YELLOW}Olası nedenler:${NC}"
    echo "  1. './scripts/04_serve_repo.sh' sunucusu çalışmıyor olabilir."
    echo "  2. Girilen IP/Port hatalı olabilir."
    echo "  3. Belirtilen dağıtım ('$DIST') henüz publish edilmemiş olabilir."
    echo ""
    echo -ne "Yine de istemci yapılandırma kodunu üretmek istiyor musunuz? [E/h]: "
    read -r CEVAP
    if [[ "$CEVAP" =~ ^[Hh]$ ]]; then
        echo "İşlem iptal edildi."
        exit 1
    fi
fi

# 2. İstemci Satırı Oluşturma
echo ""
echo -e "${YELLOW}[2/3] İstemci Yapılandırma Satırı Oluşturuluyor...${NC}"
SOURCES_LINE="deb [trusted=yes] ${REPO_URL}/ ${DIST} ${COMP}"
LIST_FILE="/etc/apt/sources.list.d/${LIST_NAME}.list"

echo -e "Oluşturulan Satır:"
echo -e "  ${BOLD}${GREEN}$SOURCES_LINE${NC}"
echo ""

# 3. İstemciye Otomatik Uygulama (Eğer sistemde apt varsa)
echo -e "${YELLOW}[3/3] İstemci Uygulama Seçenekleri:${NC}"

if command -v apt-get >/dev/null 2>&1; then
    echo -e "${CYAN}Bu sistem bir Debian/Ubuntu sistemi olarak tespit edildi.${NC}"
    echo -ne "Bu depoyu doğrudan bu makinenin ${YELLOW}$LIST_FILE${NC} dosyasına eklemek istiyor musunuz? [e/H]: "
    read -r ONAY
    if [[ "$ONAY" =~ ^[Ee]$ ]]; then
        echo "$SOURCES_LINE" | sudo tee "$LIST_FILE" >/dev/null
        echo -e "${GREEN}[BAŞARILI] $LIST_FILE oluşturuldu.${NC}"
        echo -e "${YELLOW}Paket listeleri güncelleniyor (sudo apt update)...${NC}"
        sudo apt-get update
        echo -e "${GREEN}[TAMAMLANDI] Artık bu depodaki paketleri kurabilirsiniz!${NC}"
        exit 0
    fi
fi

# Manuel Ekleme Kılavuzu (Uzak makineden bağlanacaklar için)
echo -e "\n${BOLD}Uzak bir Debian / Ubuntu makineden bu URL'ye bağlanmak için:${NC}"
echo "----------------------------------------------------------------"
echo -e "1. İstemci makinenin terminalinde şu komutu çalıştırın:"
echo -e "   ${CYAN}echo \"$SOURCES_LINE\" | sudo tee $LIST_FILE${NC}"
echo ""
echo -e "2. Paket listesini güncelleyin:"
echo -e "   ${CYAN}sudo apt update${NC}"
echo ""
echo -e "3. Depodaki paketi kurun:"
echo -e "   ${CYAN}sudo apt install <paket-adi>${NC}   ${YELLOW}(Örn: sudo apt install hello)${NC}"
echo "----------------------------------------------------------------"
echo -e "4. Tarayıcıdan veya curl ile depoyu doğrudan gezmek için:"
echo -e "   ${CYAN}curl -s ${REPO_URL}/dists/${DIST}/${COMP}/binary-amd64/Packages | grep '^Package:'${NC}"
echo "----------------------------------------------------------------"
