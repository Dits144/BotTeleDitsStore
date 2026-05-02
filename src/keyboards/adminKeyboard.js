const { Markup } = require('telegraf');

const adminMenuKeyboard = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📊 Dashboard Admin', 'admin_dashboard')],
        [
            Markup.button.callback('➕ Tambah Produk', 'admin_add_product'),
            Markup.button.callback('❌ Hapus Produk', 'admin_del_product')
        ],
        [
            Markup.button.callback('✏️ Kelola Produk', 'admin_manage_product'),
            Markup.button.callback('📦 Lihat Stok Terjual', 'admin_view_sold_stok')
        ],
        [Markup.button.callback('✅ Konfirmasi Pembayaran', 'admin_confirm_payment')],
        [
            Markup.button.callback('👥 Data User', 'admin_data_user'),
            Markup.button.callback('🧾 Riwayat Transaksi', 'admin_all_transactions')
        ],
        [
            Markup.button.callback('💰 Tambah Saldo', 'admin_add_saldo'),
            Markup.button.callback('💸 Kurangi Saldo', 'admin_reduce_saldo')
        ],
        [
            Markup.button.callback('🖼️ Upload QRIS', 'admin_upload_qris'),
            Markup.button.callback('🔄 Update QRIS', 'admin_update_qris')
        ],
        [
            Markup.button.callback('📢 Broadcast Pesan', 'admin_broadcast'),
            Markup.button.callback('📈 Statistik Penjualan', 'admin_statistics')
        ],
        [Markup.button.callback('⚙️ Setting Bot', 'admin_settings')]
    ]);
};

const backToAdminMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Kembali Admin Menu', 'admin_menu')]
    ]);
};

module.exports = { adminMenuKeyboard, backToAdminMenu };
