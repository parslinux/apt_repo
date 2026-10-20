// ==============================================================================
// APT Depo Paneli - Vanilla JS İstemci Mantığı
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Durum Değişkenleri
    let allPackages = [];
    let allRepos = [];
    let currentTab = 'packagesTab';

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
        const codeSourcesLine = document.getElementById('codeSourcesLine');
        if (codeSourcesLine) {
            codeSourcesLine.textContent = `echo "deb [trusted=yes] ${origin}/ bookworm main" | sudo tee /etc/apt/sources.list.d/ozel-depo.list`;
        }
        const codeOneLineInstall = document.getElementById('codeOneLineInstall');
        if (codeOneLineInstall) {
            codeOneLineInstall.textContent = `curl -sSL ${origin}/install.sh | sudo bash`;
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
                        filename: 'pool/main/h/hello/hello_2.10-3_amd64.deb'
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
        } catch (err) {
            console.error('Veri yükleme hatası:', err);
            renderPackages();
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

    // 5. Paket Kartlarını Ekrana Bas
    function renderPackages() {
        if (!packagesGrid) return;

        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const selectedRepo = repoFilterSelect ? repoFilterSelect.value : 'all';

        const filtered = allPackages.filter(pkg => {
            const matchQuery = !query || 
                pkg.name.toLowerCase().includes(query) || 
                (pkg.description && pkg.description.toLowerCase().includes(query)) ||
                (pkg.architecture && pkg.architecture.toLowerCase().includes(query));

            const matchRepo = selectedRepo === 'all' || pkg.repo === selectedRepo;
            return matchQuery && matchRepo;
        });

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

        packagesGrid.innerHTML = filtered.map(pkg => `
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
                    </div>

                    <div class="package-actions">
                        <button class="btn btn-primary btn-sm btn-install" data-pkgname="${escapeHtml(pkg.name)}" title="Kurulum komutunu kopyala">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>apt install</span>
                        </button>

                        <button class="btn btn-secondary btn-sm btn-details" data-pkgname="${escapeHtml(pkg.name)}">
                            Detaylar
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Kart içi buton dinleyicileri
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

        packageModal.classList.add('active');
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

    // 9. Arama ve Filtre Dinleyicileri
    if (searchInput) searchInput.addEventListener('input', renderPackages);
    if (repoFilterSelect) repoFilterSelect.addEventListener('change', renderPackages);
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            btnRefresh.classList.add('loading');
            loadDashboardData().finally(() => {
                showToast('Veriler güncellendi');
                btnRefresh.classList.remove('loading');
            });
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

    // Başlat
    updateSetupCommands();
    loadDashboardData();
});
