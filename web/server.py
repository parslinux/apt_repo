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
import io
import tarfile
import urllib.parse
import threading
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent
APTLY_BIN = ROOT_DIR / "bin" / "aptly"
PUBLIC_DIR = Path.home() / ".aptly" / "public"
METRICS_FILE = ROOT_DIR / ".metrics.json"
API_TOKEN_FILE = ROOT_DIR / ".api_token"

def get_configured_api_token():
    env_token = os.environ.get("APT_REPO_API_TOKEN", "").strip()
    if env_token:
        return env_token
    if API_TOKEN_FILE.is_file():
        try:
            return API_TOKEN_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    return None

def inspect_deb_package(pkg_name: str, pkg_version: str = ""):
    target_deb = None
    search_dirs = [
        PUBLIC_DIR / "pool",
        ROOT_DIR / "custom_packages",
        ROOT_DIR / "sample_packages"
    ]
    for base in search_dirs:
        if not base.is_dir():
            continue
        for f in base.rglob("*.deb"):
            if pkg_version and f.name.startswith(f"{pkg_name}_{pkg_version}"):
                target_deb = f
                break
            elif not target_deb and (f.name.startswith(f"{pkg_name}_") or f.stem == pkg_name):
                target_deb = f
        if target_deb and pkg_version and target_deb.name.startswith(f"{pkg_name}_{pkg_version}"):
            break

    if not target_deb or not target_deb.is_file():
        return {"success": False, "error": f"'{pkg_name}' paketi diskte bulunamadı."}

    try:
        with open(target_deb, "rb") as f:
            magic = f.read(8)
            if magic != b"!<arch>\n":
                return {"success": False, "error": "Geçersiz .deb arşivi (ar formatı eksik)."}
            files = {}
            while True:
                header = f.read(60)
                if not header or len(header) < 60:
                    break
                name = header[:16].decode("ascii", errors="ignore").strip().rstrip("/")
                size = int(header[48:58].decode("ascii", errors="ignore").strip())
                data = f.read(size)
                if size % 2 == 1:
                    f.read(1)
                files[name] = data

        control_text = ""
        control_names = [k for k in files if k.startswith("control.tar")]
        if control_names:
            with tarfile.open(fileobj=io.BytesIO(files[control_names[0]])) as tar:
                for m in tar.getmembers():
                    if m.name.endswith("control") or m.name == "control":
                        extracted = tar.extractfile(m)
                        if extracted:
                            control_text = extracted.read().decode("utf-8", errors="replace")
                            break

        file_tree = []
        data_names = [k for k in files if k.startswith("data.tar")]
        if data_names:
            with tarfile.open(fileobj=io.BytesIO(files[data_names[0]])) as tar:
                for m in tar.getmembers():
                    file_tree.append({
                        "name": m.name,
                        "size": m.size,
                        "isdir": m.isdir(),
                        "mode": oct(m.mode),
                        "mtime": datetime.fromtimestamp(m.mtime).strftime("%Y-%m-%d %H:%M:%S") if m.mtime else "-"
                    })

        return {
            "success": True,
            "filename": target_deb.name,
            "path": str(target_deb),
            "size": target_deb.stat().st_size,
            "control": control_text,
            "files": file_tree
        }
    except Exception as e:
        return {"success": False, "error": f"Paket ayrıştırma hatası: {e}"}

