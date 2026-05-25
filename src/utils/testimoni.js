const { Telegraf } = require('telegraf');
const env = require('../config/env');
const { formatRupiah } = require('./format');

async function sendTestimoni(bot, transaction, product, variant, user) {
    if (!env.TESTIMONI_CHANNEL_ID) {
        console.warn('TESTIMONI_CHANNEL_ID belum diatur di .env. Pengiriman testimoni diabaikan.');
        return;
    }

    const { formatDayDateWIB } = require('./time');
    const { jam } = formatDayDateWIB();
    const dateFormatted = require('moment-timezone')().tz('Asia/Jakarta').format('DD.MM.YYYY');

    let text = `╭──────────────╮\n`;
    text += `   📦 TRANSAKSI BERHASIL 📦\n`;
    text += `╰──────────────╯\n\n`;

    // Ambil nomor trx. Jika ada awalan # jangan didobel
    const trxId = transaction.invoice_id || '-';
    const trxDisplay = trxId.startsWith('#') ? trxId : `#${trxId}`;

    text += `📒 No Trx       : ${trxDisplay}\n`;
    text += `🌀 Status       : ${user.role === 'admin' ? 'Admin 🛠' : 'Member 👤'}\n`;
    text += `👤 Username     : ${user.username ? '@' + user.username : user.full_name}\n`;
    text += `🆔 ID           : ${user.telegram_id}\n\n`;

    text += `📦 Produk       : ${product.name}\n`;
    if (variant) {
        text += `🎛 Varian       : ${variant.name}\n`;
        text += `⏳ Garansi      : ${variant.warranty || '-'}\n`;
    }
    text += `💲 Harga        : Rp ${formatRupiah(transaction.total_price)}\n\n`;

    if (transaction.payment_method === 'saldo') {
        text += `💳 Saldo Keluar : Rp ${formatRupiah(transaction.total_price)}\n`;
        text += `💰 Saldo Now    : Rp ${formatRupiah(user.saldo)}\n\n`;
    } else {
        text += `💳 Metode Bayar : QRIS\n\n`;
    }

    text += `📅 Tanggal      : ${dateFormatted}\n`;
    text += `⏰ Waktu        : ${jam} WIB\n\n`;

    text += `━━━━━━━━━━━━━━\n`;
    text += `📝 Catatan: Simpan nomor transaksi untuk support\n`;
    text += `━━━━━━━━━━━━━━`;

    try {
        // Gunakan token bot testimoni khusus yang diberikan user, fallback ke token default
        const token = env.TESTIMONI_BOT_TOKEN || '8772417938:AAH26VMUIB2aUDLuw2MtbIbQG9LGbhQjrvw';
        const testimoniBot = new Telegraf(token);

        await testimoniBot.telegram.sendMessage(env.TESTIMONI_CHANNEL_ID, text);
    } catch (error) {
        console.error('Gagal mengirim testimoni ke channel:', error.message);
    }
}

module.exports = { sendTestimoni };
