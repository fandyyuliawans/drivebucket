// Ganti dengan URL dan Anon Key proyek Supabase Anda sendiri
const SUPABASE_URL = "https://dmagkklzsjfmuposfulb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWdra2x6c2pmbXVwb3NmdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTYxNjYsImV4cCI6MjA5NjM5MjE2Nn0.HtdnSjQot3biVrn7OeX_dUOG70OFLHpjOuixsc9ZDlE";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elemen DOM
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnTambahStorage = document.getElementById('btn-tambah-storage');
const inputUpload = document.getElementById('input-upload');

// Jalankan pengecekan auth saat halaman dibuka
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }
});

// Event Listeners
btnLogin.addEventListener('click', () => {
    // Gunakan provider login default Supabase (bisa email atau Google langsung)
    supabase.auth.signInWithOAuth({ provider: 'google' });
});

btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
});

// Simulasi Tambah Akun Google Storage Baru
btnTambahStorage.addEventListener('click', () => {
    alert("Membuka Alur Google OAuth...\nDi sini backend Edge Function akan meminta scope 'https://www.googleapis.com/auth/drive.file' dan menyimpan refresh_token ke database.");
});

// Logika Upload File
inputUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    alert(`Memproses file: ${file.name} (${(file.size / 1024).toFixed(1)} KB).\nSistem akan mencari Bucket yang paling kosong, lalu mengirimkannya lewat Serverless Edge Function.`);
    // Implementasi nyata: kirim file ke Supabase Edge Function Anda
});

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

// Mengambil Data dari Supabase dan memperbarui UI Ringkasan (Gambar 1)
async function loadDashboardData() {
    // 1. Ambil data Drives (Buckets)
    const { data: drives } = await supabase.from('drives').select('*');
    
    // 2. Ambil data Files
    const { data: files } = await supabase.from('files').select('*, drives(bucket_name)');

    if (drives) {
        document.getElementById('stat-drive-aktif').innerText = drives.filter(d => d.status === 'Aktif').length;
        
        let totalFreeBytes = drives.reduce((acc, d) => acc + (d.total_storage - d.used_storage), 0);
        let totalFreeGB = (totalFreeBytes / (1024 ** 3)).toFixed(1);
        document.getElementById('stat-storage-bebas').innerText = `${totalFreeGB} GB`;
    }

    if (files) {
        document.getElementById('stat-total-file').innerText = files.length;
        
        let totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
        let totalSizeKB = (totalSizeBytes / 1024).toFixed(1);
        document.getElementById('stat-total-size').innerText = `${totalSizeKB} KB`;

        // Render tabel file terbaru
        const tbody = document.getElementById('table-files-body');
        tbody.innerHTML = files.map(file => `
            <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
                <td class="py-4 font-medium flex items-center space-x-2">
                    <span class="text-red-500">📄</span> <span>${file.file_name}</span>
                </td>
                <td class="py-4 text-gray-500">${(file.size / 1024).toFixed(1)} KB</td>
                <td class="py-4"><span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">${file.drives?.bucket_name || 'Unknown'}</span></td>
                <td class="py-4 text-right">
                    <button class="text-blue-600 hover:underline font-medium">Unduh</button>
                </td>
            </tr>
        `).join('');
    }
}