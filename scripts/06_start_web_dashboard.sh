#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8080}"
SERVER_PY="$ROOT_DIR/web/server.py"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}          APT DEPOSU MODERN WEB DASHBOARD BAŞLATILIYOR          ${NC}"
echo -e "${BLUE}================================================================${NC}"

LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || echo "localhost")

echo -e "Port          : ${GREEN}$PORT${NC}"
echo -e "Web Panel URL : ${CYAN}http://localhost:${PORT}/${NC}"
echo -e "Ağ Üzerinden  : ${CYAN}http://${LOCAL_IP}:${PORT}/${NC}"
echo -e "APT Depo URL  : ${GREEN}http://${LOCAL_IP}:${PORT}/ (bookworm main)${NC}"
echo "----------------------------------------------------------------"
echo -e "${YELLOW}Tarayıcınızda açıp paketleri gezebilir, arayabilir ve komut kopyalayabilirsiniz.${NC}"
echo -e "${YELLOW}Durdurmak için [CTRL + C] tuşlarına basın.${NC}"
echo ""

python3 "$SERVER_PY" "$PORT"
