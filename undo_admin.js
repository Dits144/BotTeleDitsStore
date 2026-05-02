const fs = require('fs');
let code = fs.readFileSync('src/handlers/admin.js', 'utf8');

// Undo adminFastNav definition
code = code.replace(/const adminFastNav = \[\n    Markup\.button\.callback\('🛠 Admin Menu', 'nav_adminmenu'\),\n    Markup\.button\.callback\('🏠 Start', 'nav_start'\),\n    Markup\.button\.callback\('⬅️ Back', 'nav_back'\)\n\];\n/, '');

// Undo [backBtnAdmin, adminFastNav]
code = code.replace(/\[backBtnAdmin, adminFastNav\]/g, '[backBtnAdmin]');
code = code.replace(/backBtnAdmin, adminFastNav/g, 'backBtnAdmin');
code = code.replace(/kb\.push\(adminFastNav\);\n/g, '');

// Undo breadcrumbs
code = code.replace(/📍 \/adminmenu > Dashboard\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Tambah Produk\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Hapus Produk\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Kelola Produk\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Konfirmasi Pembayaran\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Data User\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Cari User\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Riwayat Transaksi\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Tambah Saldo\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Kurangi Saldo\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Upload QRIS\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Update QRIS\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Broadcast\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Statistik\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Setting > \${type}\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Upload Banner\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Clear All\\n\\n/g, '');
code = code.replace(/📍 \/adminmenu > Lihat Stok Terjual\\n\\n/g, '');

fs.writeFileSync('src/handlers/admin.js', code);
console.log('Done reverting admin.js');
