#!/usr/bin/env bash
set -e

# ==============================================================================
# download_apt_tools.sh
# 
# Bu betik, Debian ve Ubuntu APT depo teknolojilerini (Aptly, Reprepro, Debian APT,
# Debmirror vb.) doğrudan resmi kaynaklarından en güncel halleriyle indirir.
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
SAMPLES_DIR="$ROOT_DIR/sample_packages"

MODE="all" # all, bin, sources

# Argümanları ayrıştır
for arg in "$@"; do
    case "$arg" in
        --binaries-only)
            MODE="bin"
            ;;
        --sources-only)
            MODE="sources"
            ;;
        --all)
            MODE="all"
            ;;
        -h|--help)
            echo -e "${BOLD}Kullanım:${NC} $0 [SEÇENEKLER]"
            echo ""
            echo "Seçenekler:"
            echo "  --all            Hem çalıştırılabilir araçları (binary) hem kaynak kodları indirir (Varsayılan)"
            echo "  --binaries-only  Yalnızca çalıştırılabilir araçları (bin/aptly) indirir"
            echo "  --sources-only   Yalnızca resmi açık kaynak depolarını (sources/*) indirir"
            echo "  -h, --help       Bu yardım mesajını gösterir"
            exit 0
            ;;
        *)
            echo -e "${RED}[HATA] Bilinmeyen seçenek:${NC} $arg"
            echo "Yardım için: $0 --help"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}       APT TEKNOLOJİLERİ VE ARAÇLARI İNDİRİCİ                   ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Hedef Dizin : ${CYAN}$ROOT_DIR${NC}"
echo -e "Mod         : ${GREEN}$MODE${NC}"
echo ""

# 1. Gerekli Temel Araç Kontrolü
echo -e "${YELLOW}[1/4] Sistem gereksinimleri kontrol ediliyor...${NC}"
MISSING_TOOLS=()
for tool in curl git unzip; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        MISSING_TOOLS+=("$tool")
    fi
done

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo -e "${RED}[HATA] Eksik araçlar bulundu: ${MISSING_TOOLS[*]}${NC}"
    echo "Lütfen bu araçları paket yöneticinizle kurun."
    exit 1
fi
echo -e "${GREEN}--> Gerekli araçlar (curl, git, unzip) hazır.${NC}"

# Dizinleri oluştur
mkdir -p "$BIN_DIR" "$SOURCES_DIR" "$SAMPLES_DIR"

# Mimari Tespiti
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)  APTLY_ARCH="linux_amd64" ;;
    aarch64) APTLY_ARCH="linux_arm64" ;;
    armv7l)  APTLY_ARCH="linux_arm" ;;
    *)       APTLY_ARCH="linux_amd64" ;;
esac

# 2. Çalıştırılabilir Araçları (Binaries) İndir
if [ "$MODE" = "all" ] || [ "$MODE" = "bin" ]; then
    echo ""
    echo -e "${YELLOW}[2/4] En güncel Aptly binary sürümü kontrol ediliyor...${NC}"
    
    # GitHub API'den son release etiketini çek
    LATEST_TAG=$(curl -s "https://api.github.com/repos/aptly-dev/aptly/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$LATEST_TAG" ]; then
        LATEST_TAG="v1.6.3" # Yedek fallback
    fi
    VERSION="${LATEST_TAG#v}"
    
    echo -e "Tespit edilen sürüm: ${GREEN}${LATEST_TAG}${NC} (Mimari: ${GREEN}${APTLY_ARCH}${NC})"
    
    DOWNLOAD_URL="https://github.com/aptly-dev/aptly/releases/download/${LATEST_TAG}/aptly_${VERSION}_${APTLY_ARCH}.zip"
    echo -e "İndiriliyor: ${CYAN}${DOWNLOAD_URL}${NC}"
    
    TEMP_ZIP="$ROOT_DIR/aptly_temp.zip"
    TEMP_DIR="$ROOT_DIR/aptly_extract_temp"
    
    curl -fL -o "$TEMP_ZIP" "$DOWNLOAD_URL"
    rm -rf "$TEMP_DIR" && mkdir -p "$TEMP_DIR"
    unzip -q -o "$TEMP_ZIP" -d "$TEMP_DIR"
    
    # Gerçek ikili dosyayı ve bash completion dosyasını yerine taşı
    find "$TEMP_DIR" -type f -name "aptly" -perm /111 -exec mv {} "$BIN_DIR/aptly" \;
    find "$TEMP_DIR" -type f -path "*/bash_completion.d/aptly" -exec mv {} "$BIN_DIR/aptly_bash_completion.sh" \;
    
    chmod +x "$BIN_DIR/aptly"
    rm -rf "$TEMP_ZIP" "$TEMP_DIR"
    
    echo -e "${GREEN}--> bin/aptly başarıyla kuruldu:${NC} $("$BIN_DIR/aptly" version)"
