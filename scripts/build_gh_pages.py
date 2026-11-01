#!/usr/bin/env python3
"""
GitHub Pages Portalı Oluşturucu ve Senkronizasyon Betiği
~/.aptly/public altındaki en güncel paket indekslerini okur ve
https://parslinux.github.io/apt_repo için statik landing sayfasını üretir.
"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = Path.home() / ".aptly" / "public"
PACKAGES_FILE = PUBLIC_DIR / "dists" / "0.1" / "main" / "binary-all" / "Packages"

def parse_packages():
    if not PACKAGES_FILE.is_file():
        print(f"HATA: {PACKAGES_FILE} bulunamadı!", file=sys.stderr)
        sys.exit(1)

    content = PACKAGES_FILE.read_text(encoding="utf-8", errors="ignore")
    blocks = content.strip().split("\n\n")
    packages = []

    for block in blocks:
        pkg = {}
        lines = block.splitlines()
        desc_lines = []
        in_desc = False
        for line in lines:
            if line.startswith(" ") and in_desc:
                desc_lines.append(line.strip())
                continue
            in_desc = False
            if ":" in line:
                k, v = line.split(":", 1)
                k = k.strip().lower()
                v = v.strip()
                if k == "description":
                    in_desc = True
                    desc_lines.append(v)
                else:
                    pkg[k] = v
        if desc_lines:
            pkg["description"] = " ".join(desc_lines)
        if "package" in pkg:
            packages.append({
                "name": pkg.get("package", ""),
                "version": pkg.get("version", ""),
                "arch": pkg.get("architecture", "all"),
                "size": int(pkg.get("size", 0)),
                "desc": pkg.get("description", ""),
                "filename": pkg.get("filename", "")
            })

    packages.sort(key=lambda x: x["name"])
    return packages

def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"

def generate_html(packages, total_count=31):
    cards_html = []
    for p in packages:
        name = p["name"]
        version = p["version"]
        arch = p["arch"]
        size_str = format_size(p["size"])
        desc = p["desc"] or "ParsLinux resmi sistem ve masaüstü paketi."
        dl_link = p["filename"] or f"pool/main/p/{name}/{name}_{version}_{arch}.deb"

        clean_desc_data = desc.lower().replace('"', '&quot;')
        clean_desc_display = desc.replace("<", "&lt;").replace(">", "&gt;")

        card = f"""            <div class="pkg-card" data-name="{name}" data-version="{version}" data-arch="{arch}" data-size="{p['size']}" data-sizestr="{size_str}" data-dllink="{dl_link}" data-desc="{clean_desc_data}" data-rawdesc="{clean_desc_display}">
                <div>
                    <div class="pkg-header">
                        <div class="pkg-name">{name}</div>
                        <div class="pkg-version">{version}</div>
                    </div>
                    <div class="pkg-desc">{clean_desc_display}</div>
                </div>
                <div class="pkg-meta">
                    <span>Mimari: {arch} • {size_str}</span>
                    <div class="pkg-actions-btns">
                        <button class="details-btn" onclick="openPkgModal(this.closest('.pkg-card'))" title="Paket Detayları">
                            <span>ℹ️</span> Detaylar
                        </button>
                        <a href="{dl_link}" class="dl-btn" download title=".deb Paketini İndir">
                            <span>⬇</span> .deb İndir
                        </a>
                    </div>
                </div>
            </div>"""
        cards_html.append(card)

    cards_joined = "\n".join(cards_html)

    html_content = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ParsLinux 0.1 & Bookworm - Resmi APT Deposu</title>
    <meta name="description" content="ParsLinux resmi APT paket deposu. Debian 12 Bookworm tabanlı sistemler için çekirdek paketler, temalar ve araçlar.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #0b0f19;
            --surface: #121826;
            --surface-hover: #1a2235;
            --surface-border: #1f293d;
            --primary: #6366f1;
            --primary-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
            --accent: #38bdf8;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
            --card-glow: rgba(99, 102, 241, 0.12);
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            line-height: 1.6;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(168, 85, 247, 0.12) 0%, transparent 45%);
            background-attachment: fixed;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 1.5rem 4rem 1.5rem;
        }}

        /* Üst Gezinti */
        .top-nav {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0 2rem 0;
            border-bottom: 1px solid var(--surface-border);
            margin-bottom: 2.5rem;
            flex-wrap: wrap;
            gap: 1rem;
        }}

        .nav-brand {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            text-decoration: none;
        }}

        .nav-logo {{
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: var(--primary-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }}

        .nav-title {{
            font-weight: 800;
            color: #fff;
            font-size: 1.15rem;
            letter-spacing: -0.01em;
        }}

        .nav-sub {{
            color: var(--text-muted);
            font-size: 0.8rem;
            margin-left: 0.4rem;
        }}

        .nav-actions {{
            display: flex;
            gap: 0.6rem;
            align-items: center;
            flex-wrap: wrap;
        }}

        .nav-btn {{
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.45rem 0.95rem;
            border-radius: 0.5rem;
            font-size: 0.82rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
        }}

        .nav-btn-primary {{
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.4);
            color: #a5b4fc;
        }}

        .nav-btn-primary:hover {{
            background: var(--primary);
            color: #fff;
        }}

        .nav-btn-secondary {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--surface-border);
            color: var(--text-muted);
        }}

        .nav-btn-secondary:hover {{
            background: var(--surface-hover);
            color: #fff;
        }}

        header {{
            text-align: center;
            margin-bottom: 2.5rem;
            position: relative;
        }}

        .badge {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(99, 102, 241, 0.12);
            border: 1px solid rgba(99, 102, 241, 0.35);
            color: #818cf8;
            padding: 0.35rem 1rem;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 1.25rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }}

        h1 {{
            font-size: clamp(2rem, 5vw, 3.25rem);
            font-weight: 800;
            letter-spacing: -0.03em;
            background: var(--primary-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1rem;
        }}

        .subtitle {{
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 680px;
            margin: 0 auto;
        }}

        /* Kurulum Bölümü & Sekmeler */
        .setup-section {{
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 1.25rem;
            padding: 2rem;
            margin-bottom: 2.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            position: relative;
        }}

        .setup-title {{
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.4rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #fff;
        }}

        .setup-tabs {{
            display: flex;
            gap: 0.5rem;
            margin: 1.25rem 0 1rem 0;
            flex-wrap: wrap;
        }}

        .setup-tab-btn {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--surface-border);
            color: var(--text-muted);
            padding: 0.45rem 1rem;
            border-radius: 0.5rem;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .setup-tab-btn.active {{
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }}

        .code-block {{
            background: #060911;
            border: 1px solid #1e293b;
            border-radius: 0.75rem;
            padding: 1.25rem;
            position: relative;
            margin-top: 0.75rem;
        }}

        .code-block code {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #38bdf8;
            display: block;
            line-height: 1.7;
            overflow-x: auto;
            word-break: break-word;
            white-space: pre-wrap;
        }}

        .copy-btn {{
            position: absolute;
            top: 0.85rem;
            right: 0.85rem;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--text-main);
            padding: 0.35rem 0.75rem;
            border-radius: 0.4rem;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .copy-btn:hover {{
            background: rgba(255, 255, 255, 0.18);
        }}

        /* KPI Kartları */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1rem;
            margin-bottom: 2.5rem;
        }}

        .kpi-card {{
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 1rem;
            padding: 1.25rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            transition: all 0.25s ease;
        }}

        .kpi-card:hover {{
            border-color: rgba(99, 102, 241, 0.4);
            transform: translateY(-2px);
        }}

        .kpi-label {{
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.35rem;
        }}

        .kpi-val {{
            font-size: 1.25rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: 0.2rem;
        }}

        .kpi-sub {{
            font-size: 0.78rem;
            color: var(--accent);
        }}

        /* Araç Çubuğu (Toolbar) */
        .toolbar {{
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 1rem;
            padding: 1rem 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }}

        .search-box {{
            position: relative;
            flex: 1;
            min-width: 260px;
        }}

        .search-icon {{
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 0.9rem;
        }}

        .search-input {{
            width: 100%;
            background: #060911;
            border: 1px solid var(--surface-border);
            border-radius: 0.6rem;
            padding: 0.65rem 1rem 0.65rem 2.5rem;
            color: #fff;
            font-size: 0.88rem;
            outline: none;
            transition: all 0.2s ease;
        }}

        .search-input:focus {{
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }}

        .filters-group {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }}

        .arch-pills {{
            display: flex;
            gap: 0.35rem;
            align-items: center;
        }}

        .arch-label {{
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-right: 0.25rem;
        }}

        .arch-pill {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--surface-border);
            color: var(--text-muted);
            padding: 0.3rem 0.65rem;
            border-radius: 0.4rem;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .arch-pill.active {{
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
        }}

        .sort-select {{
            background: #060911;
            border: 1px solid var(--surface-border);
            border-radius: 0.5rem;
            padding: 0.45rem 0.8rem;
            color: #fff;
            font-size: 0.8rem;
            outline: none;
        }}

        .stats-badge {{
            font-size: 0.82rem;
            color: var(--text-muted);
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--surface-border);
            padding: 0.4rem 0.85rem;
            border-radius: 0.5rem;
            white-space: nowrap;
        }}

        .stats-badge b {{
            color: var(--accent);
        }}

        /* Paket Kartları */
        .pkg-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.25rem;
        }}

        .pkg-card {{
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 1rem;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }}

        .pkg-card:hover {{
            border-color: rgba(99, 102, 241, 0.45);
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(99, 102, 241, 0.1);
        }}

        .pkg-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.75rem;
            gap: 0.5rem;
        }}

        .pkg-name {{
            font-size: 1.1rem;
            font-weight: 700;
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            word-break: break-word;
        }}

        .pkg-version {{
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            font-size: 0.72rem;
            padding: 0.2rem 0.5rem;
            border-radius: 0.35rem;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            white-space: nowrap;
        }}

        .pkg-desc {{
            color: var(--text-muted);
            font-size: 0.88rem;
            line-height: 1.55;
            margin-bottom: 1.25rem;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }}

        .pkg-meta {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid var(--surface-border);
            padding-top: 1rem;
            font-size: 0.8rem;
            color: #64748b;
        }}

        .pkg-actions-btns {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}

        .details-btn {{
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #cbd5e1;
            padding: 0.4rem 0.8rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.82rem;
            transition: all 0.2s ease;
            font-family: inherit;
        }}

        .details-btn:hover {{
            background: rgba(255, 255, 255, 0.16);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }}

        .dl-btn {{
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.4);
            color: #a5b4fc;
            padding: 0.4rem 0.85rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.82rem;
            transition: all 0.2s ease;
        }}

        .dl-btn:hover {{
            background: var(--primary);
            color: #ffffff;
            transform: translateY(-1px);
        }}

        /* Modal Stilleri */
        .modal-backdrop {{
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(3, 7, 18, 0.82);
            backdrop-filter: blur(8px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1.5rem;
        }}

        .modal-backdrop.active {{
            display: flex;
        }}

        .modal-content {{
            background: #121826;
            border: 1px solid #1f293d;
            border-radius: 1.25rem;
            max-width: 620px;
            width: 100%;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15);
            overflow: hidden;
            animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }}

        @keyframes modalFadeIn {{
            from {{ opacity: 0; transform: scale(0.95) translateY(10px); }}
            to {{ opacity: 1; transform: scale(1) translateY(0); }}
        }}

        .modal-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--surface-border);
            gap: 1rem;
        }}

        .modal-header h3 {{
            font-size: 1.3rem;
            font-weight: 700;
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
        }}

        .modal-badge-ver {{
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.35);
            color: #38bdf8;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.15rem 0.5rem;
            border-radius: 0.35rem;
            font-family: 'JetBrains Mono', monospace;
        }}

        .modal-badge-arch {{
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.35);
            color: #10b981;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.15rem 0.5rem;
            border-radius: 0.35rem;
            font-family: 'JetBrains Mono', monospace;
        }}

        .modal-close {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            font-size: 1.35rem;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }}

        .modal-close:hover {{
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.4);
        }}

        .modal-body {{
            padding: 1.5rem;
        }}

        .modal-desc {{
            color: var(--text-muted);
            font-size: 0.92rem;
            line-height: 1.6;
            margin-bottom: 1.25rem;
            max-height: 180px;
            overflow-y: auto;
        }}

        .modal-cmd-box {{
            background: #060911;
            border: 1px solid var(--surface-border);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            margin-bottom: 1.25rem;
        }}

        .modal-cmd-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.8rem;
            color: #94a3b8;
            font-weight: 600;
        }}

        .modal-copy-btn {{
            background: var(--primary);
            border: none;
            color: #ffffff;
            padding: 0.25rem 0.65rem;
            border-radius: 0.4rem;
            font-size: 0.75rem;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }}

        .modal-copy-btn:hover {{
            opacity: 0.9;
        }}

        .modal-cmd-code {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.88rem;
            color: #38bdf8;
            display: block;
            word-break: break-all;
        }}

        .modal-footer {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.75rem;
            padding-top: 0.75rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }}

        .modal-meta {{
            font-size: 0.82rem;
            color: #64748b;
        }}

        footer {{
            text-align: center;
            margin-top: 5rem;
            padding-top: 2rem;
            border-top: 1px solid var(--surface-border);
            color: var(--text-muted);
            font-size: 0.9rem;
        }}

        footer a {{
            color: var(--primary);
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Üst Gezinti -->
        <nav class="top-nav">
            <a href="#" class="nav-brand">
                <div class="nav-logo">🐆</div>
                <div>
                    <span class="nav-title">ParsLinux</span>
                    <span class="nav-sub">Resmi APT Deposu</span>
                </div>
            </a>
            <div class="nav-actions">
                <a href="parslinux-archive-keyring.gpg" download class="nav-btn nav-btn-primary">
                    🔑 GPG Keyring İndir
                </a>
                <a href=".well-known/openpgpkey/hu/gkux3qirko9oqgy8uy54k78iopxuno96" target="_blank" class="nav-btn nav-btn-secondary" title="RFC 9580 Web Key Directory">
                    🌐 WKD Anahtarı
                </a>
                <a href="https://github.com/parslinux/apt_repo" target="_blank" class="nav-btn nav-btn-secondary">
                    GitHub
                </a>
            </div>
        </nav>

        <header>
            <div class="badge">🐆 ParsLinux 0.1 & Bookworm</div>
            <h1>Resmi APT Paket Deposu</h1>
            <p class="subtitle">ParsLinux ekosistemine ait tüm çekirdek masaüstü, kurulum aracı, temalar ve sistem uygulamalarının resmi dağıtım merkezi.</p>
        </header>

        <!-- Kurulum Rehberi -->
        <section class="setup-section">
            <div class="setup-title">
                <span>⚡</span> Depoyu Sisteminize Ekleyin
            </div>
            <p style="color: var(--text-muted); font-size: 0.95rem;">ParsLinux veya Debian Bookworm sisteminizde depoyu güvenle kurmak için tercih ettiğiniz yöntemi seçin:</p>

            <div class="setup-tabs">
                <button class="setup-tab-btn active" onclick="switchSetupTab('gpg')">🔑 GPG Doğrulamalı (Önerilen)</button>
                <button class="setup-tab-btn" onclick="switchSetupTab('wkd')">🌐 Web Key Directory (WKD)</button>
                <button class="setup-tab-btn" onclick="switchSetupTab('trusted')">⚡ Hızlı Test (Trusted)</button>
            </div>

            <div class="code-block">
                <button class="copy-btn" onclick="copyCommand()">Kopyala</button>
                <code id="setup-cmd"># 1. GPG Anahtarını indirin ve keyring dizinine ekleyin:
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://parslinux.github.io/apt_repo/parslinux-archive-keyring.gpg | sudo tee /etc/apt/keyrings/parslinux-archive-keyring.gpg > /dev/null

# 2. ParsLinux deposunu ekleyin ve güncelleyin:
echo "deb [signed-by=/etc/apt/keyrings/parslinux-archive-keyring.gpg] https://parslinux.github.io/apt_repo 0.1 main" | sudo tee /etc/apt/sources.list.d/parslinux.list
sudo apt update</code>
            </div>
        </section>

        <!-- KPI Kartları -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Dağıtım Tabanı</div>
                <div class="kpi-val">Debian 12 Bookworm</div>
                <div class="kpi-sub">0.1 & bookworm sürümleri</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Mevcut Paketler</div>
                <div class="kpi-val">{total_count} Resmi Paket</div>
                <div class="kpi-sub" style="color: #10b981;">Çekirdek + Masaüstü + Araçlar</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">GPG Doğrulama (WKD)</div>
                <div class="kpi-val" style="color: #10b981;">RFC 9580 Aktif</div>
                <div class="kpi-sub">repo@parslinux.org</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Desteklenen Mimariler</div>
                <div class="kpi-val">all • amd64</div>
                <div class="kpi-sub" style="color: #a855f7;">64-bit ve Mimari Bağımsız</div>
            </div>
        </div>

        <!-- Araç Çubuğu -->
        <div class="toolbar">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input type="text" class="search-input" id="search" placeholder="Paket ara (örn: pars-setup, mycomputer)..." onkeyup="filterPackages()">
            </div>
            <div class="filters-group">
                <div class="arch-pills">
                    <span class="arch-label">Mimari:</span>
                    <button class="arch-pill active" onclick="setArchFilter('all')">Tümü</button>
                    <button class="arch-pill" onclick="setArchFilter('arch_all')">all</button>
                    <button class="arch-pill" onclick="setArchFilter('amd64')">amd64</button>
                </div>
                <select class="sort-select" id="sortSelect" onchange="sortPackages()">
                    <option value="name-asc">Sırala: İsim (A-Z)</option>
                    <option value="name-desc">Sırala: İsim (Z-A)</option>
                    <option value="size-desc">Sırala: Boyut (Büyükten Küçüğe)</option>
                    <option value="size-asc">Sırala: Boyut (Küçükten Büyüğe)</option>
                </select>
                <div class="stats-badge">
                    Toplam <b id="pkg-count">{total_count}</b> Paket Listeleniyor
                </div>
            </div>
        </div>

        <!-- Paket Izgarası -->
        <div class="pkg-grid" id="pkg-grid">
{cards_joined}
        </div>

        <footer>
            <p>ParsLinux Resmi Paket Deposu • Debian Bookworm Tabanlı • GPLv2 Açık Kaynak</p>
            <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #64748b;">
                Tüm paketler ParsLinux ekibi tarafından doğrulanmış ve imzalanmıştır.
            </p>
        </footer>
    </div>

    <script>
        const setupSnippets = {{
            gpg: `# 1. GPG Anahtarını indirin ve keyring dizinine ekleyin:
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://parslinux.github.io/apt_repo/parslinux-archive-keyring.gpg | sudo tee /etc/apt/keyrings/parslinux-archive-keyring.gpg > /dev/null

# 2. ParsLinux deposunu ekleyin ve güncelleyin:
echo "deb [signed-by=/etc/apt/keyrings/parslinux-archive-keyring.gpg] https://parslinux.github.io/apt_repo 0.1 main" | sudo tee /etc/apt/sources.list.d/parslinux.list
sudo apt update`,

            wkd: `# Web Key Directory (WKD) ile otomatik içe aktarma (RFC 9580):
sudo mkdir -p /etc/apt/keyrings
gpg --locate-keys repo@parslinux.org && gpg --export repo@parslinux.org | sudo gpg --dearmor --yes -o /etc/apt/keyrings/parslinux-archive-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/parslinux-archive-keyring.gpg] https://parslinux.github.io/apt_repo 0.1 main" | sudo tee /etc/apt/sources.list.d/parslinux.list
sudo apt update`,

            trusted: `# Hızlı test amaçlı kurulum (GPG doğrulaması olmadan):
echo "deb [trusted=yes] https://parslinux.github.io/apt_repo 0.1 main" | sudo tee /etc/apt/sources.list.d/parslinux.list
sudo apt update`
        }};

        let activeArch = 'all';

        function switchSetupTab(tabKey) {{
            document.querySelectorAll('.setup-tab-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            const codeEl = document.getElementById('setup-cmd');
            if (codeEl && setupSnippets[tabKey]) {{
                codeEl.textContent = setupSnippets[tabKey];
            }}
        }}

        function copyCommand() {{
            const code = document.getElementById('setup-cmd').textContent;
            navigator.clipboard.writeText(code).then(() => {{
                const btn = document.querySelector('.copy-btn');
                const prev = btn.textContent;
                btn.textContent = 'Kopyalandı! ✓';
                setTimeout(() => {{ btn.textContent = prev; }}, 2000);
            }});
        }}

        function setArchFilter(arch) {{
            activeArch = arch;
            document.querySelectorAll('.arch-pill').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            filterPackages();
        }}

        function filterPackages() {{
            const input = document.getElementById('search').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.pkg-card');
            let visibleCount = 0;

            cards.forEach(card => {{
                const name = card.getAttribute('data-name').toLowerCase();
                const desc = card.getAttribute('data-desc').toLowerCase();
                const arch = card.getAttribute('data-arch');

                const matchesText = !input || name.includes(input) || desc.includes(input);
                let matchesArch = true;
                if (activeArch === 'arch_all') matchesArch = (arch === 'all');
                else if (activeArch === 'amd64') matchesArch = (arch === 'amd64');

                if (matchesText && matchesArch) {{
                    card.style.display = 'flex';
                    visibleCount++;
                }} else {{
                    card.style.display = 'none';
                }}
            }});

            const badge = document.getElementById('pkg-count');
            if (badge) badge.textContent = visibleCount;
        }}

        function sortPackages() {{
            const sortMode = document.getElementById('sortSelect').value;
            const grid = document.getElementById('pkg-grid');
            const cards = Array.from(grid.querySelectorAll('.pkg-card'));

            cards.sort((a, b) => {{
                const nameA = a.getAttribute('data-name');
                const nameB = b.getAttribute('data-name');
                const sizeA = parseInt(a.getAttribute('data-size') || 0);
                const sizeB = parseInt(b.getAttribute('data-size') || 0);

                if (sortMode === 'name-asc') return nameA.localeCompare(nameB);
                if (sortMode === 'name-desc') return nameB.localeCompare(nameA);
                if (sortMode === 'size-desc') return sizeB - sizeA;
                if (sortMode === 'size-asc') return sizeA - sizeB;
                return 0;
            }});

            cards.forEach(card => grid.appendChild(card));
        }}

        function openPkgModal(card) {{
            if (!card) return;
            const name = card.getAttribute('data-name');
            const version = card.getAttribute('data-version') || '';
            const arch = card.getAttribute('data-arch') || '';
            const desc = card.getAttribute('data-rawdesc') || '';
            const sizeStr = card.getAttribute('data-sizestr') || '';
            const dlLink = card.getAttribute('data-dllink') || '#';

            document.getElementById('modalPkgTitle').textContent = name;
            document.getElementById('modalPkgVerBadge').textContent = 'v' + version;
            document.getElementById('modalPkgArchBadge').textContent = arch;
            document.getElementById('modalPkgDesc').textContent = desc || 'Açıklama bulunmuyor.';
            document.getElementById('modalInstallCmd').textContent = 'sudo apt install ' + name;
            document.getElementById('modalMetaInfo').textContent = 'Mimari: ' + arch + ' • Boyut: ' + sizeStr;
            const dlBtn = document.getElementById('modalDlBtn');
            dlBtn.href = dlLink;
            dlBtn.download = dlLink.split('/').pop() || name + '.deb';

            const modal = document.getElementById('pkgModal');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }}

        function closePkgModal() {{
            const modal = document.getElementById('pkgModal');
            if (modal) modal.classList.remove('active');
            document.body.style.overflow = '';
        }}

        function copyModalInstallCmd() {{
            const cmd = document.getElementById('modalInstallCmd').textContent;
            navigator.clipboard.writeText(cmd).then(() => {{
                const btn = document.getElementById('modalCopyBtn');
                const orig = btn.textContent;
                btn.textContent = 'Kopyalandı! ✓';
                btn.style.background = '#10b981';
                setTimeout(() => {{
                    btn.textContent = orig;
                    btn.style.background = '';
                }}, 2000);
            }});
        }}

        document.addEventListener('keydown', (e) => {{
            if (e.key === 'Escape') closePkgModal();
        }});

        const modalBackdrop = document.getElementById('pkgModal');
        if (modalBackdrop) {{
            modalBackdrop.addEventListener('click', (e) => {{
                if (e.target === modalBackdrop) closePkgModal();
            }});
        }}
    </script>

    <!-- Paket Detay Modalı -->
    <div class="modal-backdrop" id="pkgModal">
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h3 id="modalPkgTitle"></h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.4rem;">
                        <span id="modalPkgVerBadge" class="modal-badge-ver"></span>
                        <span id="modalPkgArchBadge" class="modal-badge-arch"></span>
                    </div>
                </div>
                <button class="modal-close" onclick="closePkgModal()" title="Kapat">&times;</button>
            </div>
            <div class="modal-body">
                <p id="modalPkgDesc" class="modal-desc"></p>
                <div class="modal-cmd-box">
                    <div class="modal-cmd-header">
                        <span>Terminal Kurulum Komutu:</span>
                        <button class="modal-copy-btn" id="modalCopyBtn" onclick="copyModalInstallCmd()">Kopyala</button>
                    </div>
                    <code class="modal-cmd-code" id="modalInstallCmd"></code>
                </div>
                <div class="modal-footer">
                    <span class="modal-meta" id="modalMetaInfo"></span>
                    <a class="dl-btn" id="modalDlBtn" href="#" download>
                        <span>⬇</span> .deb İndir
                    </a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>"""
    return html_content

def main():
    pkgs = parse_packages()
    print(f"Toplam {len(pkgs)} paket ayrıştırıldı.")
    html = generate_html(pkgs, len(pkgs))

    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else PUBLIC_DIR / "index.html"
    dest.write_text(html, encoding="utf-8")
    print(f"Başarıyla kaydedildi: {dest} ({len(html)} bayt)")

if __name__ == "__main__":
    main()
