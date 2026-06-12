// ==========================================
// 1. INISIALISASI SUPABASE
// ==========================================
// PENTING: Ganti dengan URL dan Anon Key proyek Supabase Anda!
const SUPABASE_URL = "https://dmagkklzsjfmuposfulb.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWdra2x6c2pmbXVwb3NmdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTYxNjYsImV4cCI6MjA5NjM5MjE2Nn0.HtdnSjQot3biVrn7OeX_dUOG70OFLHpjOuixsc9ZDlE"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. ELEMEN DOM & TAB MANAJEMEN
// ==========================================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

function showLogin() { loginScreen.classList.remove('hidden'); dashboardScreen.classList.add('hidden'); }
function showDashboard() { loginScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); }

window.switchTab = function(tabName) {
    document.getElementById('my-drive-section').classList.toggle('hidden', tabName !== 'mydrive');
    document.getElementById('kelola-drive-section').classList.toggle('hidden', tabName !== 'kelola');
    if (tabName === 'kelola') renderKelolaDriveUI();
};

// ==========================================
// 3. RADAR LOGIN (Auto Check)
// ==========================================
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        showDashboard();
        setTimeout(() => { loadDashboardData(); }, 100); 
    } else {
        showLogin();
    }
});

// ==========================================
// 4. LOGIN GOOGLE & ADMIN
// ==========================================
document.getElementById('btn-login').addEventListener('click', () => {
    supabaseClient.auth.signInWithOAuth({ provider: 'google' });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

document.getElementById('btn-login-admin').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    if (!email || !password) return alert("Harap isi Email dan Password Admin!");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert("Login Gagal: Email atau Password salah.");
});

// ==========================================
// 5. TAMBAH STORAGE (OAUTH DRIVE)
// ==========================================
document.getElementById('btn-tambah-storage').addEventListener('click', async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return alert("Sesi habis, silakan login ulang!");

        // PENTING: Ganti dengan Client ID Google dan ID Supabase Anda!
        const GOOGLE_CLIENT_ID = "MASUKKAN_CLIENT_ID_GOOGLE_ANDA_DI_SINI"; 
        const REDIRECT_URI = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/google-auth-callback";
        
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.file%20email&access_type=offline&state=${session.user.id}&prompt=consent`;
        window.location.href = googleAuthUrl; 
    } catch (err) { alert("Gagal memproses tombol."); }
});

// ==========================================
// 6. UPLOAD FILE BESAR (RESUMABLE)
// ==========================================
document.getElementById('input-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return alert("Silakan login terlebih dahulu!");

    const loadingOverlay = document.getElementById('loading-overlay');
    if(loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
        // PENTING: Ganti dengan URL Supabase Anda
        const URL_UPLOAD_INIT = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/upload-file";
        
        const initRes = await fetch(URL_UPLOAD_INIT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id, fileName: file.name, fileSize: file.size, mimeType: file.type })
        });

        const initResult = await initRes.json();
        if (!initRes.ok || !initResult.success) throw new Error(initResult.error || "Gagal meminta izin upload.");

        const uploadRes = await fetch(initResult.uploadUrl, { method: 'PUT', body: file });
        if (!uploadRes.ok) throw new Error("Google Drive menolak file tersebut.");
        const uploadResult = await uploadRes.json();

        await supabaseClient.from('files').insert([{
            user_id: session.user.id, drive_id: initResult.driveId, file_name: file.name,
            google_file_id: uploadResult.id, size: file.size
        }]);

        await supabaseClient.from('drives').update({ used_storage: initResult.usedStorage + file.size }).eq('id', initResult.driveId);

        alert("✅ Luar Biasa! File berhasil terunggah.");
        loadDashboardData(); 
    } catch (error) {
        alert("❌ Terjadi kesalahan: " + error.message);
    } finally {
        if(loadingOverlay) loadingOverlay.classList.add('hidden');
        e.target.value = ''; 
    }
});

// ==========================================
// 7. TARIK DATA & RENDER TABEL (SEARCH/SORT)
// ==========================================
let globalFilesData = [];

async function loadDashboardData() {
    const { data: drives } = await supabaseClient.from('drives').select('*');
    const { data: files } = await supabaseClient.from('files').select('*, drives(bucket_name)').order('created_at', { ascending: false });

    if (drives) {
        document.getElementById('stat-drive-aktif').innerText = drives.filter(d => d.status === 'Aktif').length;
        let totalFreeBytes = drives.reduce((acc, d) => acc + (d.total_storage - d.used_storage), 0);
        document.getElementById('stat-storage-bebas').innerText = `${(totalFreeBytes / (1024 ** 3)).toFixed(1)} GB`;
    }

    if (files) {
        globalFilesData = files;
        document.getElementById('stat-total-file').innerText = files.length;
        let totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
        document.getElementById('stat-total-size').innerText = `${(totalSizeBytes / 1024).toFixed(1)} KB`;
        renderFilesTable(); 
    }
}

function renderFilesTable() {
    const searchEl = document.getElementById('search-file');
    const sortEl = document.getElementById('sort-file');
    if (!searchEl || !sortEl) return; // Mencegah error jika elemen belum muncul

    const searchQuery = searchEl.value.toLowerCase();
    const sortValue = sortEl.value;

    let filteredFiles = globalFilesData.filter(file => file.file_name.toLowerCase().includes(searchQuery));

    if (sortValue === 'terlama') filteredFiles.reverse();
    if (sortValue === 'terbesar') filteredFiles.sort((a, b) => b.size - a.size);
    if (sortValue === 'terkecil') filteredFiles.sort((a, b) => a.size - b.size);
    if (sortValue === 'az') filteredFiles.sort((a, b) => a.file_name.localeCompare(b.file_name));

    const tbody = document.getElementById('table-files-body');
    if (!tbody) return;

    tbody.innerHTML = filteredFiles.map(file => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
            <td class="py-4 font-medium flex items-center space-x-2">
                <span class="text-gray-400">📄</span> <span class="truncate max-w-[180px]" title="${file.file_name}">${file.file_name}</span>
            </td>
            <td class="py-4 text-gray-500">${(file.size / 1024).toFixed(1)} KB</td>
            <td class="py-4"><span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">${file.drives?.bucket_name || 'Unknown'}</span></td>
            <td class="py-4 text-right space-x-2 md:space-x-3">
                <button onclick="manageFile('${file.id}', 'download')" class="text-blue-600 hover:underline font-medium transition">⬇️ Unduh</button>
                <button onclick="manageFile('${file.id}', 'rename')" class="text-amber-600 hover:underline font-medium transition">✏️ Rename</button>
                <button onclick="manageFile('${file.id}', 'share')" class="text-emerald-600 hover:underline font-medium transition">🔗 Share</button>
                <button onclick="manageFile('${file.id}', 'delete')" class="text-red-500 hover:underline font-medium transition">🗑️ Hapus</button>
            </td>
        </tr>
    `).join('');
}

