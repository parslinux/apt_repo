#!/usr/bin/env python3
"""
APT Depo Modern Web Sunucusu ve API Köprüsü
Bu sunucu hem modern web kontrol panelini hem de APT istemcilerinin
(apt update, apt install) kullandığı depo dosyalarını aynı port üzerinden sunar.
"""

import os
import sys
import json
import subprocess
import email
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

ROOT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent
APTLY_BIN = ROOT_DIR / "bin" / "aptly"
PUBLIC_DIR = Path.home() / ".aptly" / "public"

def run_cmd(args):
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=5)
        return res.stdout.strip()
    except Exception:
        return ""

def parse_packages_file():
    """~/.aptly/public altındaki Packages dosyalarını okuyup JSON listesi döner."""
    packages = []
    if not PUBLIC_DIR.exists():
        return packages

    for p_file in PUBLIC_DIR.glob("dists/**/Packages"):
        try:
            content = p_file.read_text(encoding="utf-8", errors="ignore")
            blocks = content.strip().split("\n\n")
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
                        key, val = line.split(":", 1)
                        key = key.strip().lower()
                        val = val.strip()
                        if key == "description":
                            in_desc = True
                            desc_lines.append(val)
                        else:
                            pkg[key] = val
                if desc_lines:
                    pkg["description"] = " ".join(desc_lines)
                if "package" in pkg:
                    packages.append({
                        "name": pkg.get("package", ""),
                        "version": pkg.get("version", ""),
                        "architecture": pkg.get("architecture", "all"),
                        "section": pkg.get("section", "misc"),
                        "size": pkg.get("size", "0"),
                        "maintainer": pkg.get("maintainer", ""),
                        "description": pkg.get("description", ""),
                        "filename": pkg.get("filename", ""),
                        "depends": pkg.get("depends", ""),
                        "pre_depends": pkg.get("pre-depends", ""),
                        "recommends": pkg.get("recommends", ""),
                        "suggests": pkg.get("suggests", ""),
                        "conflicts": pkg.get("conflicts", ""),
                        "breaks": pkg.get("breaks", ""),
                        "provides": pkg.get("provides", ""),
                        "installed_size": pkg.get("installed-size", ""),
                        "homepage": pkg.get("homepage", ""),
                        "repo": p_file.parts[-4] if len(p_file.parts) >= 4 else "main"
                    })
        except Exception as e:
            print(f"[HATA] Packages dosyası okunamadı: {e}", file=sys.stderr)
    return packages

def get_repos_info():
    """Tanımlı depoları listeler."""
    repos = []
    raw_list = run_cmd([str(APTLY_BIN), "repo", "list", "-raw"])
    if raw_list:
        for r_name in raw_list.splitlines():
            r_name = r_name.strip()
            if not r_name:
                continue
            show_out = run_cmd([str(APTLY_BIN), "repo", "show", "-with-packages", r_name])
            dist = "bookworm"
            comp = "main"
            comment = ""
            pkgs = []
            in_pkgs = False
            for line in show_out.splitlines():
                if "Default Distribution:" in line:
                    dist = line.split(":", 1)[1].strip()
                elif "Default Component:" in line:
                    comp = line.split(":", 1)[1].strip()
                elif "Comment:" in line:
                    comment = line.split(":", 1)[1].strip()
                elif "Packages:" in line:
                    in_pkgs = True
                    continue
                elif in_pkgs and line.startswith("  "):
                    p = line.strip()
                    if p:
                        pkgs.append(p)
            repos.append({
                "name": r_name,
                "distribution": dist,
                "component": comp,
                "comment": comment,
                "packages": pkgs
            })
    return repos

def get_gpg_key():
    candidates = [
        PUBLIC_DIR / "public.key",
        ROOT_DIR / "keys" / "repo_public.key",
        Path.home() / ".aptly" / "public.key"
    ]
    for c in candidates:
        if c.is_file():
            return c.read_bytes()
    try:
        res = subprocess.run(["gpg", "--armor", "--export"], capture_output=True, timeout=3)
        if res.returncode == 0 and res.stdout:
            return res.stdout
    except Exception:
        pass
    return None

