// 1. Masukkan URL dan Key Anda di sini
const SUPABASE_URL = "https://dmagkklzsjfmuposfulb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWdra2x6c2pmbXVwb3NmdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTYxNjYsImV4cCI6MjA5NjM5MjE2Nn0.HtdnSjQot3biVrn7OeX_dUOG70OFLHpjOuixsc9ZDlE";

// 2. PERBAIKAN ERROR: Ubah nama variabel menjadi supabaseClient
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elemen DOM
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnTambahStorage = document.getElementById('btn-tambah-storage');
const inputUpload = document.getElementById('input-upload');

// Jalankan pengecekan auth saat halaman dibuka
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }
});

// Event Listeners
btnLogin.addEventListener('click', () => {
    supabaseClient.auth.signInWithOAuth({ provider: 'google' });
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

// 3. PERBAIKAN TOMBOL HIJAU: Arahkan ke Edge Function Supabase
// PERBAIKAN TOMBOL HIJAU: Menambahkan ID User dan Scope Email
btnTambahStorage.addEventListener('click', async () => {
    // Ambil ID User yang sedang login
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        alert("Sesi habis, silakan login ulang!");
        return;
    }

    const userId = session.user.id; // Ini ID Supabase Anda
    const GOOGLE_CLIENT_ID = "800639483878-9nm9324qto7cf1d4ceqockodcl9h30af.apps.googleusercontent.com"; 
    const REDIRECT_URI = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/google-auth-callback";
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=https://www.googleapis.com/auth/drive.file%20email` + // Tambahan '%20email' agar bisa baca alamat email Google
        `&access_type=offline` +
        `&state=${userId}` + // KITA TITIPKAN ID USER DI SINI (Parameter state)
        `&prompt=consent`;
    
    window.location.href = googleAuthUrl; 
});

// Logika Upload File
inputUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    alert(`Memproses file: ${file.name} (${(file.size / 1024).toFixed(1)} KB).\nSistem akan mencari Bucket yang paling kosong, lalu mengirimkannya lewat Serverless Edge Function.`);
});

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

// Mengambil Data dari Supabase
async function loadDashboardData() {
    // Perhatikan: sekarang kita menggunakan supabaseClient
    const { data: drives } = await supabaseClient.from('drives').select('*');
    const { data: files } = await supabaseClient.from('files').select('*, drives(bucket_name)');

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
