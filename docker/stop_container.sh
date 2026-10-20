#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTAINER_NAME="apt_repository_server"

echo -e "${BLUE}=== Docker Container Durduruluyor ===${NC}"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    echo -e "${GREEN}[BAŞARILI] $CONTAINER_NAME durduruldu ve kaldırıldı.${NC}"
else
    echo -e "${YELLOW}[BİLGİ] Çalışan $CONTAINER_NAME bulunamadı.${NC}"
fi