// Pasang pendeteksi ketikan untuk search & sort
document.addEventListener('DOMContentLoaded', () => {
    const searchEl = document.getElementById('search-file');
    const sortEl = document.getElementById('sort-file');
    if (searchEl) searchEl.addEventListener('input', renderFilesTable);
    if (sortEl) sortEl.addEventListener('change', renderFilesTable);
});

// ==========================================
// 8. LOGIKA MANAJEMEN: DOWNLOAD, RENAME, SHARE, DELETE
// ==========================================
window.manageFile = async function(fileId, action) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    let inputNamaBaru = null;

    if (action === 'rename') {
        const fileSkg = globalFilesData.find(f => f.id === fileId);
        const namaBaru = prompt("Masukkan nama baru untuk file ini:", fileSkg ? fileSkg.file_name : "");
        if (!namaBaru || namaBaru.trim() === "" || namaBaru === fileSkg.file_name) return;
        inputNamaBaru = namaBaru.trim();
    }

    if (action === 'delete') {
        if (!confirm("Yakin ingin menghapus file ini permanen dari Google Drive?")) return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
        // PENTING: Ganti dengan URL Supabase Anda
        const URL_MANAGE = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/manage-file";
        
        const response = await fetch(URL_MANAGE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id, fileId: fileId, action: action, newName: inputNamaBaru })
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            if (action === 'delete') { alert("🗑️ File berhasil dihapus!"); loadDashboardData(); } 
            else if (action === 'share') { prompt("Link berhasil dibuat! Silakan copy link:", result.link); } 
            else if (action === 'download') { window.open(result.link, '_blank'); } 
            else if (action === 'rename') { alert("✏️ Nama file berhasil diubah!"); loadDashboardData(); }
        } else {
            alert("❌ Gagal: " + (result.error || result.message));
        }
    } catch (error) {
        alert("❌ Terjadi kesalahan jaringan.");
    } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

// ==========================================
// 9. KELOLA DRIVE (UI KARTU)
// ==========================================
async function renderKelolaDriveUI() {
    const { data: drives } = await supabaseClient.from('drives').select('*');
    const gridContainer = document.getElementById('grid-kelola-drives');
    if (!gridContainer) return;

    if (!drives || drives.length === 0) { gridContainer.innerHTML = `<p class="text-gray-500">Belum ada Drive.</p>`; return; }

    gridContainer.innerHTML = drives.map(drive => {
        const totalGB = (drive.total_storage / (1024 ** 3)).toFixed(1);
        const usedGB = (drive.used_storage / (1024 ** 3)).toFixed(1);
        const freeGB = ((drive.total_storage - drive.used_storage) / (1024 ** 3)).toFixed(1);
        const percentUsed = Math.min(100, Math.round((drive.used_storage / drive.total_storage) * 100));

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div class="flex items-center space-x-3">
                        <div class="bg-blue-600 text-white p-2 rounded shrink-0">🪣</div>
                        <div><h3 class="font-bold text-gray-800 text-sm truncate">${drive.bucket_name}</h3><p class="text-xs text-gray-500 truncate">${drive.email}</p></div>
                    </div>
                    <span class="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Aktif</span>
                </div>
                <div class="p-5">
                    <div class="flex justify-between text-xs text-gray-500 mb-2"><span>${usedGB} GB terpakai</span><span>${freeGB} GB bebas</span></div>
                    <div class="w-full bg-gray-200 rounded-full h-2 mb-4"><div class="bg-blue-500 h-2 rounded-full" style="width: ${percentUsed}%"></div></div>
                </div>
            </div>`;
    }).join('');
}
