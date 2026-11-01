// ==============================================================================
// APT Depo Paneli - Vanilla JS İstemci Mantığı
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Durum Değişkenleri
    let allPackages = [];
    let allRepos = [];
    let currentTab = 'packagesTab';
    let downloadMetrics = { total_downloads: 0, total_bytes: 0, top_packages: [], recent_events: [] };

    // DOM Elementleri
    const packagesGrid = document.getElementById('packagesGrid');
    const searchInput = document.getElementById('searchInput');
    const repoFilterSelect = document.getElementById('repoFilterSelect');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const btnRefresh = document.getElementById('btnRefresh');
    const toastContainer = document.getElementById('toastContainer');
    
    // İstatistik Elementleri
    const statRepoCount = document.getElementById('statRepoCount');
    const statPackageCount = document.getElementById('statPackageCount');
    const statPublishCount = document.getElementById('statPublishCount');
    const statDiskUsage = document.getElementById('statDiskUsage');
    
    // Metrik Elementleri
    const metricTotalDownloads = document.getElementById('metricTotalDownloads');
    const metricTotalBandwidth = document.getElementById('metricTotalBandwidth');
    const metricTopPackage = document.getElementById('metricTopPackage');
    const metricTopPackageCount = document.getElementById('metricTopPackageCount');
    const metricLastDownload = document.getElementById('metricLastDownload');
    const metricLastPackage = document.getElementById('metricLastPackage');
    const metricTrackedPkgsBadge = document.getElementById('metricTrackedPkgsBadge');
    const metricsTableBody = document.getElementById('metricsTableBody');
    const metricsFeed = document.getElementById('metricsFeed');
    const btnSimulateDownload = document.getElementById('btnSimulateDownload');
    const btnRefreshMetrics = document.getElementById('btnRefreshMetrics');
    const btnResetMetrics = document.getElementById('btnResetMetrics');

    // Filtre & Sıralama Elementleri
    let currentArchFilter = 'all';
    let currentInspectedFiles = [];
    const sortSelect = document.getElementById('sortSelect');
    const btnSearchClear = document.getElementById('btnSearchClear');
    const archFilterPills = document.querySelectorAll('.arch-pill');
    const packageResultsCount = document.getElementById('packageResultsCount');

    // API Token Elementleri
    const btnApiSettings = document.getElementById('btnApiSettings');
    const apiStatusNavLabel = document.getElementById('apiStatusNavLabel');
    const apiTokenModal = document.getElementById('apiTokenModal');
    const modalApiCloseBtn = document.getElementById('modalApiCloseBtn');
    const inputApiToken = document.getElementById('inputApiToken');
    const btnSaveApiToken = document.getElementById('btnSaveApiToken');
    const btnClearApiToken = document.getElementById('btnClearApiToken');
    const apiTokenTestResult = document.getElementById('apiTokenTestResult');

    // Modal Subnav Elementleri
    const modalSubnavBtns = document.querySelectorAll('.modal-tab-btn');
    const modalViews = document.querySelectorAll('.modal-view');
    const modalFilesCountBadge = document.getElementById('modalFilesCountBadge');
    const modalFilesSizeBadge = document.getElementById('modalFilesSizeBadge');
    const modalFilesTreeList = document.getElementById('modalFilesTreeList');
    const modalFileSearchInput = document.getElementById('modalFileSearchInput');
    const modalControlRaw = document.getElementById('modalControlRaw');
    const btnCopyControlText = document.getElementById('btnCopyControlText');

    // Auth Başlıkları Yardımcısı
    function getAuthHeaders(extra = {}) {
        const token = localStorage.getItem('apt_repo_api_token');
        const headers = { ...extra };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['X-API-Key'] = token;
        }
        return headers;
    }

    // Modal Elementleri
    const packageModal = document.getElementById('packageModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCloseFooterBtn = document.getElementById('modalCloseFooterBtn');
    const modalPkgName = document.getElementById('modalPkgName');
    const modalPkgVersion = document.getElementById('modalPkgVersion');
    const modalPkgBody = document.getElementById('modalPkgBody');
    const modalDownloadBtn = document.getElementById('modalDownloadBtn');

    // 1. Dinamik Host ve URL Tespiti (Sources.list için)
    function updateSetupCommands() {
        const origin = window.location.origin || 'http://localhost:8080';
        
        const codeGpgKeyImport = document.getElementById('codeGpgKeyImport');
        if (codeGpgKeyImport) {
            codeGpgKeyImport.textContent = `sudo mkdir -p /etc/apt/keyrings && curl -fsSL ${origin}/public.key | sudo gpg --dearmor --yes -o /etc/apt/keyrings/parslinux-archive-keyring.gpg`;
        }

        const codeSourcesGpgLine = document.getElementById('codeSourcesGpgLine');
        if (codeSourcesGpgLine) {
            codeSourcesGpgLine.textContent = `echo "deb [signed-by=/etc/apt/keyrings/parslinux-archive-keyring.gpg] ${origin}/ bookworm main" | sudo tee /etc/apt/sources.list.d/parslinux.list`;
        }

        const codeSourcesLine = document.getElementById('codeSourcesLine');
        if (codeSourcesLine) {
            codeSourcesLine.textContent = `echo "deb [trusted=yes] ${origin}/ bookworm main" | sudo tee /etc/apt/sources.list.d/parslinux.list`;
        }

        const codeOneLineInstall = document.getElementById('codeOneLineInstall');
        if (codeOneLineInstall) {
            codeOneLineInstall.textContent = `curl -sSL ${origin}/install.sh | sudo bash`;
        }

        const codeWkdImport = document.getElementById('codeWkdImport');
        if (codeWkdImport) {
            codeWkdImport.textContent = `gpg --locate-keys repo@parslinux.org && gpg --export repo@parslinux.org | sudo gpg --dearmor --yes -o /etc/apt/keyrings/parslinux-archive-keyring.gpg`;
        }
    }

    // 2. Sekme (Tab) Yönetimi
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab === currentTab) return;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');

            currentTab = targetTab;
            if (targetTab === 'metricsTab') {
                loadMetricsData();
            } else if (targetTab === 'snapshotsTab') {
                loadSnapshotsData();
            } else if (targetTab === 'diffTab') {
                populateDiffSelects();
            }
        });
    });

    // 3. API Verilerini Çekme
    async function loadDashboardData() {
        try {
            // İstatistikleri çek
            const statusRes = await fetch('/api/status').catch(() => null);
            if (statusRes && statusRes.ok) {
                const statusData = await statusRes.json();
                statRepoCount.textContent = statusData.repo_count ?? '2';
                statPackageCount.textContent = statusData.package_count ?? '1';
                statPublishCount.textContent = statusData.publish_count ?? '1';
                statDiskUsage.textContent = statusData.disk_usage ?? '132 KB';
            } else {
                // Fallback statik değerler
                statRepoCount.textContent = '2';
                statPackageCount.textContent = '1';
                statPublishCount.textContent = '1';
                statDiskUsage.textContent = '132 KB';
            }

            // Paketleri çek
            const pkgRes = await fetch('/api/packages').catch(() => null);
            if (pkgRes && pkgRes.ok) {
                const pkgData = await pkgRes.json();
                allPackages = pkgData.packages || [];
            } else {
                // Fallback: Depoda zaten bulunan hello paketini simüle et
                allPackages = [
                    {
                        name: 'hello',
                        version: '2.10-3',
                        architecture: 'amd64',
                        repo: 'demo-depo',
                        section: 'devel',
                        size: '53080',
                        maintainer: 'Santiago Vila <sanvila@debian.org>',
                        description: 'Klasik GNU hello dünya programı. Terminal ekranına dostça bir selamlama mesajı basar.',
                        filename: 'pool/main/h/hello/hello_2.10-3_amd64.deb',
                        depends: 'libc6 (>= 2.34)',
                        recommends: 'bash, coreutils',
                        suggests: 'hello-doc'
                    }
                ];
            }

            // Depoları çek
            const repoRes = await fetch('/api/repos').catch(() => null);
            if (repoRes && repoRes.ok) {
                const repoData = await repoRes.json();
                allRepos = repoData.repos || [];
            } else {
                allRepos = [
                    { name: 'demo-depo', distribution: 'bookworm', component: 'main', comment: 'Hızlı Demo Deposu', packages: ['hello'] },
                    { name: 'test-depo', distribution: 'bookworm', component: 'main', comment: 'Deneme Deposu', packages: ['hello'] }
                ];
            }

            updateRepoSelect();
            renderPackages();
            renderRepoArchitecture();
            renderRecentUploads();
            renderWebhookEvents();
        } catch (err) {
            console.error('Veri yükleme hatası:', err);
            renderPackages();
            renderRecentUploads();
            renderWebhookEvents();
        }
    }

    // 4. Depo Seçim Filtresini Doldur
    function updateRepoSelect() {
        if (!repoFilterSelect) return;
        const currentVal = repoFilterSelect.value;
        repoFilterSelect.innerHTML = '<option value="all">Tüm Depolar</option>';
        
        allRepos.forEach(repo => {
            const opt = document.createElement('option');
            opt.value = repo.name;
            opt.textContent = repo.name;
            repoFilterSelect.appendChild(opt);
        });

        if (currentVal) repoFilterSelect.value = currentVal;

        // Yükleme formundaki hedef depo seçimini de doldur
        const uploadTargetRepo = document.getElementById('uploadTargetRepo');
        if (uploadTargetRepo) {
            const currentUploadVal = uploadTargetRepo.value;
            uploadTargetRepo.innerHTML = '';
            allRepos.forEach(repo => {
                const opt = document.createElement('option');
                opt.value = repo.name;
                opt.textContent = `${repo.name} (${repo.distribution || 'bookworm'})`;
                uploadTargetRepo.appendChild(opt);
            });
            if (currentUploadVal) uploadTargetRepo.value = currentUploadVal;
        }
    }

    // Paket Yükleme Sekmesinde Son Paketleri Göster
    function renderRecentUploads() {
        const tbody = document.getElementById('recentUploadsTableBody');
        const badge = document.getElementById('uploadedPackagesCountBadge');
        if (!tbody) return;
        if (!allPackages || allPackages.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 1.5rem;">Henüz kayıtlı paket yok.</td></tr>`;
            return;
        }
        if (badge) badge.textContent = `${allPackages.length} Paket Yayında`;
        
        tbody.innerHTML = allPackages.slice(0, 10).map(pkg => `
            <tr>
                <td><strong style="color: #fff; font-family: var(--font-mono); font-size: 0.9rem;">${escapeHtml(pkg.name)}</strong></td>
                <td><span class="badge badge-primary" style="font-size: 0.72rem;">${escapeHtml(pkg.version || '1.0.0')}</span></td>
                <td><span class="badge badge-secondary" style="font-size: 0.72rem;">${escapeHtml(pkg.architecture || 'all')}</span></td>
                <td style="color: var(--text-secondary); font-size: 0.82rem;">${escapeHtml(pkg.section || 'main')} / ${escapeHtml(pkg.repo || '0.1')}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem; color: #94a3b8;">${formatBytes(Number(pkg.size) || 25000)}</td>
                <td><span class="badge badge-emerald" style="font-size: 0.72rem;">✓ Yayında</span></td>
            </tr>
        `).join('');
    }

    // Webhook Bildirimleri Canlı Olay Akışı
    const webhookDeliveryEvents = [
        { platform: 'Discord', channel: '#duyurular', event: 'Yeni paket yayınlandı: pars-setup v1.0.0-1 (all)', status: '200 OK', time: '12 dakika önce', icon: '🎮', color: '#5865F2' },
        { platform: 'Telegram', channel: '@parslinux_updates', event: 'Depo güncellemesi: parslinux-menus v2026.1 eklendi', status: '200 OK', time: '38 dakika önce', icon: '✈️', color: '#24A1DE' },
        { platform: 'Slack', channel: '#repo-ci', event: 'CI/CD Pipeline tamamlandı: parslinux-theme v1.0.0', status: '200 OK', time: '1 saat önce', icon: '💼', color: '#E01E5A' },
        { platform: 'Discord', channel: '#duyurular', event: 'GPG doğrulama anahtarı kontrol edildi: RFC 9580 WKD aktif', status: '200 OK', time: '3 saat önce', icon: '🎮', color: '#5865F2' }
    ];

    function renderWebhookEvents() {
        const container = document.getElementById('webhookEventsFeed');
        if (!container) return;
        container.innerHTML = webhookDeliveryEvents.map(ev => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem 1.1rem; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                        ${ev.icon}
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: #fff;">${escapeHtml(ev.event)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 0.5rem; align-items: center; margin-top: 0.2rem;">
                            <span style="color: ${ev.color}; font-weight: 600;">${escapeHtml(ev.platform)}</span>
                            <span>•</span>
                            <span>${escapeHtml(ev.channel)}</span>
                            <span>•</span>
                            <span>${escapeHtml(ev.time)}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <span class="badge badge-emerald" style="font-size: 0.75rem;">✓ ${escapeHtml(ev.status)}</span>
                </div>
            </div>
        `).join('');
    }

    // 5. Paket Kartlarını Ekrana Bas
    function renderPackages() {
        if (!packagesGrid) return;

        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const selectedRepo = repoFilterSelect ? repoFilterSelect.value : 'all';
        const selectedSort = sortSelect ? sortSelect.value : 'name-asc';

        if (btnSearchClear) {
            btnSearchClear.style.display = query ? 'flex' : 'none';
        }

        let filtered = allPackages.filter(pkg => {
            const matchQuery = !query || 
                pkg.name.toLowerCase().includes(query) || 
                (pkg.description && pkg.description.toLowerCase().includes(query)) ||
                (pkg.architecture && pkg.architecture.toLowerCase().includes(query));

            const matchRepo = selectedRepo === 'all' || pkg.repo === selectedRepo;

            let matchArch = true;
            if (currentArchFilter === 'all-arch') {
                matchArch = (pkg.architecture === 'all');
            } else if (currentArchFilter !== 'all') {
                matchArch = (pkg.architecture === currentArchFilter);
            }

            return matchQuery && matchRepo && matchArch;
        });

        // Sıralama Mantığı
        filtered.sort((a, b) => {
            if (selectedSort === 'name-asc') {
                return a.name.localeCompare(b.name);
            } else if (selectedSort === 'name-desc') {
                return b.name.localeCompare(a.name);
            } else if (selectedSort === 'downloads-desc') {
                const da = (downloadMetrics.top_packages || []).find(p => p.name === a.name)?.downloads || 0;
                const db = (downloadMetrics.top_packages || []).find(p => p.name === b.name)?.downloads || 0;
                return db - da;
            } else if (selectedSort === 'size-desc') {
                return (b.size || 0) - (a.size || 0);
            } else if (selectedSort === 'size-asc') {
                return (a.size || 0) - (b.size || 0);
            }
            return 0;
        });

        if (packageResultsCount) {
            packageResultsCount.textContent = `${filtered.length} Paket`;
        }

        if (filtered.length === 0) {
            packagesGrid.innerHTML = `
                <div class="loading-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <p>Aramanızla eşleşen paket bulunamadı.</p>
                </div>
            `;
            return;
        }

        packagesGrid.innerHTML = filtered.map(pkg => {
            const pm = (downloadMetrics.top_packages || []).find(p => p.name === pkg.name);
            const dlBadge = (pm && pm.downloads > 0) ? `<span>•</span><span style="color: #38bdf8; font-weight: 600;" title="${pm.downloads} kez indirildi">📥 ${pm.downloads}</span>` : '';
            const debUrl = pkg.filename ? ('/' + pkg.filename.replace(/^\/+/, '')) : '#';
            return `
            <div class="package-card" data-pkg="${encodeURIComponent(JSON.stringify(pkg))}">
                <div>
                    <div class="package-header">
                        <h4 class="package-title">${escapeHtml(pkg.name)}</h4>
                        <span class="badge badge-primary">v${escapeHtml(pkg.version)}</span>
                    </div>
                    <p class="package-desc">${escapeHtml(pkg.description || 'Açıklama bulunmuyor.')}</p>
                </div>

                <div>
                    <div class="package-meta">
                        <span class="badge badge-emerald">${escapeHtml(pkg.architecture || 'amd64')}</span>
                        <span>•</span>
                        <span>${formatBytes(pkg.size)}</span>
                        <span>•</span>
                        <span>${escapeHtml(pkg.repo || 'main')}</span>
                        ${dlBadge}
                    </div>

                    <div class="package-actions">
                        <a href="${debUrl}" download class="btn btn-primary btn-sm btn-deb-dl" title="${escapeHtml(pkg.name)} .deb paket dosyasını indir">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>.deb İndir</span>
                        </a>

                        <button class="btn btn-secondary btn-sm btn-details" data-pkgname="${escapeHtml(pkg.name)}" title="Paket detaylarını görüntüle">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span>Detaylar</span>
                        </button>

                        <button class="btn btn-secondary btn-sm btn-install" data-pkgname="${escapeHtml(pkg.name)}" title="Kurulum komutunu kopyala">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>apt install</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Kart içi buton dinleyicileri
        packagesGrid.querySelectorAll('.btn-deb-dl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        packagesGrid.querySelectorAll('.btn-install').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pkgName = btn.getAttribute('data-pkgname');
                copyToClipboard(`sudo apt install ${pkgName}`, `'sudo apt install ${pkgName}' kopyalandı!`);
            });
        });

        packagesGrid.querySelectorAll('.btn-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.package-card');
                const pkgData = JSON.parse(decodeURIComponent(card.getAttribute('data-pkg')));
                openPackageModal(pkgData);
            });
        });
    }

    // 6. Depo Mimarisi Sekmesini Bas
    function renderRepoArchitecture() {
        const container = document.getElementById('repoTreeContainer');
        if (!container) return;

        if (allRepos.length === 0) {
            container.innerHTML = '<p class="text-muted">Henüz tanımlı depo yok.</p>';
            return;
        }

        container.innerHTML = allRepos.map(repo => `
            <div class="repo-block">
                <div class="repo-block-header">
                    <span class="repo-block-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                        </svg>
                        ${escapeHtml(repo.name)}
                    </span>
                    <span class="badge badge-emerald">Aktif</span>
                </div>
                <div class="modal-detail-row">
                    <span class="modal-detail-label">Dağıtım (Distribution):</span>
                    <span class="modal-detail-val">${escapeHtml(repo.distribution || 'bookworm')}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="modal-detail-label">Bileşen (Component):</span>
                    <span class="modal-detail-val">${escapeHtml(repo.component || 'main')}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="modal-detail-label">Açıklama:</span>
                    <span class="modal-detail-val">${escapeHtml(repo.comment || '-')}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="modal-detail-label">Paket Sayısı:</span>
                    <span class="modal-detail-val">${repo.packages ? repo.packages.length : 0} paket</span>
                </div>
            </div>
        `).join('');
    }

    // 7. Paket Detay Modalı
    function openPackageModal(pkg) {
        modalPkgName.textContent = pkg.name;
        modalPkgVersion.textContent = `v${pkg.version}`;
        
        const pm = (downloadMetrics.top_packages || []).find(p => p.name === pkg.name);
        const dlCount = pm ? pm.downloads : 0;
        const dlBytes = pm ? formatBytes(pm.bytes) : '0 B';

        modalPkgBody.innerHTML = `
            <div class="modal-detail-row">
                <span class="modal-detail-label">Paket:</span>
                <span class="modal-detail-val">${escapeHtml(pkg.name)}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Sürüm:</span>
                <span class="modal-detail-val">${escapeHtml(pkg.version)}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Mimari:</span>
                <span class="modal-detail-val">${escapeHtml(pkg.architecture || 'amd64')}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Dosya Boyutu:</span>
                <span class="modal-detail-val">${formatBytes(pkg.size)}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Toplam İndirme:</span>
                <span class="modal-detail-val" style="color: #38bdf8; font-weight: 600;">📥 ${dlCount} indirme (${dlBytes})</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Geliştirici / Bakımcı:</span>
                <span class="modal-detail-val">${escapeHtml(pkg.maintainer || 'Bilinmiyor')}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Havuzdaki Yolu:</span>
                <span class="modal-detail-val" style="word-break: break-all;">${escapeHtml(pkg.filename || '-')}</span>
            </div>
            <div style="margin-top: 1.25rem;">
                <span class="modal-detail-label" style="display: block; margin-bottom: 0.4rem;">Açıklama:</span>
                <p style="color: var(--text-primary); line-height: 1.6;">${escapeHtml(pkg.description || 'Detaylı açıklama bulunmuyor.')}</p>
            </div>
        `;

        if (pkg.filename) {
            modalDownloadBtn.href = `/${pkg.filename}`;
            modalDownloadBtn.style.display = 'inline-flex';
        } else {
            modalDownloadBtn.style.display = 'none';
        }

        // Modal sekmesini varsayılan olarak Genel görünümüne al
        switchModalTab('modalViewOverview');

        // Bağımlılık Ağacı Görselleştiriciyi Çalıştır
        renderDependencyVisualizer(pkg);

        // Paket İçi Dosya Gezgini ve Control İncelemesini Tetikle
        inspectPackageContents(pkg);

        packageModal.classList.add('active');
    }

    function switchModalTab(targetViewId) {
        modalSubnavBtns.forEach(btn => {
            const isTarget = btn.getAttribute('data-modaltab') === targetViewId;
            btn.classList.toggle('active', isTarget);
        });
        modalViews.forEach(v => {
            if (v.id === targetViewId) {
                v.style.display = 'block';
                v.classList.add('active');
            } else {
                v.style.display = 'none';
                v.classList.remove('active');
            }
        });
    }

    function inspectPackageContents(pkg) {
        if (modalFilesCountBadge) modalFilesCountBadge.textContent = '...';
        if (modalFilesSizeBadge) modalFilesSizeBadge.textContent = formatBytes(pkg.size);
        if (modalFilesTreeList) modalFilesTreeList.innerHTML = `<div class="text-center text-muted" style="padding: 2.5rem;">Dosyalar ayrıştırılıyor...</div>`;
        if (modalControlRaw) modalControlRaw.textContent = 'Control dosyası taranıyor...';
        currentInspectedFiles = [];
        if (modalFileSearchInput) modalFileSearchInput.value = '';

        fetch(`/api/package/inspect?name=${encodeURIComponent(pkg.name)}&version=${encodeURIComponent(pkg.version || '')}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (modalFilesCountBadge) modalFilesCountBadge.textContent = (data.files || []).length;
                    if (modalFilesSizeBadge) modalFilesSizeBadge.textContent = formatBytes(data.size);
                    currentInspectedFiles = data.files || [];
                    renderModalFilesList(currentInspectedFiles);
                    if (modalControlRaw) modalControlRaw.textContent = data.control || 'Control dosyası boş.';
                } else {
                    if (modalFilesCountBadge) modalFilesCountBadge.textContent = '0';
                    if (modalFilesTreeList) modalFilesTreeList.innerHTML = `<div class="text-center text-muted" style="padding: 2.5rem;">${escapeHtml(data.error || 'Dosyalar okunamadı.')}</div>`;
                    if (modalControlRaw) modalControlRaw.textContent = data.error || 'Control metni okunamadı.';
                }
            })
            .catch(err => {
                if (modalFilesCountBadge) modalFilesCountBadge.textContent = '0';
                if (modalFilesTreeList) modalFilesTreeList.innerHTML = `<div class="text-center text-muted" style="padding: 2.5rem;">Hata: ${escapeHtml(err.message)}</div>`;
                if (modalControlRaw) modalControlRaw.textContent = 'Bağlantı hatası: ' + err.message;
            });
    }

    function renderModalFilesList(files) {
        if (!modalFilesTreeList) return;
        const q = (modalFileSearchInput ? modalFileSearchInput.value : '').toLowerCase().trim();
        const filtered = q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;
        if (filtered.length === 0) {
            modalFilesTreeList.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">Eşleşen dosya bulunamadı.</div>`;
            return;
        }

        modalFilesTreeList.innerHTML = filtered.map(f => {
            const isDir = f.isdir || f.name.endsWith('/');
            const icon = isDir ? '📁' : '📄';
            const sizeStr = isDir ? '-' : formatBytes(f.size);
            return `
                <div class="pkg-file-row">
                    <div class="pkg-file-left" title="${escapeHtml(f.name)}">
                        <span class="pkg-file-icon">${icon}</span>
                        <span class="pkg-file-name ${isDir ? 'is-dir' : ''}">${escapeHtml(f.name)}</span>
                    </div>
                    <div class="pkg-file-right">
                        <span>${escapeHtml(f.mode || '-')}</span>
                        <span>•</span>
                        <span style="font-weight: 600; color: #a5b4fc;">${sizeStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDependencyVisualizer(pkg) {
        const container = document.getElementById('modalDepTreeContent');
        const summaryBadge = document.getElementById('modalDepSummary');
        if (!container) return;

        const depCategories = [
            { key: 'depends', title: 'Zorunlu Bağımlılıklar (Depends)', class: 'group-depends', badge: 'Zorunlu', color: '#ef4444' },
            { key: 'pre_depends', title: 'Ön-Kurulum (Pre-Depends)', class: 'group-pre_depends', badge: 'Pre-Depends', color: '#f59e0b' },
            { key: 'recommends', title: 'Tavsiye Edilenler (Recommends)', class: 'group-recommends', badge: 'Tavsiye', color: '#10b981' },
            { key: 'suggests', title: 'Önerilenler (Suggests)', class: 'group-suggests', badge: 'Öneri', color: '#06b6d4' },
            { key: 'conflicts', title: 'Çakışmalar (Conflicts/Breaks)', class: 'group-conflicts', badge: 'Çakışma', color: '#9333ea' }
        ];

        let totalDepsCount = 0;
        let htmlBlocks = [];

        depCategories.forEach(cat => {
            const raw = pkg[cat.key];
            if (!raw) return;

            const items = raw.split(',').map(s => s.trim()).filter(Boolean);
            if (items.length === 0) return;

            totalDepsCount += items.length;

            const nodesHtml = items.map(item => {
                const baseName = item.split(/[ (|]/)[0].trim();
                const inRepo = allPackages.some(p => p.name === baseName);

                return `
                    <div class="dep-node-card ${inRepo ? 'clickable' : ''}" data-pkg-name="${escapeHtml(baseName)}" title="${inRepo ? 'Bu paket depomuzda mevcut! Tıklayarak inceleyin.' : 'Debian / Ubuntu taban deposundan sağlanır.'}">
                        <span style="font-weight: 600;">${escapeHtml(item)}</span>
                        ${inRepo 
                            ? '<span class="dep-status-tag in-repo">✓ Depoda Mevcut</span>' 
                            : '<span class="dep-status-tag system-base">Debian Tabanı</span>'}
                    </div>
                `;
            }).join('');

            htmlBlocks.push(`
                <div class="dep-group ${cat.class}">
                    <div class="dep-group-header">
                        <span class="dep-group-title" style="color: ${cat.color};">
                            ${cat.title}
                        </span>
                        <span class="badge" style="background: rgba(255,255,255,0.06); color: #fff; font-size: 0.72rem;">${items.length} adet</span>
                    </div>
                    <div class="dep-nodes-list">
                        ${nodesHtml}
                    </div>
                </div>
            `);
        });

        if (totalDepsCount === 0) {
            summaryBadge.textContent = 'Bağımsız (Self-Contained)';
            summaryBadge.className = 'badge badge-emerald';
            container.innerHTML = `
                <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: 10px; padding: 1.25rem; text-align: center; color: var(--text-secondary); font-size: 0.88rem;">
                    🛡️ Bu paketin harici bir paket bağımlılığı bulunmuyor veya tek başına çalışabilir.
                </div>
            `;
        } else {
            summaryBadge.textContent = `${totalDepsCount} Bağımlılık Tanımlı`;
            summaryBadge.className = 'badge badge-primary';
            container.innerHTML = htmlBlocks.join('');

            container.querySelectorAll('.dep-node-card.clickable').forEach(node => {
                node.addEventListener('click', () => {
                    const targetName = node.getAttribute('data-pkg-name');
                    const found = allPackages.find(p => p.name === targetName);
                    if (found) {
                        openPackageModal(found);
                    }
                });
            });
        }
    }

    function closePackageModal() {
        packageModal.classList.remove('active');
    }

    modalCloseBtn.addEventListener('click', closePackageModal);
    modalCloseFooterBtn.addEventListener('click', closePackageModal);
    packageModal.addEventListener('click', (e) => {
        if (e.target === packageModal) closePackageModal();
    });

    // 8. Kopyalama ve Bildirim (Toast)
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-copy');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                copyToClipboard(targetEl.textContent.trim(), 'Komut panoya kopyalandı!');
            }
        });
    });

    function copyToClipboard(text, message = 'Kopyalandı!') {
        navigator.clipboard.writeText(text).then(() => {
            showToast(message);
        }).catch(err => {
            console.error('Kopyalama hatası:', err);
        });
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${escapeHtml(message)}</span>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // 9. Arama, Mimari ve Sıralama Dinleyicileri
    if (searchInput) searchInput.addEventListener('input', renderPackages);
    if (btnSearchClear) {
        btnSearchClear.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            btnSearchClear.style.display = 'none';
            renderPackages();
            if (searchInput) searchInput.focus();
        });
    }
    if (repoFilterSelect) repoFilterSelect.addEventListener('change', renderPackages);
    if (sortSelect) sortSelect.addEventListener('change', renderPackages);

    archFilterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            archFilterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentArchFilter = pill.getAttribute('data-arch') || 'all';
            renderPackages();
        });
    });

    // Modal Subnav Sekme Değişimi
    modalSubnavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-modaltab');
            if (targetId) switchModalTab(targetId);
        });
    });

    if (modalFileSearchInput) {
        modalFileSearchInput.addEventListener('input', () => {
            renderModalFilesList(currentInspectedFiles);
        });
    }

    if (btnCopyControlText) {
        btnCopyControlText.addEventListener('click', () => {
            const txt = modalControlRaw ? modalControlRaw.textContent : '';
            copyToClipboard(txt, 'Debian control metni panoya kopyalandı!');
        });
    }

    // REST API Güvenlik ve Token Yönetimi
    async function loadAuthStatus() {
        if (!apiStatusNavLabel) return;
        try {
            const res = await fetch('/api/auth/status');
            if (res.ok) {
                const data = await res.json();
                if (data.enabled) {
                    const savedToken = localStorage.getItem('apt_repo_api_token');
                    if (savedToken) {
                        apiStatusNavLabel.textContent = '🔒 Yetkili';
                        btnApiSettings.className = 'btn btn-primary btn-sm';
                    } else {
                        apiStatusNavLabel.textContent = '⚠️ Token Gerekli';
                        btnApiSettings.className = 'btn btn-secondary btn-sm';
                    }
                } else {
                    apiStatusNavLabel.textContent = 'API Açık';
                    btnApiSettings.className = 'btn btn-secondary btn-sm';
                }
            }
        } catch {
            apiStatusNavLabel.textContent = 'API';
        }
    }

    if (btnApiSettings && apiTokenModal) {
        btnApiSettings.addEventListener('click', () => {
            if (inputApiToken) {
                inputApiToken.value = localStorage.getItem('apt_repo_api_token') || '';
            }
            if (apiTokenTestResult) apiTokenTestResult.style.display = 'none';
            apiTokenModal.classList.add('active');
        });
    }

    if (modalApiCloseBtn && apiTokenModal) {
        modalApiCloseBtn.addEventListener('click', () => apiTokenModal.classList.remove('active'));
    }

    if (apiTokenModal) {
        apiTokenModal.addEventListener('click', (e) => {
            if (e.target === apiTokenModal) apiTokenModal.classList.remove('active');
        });
    }

    if (btnSaveApiToken) {
        btnSaveApiToken.addEventListener('click', async () => {
            const token = inputApiToken ? inputApiToken.value.trim() : '';
            if (!token) {
                showToast('Lütfen geçerli bir token girin veya Kaldır seçeneğini kullanın.');
                return;
            }
            localStorage.setItem('apt_repo_api_token', token);
            try {
                const res = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': token }
                });
                const data = await res.json();
                if (apiTokenTestResult) {
                    apiTokenTestResult.style.display = 'block';
                    if (data.valid) {
                        apiTokenTestResult.style.background = 'rgba(16, 185, 129, 0.2)';
                        apiTokenTestResult.style.color = '#6ee7b7';
                        apiTokenTestResult.textContent = '✓ Token sunucu tarafından doğrulandı ve kaydedildi!';
                        showToast('API Token başarıyla doğrulandı!');
                    } else {
                        apiTokenTestResult.style.background = 'rgba(239, 68, 68, 0.2)';
                        apiTokenTestResult.style.color = '#fca5a5';
                        apiTokenTestResult.textContent = '✕ Token geçersiz veya sunucu ile uyuşmuyor.';
                        showToast('Uyarı: Sunucu bu tokeni kabul etmedi.');
                    }
                }
            } catch (err) {
                showToast('Doğrulama hatası: ' + err.message);
            }
            loadAuthStatus();
        });
    }

    if (btnClearApiToken) {
        btnClearApiToken.addEventListener('click', () => {
            localStorage.removeItem('apt_repo_api_token');
            if (inputApiToken) inputApiToken.value = '';
            if (apiTokenTestResult) {
                apiTokenTestResult.style.display = 'block';
                apiTokenTestResult.style.background = 'rgba(255, 255, 255, 0.05)';
                apiTokenTestResult.style.color = 'var(--text-muted)';
                apiTokenTestResult.textContent = 'API Token yerel hafızadan silindi.';
            }
            showToast('API Token silindi.');
            loadAuthStatus();
        });
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            btnRefresh.classList.add('loading');
            loadDashboardData().finally(() => {
                showToast('Veriler güncellendi');
                btnRefresh.classList.remove('loading');
            });
        });
    }

    // 10. Paket Yükleme (Drag & Drop ve File Input)
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadSelectedFiles = document.getElementById('uploadSelectedFiles');
    const selectedFilesList = document.getElementById('selectedFilesList');
    const btnSubmitUpload = document.getElementById('btnSubmitUpload');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const uploadTargetRepo = document.getElementById('uploadTargetRepo');

    let currentSelectedFiles = [];

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.deb'));
            if (files.length === 0) {
                showToast('Lütfen yalnızca .deb uzantılı paket seçin.');
                return;
            }
            handleFilesSelection(files);
        });

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files).filter(f => f.name.endsWith('.deb'));
            handleFilesSelection(files);
        });
    }

    function handleFilesSelection(files) {
        currentSelectedFiles = files;
        if (files.length === 0) {
            uploadSelectedFiles.style.display = 'none';
            return;
        }

        selectedFilesList.innerHTML = files.map(f => `
            <li class="selected-file-item">
                <span class="selected-file-name">${escapeHtml(f.name)}</span>
                <span class="selected-file-size">${formatBytes(f.size)}</span>
            </li>
        `).join('');

        uploadSelectedFiles.style.display = 'block';
        uploadProgressText.textContent = '';
    }

    if (btnSubmitUpload) {
        btnSubmitUpload.addEventListener('click', async () => {
            if (currentSelectedFiles.length === 0) return;

            const targetRepo = uploadTargetRepo ? uploadTargetRepo.value : 'demo-depo';
            const formData = new FormData();
            formData.append('repo', targetRepo);
            currentSelectedFiles.forEach(file => {
                formData.append('file', file);
            });

            btnSubmitUpload.disabled = true;
            btnSubmitUpload.classList.add('loading');
            uploadProgressText.textContent = 'Paketler yükleniyor ve yayın güncelleniyor...';

            try {
                const res = await fetch(`/api/upload?repo=${encodeURIComponent(targetRepo)}`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    showToast(data.message || 'Paketler başarıyla depoya eklendi!');
                    currentSelectedFiles = [];
                    uploadSelectedFiles.style.display = 'none';
                    if (fileInput) fileInput.value = '';
                    // Verileri otomatik yenile
                    await loadDashboardData();
                } else {
                    showToast('Hata: ' + (data.error || 'Bilinmeyen hata'));
                    uploadProgressText.textContent = 'Hata: ' + (data.error || 'Bilinmeyen hata');
                }
            } catch (err) {
                console.error('Yükleme hatası:', err);
                showToast('Sunucuya bağlanırken hata oluştu.');
                uploadProgressText.textContent = 'Bağlantı hatası!';
            } finally {
                btnSubmitUpload.disabled = false;
                btnSubmitUpload.classList.remove('loading');
            }
        });
    }

    // Yardımcı Fonksiyonlar
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatBytes(bytes) {
        if (!bytes || isNaN(bytes)) return 'Bilinmiyor';
        const b = parseInt(bytes, 10);
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // 9. Webhook Durumu ve Testi
    async function loadWebhookStatus() {
        const indicator = document.getElementById('webhookStatusIndicator');
        if (!indicator) return;

        try {
            const res = await fetch('/api/webhook/status');
            if (res.ok) {
                const data = await res.json();
                if (data.configured) {
                    indicator.textContent = '✅ Yapılandırıldı (.webhook.env)';
                    indicator.className = 'badge badge-emerald';
                } else {
                    indicator.textContent = '⚠️ Yapılandırılmadı (.webhook.env)';
                    indicator.className = 'badge badge-amber';
                }
            }
        } catch {
            indicator.textContent = 'Durum Alınamadı';
            indicator.className = 'badge badge-secondary';
        }
    }

    const btnSendWebhookTest = document.getElementById('btnSendWebhookTest');
    const webhookConsoleOutput = document.getElementById('webhookConsoleOutput');

    if (btnSendWebhookTest) {
        btnSendWebhookTest.addEventListener('click', async () => {
            btnSendWebhookTest.disabled = true;
            btnSendWebhookTest.innerHTML = '<span>Gönderiliyor...</span>';
            if (webhookConsoleOutput) {
                webhookConsoleOutput.style.display = 'block';
                webhookConsoleOutput.textContent = '>>> Webhook test işlemi başlatılıyor...\n';
            }

            try {
                const res = await fetch('/api/webhook/test', { method: 'POST' });
                const data = await res.json();
                if (webhookConsoleOutput) {
                    webhookConsoleOutput.textContent += (data.output || 'Çıktı alınamadı.') + '\n';
                    if (data.success) {
                        webhookConsoleOutput.textContent += '>>> [BAŞARILI] Webhook bildirimi başarıyla iletildi.';
                        showToast('Webhook bildirimi başarıyla iletildi!');
                    } else {
                        webhookConsoleOutput.textContent += '>>> [UYARI] Webhook kanalları yapılandırılmamış veya hata döndü.\nLütfen .webhook.env dosyasını kontrol edin.';
                        showToast('Webhook: .webhook.env dosyasını kontrol edin.');
                    }
                }
            } catch (err) {
                if (webhookConsoleOutput) {
                    webhookConsoleOutput.textContent += '>>> [HATA] İstek gönderilirken hata: ' + err.message;
                }
                showToast('Webhook sunucu bağlantı hatası!');
            } finally {
                btnSendWebhookTest.disabled = false;
                btnSendWebhookTest.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    <span>Test Bildirimi Gönder</span>
                `;
            }
        });
    }

    // 10. GPG WKD (Web Key Directory) Durumu
    async function loadWkdStatus() {
        const badge = document.getElementById('wkdStatusBadge');
        if (!badge) return;

        try {
            const res = await fetch('/api/wkd/status');
            if (res.ok) {
                const data = await res.json();
                if (data.enabled) {
                    badge.textContent = '✅ WKD Aktif (RFC 9580)';
                    badge.className = 'badge badge-emerald';
                    badge.title = `Domain: ${data.domain} | Hash: ${data.hashes['repo@parslinux.org'] || ''}`;
                } else {
                    badge.textContent = '⚠️ WKD Pasif';
                    badge.className = 'badge badge-amber';
                }
            } else {
                badge.textContent = 'WKD Bilinmiyor';
                badge.className = 'badge badge-secondary';
            }
        } catch {
            badge.textContent = 'WKD Bağlantı Yok';
            badge.className = 'badge badge-secondary';
        }
    }

    // 12. İndirme Analitiği ve Metrikleri Yükleme
    async function loadMetricsData() {
        try {
            const res = await fetch('/api/metrics').catch(() => null);
            if (!res || !res.ok) return;

            const data = await res.json();
            downloadMetrics = data;

            // 1. KPI Kartları
            if (metricTotalDownloads) {
                metricTotalDownloads.textContent = (data.total_downloads || 0).toLocaleString();
            }
            if (metricTotalBandwidth) {
                metricTotalBandwidth.textContent = formatBytes(data.total_bytes || 0);
            }
            if (metricTopPackage) {
                if (data.top_packages && data.top_packages.length > 0) {
                    const top = data.top_packages[0];
                    metricTopPackage.textContent = top.name;
                    metricTopPackageCount.textContent = `${top.downloads} indirme (${formatBytes(top.bytes)})`;
                } else {
                    metricTopPackage.textContent = '-';
                    metricTopPackageCount.textContent = 'Henüz indirme yok';
                }
            }
            if (metricLastDownload) {
                if (data.recent_events && data.recent_events.length > 0) {
                    const last = data.recent_events[0];
                    const timeOnly = last.timestamp.includes(' ') ? last.timestamp.split(' ')[1] : last.timestamp;
                    metricLastDownload.textContent = timeOnly;
                    metricLastPackage.textContent = `${last.package} (${last.client})`;
                } else {
                    metricLastDownload.textContent = '-';
                    metricLastPackage.textContent = '-';
                }
            }
            if (metricTrackedPkgsBadge) {
                const count = (data.top_packages || []).length;
                metricTrackedPkgsBadge.textContent = `${count} Takip Edilen Paket`;
            }

            // 2. Liderlik Tablosu
            if (metricsTableBody) {
                const topList = data.top_packages || [];
                if (topList.length === 0) {
                    metricsTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center text-muted" style="padding: 2.5rem;">
                                Henüz kayıtlı paket indirmesi bulunmuyor. Test etmek için aşağıdaki "Test İndirmesi Simüle Et" butonuna tıklayabilirsiniz.
                            </td>
                        </tr>
                    `;
                } else {
                    const totalDl = data.total_downloads || 1;
                    metricsTableBody.innerHTML = topList.map((p, idx) => {
                        const rank = idx + 1;
                        let rankClass = 'rank-other';
                        if (rank === 1) rankClass = 'rank-1';
                        else if (rank === 2) rankClass = 'rank-2';
                        else if (rank === 3) rankClass = 'rank-3';

                        const pct = ((p.downloads / totalDl) * 100).toFixed(1);

                        return `
                            <tr>
                                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                                <td>
                                    <strong style="color: #fff; font-family: var(--font-mono); font-size: 0.92rem;">${escapeHtml(p.name)}</strong>
                                </td>
                                <td>
                                    <span class="badge badge-primary" style="font-size: 0.72rem;">${escapeHtml(p.version || '-')}</span>
                                </td>
                                <td>
                                    <span style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${p.downloads}</span>
                                </td>
                                <td class="popularity-cell">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                                        <span>%${pct}</span>
                                    </div>
                                    <div class="popularity-bar-container">
                                        <div class="popularity-bar-fill" style="width: ${pct}%;"></div>
                                    </div>
                                </td>
                                <td style="font-size: 0.8rem; color: var(--text-secondary); font-family: var(--font-mono);">
                                    ${formatBytes(p.bytes)}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // 3. Canlı İndirme Günlüğü (Feed)
            if (metricsFeed) {
                const events = data.recent_events || [];
                if (events.length === 0) {
                    metricsFeed.innerHTML = `
                        <div class="text-center text-muted" style="padding: 3rem 1rem;">
                            İstemcilerden (APT, browser, cURL) gelen indirme istekleri burada canlı listelenir.
                        </div>
                    `;
                } else {
                    metricsFeed.innerHTML = events.map(ev => `
                        <div class="feed-item">
                            <div class="feed-left">
                                <span class="feed-pkg">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #38bdf8;">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    ${escapeHtml(ev.package)}
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;">v${escapeHtml(ev.version)}</span>
                                </span>
                                <span class="feed-meta">
                                    <span>${escapeHtml(ev.timestamp)}</span>
                                    <span>•</span>
                                    <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                                        <span>${escapeHtml(ev.flag || '🌐')}</span>
                                        <span>${escapeHtml(ev.city || 'Bilinmiyor')}</span>
                                    </span>
                                    <span>•</span>
                                    <span>${escapeHtml(ev.ip)}</span>
                                    <span>•</span>
                                    <span>${formatBytes(ev.size)}</span>
                                </span>
                            </div>
                            <span class="feed-client-badge">${escapeHtml(ev.client)}</span>
                        </div>
                    `).join('');
                }
            }

            // 4. Coğrafi Dağılımı (GeoIP) Render Et
            renderGeoAnalytics(data);

            // 5. Zaman Serisi Grafiğini Render Et
            renderDownloadTrendsChart(data);
        } catch (err) {
            console.error('Metrik yükleme hatası:', err);
        }
    }

    // 12.1 Coğrafi Dağılım (GeoIP) Görselleştirici
    function renderGeoAnalytics(data) {
        const countriesList = document.getElementById('geoCountriesList');
        const citiesList = document.getElementById('geoCitiesList');
        const totalCountriesBadge = document.getElementById('geoTotalCountriesBadge');
        const topRegionBadge = document.getElementById('geoTopRegionBadge');

        const geoDist = data.geo_distribution || {};
        const cityDist = data.city_distribution || {};
        const countries = Object.entries(geoDist);

        if (totalCountriesBadge) {
            totalCountriesBadge.textContent = `${countries.length} Ülke`;
        }

        if (countries.length === 0) {
            if (countriesList) countriesList.innerHTML = '<div class="text-center text-muted" style="padding: 1.5rem 1rem;">Henüz coğrafi indirme verisi bulunmuyor.</div>';
            if (citiesList) citiesList.innerHTML = '<div class="text-center text-muted" style="width: 100%; padding: 1.5rem 1rem;">İstek geldikçe tespit edilen şehirler burada listelenir.</div>';
            if (topRegionBadge) topRegionBadge.textContent = 'Lider: -';
            return;
        }

        // En çok indiren ülkeye göre sırala
        countries.sort((a, b) => b[1].count - a[1].count);
        const topCountry = countries[0];
        if (topRegionBadge) {
            topRegionBadge.textContent = `Lider: ${topCountry[1].flag || ''} ${topCountry[0]}`;
        }

        const totalDl = data.total_downloads || 1;

        if (countriesList) {
            countriesList.innerHTML = countries.map(([cName, info]) => {
                const count = info.count || 0;
                const pct = ((count / totalDl) * 100).toFixed(1);
                return `
                    <div class="geo-country-row" style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem;">
                            <span style="display: flex; align-items: center; gap: 0.5rem; color: #fff; font-weight: 500;">
                                <span style="font-size: 1.15rem;">${escapeHtml(info.flag || '🌐')}</span>
                                <span>${escapeHtml(cName)}</span>
                                <span style="font-size: 0.72rem; color: var(--text-secondary); background: rgba(255,255,255,0.06); padding: 0.1rem 0.4rem; border-radius: 4px;">${escapeHtml(info.code || '')}</span>
                            </span>
                            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">
                                <b style="color: #38bdf8;">${count}</b> indirme (${pct}%)
                            </span>
                        </div>
                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #6366f1, #38bdf8); border-radius: 999px; transition: width 0.4s ease;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (citiesList) {
            const cities = Object.entries(cityDist);
            cities.sort((a, b) => b[1] - a[1]);
            citiesList.innerHTML = cities.map(([cityKey, cCount]) => `
                <div style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); color: #cbd5e1; padding: 0.3rem 0.65rem; border-radius: 20px; font-size: 0.8rem;">
                    <span>${escapeHtml(cityKey)}</span>
                    <span style="background: var(--primary); color: #fff; font-size: 0.72rem; padding: 0.1rem 0.4rem; border-radius: 10px; font-weight: 600;">${cCount}</span>
                </div>
            `).join('');
        }
    }

    // 13. Zaman Serisi SVG Trend Grafiği Oluşturucu
    function renderDownloadTrendsChart(data) {
        const svg = document.getElementById('downloadTrendsSvg');
        const gridGroup = document.getElementById('chartGridGroup');
        const areaPath = document.getElementById('chartAreaPath');
        const linePath = document.getElementById('chartLinePath');
        const dotsGroup = document.getElementById('chartDotsGroup');
        const labelsGroup = document.getElementById('chartLabelsGroup');
        const tooltip = document.getElementById('chartTooltip');
        const totalPeriodEl = document.getElementById('chartTotalPeriod');
        const container = document.getElementById('metricsChartContainer');

        if (!svg || !gridGroup || !areaPath || !linePath || !dotsGroup || !labelsGroup) return;

        // Son 7 günü oluştur
        const days = [];
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const dailyTrends = data.daily_trends || {};
        let periodSum = 0;

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
            const count = dailyTrends[iso] || 0;
            periodSum += count;
            days.push({ iso, label, count });
        }

        if (totalPeriodEl) {
            totalPeriodEl.textContent = `${periodSum.toLocaleString()} İndirme`;
        }

        // Boyutlar ve Koordinatlar
        const svgWidth = 800;
        const svgHeight = 200;
        const padLeft = 55;
        const padRight = 30;
        const padTop = 30;
        const padBottom = 35;

        const chartWidth = svgWidth - padLeft - padRight;
        const chartHeight = svgHeight - padTop - padBottom;

        const maxVal = Math.max(...days.map(d => d.count), 5);
        const niceMax = Math.ceil(maxVal * 1.25);

        // Grid ve Y ekseni etiketleri
        const gridSteps = 3;
        let gridHtml = '';
        for (let s = 0; s <= gridSteps; s++) {
            const ratio = s / gridSteps;
            const y = padTop + chartHeight - (ratio * chartHeight);
            const val = Math.round(ratio * niceMax);

            gridHtml += `
                <line class="chart-grid-line" x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}"/>
                <text class="chart-y-label" x="${padLeft - 12}" y="${y + 4}">${val}</text>
            `;
        }
        gridGroup.innerHTML = gridHtml;

        // Nokta hesaplama
        const points = days.map((day, idx) => {
            const x = padLeft + (idx / (days.length - 1)) * chartWidth;
            const y = padTop + chartHeight - (day.count / niceMax) * chartHeight;
            return { x, y, ...day };
        });

        // Çizgi ve Alan Yolları (SVG path)
        if (points.length > 0) {
            const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            linePath.setAttribute('d', lineD);

            const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${padTop + chartHeight} L ${points[0].x.toFixed(1)} ${padTop + chartHeight} Z`;
            areaPath.setAttribute('d', areaD);
        }

        // Noktalar ve X ekseni etiketleri
        let dotsHtml = '';
        let labelsHtml = '';

        points.forEach((p) => {
            dotsHtml += `
                <circle class="chart-dot" 
                        cx="${p.x.toFixed(1)}" 
                        cy="${p.y.toFixed(1)}" 
                        data-label="${p.label}" 
                        data-count="${p.count}"
                        data-iso="${p.iso}">
                </circle>
            `;

            labelsHtml += `
                <text class="chart-axis-label" x="${p.x.toFixed(1)}" y="${svgHeight - 10}">${p.label}</text>
            `;
        });

        dotsGroup.innerHTML = dotsHtml;
        labelsGroup.innerHTML = labelsHtml;

        // Tooltip Etkileşimi
        const dots = dotsGroup.querySelectorAll('.chart-dot');
        dots.forEach(dot => {
            dot.addEventListener('mouseenter', () => {
                const label = dot.getAttribute('data-label');
                const count = dot.getAttribute('data-count');
                const iso = dot.getAttribute('data-iso');
                if (tooltip && container) {
                    tooltip.innerHTML = `
                        <div class="chart-tooltip-date">${label} (${iso})</div>
                        <div class="chart-tooltip-val">📥 ${count} İndirme</div>
                    `;
                    tooltip.style.display = 'block';

                    const rect = container.getBoundingClientRect();
                    const dotRect = dot.getBoundingClientRect();
                    const left = dotRect.left - rect.left + (dotRect.width / 2);
                    const top = dotRect.top - rect.top;

                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                }
            });

            dot.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none';
            });
        });
    }

    // Buton Dinleyicileri (Metrikler)
    if (btnRefreshMetrics) {
        btnRefreshMetrics.addEventListener('click', async () => {
            btnRefreshMetrics.classList.add('loading');
            await loadMetricsData();
            setTimeout(() => btnRefreshMetrics.classList.remove('loading'), 400);
            showToast('Metrikler güncellendi');
        });
    }

    if (btnSimulateDownload) {
        btnSimulateDownload.addEventListener('click', async () => {
            btnSimulateDownload.disabled = true;
            try {
                // Rastgele bir paket seç
                const targetPkg = allPackages.length > 0 
                    ? allPackages[Math.floor(Math.random() * allPackages.length)]
                    : { name: 'pars-setup', version: '1.0.0', size: 307200 };

                const res = await fetch('/api/metrics/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        package: targetPkg.name,
                        version: targetPkg.version,
                        size: parseInt(targetPkg.size) || 153600
                    })
                });

                if (res.ok) {
                    showToast(`'${targetPkg.name}' için indirme simüle edildi!`);
                    await loadMetricsData();
                    renderPackages();
                } else {
                    showToast('Simülasyon başarısız oldu.');
                }
            } catch (err) {
                showToast('Hata: ' + err.message);
            } finally {
                btnSimulateDownload.disabled = false;
            }
        });
    }

    if (btnResetMetrics) {
        btnResetMetrics.addEventListener('click', async () => {
            if (!confirm('Tüm indirme sayaçlarını ve log geçmişini sıfırlamak istediğinize emin misiniz?')) {
                return;
            }
            try {
                const res = await fetch('/api/metrics/reset', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Tüm indirme metrikleri sıfırlandı.');
                    await loadMetricsData();
                    renderPackages();
                } else {
                    showToast('Hata: ' + (data.error || 'Sıfırlama başarısız'));
                }
            } catch (err) {
                showToast('Sıfırlama hatası: ' + err.message);
            }
        });
    }

    // =========================================================================
    // 12. Snapshot (Anlık Görüntü) ve Rollback Yönetimi
    // =========================================================================
    let allSnapshots = [];
    let currentRollbackSnapshot = null;

    const snapshotsContainer = document.getElementById('snapshotsContainer');
    const btnRefreshSnapshots = document.getElementById('btnRefreshSnapshots');
    const btnOpenCreateSnapshotModal = document.getElementById('btnOpenCreateSnapshotModal');
    const snapshotCreateModal = document.getElementById('snapshotCreateModal');
    const modalSnapCreateCloseBtn = document.getElementById('modalSnapCreateCloseBtn');
    const modalSnapCreateCancelBtn = document.getElementById('modalSnapCreateCancelBtn');
    const btnSubmitCreateSnapshot = document.getElementById('btnSubmitCreateSnapshot');
    const snapCreateRepoSelect = document.getElementById('snapCreateRepoSelect');
    const snapCreateNameInput = document.getElementById('snapCreateNameInput');
    const snapCreateDescInput = document.getElementById('snapCreateDescInput');

    const snapshotRollbackModal = document.getElementById('snapshotRollbackModal');
    const modalSnapRollbackCloseBtn = document.getElementById('modalSnapRollbackCloseBtn');
    const modalSnapRollbackCancelBtn = document.getElementById('modalSnapRollbackCancelBtn');
    const btnSubmitRollback = document.getElementById('btnSubmitRollback');
    const snapRollbackTargetName = document.getElementById('snapRollbackTargetName');
    const snapRollbackRepoSelect = document.getElementById('snapRollbackRepoSelect');
    const snapRollbackDistSelect = document.getElementById('snapRollbackDistSelect');

    async function loadSnapshotsData() {
        if (!snapshotsContainer) return;
        try {
            snapshotsContainer.innerHTML = '<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2.5rem;">Snapshot listesi taranıyor...</div>';
            const res = await fetch('/api/snapshots');
            const data = await res.json();
            allSnapshots = data.snapshots || [];
            renderSnapshots(allSnapshots);
            populateDiffSelects();
        } catch (err) {
            snapshotsContainer.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2.5rem; color: #f87171;">Snapshot verisi alınamadı: ${escapeHtml(err.message)}</div>`;
        }
    }

    function renderSnapshots(snapshots) {
        if (!snapshotsContainer) return;
        if (!snapshots || snapshots.length === 0) {
            snapshotsContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem; text-align: center; background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 12px;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📸</div>
                    <h4 style="color: #fff; margin-bottom: 0.5rem;">Kayıtlı Snapshot Bulunmuyor</h4>
                    <p style="color: var(--text-muted); font-size: 0.88rem; max-width: 480px; margin: 0 auto 1.5rem auto;">
                        Deponuzun anlık durumunun değişmez bir kopyasını alarak sürüm güncellemeleri öncesinde sistemi güvenceye alabilirsiniz.
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('btnOpenCreateSnapshotModal').click()">İlk Snapshot'ı Al</button>
                </div>
            `;
            return;
        }

        snapshotsContainer.innerHTML = snapshots.map(snap => {
            const isAuto = snap.name.startsWith('auto-');
            const autoBadge = isAuto ? `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.72rem;">🤖 Otomatik Yedek</span>` : '';
            return `
            <div class="snapshot-card">
                <div>
                    <div class="snapshot-card-top">
                        <div class="snapshot-title" title="${escapeHtml(snap.name)}">${escapeHtml(snap.name)}</div>
                        <div style="display: flex; gap: 0.35rem; align-items: center;">
                            ${autoBadge}
                            <span class="badge badge-emerald">${snap.package_count || 0} Paket</span>
                        </div>
                    </div>
                    <div class="snapshot-meta-row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${escapeHtml(snap.created_at || 'Tarih bilinmiyor')}</span>
                    </div>
                    <div class="snapshot-desc" style="margin-top: 0.75rem;">
                        ${escapeHtml(snap.description || 'Snapshot açıklaması girilmemiş.')}
                    </div>
                </div>
                <div class="snapshot-actions">
                    <button class="btn btn-primary btn-sm" onclick="window.triggerSnapshotRollback('${escapeHtml(snap.name)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                        <span>Rollback</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.triggerSnapshotDiff('${escapeHtml(snap.name)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span>Diff</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="window.triggerSnapshotDrop('${escapeHtml(snap.name)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span>Sil</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.triggerSnapshotRollback = function(snapName) {
        currentRollbackSnapshot = snapName;
        if (snapRollbackTargetName) snapRollbackTargetName.textContent = snapName;
        if (snapshotRollbackModal) snapshotRollbackModal.classList.add('active');
    };

    window.triggerSnapshotDiff = function(snapName) {
        const diffTabBtn = document.getElementById('tabBtnDiff');
        if (diffTabBtn) diffTabBtn.click();
        const diffModeSnapBtn = document.getElementById('diffModeSnapBtn');
        if (diffModeSnapBtn) diffModeSnapBtn.click();
        if (diffSnap1Select) diffSnap1Select.value = snapName;
    };

    window.triggerSnapshotDrop = async function(snapName) {
        if (!confirm(`'${snapName}' anlık görüntüsünü silmek istediğinize emin misiniz?`)) return;
        try {
            const res = await fetch('/api/snapshot/drop', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ name: snapName })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`'${snapName}' snapshot'ı başarıyla silindi.`);
                loadSnapshotsData();
            } else {
                showToast('Hata: ' + (data.error || 'Silme başarısız'));
            }
        } catch (err) {
            showToast('Hata: ' + err.message);
        }
    };

    if (btnRefreshSnapshots) {
        btnRefreshSnapshots.addEventListener('click', () => {
            loadSnapshotsData();
            showToast('Snapshot listesi güncellendi.');
        });
    }

    if (btnOpenCreateSnapshotModal) {
        btnOpenCreateSnapshotModal.addEventListener('click', () => {
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
            if (snapCreateNameInput) snapCreateNameInput.value = `snap_parslinux_${ts}`;
            if (snapCreateDescInput) snapCreateDescInput.value = '';
            if (snapshotCreateModal) snapshotCreateModal.classList.add('active');
        });
    }

    if (modalSnapCreateCloseBtn) modalSnapCreateCloseBtn.addEventListener('click', () => snapshotCreateModal.classList.remove('active'));
    if (modalSnapCreateCancelBtn) modalSnapCreateCancelBtn.addEventListener('click', () => snapshotCreateModal.classList.remove('active'));

    if (btnSubmitCreateSnapshot) {
        btnSubmitCreateSnapshot.addEventListener('click', async () => {
            const repo = snapCreateRepoSelect ? snapCreateRepoSelect.value : 'parslinux';
            const name = snapCreateNameInput ? snapCreateNameInput.value.trim() : '';
            const desc = snapCreateDescInput ? snapCreateDescInput.value.trim() : '';
            btnSubmitCreateSnapshot.disabled = true;
            btnSubmitCreateSnapshot.textContent = 'Oluşturuluyor...';
            try {
                const res = await fetch('/api/snapshot/create', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ repo, name, description: desc })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(data.message || 'Snapshot oluşturuldu!');
                    if (snapshotCreateModal) snapshotCreateModal.classList.remove('active');
                    loadSnapshotsData();
                } else {
                    showToast('Hata: ' + (data.error || 'Oluşturulamadı'));
                }
            } catch (err) {
                showToast('Hata: ' + err.message);
            } finally {
                btnSubmitCreateSnapshot.disabled = false;
                btnSubmitCreateSnapshot.textContent = 'Snapshot Oluştur';
            }
        });
    }

    if (modalSnapRollbackCloseBtn) modalSnapRollbackCloseBtn.addEventListener('click', () => snapshotRollbackModal.classList.remove('active'));
    if (modalSnapRollbackCancelBtn) modalSnapRollbackCancelBtn.addEventListener('click', () => snapshotRollbackModal.classList.remove('active'));

    if (btnSubmitRollback) {
        btnSubmitRollback.addEventListener('click', async () => {
            if (!currentRollbackSnapshot) return;
            const repo = snapRollbackRepoSelect ? snapRollbackRepoSelect.value : 'parslinux';
            const dist = snapRollbackDistSelect ? snapRollbackDistSelect.value : 'bookworm';
            btnSubmitRollback.disabled = true;
            btnSubmitRollback.textContent = 'Geri Yükleniyor...';
            try {
                const res = await fetch('/api/snapshot/rollback', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ snapshot: currentRollbackSnapshot, repo, distribution: dist })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(data.message || 'Depo başarıyla geri yüklendi!');
                    if (snapshotRollbackModal) snapshotRollbackModal.classList.remove('active');
                    loadDashboardData();
                    loadSnapshotsData();
                } else {
                    showToast('Rollback Hatası: ' + (data.error || 'İşlem başarısız'));
                }
            } catch (err) {
                showToast('Hata: ' + err.message);
            } finally {
                btnSubmitRollback.disabled = false;
                btnSubmitRollback.textContent = '↺ Geri Yüklemeyi Başlat';
            }
        });
    }

    // =========================================================================
    // 13. Paket & Sürüm Diff Karşılaştırıcı
    // =========================================================================
    const diffModePkgBtn = document.getElementById('diffModePkgBtn');
    const diffModeSnapBtn = document.getElementById('diffModeSnapBtn');
    const diffPkgSection = document.getElementById('diffPkgSection');
    const diffSnapSection = document.getElementById('diffSnapSection');
    const diffPkg1Select = document.getElementById('diffPkg1Select');
    const diffPkg2Select = document.getElementById('diffPkg2Select');
    const btnExecutePkgDiff = document.getElementById('btnExecutePkgDiff');
    const diffSnap1Select = document.getElementById('diffSnap1Select');
    const diffSnap2Select = document.getElementById('diffSnap2Select');
    const btnExecuteSnapDiff = document.getElementById('btnExecuteSnapDiff');
    const diffResultsContainer = document.getElementById('diffResultsContainer');

    if (diffModePkgBtn && diffModeSnapBtn) {
        diffModePkgBtn.addEventListener('click', () => {
            diffModePkgBtn.classList.add('active');
            diffModeSnapBtn.classList.remove('active');
            if (diffPkgSection) diffPkgSection.style.display = 'block';
            if (diffSnapSection) diffSnapSection.style.display = 'none';
        });
        diffModeSnapBtn.addEventListener('click', () => {
            diffModeSnapBtn.classList.add('active');
            diffModePkgBtn.classList.remove('active');
            if (diffPkgSection) diffPkgSection.style.display = 'none';
            if (diffSnapSection) diffSnapSection.style.display = 'block';
        });
    }

    function populateDiffSelects() {
        if (diffPkg1Select && diffPkg2Select && allPackages && allPackages.length > 0) {
            const current1 = diffPkg1Select.value;
            const current2 = diffPkg2Select.value;
            const options = allPackages.map(p => `<option value="${escapeHtml(p.name)}:${escapeHtml(p.version)}">${escapeHtml(p.name)} (v${escapeHtml(p.version)})</option>`).join('');
            diffPkg1Select.innerHTML = `<option value="">Paket seçin...</option>` + options;
            diffPkg2Select.innerHTML = `<option value="">Karşılaştırılacak paket seçin...</option>` + options;
            if (current1) diffPkg1Select.value = current1;
            if (current2) diffPkg2Select.value = current2;
        }

        if (diffSnap1Select && diffSnap2Select && allSnapshots) {
            const currentS1 = diffSnap1Select.value;
            const currentS2 = diffSnap2Select.value;
            const sOptions = allSnapshots.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${s.package_count || 0} paket)</option>`).join('');
            diffSnap1Select.innerHTML = `<option value="">Snapshot seçin...</option>` + sOptions;
            diffSnap2Select.innerHTML = `<option value="">Snapshot seçin...</option>` + sOptions;
            if (currentS1) diffSnap1Select.value = currentS1;
            if (currentS2) diffSnap2Select.value = currentS2;
        }
    }

    if (btnExecutePkgDiff) {
        btnExecutePkgDiff.addEventListener('click', async () => {
            const val1 = diffPkg1Select ? diffPkg1Select.value : '';
            const val2 = diffPkg2Select ? diffPkg2Select.value : '';
            if (!val1 || !val2) {
                showToast('Lütfen karşılaştırmak için iki paket seçin.');
                return;
            }
            const [p1, v1] = val1.split(':');
            const [p2, v2] = val2.split(':');

            if (diffResultsContainer) {
                diffResultsContainer.style.display = 'block';
                diffResultsContainer.innerHTML = '<div class="text-center text-muted" style="padding: 2.5rem;">Paket arşivleri ayrıştırılıyor ve farklar hesaplanıyor...</div>';
            }

            try {
                const res = await fetch(`/api/package/diff?pkg1=${encodeURIComponent(p1)}&ver1=${encodeURIComponent(v1 || '')}&pkg2=${encodeURIComponent(p2)}&ver2=${encodeURIComponent(v2 || '')}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    diffResultsContainer.innerHTML = `<div class="text-center" style="padding: 2.5rem; color: #f87171;">Fark hesaplanamadı: ${escapeHtml(data.error || 'Bilinmeyen hata')}</div>`;
                    return;
                }
                renderPackageDiffResults(data);
            } catch (err) {
                diffResultsContainer.innerHTML = `<div class="text-center" style="padding: 2.5rem; color: #f87171;">Hata: ${escapeHtml(err.message)}</div>`;
            }
        });
    }

    function renderPackageDiffResults(data) {
        if (!diffResultsContainer) return;
        const p1 = data.pkg1 || {};
        const p2 = data.pkg2 || {};
        const ctrlDiff = data.control_diff || [];
        const fileDiff = data.file_diff || [];

        diffResultsContainer.innerHTML = `
            <div class="diff-summary-grid">
                <div class="diff-summary-card">
                    <div class="diff-summary-title">Paket A (Kaynak)</div>
                    <div style="font-weight: 700; color: #fff; font-size: 1.05rem;">${escapeHtml(p1.name)} <span class="badge badge-primary">v${escapeHtml(p1.version)}</span></div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.35rem;">Boyut: ${formatBytes(p1.size || 0)} • ${p1.files_count || 0} Dosya</div>
                </div>
                <div class="diff-summary-card">
                    <div class="diff-summary-title">Paket B (Hedef)</div>
                    <div style="font-weight: 700; color: #fff; font-size: 1.05rem;">${escapeHtml(p2.name)} <span class="badge badge-primary">v${escapeHtml(p2.version)}</span></div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.35rem;">Boyut: ${formatBytes(p2.size || 0)} • ${p2.files_count || 0} Dosya</div>
                </div>
                <div class="diff-summary-card">
                    <div class="diff-summary-title">Değişiklik Özeti</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.4rem; flex-wrap: wrap;">
                        <span class="diff-badge-add">+${fileDiff.filter(f => f.status === 'added').length} Eklendi</span>
                        <span class="diff-badge-del">-${fileDiff.filter(f => f.status === 'removed').length} Silindi</span>
                        <span class="diff-badge-mod">!${fileDiff.filter(f => f.status === 'modified').length} Değişti</span>
                        <span class="badge badge-secondary">${data.unchanged_files_count || 0} Aynı</span>
                    </div>
                </div>
            </div>

            <!-- Control Farkları Tablosu -->
            <div style="margin-bottom: 2rem;">
                <h4 style="color: #fff; font-size: 0.95rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    📄 Debian Control Alan Farkları (${ctrlDiff.length})
                </h4>
                ${ctrlDiff.length === 0 ? '<div class="text-muted" style="font-size: 0.85rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">Control alanları tamamen özdeş.</div>' : `
                    <div class="diff-table-container">
                        <table class="diff-table">
                            <thead>
                                <tr>
                                    <th style="width: 140px;">Alan</th>
                                    <th>Kaynak (A)</th>
                                    <th>Hedef (B)</th>
                                    <th style="width: 100px;">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ctrlDiff.map(c => `
                                    <tr class="${c.status === 'added' ? 'diff-row-added' : (c.status === 'removed' ? 'diff-row-removed' : 'diff-row-modified')}">
                                        <td style="font-weight: 600; color: #fff;">${escapeHtml(c.field)}</td>
                                        <td style="color: var(--text-muted); word-break: break-all;">${escapeHtml(c.val1)}</td>
                                        <td style="color: #fff; word-break: break-all;">${escapeHtml(c.val2)}</td>
                                        <td>
                                            <span class="${c.status === 'added' ? 'diff-badge-add' : (c.status === 'removed' ? 'diff-badge-del' : 'diff-badge-mod')}">
                                                ${c.status === 'added' ? '+ Eklendi' : (c.status === 'removed' ? '- Silindi' : '! Değişti')}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Dosya Ağacı Farkları Tablosu -->
            <div>
                <h4 style="color: #fff; font-size: 0.95rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    📁 Dosya Ağacı Değişiklikleri (${fileDiff.length})
                </h4>
                ${fileDiff.length === 0 ? '<div class="text-muted" style="font-size: 0.85rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">Dosya ağacı tamamen özdeş.</div>' : `
                    <div class="diff-table-container">
                        <table class="diff-table">
                            <thead>
                                <tr>
                                    <th>Dosya / Dizin</th>
                                    <th style="width: 120px;">Durum</th>
                                    <th style="width: 140px;">Boyut (A ➔ B)</th>
                                    <th style="width: 120px;">İzin (Mode)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fileDiff.map(f => `
                                    <tr class="${f.status === 'added' ? 'diff-row-added' : (f.status === 'removed' ? 'diff-row-removed' : 'diff-row-modified')}">
                                        <td style="word-break: break-all;">${f.isdir ? '📁' : '📄'} ${escapeHtml(f.name)}</td>
                                        <td>
                                            <span class="${f.status === 'added' ? 'diff-badge-add' : (f.status === 'removed' ? 'diff-badge-del' : 'diff-badge-mod')}">
                                                ${f.status === 'added' ? '+ Eklendi' : (f.status === 'removed' ? '- Silindi' : '! Değişti')}
                                            </span>
                                        </td>
                                        <td style="font-size: 0.8rem; color: var(--text-secondary);">
                                            ${f.status === 'added' ? formatBytes(f.size2 || 0) : (f.status === 'removed' ? formatBytes(f.size1 || 0) : `${formatBytes(f.size1 || 0)} ➔ ${formatBytes(f.size2 || 0)}`)}
                                        </td>
                                        <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(f.mode2 || f.mode1 || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    if (btnExecuteSnapDiff) {
        btnExecuteSnapDiff.addEventListener('click', async () => {
            const s1 = diffSnap1Select ? diffSnap1Select.value : '';
            const s2 = diffSnap2Select ? diffSnap2Select.value : '';
            if (!s1 || !s2) {
                showToast('Lütfen karşılaştırmak için iki snapshot seçin.');
                return;
            }

            if (diffResultsContainer) {
                diffResultsContainer.style.display = 'block';
                diffResultsContainer.innerHTML = '<div class="text-center text-muted" style="padding: 2.5rem;">Snapshot farkları hesaplanıyor...</div>';
            }

            try {
                const res = await fetch(`/api/snapshot/diff?snap1=${encodeURIComponent(s1)}&snap2=${encodeURIComponent(s2)}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    diffResultsContainer.innerHTML = `<div class="text-center" style="padding: 2.5rem; color: #f87171;">Fark hesaplanamadı: ${escapeHtml(data.error || 'Bilinmeyen hata')}</div>`;
                    return;
                }
                renderSnapshotDiffResults(data);
            } catch (err) {
                diffResultsContainer.innerHTML = `<div class="text-center" style="padding: 2.5rem; color: #f87171;">Hata: ${escapeHtml(err.message)}</div>`;
            }
        });
    }

    function renderSnapshotDiffResults(data) {
        if (!diffResultsContainer) return;
        const diffs = data.differences || [];
        diffResultsContainer.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
                <h4 style="color: #fff; font-size: 1rem; margin-bottom: 0.5rem;">
                    📸 Snapshot Karşılaştırması: <span style="color: var(--accent);">${escapeHtml(data.snap1)}</span> ⟷ <span style="color: #a855f7;">${escapeHtml(data.snap2)}</span>
                </h4>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    Toplam ${diffs.length} paket farkı tespit edildi.
                </div>
            </div>

            ${diffs.length === 0 ? '<div class="text-center text-muted" style="padding: 3rem; background: rgba(0,0,0,0.2); border-radius: 8px;">İki snapshot arasında hiçbir paket farkı bulunmuyor (Özdeş).</div>' : `
                <div class="diff-table-container">
                    <table class="diff-table">
                        <thead>
                            <tr>
                                <th style="width: 100px;">İşlem</th>
                                <th style="width: 100px;">Mimari</th>
                                <th>Paket Adı</th>
                                <th>Sürüm (${escapeHtml(data.snap1)})</th>
                                <th>Sürüm (${escapeHtml(data.snap2)})</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${diffs.map(d => `
                                <tr class="${d.action === 'added' ? 'diff-row-added' : (d.action === 'removed' ? 'diff-row-removed' : 'diff-row-modified')}">
                                    <td>
                                        <span class="${d.action === 'added' ? 'diff-badge-add' : (d.action === 'removed' ? 'diff-badge-del' : 'diff-badge-mod')}">
                                            ${d.action === 'added' ? '+ Eklendi' : (d.action === 'removed' ? '- Kaldırıldı' : '! Değişti')}
                                        </span>
                                    </td>
                                    <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(d.arch)}</td>
                                    <td style="font-weight: 600; color: #fff;">${escapeHtml(d.package)}</td>
                                    <td style="color: var(--text-muted);">${escapeHtml(d.version_a || '-')}</td>
                                    <td style="color: #38bdf8; font-weight: 600;">${escapeHtml(d.version_b || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    }

    // Başlat
    updateSetupCommands();
    loadDashboardData();
    loadWebhookStatus();
    loadWkdStatus();
    loadAuthStatus();
    loadMetricsData();
    loadSnapshotsData();
});

