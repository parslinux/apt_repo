#!/usr/bin/env bash
set -e

# Eğer container içinde henüz yayınlanmış bir depo yoksa otomatik demo deposunu kur
if [ ! -d "/root/.aptly/public/dists" ]; then
    echo "[Docker Başlangıç] İlk açılış: Örnek depolar ve paketler otomatik hazırlanıyor..."
    /app/scripts/quick_demo.sh || true
    echo "[Docker Başlangıç] Hazır!"
fi

# Web ve APT sunucusunu başlat
exec python3 /app/web/server.py "${PORT:-8080}"
