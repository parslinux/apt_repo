#!/usr/bin/env python3
"""
Nginx / Caddy / Apache Erişim Loglarından İndirme Metriklerini Ayrıştırıcı
Bu betik, üretim sunucusu erişim loglarındaki .deb indirmelerini okuyarak
projenin '.metrics.json' dosyasını günceller.
"""

import sys
import os
import re
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "web"))

try:
    from server import MetricsTracker
except ImportError:
    print("[Hata] 'server.py' modülü yüklenemedi.", file=sys.stderr)
    sys.exit(1)

LOG_REGEX = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^\]]+)\]\s+"GET\s+(?P<path>[^\s\?]+)[^"]*"\s+(?P<status>\d{3})\s+(?P<bytes>\d+)\s+"[^"]*"\s+"(?P<ua>[^"]*)"'
)

def parse_log_file(log_path):
    p = Path(log_path)
    if not p.is_file():
        print(f"[Hata] Log dosyası bulunamadı: {log_path}", file=sys.stderr)
        return 0

    count = 0
    print(f"[*] '{log_path}' ayrıştırılıyor...")
    with open(p, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # .deb içeren başarılı indirmeleri ara
            if ".deb" in line and (" 200 " in line or " 206 " in line):
                m = LOG_REGEX.match(line)
                if m:
                    ip = m.group("ip")
                    req_path = m.group("path")
                    file_bytes = int(m.group("bytes"))
                    ua = m.group("ua")
                    
                    filename = os.path.basename(req_path)
                    if filename.endswith(".deb"):
                        MetricsTracker.record_download(filename, file_bytes, ip, ua)
                        count += 1
                else:
                    # Basit regex fallback
                    deb_match = re.search(r'GET\s+(/[^\s]+\.deb)', line)
                    if deb_match:
                        filename = os.path.basename(deb_match.group(1))
                        MetricsTracker.record_download(filename, 1024 * 100, "127.0.0.1", "Log Parser")
                        count += 1

    print(f"[✓] Toplam {count} adet .deb indirmesi metriklere işlendi.")
    return count

def main():
    if len(sys.argv) < 2:
        default_logs = [
            "/var/log/nginx/access.log",
            "/var/log/caddy/access.log",
            "/var/log/apache2/access.log"
        ]
        found = False
        for l in default_logs:
            if os.path.isfile(l):
                parse_log_file(l)
                found = True
                break
        if not found:
            print("Kullanım: ./scripts/parse_download_logs.py <access.log_yolu>")
            print("Örnek: ./scripts/parse_download_logs.py /var/log/nginx/access.log")
            sys.exit(0)
    else:
        parse_log_file(sys.argv[1])

if __name__ == "__main__":
    main()