class MetricsTracker:
    _lock = threading.Lock()

    @classmethod
    def _load_data(cls):
        if METRICS_FILE.is_file():
            try:
                with open(METRICS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "total_downloads": 0,
            "total_bytes": 0,
            "packages": {},
            "recent_events": [],
            "daily_trends": {}
        }

    @classmethod
    def _save_data(cls, data):
        try:
            with open(METRICS_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Metrik Kayıt Hatası] {e}", file=sys.stderr)

    @classmethod
    def record_download(cls, filename, file_size, client_ip="127.0.0.1", user_agent=""):
        base_name = filename.replace(".deb", "")
        parts = base_name.split("_")
        pkg_name = parts[0] if parts else base_name
        version = parts[1] if len(parts) > 1 else ""

        client_name = "APT İstemcisi"
        ua_lower = user_agent.lower()
        if "apt-http" in ua_lower or "debian apt" in ua_lower:
            client_name = "Debian/Ubuntu APT"
        elif "curl" in ua_lower:
            client_name = "cURL Komutu"
        elif "wget" in ua_lower:
            client_name = "Wget"
        elif "mozilla" in ua_lower or "chrome" in ua_lower or "safari" in ua_lower:
            client_name = "Web Tarayıcısı"
        elif user_agent:
            client_name = user_agent[:30]

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today = datetime.now().strftime("%Y-%m-%d")

        with cls._lock:
            data = cls._load_data()
            data["total_downloads"] = data.get("total_downloads", 0) + 1
            data["total_bytes"] = data.get("total_bytes", 0) + file_size

            pkgs = data.setdefault("packages", {})
            pkg_info = pkgs.setdefault(pkg_name, {
                "downloads": 0,
                "bytes": 0,
                "version": version,
                "last_download": None
            })
            pkg_info["downloads"] += 1
            pkg_info["bytes"] += file_size
            if version:
                pkg_info["version"] = version
            pkg_info["last_download"] = now_iso

            trends = data.setdefault("daily_trends", {})
            trends[today] = trends.get(today, 0) + 1

            recent = data.setdefault("recent_events", [])
            recent.insert(0, {
                "timestamp": now_iso,
                "package": pkg_name,
                "version": version or "-",
                "filename": filename,
                "size": file_size,
                "ip": client_ip,
                "client": client_name
            })
            data["recent_events"] = recent[:40]

            cls._save_data(data)

    @classmethod
    def get_summary(cls):
        with cls._lock:
            data = cls._load_data()
        
        pkgs_list = []
        for name, info in data.get("packages", {}).items():
            pkgs_list.append({
                "name": name,
                "version": info.get("version", "-"),
                "downloads": info.get("downloads", 0),
                "bytes": info.get("bytes", 0),
                "last_download": info.get("last_download")
            })
        pkgs_list.sort(key=lambda x: x["downloads"], reverse=True)

        return {
            "total_downloads": data.get("total_downloads", 0),
            "total_bytes": data.get("total_bytes", 0),
            "unique_packages": len(pkgs_list),
            "top_packages": pkgs_list,
            "recent_events": data.get("recent_events", []),
            "daily_trends": data.get("daily_trends", {})
        }

    @classmethod
    def reset(cls):
        with cls._lock:
            cls._save_data({
                "total_downloads": 0,
                "total_bytes": 0,
                "packages": {},
                "recent_events": [],
                "daily_trends": {}
            })

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

def get_snapshots_info():
    """Tüm Aptly snapshot'larını listeler."""
    snapshots = []
    raw_list = run_cmd([str(APTLY_BIN), "snapshot", "list", "-raw"])
    if not raw_list:
        return snapshots
    
    for s_name in raw_list.splitlines():
        s_name = s_name.strip()
        if not s_name:
            continue
        show_out = run_cmd([str(APTLY_BIN), "snapshot", "show", s_name])
        created_at = ""
        description = ""
        pkg_count = 0
        for line in show_out.splitlines():
            if line.startswith("Created At:"):
                created_at = line.split(":", 1)[1].strip()
            elif line.startswith("Description:"):
                description = line.split(":", 1)[1].strip()
            elif line.startswith("Number of packages:"):
                try:
                    pkg_count = int(line.split(":", 1)[1].strip())
                except Exception:
                    pkg_count = 0
        snapshots.append({
            "name": s_name,
            "created_at": created_at,
            "description": description,
            "package_count": pkg_count
        })
    return snapshots

