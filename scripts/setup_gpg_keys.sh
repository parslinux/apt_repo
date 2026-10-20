#!/usr/bin/env bash
set -e

# ==============================================================================
# setup_gpg_keys.sh
# 
# Bu betik, APT deposunu resmi ve güvenli şekilde imzalamak için GPG anahtarı
# üretir, genel anahtarı (public.key) web sunucusuna ve yerel diske dışa aktarır.
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYS_DIR="$ROOT_DIR/keys"
PUBLIC_APT_DIR="$HOME/.aptly/public"

KEY_NAME="${1:-APT Depo Yoneticisi}"
KEY_EMAIL="${2:-repo@yerel.lan}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}         GPG DEPO İMZALAMA VE ANAHTAR OTOMASYONU                ${NC}"
echo -e "${BLUE}================================================================${NC}"

mkdir -p "$KEYS_DIR"

# 1. Mevcut Anahtar Kontrolü
EXISTING_KEY=$(gpg --list-secret-keys --keyid-format LONG "$KEY_EMAIL" 2>/dev/null || true)

if [ -n "$EXISTING_KEY" ]; then
    echo -e "${GREEN}[BİLGİ] '$KEY_EMAIL' için zaten bir GPG anahtarı mevcut.${NC}"
else
    echo -e "${YELLOW}[1/3] Yeni GPG anahtarı üretiliyor (RSA 4096-bit)...${NC}"
    echo -e "İsim  : ${CYAN}$KEY_NAME${NC}"
    echo -e "E-Posta: ${CYAN}$KEY_EMAIL${NC}"
    
    gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $KEY_NAME
Name-Email: $KEY_EMAIL
Expire-Date: 0
%no-protection
%commit
EOF
    echo -e "${GREEN}--> GPG anahtarı başarıyla üretildi.${NC}"
fi

# 2. Genel Anahtarı (Public Key) Dışa Aktarma
echo -e "\n${YELLOW}[2/3] Genel anahtar dışa aktarılıyor...${NC}"
PUB_KEY_FILE="$KEYS_DIR/repo_public.key"
gpg --armor --export "$KEY_EMAIL" > "$PUB_KEY_FILE"
echo -e "${GREEN}--> Yerel kopya kaydedildi: $PUB_KEY_FILE${NC}"

# Web sunucusunun köküne de koy (istemciler curl ile indirebilsin)
if [ -d "$PUBLIC_APT_DIR" ]; then
    cp "$PUB_KEY_FILE" "$PUBLIC_APT_DIR/public.key"
    echo -e "${GREEN}--> Web kök dizinine kopyalandı: $PUBLIC_APT_DIR/public.key${NC}"
fi

# 3. İstemci Doğrulama Bilgileri
KEY_ID=$(gpg --list-keys --keyid-format LONG "$KEY_EMAIL" | grep "pub " | awk '{print $2}' | cut -d'/' -f2)

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}GPG KURULUMU TAMAMLANDI!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Anahtar ID : ${BOLD}${CYAN}$KEY_ID${NC}"
echo -e "Sahibi     : $KEY_NAME <$KEY_EMAIL>"
echo ""
echo -e "${BOLD}Bundan sonra depoyu imzalı yayınlamak için:${NC}"
echo -e "  ${YELLOW}./bin/aptly publish repo -gpg-key=\"$KEY_ID\" <depo-adi>${NC}"
echo -e "veya yayını güncellemek için:"
echo -e "  ${YELLOW}./bin/aptly publish update -gpg-key=\"$KEY_ID\" <dagitim-adi>${NC}"
echo ""
echo -e "${BOLD}İstemci makinede bu anahtarı güvenli ekleme komutu:${NC}"
echo -e "  ${CYAN}curl -fsSL http://<SUNUCU_IP>:8080/public.key | sudo gpg --dearmor -o /etc/apt/keyrings/ozel-depo.gpg${NC}"
echo "----------------------------------------------------------------"
