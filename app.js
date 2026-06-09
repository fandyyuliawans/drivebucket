// ==========================================
// 1. INISIALISASI SUPABASE
// ==========================================
// PENTING: Ganti dengan URL dan Anon Key proyek Supabase Anda sendiri!
const SUPABASE_URL = "https://dmagkklzsjfmuposfulb.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWdra2x6c2pmbXVwb3NmdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTYxNjYsImV4cCI6MjA5NjM5MjE2Nn0.HtdnSjQot3biVrn7OeX_dUOG70OFLHpjOuixsc9ZDlE"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. ELEMEN DOM
// ==========================================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnTambahStorage = document.getElementById('btn-tambah-storage');
const inputUpload = document.getElementById('input-upload');

// ==========================================
// 3. RADAR PEMANTAU LOGIN (Anti Angka 0)
// ==========================================
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        showDashboard();
        // Beri jeda sepersekian detik untuk memastikan database siap
        setTimeout(() => {
            loadDashboardData();
        }, 100); 
    } else {
        showLogin();
    }
});

// ==========================================
// 4. EVENT LISTENER LOGIN / LOGOUT
// ==========================================
btnLogin.addEventListener('click', () => {
    supabaseClient.auth.signInWithOAuth({ provider: 'google' });
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

// ==========================================
// 5. TOMBOL HIJAU: TAMBAH STORAGE
// ==========================================
btnTambahStorage.addEventListener('click', async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            alert("Sesi habis, silakan login ulang!");
            return;
        }

        const userId = session.user.id;
        
        // PENTING: Ganti 2 baris ini dengan milik Anda!
        const GOOGLE_CLIENT_ID = "800639483878-9nm9324qto7cf1d4ceqockodcl9h30af.apps.googleusercontent.com"; 
        const REDIRECT_URI = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/google-auth-callback";
        
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.file%20email&access_type=offline&state=${userId}&prompt=consent`;
        
        window.location.href = googleAuthUrl; 

    } catch (error) {
        console.error("Terjadi error pada sistem:", error);
        alert("Gagal memproses tombol. Cek console untuk detailnya.");
    }
});

// ==========================================
// 6. LOGIKA UPLOAD FILE SUNGGUHAN
// ==========================================
inputUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("Silakan login terlebih dahulu!");
        return;
    }

    alert(`Mulai mengunggah: ${file.name}...\n\nHarap tunggu sebentar, file sedang dikirim ke Google Drive.`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', session.user.id);

    try {
        // PENTING: Ganti URL di bawah ini dengan URL Edge Function Anda!
        const URL_UPLOAD = "https://dmagkklzsjfmuposfulb.supabase.co/functions/v1/upload-file";
        
        const response = await fetch(URL_UPLOAD, {
            method: 'POST',
            body: formData 
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert("✅ Berhasil! File Anda sudah tersimpan aman di Google Drive.");
            loadDashboardData(); 
        } else {
            alert("❌ Gagal unggah: " + result.error);
        }

    } catch (error) {
        console.error(error);
        alert("❌ Terjadi kesalahan jaringan, tidak bisa menghubungi server.");
    } finally {
        e.target.value = '';
    }
});

// ==========================================
// 7. FUNGSI TAMPILAN UI
// ==========================================
function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

// ==========================================
// 8. FUNGSI TARIK DATA DASHBOARD
// ==========================================
async function loadDashboardData() {
    const { data: drives, error: errDrives } = await supabaseClient.from('drives').select('*');
    const { data: files, error: errFiles } = await supabaseClient.from('files').select('*, drives(bucket_name)');

    if (errDrives) console.error("Gagal menarik data Drive:", errDrives);
    if (errFiles) console.error("Gagal menarik data File:", errFiles);

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
