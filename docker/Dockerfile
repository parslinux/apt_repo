# ==============================================================================
# Dockerfile - APT Depo ve Web Dashboard Konteyneri
# ==============================================================================
FROM python:3.12-slim

# Temel araçları kur
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    bzip2 \
    xz-utils \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Proje dizinlerini kopyala
COPY bin/ /app/bin/
COPY scripts/ /app/scripts/
COPY web/ /app/web/
COPY custom_packages/ /app/custom_packages/
COPY sample_packages/ /app/sample_packages/
COPY docker/ /app/docker/

# Çalıştırma izinlerini ver
RUN chmod +x /app/bin/* /app/scripts/*.sh /app/web/server.py /app/docker/entrypoint.sh

# Verilerin kalıcı olması için .aptly birimini tanımla
VOLUME ["/root/.aptly"]

# Web Dashboard & APT Depo Portu
EXPOSE 8080

# Otomatik başlangıç betiğini çalıştır
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["8080"]
