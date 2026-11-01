#!/usr/bin/env python3
"""
ParsLinux - Otomatik Debian Changelog Üretici (Debian Policy Uyumlu)
Paket adı, sürüm, dağıtım ve değişiklik maddelerini alarak standart
'debian/changelog' biçiminde çıktı üretir veya doğrudan dosyaya kaydeder.
Git commit geçmişinden otomatik madde üretme desteği içerir.
"""

import sys
import os
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def format_rfc2822_date(dt=None):
    """Debian changelog için RFC 2822 uyumlu tarih üretir."""
    if dt is None:
        dt = datetime.now().astimezone()
    return dt.strftime("%a, %d %b %Y %H:%M:%S %z")

def get_git_commits(limit=5):
    """Son git commit mesajlarını madde listesi olarak döner."""
    try:
        res = subprocess.run(
            ["git", "-C", str(ROOT_DIR), "log", f"-n{limit}", "--oneline", "--no-merges"],
            capture_output=True, text=True, timeout=5
        )
        lines = res.stdout.strip().splitlines()
        changes = []
        for line in lines:
            parts = line.split(" ", 1)
            msg = parts[1] if len(parts) > 1 else parts[0]
            changes.append(msg)
        return changes
    except Exception:
        return []

def build_changelog_entry(pkg_name, version, distribution="bookworm", urgency="medium",
                          changes=None, maintainer_name="ParsLinux Geliştirici Ekibi",
                          maintainer_email="repo@parslinux.org", dt=None):
    """Standart Debian changelog bloğu oluşturur."""
    if not changes:
        changes = ["Genel kararlılık iyileştirmeleri ve paket sürüm güncellemesi."]

    date_str = format_rfc2822_date(dt)

    lines = [
        f"{pkg_name} ({version}) {distribution}; urgency={urgency}",
        ""
    ]

    for ch in changes:
        # Madde başına 2 boşluk ve yıldız
        clean_ch = ch.strip().lstrip("*-• ").strip()
        if clean_ch:
            lines.append(f"  * {clean_ch}")

    lines.append("")
    lines.append(f" -- {maintainer_name} <{maintainer_email}>  {date_str}")
    lines.append("")

    return "\n".join(lines)

def interactive_mode():
    print("=" * 60)
    print("  Debian (debian/changelog) Otomatik Üretici")
    print("=" * 60)

    pkg_name = input("Paket Adı [Örn: pars-setup]: ").strip()
    if not pkg_name:
        pkg_name = "pars-setup"

    version = input("Yeni Sürüm [Örn: 1.0.1]: ").strip()
    if not version:
        version = "1.0.1"

    dist = input("Hedef Dağıtım [Varsayılan: bookworm]: ").strip()
    if not dist:
        dist = "bookworm"

    urgency = input("Aciliyet Seviyesi [low/medium/high, Varsayılan: medium]: ").strip()
    if not urgency:
        urgency = "medium"

    m_name = input("Geliştirici/Sorumlu Adı [Varsayılan: ParsLinux Ekibi]: ").strip()
    if not m_name:
        m_name = "ParsLinux Geliştirici Ekibi"

    m_email = input("E-Posta [Varsayılan: repo@parslinux.org]: ").strip()
    if not m_email:
        m_email = "repo@parslinux.org"

    use_git = input("Değişiklik maddeleri son Git commit'lerinden otomatik çekilsin mi? (E/H) [E]: ").strip().lower()
    changes = []
    if use_git in ("", "e", "evet", "y", "yes"):
        changes = get_git_commits(limit=5)
        if changes:
            print(f"\n[+] Git geçmişinden {len(changes)} madde alındı:")
            for c in changes:
                print(f"    - {c}")
        else:
            print("[-] Git geçmişi bulunamadı. Lütfen manuel girin.")

    if not changes:
        print("\nDeğişiklik maddelerini girin (Bitirmek için boş satır bırakıp Enter'a basın):")
        while True:
            line = input("  * ").strip()
            if not line:
                break
            changes.append(line)

    if not changes:
        changes = ["Sürüm güncellemesi ve hata düzeltmeleri."]

    entry = build_changelog_entry(
        pkg_name=pkg_name,
        version=version,
        distribution=dist,
        urgency=urgency,
        changes=changes,
        maintainer_name=m_name,
        maintainer_email=m_email
    )

    print("\n" + "=" * 60)
    print("Üretilen debian/changelog İçeriği:")
    print("=" * 60)
    print(entry)

    save = input("Bir dosyaya kaydetmek ister misiniz? (Örn: ./debian/changelog veya Enter ile geç): ").strip()
    if save:
        out_p = Path(save)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        # Eğer dosya varsa başa ekle (prepend)
        if out_p.is_file():
            existing = out_p.read_text(encoding="utf-8")
            out_p.write_text(entry + "\n" + existing, encoding="utf-8")
            print(f"[BAŞARILI] Yeni sürüm bloğu mevcut dosyanın başına eklendi: {out_p}")
        else:
            out_p.write_text(entry, encoding="utf-8")
            print(f"[BAŞARILI] Dosya kaydedildi: {out_p}")

def main():
    parser = argparse.ArgumentParser(description="Otomatik Debian Changelog Üretici")
    parser.add_argument("package", nargs="?", help="Paket adı (örn: pars-creator)")
    parser.add_argument("version", nargs="?", help="Paket sürümü (örn: 1.0.1)")
    parser.add_argument("--dist", default="bookworm", help="Hedef dağıtım (varsayılan: bookworm)")
    parser.add_argument("--urgency", default="medium", help="Aciliyet seviyesi (varsayılan: medium)")
    parser.add_argument("--maintainer", default="ParsLinux Geliştirici Ekibi", help="Bakımcı adı")
    parser.add_argument("--email", default="repo@parslinux.org", help="Bakımcı e-postası")
    parser.add_argument("--git", action="store_true", help="Son git commit'lerini madde olarak kullan")
    parser.add_argument("-m", "--message", action="append", help="Değişiklik maddesi (birden fazla eklenebilir)")
    parser.add_argument("-o", "--output", help="Çıktının yazılacağı dosya yolu (örn: debian/changelog)")

    args = parser.parse_args()

    if not args.package or not args.version:
        interactive_mode()
        return

    changes = []
    if args.git:
        changes.extend(get_git_commits(limit=5))
    if args.message:
        changes.extend(args.message)

    entry = build_changelog_entry(
        pkg_name=args.package,
        version=args.version,
        distribution=args.dist,
        urgency=args.urgency,
        changes=changes,
        maintainer_name=args.maintainer,
        maintainer_email=args.email
    )

    if args.output:
        out_p = Path(args.output)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        if out_p.is_file():
            existing = out_p.read_text(encoding="utf-8")
            out_p.write_text(entry + "\n" + existing, encoding="utf-8")
        else:
            out_p.write_text(entry, encoding="utf-8")
        print(f"[BAŞARILI] Changelog yazıldı: {out_p}")
    else:
        print(entry)

if __name__ == "__main__":
    main()