fi

# 3. Resmi Açık Kaynak Kodlarını (Git) İndir
if [ "$MODE" = "all" ] || [ "$MODE" = "sources" ]; then
    echo ""
    echo -e "${YELLOW}[3/4] Resmi kaynak kodları (fork olmadan doğrudan) klonlanıyor...${NC}"
    
    # Repository tanımları: isim|url|açıklama
    REPOS=(
        "aptly|https://github.com/aptly-dev/aptly.git|Aptly (Go ile modern APT depo yöneticisi)"
        "reprepro|https://salsa.debian.org/debian/reprepro.git|Reprepro (Resmi Debian arşiv yöneticisi - C)"
        "apt|https://salsa.debian.org/apt-team/apt.git|Debian APT (Resmi Debian paket yöneticisi çekirdeği)"
        "debmirror|https://salsa.debian.org/debian/debmirror.git|Debmirror (Resmi Debian arşiv yansılama aracı - Perl)"
    )
    
    for entry in "${REPOS[@]}"; do
        IFS='|' read -r name url desc <<< "$entry"
        TARGET_PATH="$SOURCES_DIR/$name"
        
        echo -e "\n${CYAN}--> $desc...${NC}"
        if [ -d "$TARGET_PATH/.git" ]; then
            echo -e "    ${YELLOW}Dizin zaten var, güncelleniyor (git pull)...${NC}"
            (cd "$TARGET_PATH" && git pull --depth 1 >/dev/null 2>&1 || true)
        else
            echo -e "    ${GREEN}Klonlanıyor:${NC} $url"
            git clone --depth 1 "$url" "$TARGET_PATH"
        fi
        echo -e "    ${GREEN}Tamamlandı: sources/$name${NC}"
    done
fi

# 4. Örnek Test Paketini İndir
echo ""
echo -e "${YELLOW}[4/4] Testlerde kullanılacak örnek Debian paketi kontrol ediliyor...${NC}"
SAMPLE_PKG="$SAMPLES_DIR/hello_2.10-3_amd64.deb"
if [ ! -f "$SAMPLE_PKG" ]; then
    echo -e "İndiriliyor: ${CYAN}http://ftp.debian.org/debian/pool/main/h/hello/hello_2.10-3_amd64.deb${NC}"
    curl -fsSL -o "$SAMPLE_PKG" "http://ftp.debian.org/debian/pool/main/h/hello/hello_2.10-3_amd64.deb"
    echo -e "${GREEN}--> sample_packages/hello_2.10-3_amd64.deb indirildi.${NC}"
else
    echo -e "${GREEN}--> Örnek paket zaten mevcut.${NC}"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}TÜM APT TEKNOLOJİLERİ BAŞARIYLA İNDİRİLDİ VE HAZIRLANDI!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Çalıştırılabilir Araç : ${BOLD}$BIN_DIR/aptly${NC}"
echo -e "Kaynak Kodlar         : ${BOLD}$SOURCES_DIR/${NC}"
echo -e "Örnek Paketler        : ${BOLD}$SAMPLES_DIR/${NC}"
echo ""
echo -e "Artık depoyu kurup test etmek için şu komutu çalıştırabilirsiniz:"
echo -e "  ${YELLOW}./scripts/quick_demo.sh${NC}"
echo -e "veya web sunucusunu başlatmak için:"
echo -e "  ${YELLOW}./scripts/04_serve_repo.sh${NC}"
echo ""