class AptlyDashboardHandler(SimpleHTTPRequestHandler):
    def send_json_response(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/upload":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                content_type = self.headers.get("Content-Type", "")
                body = self.rfile.read(content_length)

                raw_msg = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8") + body
                msg = email.message_from_bytes(raw_msg)

                uploaded_files = []
                target_repo = "demo-depo"

                q = urllib.parse.parse_qs(parsed.query)
                if "repo" in q:
                    target_repo = q["repo"][0]

                for part in msg.walk():
                    filename = part.get_filename()
                    if filename and filename.endswith(".deb"):
                        payload = part.get_payload(decode=True)
                        dest = ROOT_DIR / "custom_packages" / filename
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        dest.write_bytes(payload)
                        uploaded_files.append((filename, dest))
                    elif part.get_param("name", header="content-disposition") == "repo":
                        decoded_repo = part.get_payload(decode=True).decode("utf-8").strip()
                        if decoded_repo:
                            target_repo = decoded_repo

                if not uploaded_files:
                    return self.send_json_response({"success": False, "error": "Hiçbir geçerli .deb dosyası bulunamadı."}, 400)

                added_info = []
                for fname, fpath in uploaded_files:
                    run_cmd([str(APTLY_BIN), "repo", "add", target_repo, str(fpath)])
                    added_info.append(fname)

                # Yayını güncelle
                run_cmd([str(APTLY_BIN), "publish", "update", "-skip-signing", "bookworm"])

                # Webhook bildirimini arka planda tetikle
                notify_sh = ROOT_DIR / "scripts" / "notify_webhook.sh"
                if notify_sh.is_file():
                    for fname, fpath in uploaded_files:
                        try:
                            p_name = run_cmd(["dpkg-deb", "-f", str(fpath), "Package"]) or fname.replace(".deb", "")
                            p_ver = run_cmd(["dpkg-deb", "-f", str(fpath), "Version"]) or "1.0.0"
                            p_arch = run_cmd(["dpkg-deb", "-f", str(fpath), "Architecture"]) or "amd64"
                            p_desc = run_cmd(["dpkg-deb", "-f", str(fpath), "Description"]) or "Web panelinden yüklendi."
                            p_desc = p_desc.splitlines()[0] if p_desc else "Web panelinden yüklendi."
                            subprocess.Popen([str(notify_sh), p_name, p_ver, p_arch, target_repo, p_desc])
                        except Exception as we:
                            print(f"[Webhook Bildirim Hatası] {we}", file=sys.stderr)

                return self.send_json_response({
                    "success": True,
                    "message": f"{len(added_info)} paket '{target_repo}' deposuna eklendi ve yayın güncellendi.",
                    "packages": added_info,
                    "repo": target_repo
                })
            except Exception as e:
                return self.send_json_response({"success": False, "error": f"Yükleme hatası: {str(e)}"}, 500)

        elif parsed.path == "/api/webhook/test":
            notify_sh = ROOT_DIR / "scripts" / "notify_webhook.sh"
            if notify_sh.is_file():
                res = subprocess.run([str(notify_sh), "--test"], capture_output=True, text=True, timeout=10)
                return self.send_json_response({
                    "success": res.returncode == 0,
                    "output": (res.stdout + res.stderr).strip()
                })
            return self.send_json_response({"success": False, "error": "notify_webhook.sh betiği bulunamadı."}, 404)

        self.send_error(404, "Endpoint bulunamadı")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API Rotaları
        if path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            repos = get_repos_info()
            packages = parse_packages_file()
            publish_out = run_cmd([str(APTLY_BIN), "publish", "list", "-raw"])
            pub_count = len([p for p in publish_out.splitlines() if p.strip()]) if publish_out else 0

            # Disk alanı
            disk_str = run_cmd(["du", "-sh", str(Path.home() / ".aptly")])
            disk_val = disk_str.split()[0] if disk_str else "0K"

            data = {
                "repo_count": len(repos),
                "package_count": len(packages) or sum(len(r["packages"]) for r in repos),
                "publish_count": pub_count,
                "disk_usage": disk_val
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        elif path == "/api/packages":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            pkgs = parse_packages_file()
            self.wfile.write(json.dumps({"packages": pkgs}).encode("utf-8"))
            return

        elif path == "/api/repos":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            repos = get_repos_info()
            self.wfile.write(json.dumps({"repos": repos}).encode("utf-8"))
            return

        elif path in ("/public.key", "/key.gpg", "/api/gpg-key"):
            key_data = get_gpg_key()
            if key_data:
                self.send_response(200)
                self.send_header("Content-Type", "application/pgp-keys; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="parslinux-archive-keyring.gpg"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(key_data if isinstance(key_data, bytes) else key_data.encode("utf-8"))
                return
            else:
                self.send_json_response({"error": "GPG genel anahtarı bulunamadı. Lütfen önce ./scripts/setup_gpg_keys.sh çalıştırın."}, 404)
                return

        elif path == "/api/webhook/status":
            env_file = ROOT_DIR / ".webhook.env"
            user_env = Path.home() / ".aptly" / "webhook.env"
            has_conf = env_file.is_file() or user_env.is_file()
            self.send_json_response({
                "configured": has_conf,
                "file": str(user_env if user_env.is_file() else env_file)
            })
            return

        # 2. Web UI Dosyaları (index.html, index.css, app.js, install.sh)
        if path == "/install.sh":
            sh_path = ROOT_DIR / "scripts" / "install_client_oneline.sh"
            if sh_path.is_file():
                host = self.headers.get("Host", "localhost:8080")
                script_text = sh_path.read_text(encoding="utf-8")
                # Dinamik olarak bağlanan hostu enjekte et
                script_text = script_text.replace("http://localhost:8080", f"http://{host}")
                self.send_response(200)
                self.send_header("Content-Type", "text/x-shellscript; charset=utf-8")
                self.send_header("Content-Length", str(len(script_text.encode("utf-8"))))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(script_text.encode("utf-8"))
                return
            self.send_error(404, "install.sh bulunamadı")
            return

        elif path in ("/", "/index.html"):
            return self.serve_file(WEB_DIR / "index.html", "text/html; charset=utf-8")
        elif path == "/index.css":
            return self.serve_file(WEB_DIR / "index.css", "text/css; charset=utf-8")
        elif path == "/app.js":
            return self.serve_file(WEB_DIR / "app.js", "application/javascript; charset=utf-8")
        elif path == "/favicon.ico":
            svg_icon = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(svg_icon)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(svg_icon)
            return

        # 3. APT Depo Dosyaları (dists/ ve pool/)
        # ~/.aptly/public altında aranır
        rel_path = path.lstrip("/")
        candidate = PUBLIC_DIR / rel_path
        if candidate.is_file():
            # Dosya uzantısına göre MIME tipi
            content_type = "application/octet-stream"
            if candidate.name.endswith(".deb"):
                content_type = "application/vnd.debian.binary-package"
            elif candidate.name in ("Release", "Packages"):
                content_type = "text/plain; charset=utf-8"
            elif candidate.name.endswith(".gz"):
                content_type = "application/gzip"
            return self.serve_file(candidate, content_type)

        # Bulunamadı
        self.send_error(404, f"Dosya bulunamadı: {path}")

    def serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Sunucu hatası: {e}")

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server_address = ("", port)
    httpd = HTTPServer(server_address, AptlyDashboardHandler)
    print("=" * 64)
    print(f"  APT Depo Modern Web Paneli & API Sunucusu")
    print("=" * 64)
    print(f"  Web Dashboard : http://localhost:{port}/")
    print(f"  APT Uç Noktası: http://localhost:{port}/dists/")
    print(f"  Durdurmak için: [CTRL + C]")
    print("=" * 64)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatıldı.")

if __name__ == "__main__":
    main()
