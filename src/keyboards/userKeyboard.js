const { Markup } = require('telegraf');

const mainMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🛒 List Produk', 'menu_list_produk')],
        [
            Markup.button.callback('💳 Saldo', 'menu_saldo'),
            Markup.button.callback('🧾 Riwayat Transaksi', 'menu_riwayat')
        ],
        [
            Markup.button.callback('📖 Cara Order', 'menu_cara_order'),
            Markup.button.callback('🔥 Produk Populer', 'menu_populer')
        ],
        [Markup.button.callback('🏆 Top Buyer', 'menu_top_buyer')]
    ]);
};

const backToMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Kembali ke Menu Utama', 'menu_utama')]
    ]);
};

module.exports = { mainMenu, backToMenu };