def create_auto_snapshot(repo_name: str, max_keep: int = 5):
    """Paket yükleme öncesi otomatik snapshot alır ve eski olanları temizler."""
    try:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        snap_name = f"auto-{repo_name}-{ts}"
        desc = f"Paket ekleme öncesi otomatik sistem yedeği ({datetime.now().strftime('%d.%m.%Y %H:%M:%S')})"
        res = run_cmd([str(APTLY_BIN), "snapshot", "create", snap_name, "from", "repo", repo_name])
        if "successfully" not in res and "Created" not in res and not res.startswith("Snapshot"):
            # Repo boş olabilir veya hata vermiştir
            pass
        
        # Rotasyon: En eski auto snapshot'ları temizle
        all_snaps_raw = run_cmd([str(APTLY_BIN), "snapshot", "list", "-raw"])
        auto_snaps = sorted([s for s in all_snaps_raw.splitlines() if s.startswith(f"auto-{repo_name}-")])
        if len(auto_snaps) > max_keep:
            for old_snap in auto_snaps[:-max_keep]:
                run_cmd([str(APTLY_BIN), "snapshot", "drop", old_snap])
        
        return snap_name
    except Exception as e:
        print(f"[Auto-Snapshot Hatası] {e}", file=sys.stderr)
        return None

def parse_snapshot_diff(snap1, snap2):
    """İki snapshot arasındaki diff çıktısını ayrıştırır."""
    out = run_cmd([str(APTLY_BIN), "snapshot", "diff", snap1, snap2])
    results = []
    if not out:
        return results
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("Arch") or line.startswith("---") or "successfully" in line:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 4:
            arch_col = parts[0]
            action = "changed"
            if arch_col.startswith("+"):
                action = "added"
                arch = arch_col[1:].strip()
            elif arch_col.startswith("-"):
                action = "removed"
                arch = arch_col[1:].strip()
            elif arch_col.startswith("!"):
                action = "modified"
                arch = arch_col[1:].strip()
            else:
                arch = arch_col.strip()
            
            pkg_name = parts[1]
            ver_a = parts[2]
            ver_b = parts[3]
            results.append({
                "action": action,
                "arch": arch,
                "package": pkg_name,
                "version_a": ver_a,
                "version_b": ver_b
            })
    return results

