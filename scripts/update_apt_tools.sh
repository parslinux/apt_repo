#!/usr/bin/env bash
set -e

# ==============================================================================
# update_apt_tools.sh
# 
# Bu betik, bu dizindeki APT teknolojilerini (Aptly binary ve sources/* depolarını)
# internetteki en son resmi sürümlerine günceller.
# ==============================================================================

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"
SOURCES_DIR="$ROOT_DIR/sources"
APTLY_BIN="$BIN_DIR/aptly"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}            APT TEKNOLOJİLERİNİ GÜNCELLEME BETİĞİ               ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Aptly Binary Güncelleme Kontrolü
echo -e "\n${YELLOW}[1/2] Aptly Binary Sürümü Kontrol Ediliyor...${NC}"

CURRENT_VERSION="Yok"
if [ -f "$APTLY_BIN" ]; then
    CURRENT_VERSION=$("$APTLY_BIN" version 2>/dev/null | awk '{print $3}' || echo "Bilinmiyor")
fi
echo -e "Yüklü Sürüm      : ${CYAN}$CURRENT_VERSION${NC}"

# GitHub API'den son sürümü sorgula
LATEST_TAG=$(curl -s --connect-timeout 5 "https://api.github.com/repos/aptly-dev/aptly/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || true)
if [ -z "$LATEST_TAG" ]; then
    echo -e "${YELLOW}[UYARI] GitHub API'ye erişilemedi veya limit aşıldı, mevcut binary korunuyor.${NC}"
else
    LATEST_VERSION="${LATEST_TAG#v}"
    echo -e "En Güncel Sürüm  : ${GREEN}$LATEST_VERSION ($LATEST_TAG)${NC}"

    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
        echo -e "${GREEN}--> Aptly binary zaten en güncel sürümde ($CURRENT_VERSION).${NC}"
    else
        echo -e "${YELLOW}--> Yeni sürüm tespit edildi! Güncelleniyor: $CURRENT_VERSION -> $LATEST_VERSION${NC}"
        
        ARCH="$(uname -m)"
        case "$ARCH" in
            x86_64)  APTLY_ARCH="linux_amd64" ;;
            aarch64) APTLY_ARCH="linux_arm64" ;;
            *)       APTLY_ARCH="linux_amd64" ;;
        esac

        DOWNLOAD_URL="https://github.com/aptly-dev/aptly/releases/download/${LATEST_TAG}/aptly_${LATEST_VERSION}_${APTLY_ARCH}.zip"
        TEMP_ZIP="$ROOT_DIR/aptly_update.zip"
        TEMP_EXTRACT="$ROOT_DIR/aptly_update_tmp"

        echo -e "İndiriliyor: ${CYAN}$DOWNLOAD_URL${NC}"
        if curl -fL -o "$TEMP_ZIP" "$DOWNLOAD_URL"; then
            mkdir -p "$TEMP_EXTRACT"
            unzip -q -o "$TEMP_ZIP" -d "$TEMP_EXTRACT"
            
            # Eski ikiliyi yedekle
            [ -f "$APTLY_BIN" ] && cp "$APTLY_BIN" "${APTLY_BIN}.bak"
            
            # Yeni ikiliyi yerleştir
            find "$TEMP_EXTRACT" -type f -name "aptly" -perm /111 -exec mv {} "$APTLY_BIN" \;
            find "$TEMP_EXTRACT" -type f -path "*/bash_completion.d/aptly" -exec mv {} "$BIN_DIR/aptly_bash_completion.sh" \;
            chmod +x "$APTLY_BIN"
            
            rm -rf "$TEMP_ZIP" "$TEMP_EXTRACT"
            echo -e "${GREEN}--> Aptly başarıyla güncellendi:${NC} $("$APTLY_BIN" version)"
        else
            echo -e "${RED}[HATA] Güncelleme paketi indirilemedi!${NC}"
        fi
    fi
fi

# 2. Kaynak Kodları (Git Depoları) Güncelleme
echo -e "\n${YELLOW}[2/2] Kaynak Kod Depoları Güncelleniyor (Git Pull)...${NC}"

if [ ! -d "$SOURCES_DIR" ]; then
    echo -e "${YELLOW}[BİLGİ] sources/ dizini bulunamadı. Oluşturulup depolar klonlanıyor...${NC}"
    "$ROOT_DIR/scripts/download_apt_tools.sh" --sources-only
else
    REPOS=("aptly" "reprepro" "apt" "debmirror")
    for repo in "${REPOS[@]}"; do
        REPO_PATH="$SOURCES_DIR/$repo"
        echo -e "\n${CYAN}--> Depo: $repo${NC}"
        if [ -d "$REPO_PATH/.git" ]; then
            cd "$REPO_PATH"
            # Yerel HEAD commit'ini al
            OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "bilinmiyor")
            
            # Güncellemeleri al
            git fetch --quiet --depth 1 origin || true
            PULL_OUTPUT=$(git pull --quiet 2>&1 || true)
            NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "bilinmiyor")
            
            if [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
                echo -e "    ${GREEN}[GÜNCELLENDİ] Commit: $OLD_COMMIT -> $NEW_COMMIT${NC}"
                git log -1 --pretty=format:"    Son Commit: %s (%cr)%n"
            else
                echo -e "    ${GREEN}[GÜNCEL] Zaten en son commit'te ($NEW_COMMIT).${NC}"
            fi
            cd "$ROOT_DIR"
        else
            echo -e "    ${YELLOW}Depo bulunamadı, yeniden çekiliyor...${NC}"
            "$ROOT_DIR/scripts/download_apt_tools.sh" --sources-only
        fi
    done
fi

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}TÜM APT TEKNOLOJİLERİ KONTROL EDİLDİ VE GÜNCELLENDİ!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Aptly İkili Sürümü: $("$APTLY_BIN" version 2>/dev/null || echo 'Yok')"
echo -e "Güncellenen Dizin : $ROOT_DIR"
echo ""
