#!/usr/bin/env bash
# ==============================================================================
# notify_webhook.sh
#
# Discord, Telegram ve Slack webhook bildirim gönderici.
# Depoya yeni bir .deb paketi yüklendiğinde veya yayın güncellendiğinde
# yapılandırılmış kanallara zengin bildirim gönderir.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.webhook.env"
USER_CONFIG="$HOME/.aptly/webhook.env"

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Yapılandırmayı yükle
if [ -f "$USER_CONFIG" ]; then
    # shellcheck source=/dev/null
    source "$USER_CONFIG"
elif [ -f "$CONFIG_FILE" ]; then
    # shellcheck source=/dev/null
    source "$CONFIG_FILE"
fi

PKG_NAME="${1}"
PKG_VERSION="${2}"
PKG_ARCH="${3:-amd64}"
REPO_NAME="${4:-main}"
PKG_DESC="${5:-Pars Linux APT Deposuna yeni paket eklendi.}"

# Test Modu
if [ "$1" == "--test" ]; then
    PKG_NAME="test-paket"
    PKG_VERSION="1.0.0"
    PKG_ARCH="amd64"
    REPO_NAME="parslinux-depo"
    PKG_DESC="Bu bir test bildirimidir. Webhook entegrasyonu başarıyla çalışıyor! 🚀"
    echo -e "${BLUE}=== Webhook Test Modu ===${NC}"
fi

# Yardım
if [ -z "$PKG_NAME" ] || [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo "Kullanım: $0 <PAKET_ADI> <SURUM> [MIMARI] [REPO_ADI] [ACIKLAMA]"
    echo "Test için: $0 --test"
    echo ""
    echo "Ortam Değişkenleri (.webhook.env):"
    echo "  DISCORD_WEBHOOK_URL  - Discord webhook bağlantısı"
    echo "  TELEGRAM_BOT_TOKEN   - Telegram Bot API jetonu"
    echo "  TELEGRAM_CHAT_ID     - Telegram grup/kanal ID"
    echo "  SLACK_WEBHOOK_URL    - Slack gelen webhook URL'si"
    exit 0
fi

DATE_NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DATE_HUMAN="$(date +"%d.%m.%Y %H:%M:%S")"
STATUS_SENT=0

# 1. DISCORD BİLDİRİMİ
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    echo -e "${BLUE}[Discord]${NC} Bildirim gönderiliyor..."
    DISCORD_PAYLOAD=$(cat <<EOF
{
  "username": "Pars Linux APT Bot",
  "avatar_url": "https://raw.githubusercontent.com/parslinux/apt_repo/main/web/brand_icon.png",
  "embeds": [
    {
      "title": "📦 Yeni Paket Yayınlandı: ${PKG_NAME}",
      "description": "${PKG_DESC}",
      "color": 3066993,
      "fields": [
        { "name": "🏷️ Sürüm", "value": "\`${PKG_VERSION}\`", "inline": true },
        { "name": "💻 Mimari", "value": "\`${PKG_ARCH}\`", "inline": true },
        { "name": "📁 Depo", "value": "\`${REPO_NAME}\`", "inline": true },
        { "name": "🕒 Tarih", "value": "${DATE_HUMAN}", "inline": false }
      ],
      "footer": {
        "text": "Pars Linux APT Repository Service"
      },
      "timestamp": "${DATE_NOW}"
    }
  ]
}
EOF
)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$DISCORD_PAYLOAD" "$DISCORD_WEBHOOK_URL" || true)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo -e "${GREEN}✓ Discord bildirimi iletildi.${NC}"
        STATUS_SENT=1
    else
        echo -e "${RED}✗ Discord bildirimi başarısız (HTTP $HTTP_CODE)${NC}"
    fi
fi

# 2. TELEGRAM BİLDİRİMİ
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo -e "${BLUE}[Telegram]${NC} Bildirim gönderiliyor..."
    TELEGRAM_TEXT="🚀 *Yeni Paket Yayınlandı!*
    
📦 *Paket:* \`${PKG_NAME}\`
🏷️ *Sürüm:* \`${PKG_VERSION}\`
💻 *Mimari:* \`${PKG_ARCH}\`
📁 *Depo:* \`${REPO_NAME}\`
🕒 *Zaman:* ${DATE_HUMAN}

📝 *Açıklama:*
_${PKG_DESC}_

🐧 *Pars Linux APT Deposu*"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${TELEGRAM_TEXT}" \
        -d "parse_mode=Markdown" || true)
        
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo -e "${GREEN}✓ Telegram bildirimi iletildi.${NC}"
        STATUS_SENT=1
    else
        echo -e "${RED}✗ Telegram bildirimi başarısız (HTTP $HTTP_CODE)${NC}"
    fi
fi

# 3. SLACK BİLDİRİMİ
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    echo -e "${BLUE}[Slack]${NC} Bildirim gönderiliyor..."
    SLACK_PAYLOAD=$(cat <<EOF
{
  "text": "📦 *Yeni Paket Yayınlandı:* \`${PKG_NAME}\` (v${PKG_VERSION})",
  "attachments": [
    {
      "color": "#36a64f",
      "fields": [
        { "title": "Paket", "value": "${PKG_NAME}", "short": true },
        { "title": "Sürüm", "value": "${PKG_VERSION}", "short": true },
        { "title": "Mimari", "value": "${PKG_ARCH}", "short": true },
        { "title": "Depo", "value": "${REPO_NAME}", "short": true },
        { "title": "Açıklama", "value": "${PKG_DESC}", "short": false }
      ],
      "footer": "Pars Linux APT Repository",
      "ts": $(date +%s)
    }
  ]
}
EOF
)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$SLACK_PAYLOAD" "$SLACK_WEBHOOK_URL" || true)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo -e "${GREEN}✓ Slack bildirimi iletildi.${NC}"
        STATUS_SENT=1
    else
        echo -e "${RED}✗ Slack bildirimi başarısız (HTTP $HTTP_CODE)${NC}"
    fi
fi

if [ "$STATUS_SENT" -eq 0 ]; then
    if [ -z "$DISCORD_WEBHOOK_URL" ] && [ -z "$TELEGRAM_BOT_TOKEN" ] && [ -z "$SLACK_WEBHOOK_URL" ]; then
        echo -e "${YELLOW}[BİLGİ] Hiçbir webhook tanımlı değil (.webhook.env dosyasını doldurabilirsiniz).${NC}"
    fi
fi