def compare_package_data(data1, data2):
    """İki Debian paketinin control ve dosya ağacını karşılaştırır."""
    if not data1.get("success") or not data2.get("success"):
        return {"success": False, "error": "Paketlerden biri veya her ikisi okunamadı."}

    def parse_ctrl(txt):
        res = {}
        for line in txt.splitlines():
            if ":" in line and not line.startswith(" "):
                k, v = line.split(":", 1)
                res[k.strip().lower()] = v.strip()
        return res

    ctrl1 = parse_ctrl(data1.get("control", ""))
    ctrl2 = parse_ctrl(data2.get("control", ""))
    all_keys = sorted(set(ctrl1.keys()) | set(ctrl2.keys()))
    control_diff = []
    for k in all_keys:
        v1 = ctrl1.get(k)
        v2 = ctrl2.get(k)
        if v1 != v2:
            control_diff.append({
                "field": k.capitalize(),
                "val1": v1 or "(tanımsız)",
                "val2": v2 or "(tanımsız)",
                "status": "added" if v1 is None else ("removed" if v2 is None else "changed")
            })

    files1 = {f["name"]: f for f in data1.get("files", [])}
    files2 = {f["name"]: f for f in data2.get("files", [])}
    all_files = sorted(set(files1.keys()) | set(files2.keys()))
    file_diff = []
    unchanged_count = 0
    for fn in all_files:
        f1 = files1.get(fn)
        f2 = files2.get(fn)
        if not f1:
            file_diff.append({
                "name": fn,
                "status": "added",
                "size2": f2.get("size", 0),
                "mode2": f2.get("mode", ""),
                "isdir": f2.get("isdir", False)
            })
        elif not f2:
            file_diff.append({
                "name": fn,
                "status": "removed",
                "size1": f1.get("size", 0),
                "mode1": f1.get("mode", ""),
                "isdir": f1.get("isdir", False)
            })
        elif f1.get("size") != f2.get("size") or f1.get("mode") != f2.get("mode"):
            file_diff.append({
                "name": fn,
                "status": "modified",
                "size1": f1.get("size", 0),
                "size2": f2.get("size", 0),
                "mode1": f1.get("mode", ""),
                "mode2": f2.get("mode", ""),
                "isdir": f1.get("isdir", False)
            })
        else:
            unchanged_count += 1

    return {
        "success": True,
        "pkg1": {
            "name": ctrl1.get("package", data1.get("filename")),
            "version": ctrl1.get("version", "-"),
            "size": data1.get("size", 0),
            "files_count": len(files1)
        },
        "pkg2": {
            "name": ctrl2.get("package", data2.get("filename")),
            "version": ctrl2.get("version", "-"),
            "size": data2.get("size", 0),
            "files_count": len(files2)
        },
        "control_diff": control_diff,
        "file_diff": file_diff,
        "unchanged_files_count": unchanged_count
    }


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

    def verify_auth(self):
        token = get_configured_api_token()
        if not token:
            return True
        auth_header = self.headers.get("Authorization", "").strip()
        api_key_header = self.headers.get("X-API-Key", "").strip()
        client_token = ""
        if auth_header.startswith("Bearer "):
            client_token = auth_header[7:].strip()
        elif api_key_header:
            client_token = api_key_header
        
        return client_token == token

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/upload":
            if not self.verify_auth():
                return self.send_json_response({
                    "success": False,
                    "error": "Bu işlem için geçerli bir API Token (Bearer veya X-API-Key) gereklidir."
                }, 401)
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

                # Paket yükleme öncesi güvenlik için Otomatik Snapshot al
                auto_snap = create_auto_snapshot(target_repo, max_keep=5)

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

                msg_txt = f"{len(added_info)} paket '{target_repo}' deposuna eklendi ve yayın güncellendi."
                if auto_snap:
                    msg_txt += f" (Otomatik Snapshot: {auto_snap})"

                return self.send_json_response({
                    "success": True,
                    "message": msg_txt,
                    "packages": added_info,
                    "repo": target_repo,
                    "auto_snapshot": auto_snap
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

        elif parsed.path == "/api/metrics/reset":
            if not self.verify_auth():
                return self.send_json_response({
                    "success": False,
                    "error": "Metrikleri sıfırlamak için geçerli bir API Token gereklidir."
                }, 401)
            MetricsTracker.reset()
            return self.send_json_response({"success": True, "message": "İndirme metrikleri sıfırlandı."})

        elif parsed.path == "/api/auth/verify":
            configured = bool(get_configured_api_token())
            valid = self.verify_auth()
            return self.send_json_response({
                "configured": configured,
                "valid": valid
            })

        elif parsed.path == "/api/metrics/simulate":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length > 0 else {}
            except Exception:
                body = {}
            pkg_name = body.get("package", "pars-setup")
            version = body.get("version", "1.0.0")
            fname = f"{pkg_name}_{version}_all.deb"
            fsize = int(body.get("size", 1024 * 300))
            client_ip = self.client_address[0] if self.client_address else "127.0.0.1"
            MetricsTracker.record_download(fname, fsize, client_ip, "Simüle İndirme (Test)")
            return self.send_json_response({"success": True, "message": f"'{pkg_name}' için indirme metriklerine test kaydı eklendi."})

        elif parsed.path == "/api/snapshot/create":
            if not self.verify_auth():
                return self.send_json_response({"success": False, "error": "İşlem için API Token gereklidir."}, 401)
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length > 0 else {}
            except Exception:
                body = {}
            repo = body.get("repo", "parslinux").strip() or "parslinux"
            name = body.get("name", "").strip()
            desc = body.get("description", "").strip()
            if not name:
                now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                name = f"snap_{repo}_{now_str}"
            
            cmd = [str(APTLY_BIN), "snapshot", "create", name, "from", "repo", repo]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                return self.send_json_response({
                    "success": True,
                    "message": f"'{name}' anlık görüntüsü '{repo}' deposundan başarıyla oluşturuldu.",
                    "name": name
                })
            else:
                err_msg = (res.stderr or res.stdout).strip() or "Snapshot oluşturulamadı."
                return self.send_json_response({"success": False, "error": err_msg}, 400)

        elif parsed.path == "/api/snapshot/rollback":
            if not self.verify_auth():
                return self.send_json_response({"success": False, "error": "İşlem için API Token gereklidir."}, 401)
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length > 0 else {}
            except Exception:
                body = {}
            snapshot = body.get("snapshot", "").strip()
            target_repo = body.get("repo", "parslinux").strip() or "parslinux"
            dist = body.get("distribution", "bookworm").strip() or "bookworm"
            if not snapshot:
                return self.send_json_response({"success": False, "error": "Snapshot adı eksik."}, 400)
            
            repo_show = run_cmd([str(APTLY_BIN), "repo", "show", target_repo])
            comp = "main"
            comment = "Geri Yüklendi (Rollback)"
            for line in repo_show.splitlines():
                if "Default Component:" in line:
                    comp = line.split(":", 1)[1].strip() or "main"
                elif "Comment:" in line:
                    comment = line.split(":", 1)[1].strip()

            run_cmd([str(APTLY_BIN), "repo", "drop", target_repo])
            c_res = subprocess.run([
                str(APTLY_BIN), "repo", "create",
                f"-distribution={dist}",
                f"-component={comp}",
                f"-comment={comment}",
                target_repo,
                "from", "snapshot", snapshot
            ], capture_output=True, text=True)

            if c_res.returncode != 0:
                return self.send_json_response({"success": False, "error": (c_res.stderr or c_res.stdout).strip()}, 500)

            run_cmd([str(APTLY_BIN), "publish", "update", "-skip-signing", dist])
            if dist == "bookworm":
                run_cmd([str(APTLY_BIN), "publish", "update", "-skip-signing", "0.1"])

            return self.send_json_response({
                "success": True,
                "message": f"'{target_repo}' deposu '{snapshot}' durumuna geri döndürüldü ve '{dist}' yayını güncellendi."
            })

        elif parsed.path == "/api/snapshot/drop":
            if not self.verify_auth():
                return self.send_json_response({"success": False, "error": "İşlem için API Token gereklidir."}, 401)
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length > 0 else {}
            except Exception:
                body = {}
            name = body.get("name", "").strip()
            if not name:
                return self.send_json_response({"success": False, "error": "Snapshot adı eksik."}, 400)
            res = subprocess.run([str(APTLY_BIN), "snapshot", "drop", "-force", name], capture_output=True, text=True)
            if res.returncode == 0:
                return self.send_json_response({"success": True, "message": f"'{name}' anlık görüntüsü silindi."})
            else:
                return self.send_json_response({"success": False, "error": (res.stderr or res.stdout).strip()}, 400)

        self.send_error(404, "Endpoint bulunamadı")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API Rotaları
        if path == "/api/metrics":
            return self.send_json_response(MetricsTracker.get_summary())

        elif path == "/api/status":
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

        elif path == "/api/auth/status":
            token = get_configured_api_token()
            self.send_json_response({
                "enabled": bool(token)
            })
            return

        elif path == "/api/package/inspect":
            q = urllib.parse.parse_qs(parsed.query)
            pkg_name = q.get("name", [""])[0].strip()
            pkg_ver = q.get("version", [""])[0].strip()
            if not pkg_name:
                self.send_json_response({"success": False, "error": "name parametresi eksik."}, 400)
                return
            res = inspect_deb_package(pkg_name, pkg_ver)
            self.send_json_response(res, 200 if res.get("success") else 404)
            return

        elif path == "/api/snapshots":
            snaps = get_snapshots_info()
            return self.send_json_response({"snapshots": snaps})

        elif path == "/api/snapshot/diff":
            q = urllib.parse.parse_qs(parsed.query)
            s1 = q.get("snap1", [""])[0].strip()
            s2 = q.get("snap2", [""])[0].strip()
            if not s1 or not s2:
                return self.send_json_response({"success": False, "error": "snap1 ve snap2 parametreleri gereklidir."}, 400)
            diffs = parse_snapshot_diff(s1, s2)
            return self.send_json_response({
                "success": True,
                "snap1": s1,
                "snap2": s2,
                "differences": diffs
            })

        elif path == "/api/package/diff":
            q = urllib.parse.parse_qs(parsed.query)
            p1 = q.get("pkg1", [""])[0].strip()
            v1 = q.get("ver1", [""])[0].strip()
            p2 = q.get("pkg2", [""])[0].strip()
            v2 = q.get("ver2", [""])[0].strip()
            if not p1 or not p2:
                return self.send_json_response({"success": False, "error": "pkg1 ve pkg2 parametreleri gereklidir."}, 400)
            data1 = inspect_deb_package(p1, v1)
            data2 = inspect_deb_package(p2, v2)
            res = compare_package_data(data1, data2)
            return self.send_json_response(res, 200 if res.get("success") else 400)

        elif path == "/api/wkd/status":
            wkd_dir = ROOT_DIR / ".well-known" / "openpgpkey"
            policy_ok = (wkd_dir / "policy").is_file()
            hu_dir = wkd_dir / "hu"
            hashes = [f.name for f in hu_dir.glob("*")] if hu_dir.is_dir() else []
            self.send_json_response({
                "enabled": policy_ok and len(hashes) > 0,
                "domain": "parslinux.org",
                "emails": ["repo@parslinux.org", "dev@parslinux.org", "support@parslinux.org", "contact@parslinux.org"],
                "hashes": {
                    "repo@parslinux.org": "gkux3qirko9oqgy8uy54k78iopxuno96",
                    "dev@parslinux.org": "gudx35f8m3ns6jx87gkuda1nmtsb53nd"
                },
                "policy_url": "/.well-known/openpgpkey/policy",
                "test_command": "gpg --locate-keys repo@parslinux.org"
            })
            return

        elif path.startswith("/.well-known/openpgpkey/"):
            rel_wkd = path[len("/.well-known/openpgpkey/"):].strip("/")
            candidates = [
                ROOT_DIR / ".well-known" / "openpgpkey" / rel_wkd,
                PUBLIC_DIR / ".well-known" / "openpgpkey" / rel_wkd
            ]
            for target_file in candidates:
                if target_file.is_file():
                    content = target_file.read_bytes()
                    self.send_response(200)
                    if target_file.name == "policy":
                        self.send_header("Content-Type", "text/plain; charset=utf-8")
                    else:
                        self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(len(content)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Cache-Control", "public, max-age=3600")
                    self.end_headers()
                    self.wfile.write(content)
                    return
            self.send_error(404, f"WKD anahtarı bulunamadı: {path}")
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
                try:
                    fsize = candidate.stat().st_size
                    client_ip = self.client_address[0] if self.client_address else "127.0.0.1"
                    user_agent = self.headers.get("User-Agent", "")
                    MetricsTracker.record_download(candidate.name, fsize, client_ip, user_agent)
                except Exception as me:
                    print(f"[Metrik Kayıt Hatası] {me}", file=sys.stderr)
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
