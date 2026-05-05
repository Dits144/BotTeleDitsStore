const { Telegraf } = require('telegraf');
const env = require('../config/env');
const { formatRupiah } = require('./format');

async function sendTestimoni(bot, transaction, product, variant, user) {
    if (!env.TESTIMONI_CHANNEL_ID) return;

    const { formatDayDateWIB } = require('./time');
    const { tanggal, jam } = formatDayDateWIB();
    const dateFormatted = require('moment-timezone')().tz('Asia/Jakarta').format('DD.MM.YYYY');

    let text = `╭──────────────╮\n`;
    text += `   📦 TRANSAKSI BERHASIL 📦\n`;
    text += `╰──────────────╯\n\n`;

    text += `📒 No Trx       : ${transaction.invoice_id || '-'}\n`;
    text += `🌀 Status       : ${user.role === 'admin' ? 'Admin 🛠' : 'Member 👤'}\n`;
    text += `👤 Username     : ${user.username ? '@' + user.username : user.full_name}\n`;
    text += `🆔 ID           : ${user.telegram_id}\n\n`;

    text += `📦 Produk       : ${product.name}\n`;
    if (variant) {
        text += `🎛 Variant      : ${variant.name}\n`;
    }
    text += `💲 Total        : Rp ${formatRupiah(transaction.total_price)}\n\n`;

    if (transaction.payment_method === 'saldo') {
        text += `💳 Saldo Keluar : Rp ${formatRupiah(transaction.total_price)}\n`;
        text += `💰 Saldo Now    : Rp ${formatRupiah(user.saldo)}\n\n`;
    } else {
        text += `💳 Metode Bayar : QRIS\n\n`;
    }

    text += `📅 Tanggal      : ${dateFormatted}\n`;
    text += `⏰ Waktu        : ${jam} WIB\n\n`;

    text += `━━━━━━━━━━━━━━\n`;
    text += `📝 Catatan: Terima kasih telah berbelanja di DitsStore 🙏\n`;
    text += `━━━━━━━━━━━━━━`;

    try {
        let testimoniBot = bot;
        
        // Jika user mengatur bot terpisah khusus untuk testimoni
        if (env.TESTIMONI_BOT_TOKEN) {
            testimoniBot = new Telegraf(env.TESTIMONI_BOT_TOKEN);
        }

        await testimoniBot.telegram.sendMessage(env.TESTIMONI_CHANNEL_ID, text, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Gagal mengirim testimoni ke channel:', error.message);
    }
}

module.exports = { sendTestimoni };
