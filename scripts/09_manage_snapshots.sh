#!/usr/bin/env bash
set -e

# ==============================================================================
# 09_manage_snapshots.sh
# 
# APT Depo Snapshot (Anlık Görüntü) Alma, Geri Yükleme (Rollback),
# Karşılaştırma (Diff) ve Yönetim Betiği
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

if [ ! -x "$APTLY" ]; then
    echo -e "${RED}[HATA] Aptly ikili dosyası bulunamadı: $APTLY${NC}"
    exit 1
fi

ACTION="${1:-menu}"

list_snapshots() {
    echo -e "${BLUE}=== Mevcut Snapshot'lar (Anlık Görüntüler) ===${NC}"
    raw_list=$("$APTLY" snapshot list -raw 2>/dev/null || true)
    if [ -z "$raw_list" ]; then
        echo -e "${YELLOW}Henüz kaydedilmiş bir snapshot bulunmuyor.${NC}"
        return
    fi
    for sname in $raw_list; do
        sinfo=$("$APTLY" snapshot show "$sname" 2>/dev/null || true)
        pkg_cnt=$(echo "$sinfo" | grep -i "Number of packages:" | awk -F: '{print $2}' | tr -d ' ')
        c_date=$(echo "$sinfo" | grep -i "Created At:" | awk -F: '{print $2":"$3":"$4}' | tr -d ' ')
        desc=$(echo "$sinfo" | grep -i "Description:" | cut -d: -f2- | sed 's/^ //')
        echo -e " 📸 ${BOLD}${CYAN}$sname${NC} [${GREEN}${pkg_cnt:-0} paket${NC}] - $c_date"
        if [ -n "$desc" ]; then
            echo -e "    ${YELLOW}↳ Açıklama:${NC} $desc"
        fi
    done
}

create_snapshot() {
    repo="$1"
    snap_name="$2"
    desc="$3"

    if [ -z "$repo" ]; then
        echo -ne "Kaynak Depo Adı [Örn: parslinux]: "
        read -r repo
    fi
    repo="${repo:-parslinux}"

    if [ -z "$snap_name" ]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        snap_name="snap_${repo}_${timestamp}"
    fi

    echo -e "\n${YELLOW}--> '$repo' deposundan '$snap_name' snapshot'ı oluşturuluyor...${NC}"
    "$APTLY" snapshot create "$snap_name" from repo "$repo"
    echo -e "${GREEN}✓ Snapshot başarıyla oluşturuldu: ${BOLD}$snap_name${NC}"
}

rollback_snapshot() {
    snap_name="$1"
    target_repo="$2"
    dist="$3"

    if [ -z "$snap_name" ]; then
        echo -ne "Geri Yüklenecek Snapshot Adı: "
        read -r snap_name
    fi

    if [ -z "$target_repo" ]; then
        echo -ne "Hedef Depo Adı [Örn: parslinux]: "
        read -r target_repo
    fi
    target_repo="${target_repo:-parslinux}"

    if [ -z "$dist" ]; then
        echo -ne "Yayınlanan Dağıtım Kodu [Örn: bookworm / 0.1]: "
        read -r dist
    fi
    dist="${dist:-bookworm}"

    echo -e "\n${YELLOW}⚠️  DİKKAT: '$target_repo' deposu '$snap_name' snapshot'ındaki paket durumuna geri döndürülecektir!${NC}"
    echo -ne "Onaylıyor musunuz? (e/H): "
    read -r confirm
    if [[ ! "$confirm" =~ ^[eEyY]$ ]]; then
        echo -e "${RED}İşlem iptal edildi.${NC}"
        return
    fi

    echo -e "${CYAN}--> 1. Mevcut depo ayarları alınıyor...${NC}"
    repo_show=$("$APTLY" repo show "$target_repo" 2>/dev/null || true)
    comp=$(echo "$repo_show" | grep "Default Component:" | awk -F: '{print $2}' | tr -d ' ')
    comp="${comp:-main}"
    comment=$(echo "$repo_show" | grep "Comment:" | cut -d: -f2- | sed 's/^ //')

    echo -e "${CYAN}--> 2. Depo sıfırlanıyor ve snapshot'tan yeniden kuruluyor...${NC}"
    "$APTLY" repo drop "$target_repo" 2>/dev/null || true
    "$APTLY" repo create -distribution="$dist" -component="$comp" -comment="${comment:-Rollback restored}" "$target_repo" from snapshot "$snap_name"

    echo -e "${CYAN}--> 3. APT yayını güncelleniyor ($dist)...${NC}"
    "$APTLY" publish update -skip-signing "$dist" || true
    if [ "$dist" == "bookworm" ]; then
        "$APTLY" publish update -skip-signing "0.1" 2>/dev/null || true
    fi

    echo -e "\n${GREEN}${BOLD}✓ ROLLBACK BAŞARIYLA TAMAMLANDI!${NC}"
    echo -e "Depo: ${CYAN}$target_repo${NC} | Snapshot: ${CYAN}$snap_name${NC} | Dağıtım: ${CYAN}$dist${NC}"
}

diff_snapshots() {
    snap1="$1"
    snap2="$2"

    if [ -z "$snap1" ] || [ -z "$snap2" ]; then
        echo -ne "1. Snapshot (A): "
        read -r snap1
        echo -ne "2. Snapshot (B): "
        read -r snap2
    fi

    echo -e "\n${BLUE}=== Snapshot Karşılaştırması (Diff: $snap1 vs $snap2) ===${NC}"
    "$APTLY" snapshot diff "$snap1" "$snap2"
}

drop_snapshot() {
    snap_name="$1"
    if [ -z "$snap_name" ]; then
        echo -ne "Silinecek Snapshot Adı: "
        read -r snap_name
    fi

    echo -e "${YELLOW}--> Snapshot siliniyor: $snap_name...${NC}"
    "$APTLY" snapshot drop -force "$snap_name"
    echo -e "${GREEN}✓ Snapshot silindi: $snap_name${NC}"
}

case "$ACTION" in
    list)
        list_snapshots
        ;;
    create)
        create_snapshot "$2" "$3" "$4"
        ;;
    rollback)
        rollback_snapshot "$2" "$3" "$4"
        ;;
    diff)
        diff_snapshots "$2" "$3"
        ;;
    drop)
        drop_snapshot "$2"
        ;;
    menu|*)
        clear
        echo -e "${BLUE}================================================================${NC}"
        echo -e "${BOLD}       APT DEPO ANLIK GÖRÜNTÜ (SNAPSHOT) & ROLLBACK YÖNETİMİ     ${NC}"
        echo -e "${BLUE}================================================================${NC}"
        list_snapshots
        echo "----------------------------------------------------------------"
        echo -e "  ${GREEN}1)${NC} 📸 Yeni Snapshot Al (Create)"
        echo -e "  ${GREEN}2)${NC} ↺ Depoyu Snapshot'a Geri Yükle (Rollback)"
        echo -e "  ${GREEN}3)${NC} 🔍 İki Snapshot'ı Karşılaştır (Diff)"
        echo -e "  ${RED}4)${NC} 🗑️  Snapshot Sil (Drop)"
        echo -e "  ${YELLOW}0)${NC} ↩️  Geri Dön"
        echo "----------------------------------------------------------------"
        echo -ne "İşlem seçin [0-4]: "
        read -r smenu
        case "$smenu" in
            1) create_snapshot "" "" "" ;;
            2) rollback_snapshot "" "" "" ;;
            3) diff_snapshots "" "" ;;
            4) drop_snapshot "" ;;
            0|*) exit 0 ;;
        esac
        ;;
esac
