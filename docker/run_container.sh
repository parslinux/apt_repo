#!/usr/bin/env bash
set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="apt-repo-server"
CONTAINER_NAME="apt_repository_server"
PORT="${1:-8080}"

echo -e "${BLUE}=== Docker Container Başlatılıyor ===${NC}"

# Mevcut çalışan container varsa durdur ve temizle
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}--> Eski container durduruluyor ve kaldırılıyor...${NC}"
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# İmajı derle
echo -e "${CYAN}--> Docker imajı derleniyor ($IMAGE_NAME)...${NC}"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/docker/Dockerfile" "$ROOT_DIR"

# Container'ı başlat
echo -e "${CYAN}--> Container arka planda başlatılıyor (Port: $PORT)...${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "${PORT}:8080" \
    -v aptly_data:/root/.aptly \
    "$IMAGE_NAME"

echo -e "\n${GREEN}[BAŞARILI] Container çalışıyor!${NC}"
echo -e "Web Panel: ${CYAN}http://localhost:${PORT}/${NC}"
echo -e "Durdurmak için: ${YELLOW}./docker/stop_container.sh${NC}"
