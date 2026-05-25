const { Markup } = require('telegraf');

const mainMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🟩 🛒 LIST PRODUK 🛒 🟩', 'menu_list_produk')],
        [
            Markup.button.callback('🟦 💳 SALDO', 'menu_saldo'),
            Markup.button.callback('🟪 🧾 RIWAYAT', 'menu_riwayat')
        ],
        [
            Markup.button.callback('🟨 📖 CARA ORDER', 'menu_cara_order'),
            Markup.button.callback('🟧 🔥 POPULER', 'menu_populer')
        ],
        [Markup.button.callback('👑 🏆 TOP BUYER 🏆 👑', 'menu_top_buyer')]
    ]);
};

const backToMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🟥 ⬅️ Kembali ke Menu Utama', 'menu_utama')]
    ]);
};

module.exports = { mainMenu, backToMenu };

