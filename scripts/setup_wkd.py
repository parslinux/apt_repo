#!/usr/bin/env python3
"""
ParsLinux - GPG Web Anahtar Sunucusu (WKD - Web Key Directory) Otomasyonu
Bu betik, RFC 9580 ve GnuPG WKD standartlarına uygun olarak .well-known/openpgpkey/
dizin yapısını ve zbase32 hash dosyalarını otomatik oluşturur.
"""

import sys
import os
import hashlib
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
KEYS_DIR = ROOT_DIR / "keys"
PUBLIC_DIR = Path.home() / ".aptly" / "public"
WKD_LOCAL = ROOT_DIR / ".well-known" / "openpgpkey"
WKD_PUBLIC = PUBLIC_DIR / ".well-known" / "openpgpkey"

ZBASE32_ALPHABET = "ybndrfg8ejkmcpqxot1uwisza345h769"

def zbase32_encode(data: bytes) -> str:
    bits = "".join(f"{b:08b}" for b in data)
    return "".join(ZBASE32_ALPHABET[int(bits[i:i+5], 2)] for i in range(0, len(bits), 5))

def get_wkd_hash(localpart: str) -> str:
    digest = hashlib.sha1(localpart.lower().encode("utf-8")).digest()
    return zbase32_encode(digest)

def export_gpg_keys(key_id):
    """Hem ASCII (.asc/.key) hem de ikili (.gpg) anahtarları dışa aktarır."""
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. ASCII Armored Key
    armored = subprocess.run(["gpg", "--armor", "--export", key_id], capture_output=True, check=True).stdout
    (KEYS_DIR / "repo_public.key").write_bytes(armored)
    (ROOT_DIR / "public.key").write_bytes(armored)
    if PUBLIC_DIR.is_dir():
        (PUBLIC_DIR / "public.key").write_bytes(armored)
    
    # 2. Binary Keyring (.gpg)
    binary = subprocess.run(["gpg", "--no-armor", "--export", key_id], capture_output=True, check=True).stdout
    (KEYS_DIR / "parslinux-archive-keyring.gpg").write_bytes(binary)
    (ROOT_DIR / "parslinux-archive-keyring.gpg").write_bytes(binary)
    if PUBLIC_DIR.is_dir():
        (PUBLIC_DIR / "parslinux-archive-keyring.gpg").write_bytes(binary)
        
    return binary

def build_wkd_structure(binary_key_data, domain="parslinux.org", localparts=None):
    if localparts is None:
        localparts = ["repo", "dev", "support", "contact"]

    targets = [WKD_LOCAL]
    if PUBLIC_DIR.is_dir():
        targets.append(WKD_PUBLIC)

    generated_hashes = {}

    for base in targets:
        # Doğrudan metod: /.well-known/openpgpkey/hu/<hash>
        hu_direct = base / "hu"
        hu_direct.mkdir(parents=True, exist_ok=True)
        (base / "policy").touch(exist_ok=True)

        # Gelişmiş metod: /.well-known/openpgpkey/<domain>/hu/<hash>
        hu_domain = base / domain / "hu"
        hu_domain.mkdir(parents=True, exist_ok=True)
        (base / domain / "policy").touch(exist_ok=True)

        for lp in localparts:
            h = get_wkd_hash(lp)
            generated_hashes[f"{lp}@{domain}"] = h
            (hu_direct / h).write_bytes(binary_key_data)
            (hu_domain / h).write_bytes(binary_key_data)

    return generated_hashes

def main():
    print("=" * 64)
    print(" 🔑 ParsLinux GPG Web Anahtar Sunucusu (WKD) Otomasyonu")
    print("=" * 64)

    # 1. Mevcut repo anahtarını bul
    res = subprocess.run(["gpg", "--list-keys", "--with-colons"], capture_output=True, text=True)
    key_id = None
    for line in res.stdout.splitlines():
        if line.startswith("pub:"):
            parts = line.split(":")
            if len(parts) > 4:
                key_id = parts[4]
                break

    if not key_id:
        print("[!] Sistemde kayıtlı GPG anahtarı bulunamadı.")
        print("[*] Yeni anahtar üretiliyor: repo@parslinux.org...")
        sh_gen = ROOT_DIR / "scripts" / "setup_gpg_keys.sh"
        subprocess.run(["bash", str(sh_gen), "ParsLinux Paket Deposu", "repo@parslinux.org"], check=True)
        res = subprocess.run(["gpg", "--list-keys", "--with-colons"], capture_output=True, text=True)
        for line in res.stdout.splitlines():
            if line.startswith("pub:"):
                key_id = line.split(":")[4]
                break

    print(f"[+] Kullanılan Anahtar ID : {key_id}")
    
    # 2. Anahtarları dışa aktar
    binary_data = export_gpg_keys(key_id)
    print(f"[+] Anahtarlar dışa aktarıldı (ASCII & Binary): {len(binary_data)} bayt")

    # 3. WKD dizin yapısını üret
    hashes = build_wkd_structure(binary_data, domain="parslinux.org", localparts=["repo", "dev", "support", "contact"])

    print("\n[✓] WKD Dizin Yapısı Başarıyla Oluşturuldu:")
    for email, h in hashes.items():
        print(f"  • {email:22} -> hu/{h}")

    print("\n[✓] Doğrulama Dosyaları:")
    print(f"  • Yerel Dizin : {WKD_LOCAL}")
    if PUBLIC_DIR.is_dir():
        print(f"  • Web Dizini  : {WKD_PUBLIC}")
    print(f"  • Policy      : {WKD_LOCAL / 'policy'}")
    print("=" * 64)
    print("İstemciler için test komutları:")
    print("  gpg --locate-keys repo@parslinux.org")
    print("  curl -IL https://<domain>/.well-known/openpgpkey/policy")
    print("=" * 64)

if __name__ == "__main__":
    main()
