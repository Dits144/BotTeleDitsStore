const { getAllProductsStokReport } = require('../services/productService');
const { formatDayDateWIB } = require('../utils/time');
const { Markup } = require('telegraf');

// Fungsi pembantu untuk membuat teks laporan stok dan keyboard
async function generateStokReport() {
    const timeInfo = formatDayDateWIB();
    const report = await getAllProductsStokReport();

    let text = `╭──────────────╮\n`;
    text += `   📊 LAPORAN STOK DITSSTORE 📊\n`;
    text += `╰──────────────╯\n`;
    text += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊• 📅 Hari : ${timeInfo.hari}, ${timeInfo.tanggal}\n`;
    text += `┊• ⏰ Waktu: ${timeInfo.jam} WIB\n`;
    text += `┊- - - - - - - - - - - - - - - - - - - - - -\n`;

    const keyboard = [];
    let row = [];

    report.forEach(item => {
        const isReady = item.stock > 0;
        const iconText = isReady ? '✅' : '❌';
        text += `┊ ${iconText} ${item.name}: ${item.stock}x\n`;

        // Membuat tombol berwarna premium & emote interaktif untuk tiap produk
        // Hijau 🟢 untuk Ready, Merah 🔴 untuk Habis
        const btnEmoji = isReady ? '🟢' : '🔴';
        const statusText = isReady ? `${item.stock} Pcs` : 'Habis';
        const buttonLabel = `${btnEmoji} ${item.name} [ ${iconText} ${statusText} ]`;
        
        // Buat callback_data yang aman (maksimal 64 karakter)
        const safeName = item.name.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
        
        row.push(Markup.button.callback(buttonLabel, `stok_info:${safeName}:${item.stock}`));
        if (row.length === 1) { // 1 button per row agar tampilan rapi dan teks tombol terlihat penuh
            keyboard.push(row);
            row = [];
        }
    });

    if (row.length > 0) keyboard.push(row);

    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    text += `👉 *Gunakan Menu Utama untuk membeli produk*`;

    // Tombol refresh berwarna biru (🔵) di bagian bawah
    keyboard.push([
        Markup.button.callback('🔵 🔄 REFRESH DATA STOK 🔄 🔵', 'refresh_stok')
    ]);

    return { text, keyboard };
}

module.exports = (bot) => {
    // Handler perintah /stok
    bot.command('stok', async (ctx) => {
        try {
            const { text, keyboard } = await generateStokReport();
            await ctx.replyWithMarkdown(text, Markup.inlineKeyboard(keyboard));
        } catch (error) {
            console.error('Error in /stok:', error);
            ctx.reply('❌ Gagal mengambil data stok. Silakan coba beberapa saat lagi.').catch(()=>{});
        }
    });

    // Handler callback query untuk Refresh Stok
    bot.action('refresh_stok', async (ctx) => {
        try {
            const { text, keyboard } = await generateStokReport();
            
            // Edit pesan stok yang sudah ada
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(keyboard)
            }).catch(()=>{});

            // Tampilkan pesan toast pemberitahuan sukses
            await ctx.answerCbQuery('🔄 Data stok berhasil diperbarui!').catch(()=>{});
        } catch (error) {
            console.error('Error in refresh_stok callback:', error);
            await ctx.answerCbQuery('❌ Gagal memperbarui data stok.', { show_alert: true }).catch(()=>{});
        }
    });

    // Handler callback query saat produk stok diklik
    bot.action(/^stok_info:(.+):(\d+)$/, async (ctx) => {
        try {
            const prodName = ctx.match[1].replace(/_/g, ' ');
            const stockQty = parseInt(ctx.match[2]);
            
            let message = '';
            if (stockQty > 0) {
                message = `✨ Produk: ${prodName}\n📦 Stok Tersedia: ${stockQty} Pcs\n\nSilakan pilih menu "🛒 List Produk" di Menu Utama untuk membeli! 🟢`;
            } else {
                message = `⚠️ Produk: ${prodName}\n❌ Stok sedang Habis.\n\nSilakan hubungi admin untuk melakukan restok! 🔴`;
            }
            
            await ctx.answerCbQuery(message, { show_alert: true }).catch(()=>{});
        } catch (error) {
            console.error('Error in stok_info callback:', error);
            await ctx.answerCbQuery().catch(()=>{});
        }
    });
};

