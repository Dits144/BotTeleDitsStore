const { getAllProductsStokReport } = require('../services/productService');
const { formatDayDateWIB } = require('../utils/time');
const { Markup } = require('telegraf');

// Fungsi pembantu untuk membuat teks laporan stok dan keyboard
async function generateStokReport() {
    const timeInfo = formatDayDateWIB();
    const report = await getAllProductsStokReport();

    let text = `LAPORAN STOK PRODUK\n`;
    text += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊• ${timeInfo.hari}, ${timeInfo.tanggal}\n`;
    text += `┊• ${timeInfo.jam} WIB\n`;
    text += `┊- - - - - - - - - - - - - - - - - - - - - -\n`;

    report.forEach(item => {
        const icon = item.stock > 0 ? '✅' : '❌';
        text += `┊ ${icon} ${item.name}: ${item.stock}x\n`;
    });

    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯`;

    // Tombol refresh clean di bagian bawah
    const keyboard = [
        [Markup.button.callback('🔄 Refresh Stok', 'refresh_stok')]
    ];

    return { text, keyboard };
}

module.exports = (bot) => {
    // Handler perintah /stok
    bot.command('stok', async (ctx) => {
        try {
            const { text, keyboard } = await generateStokReport();
            await ctx.reply(text, Markup.inlineKeyboard(keyboard)).catch(()=>{});
        } catch (error) {
            console.error('Error in /stok:', error);
            ctx.reply('❌ Gagal mengambil data stok.').catch(()=>{});
        }
    });

    // Handler callback query untuk Refresh Stok
    bot.action('refresh_stok', async (ctx) => {
        try {
            const { text, keyboard } = await generateStokReport();
            
            // Edit pesan stok yang sudah ada
            await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard)).catch(()=>{});

            // Tampilkan pesan toast pemberitahuan sukses
            await ctx.answerCbQuery('🔄 Data stok berhasil diperbarui!').catch(()=>{});
        } catch (error) {
            console.error('Error in refresh_stok callback:', error);
            await ctx.answerCbQuery('❌ Gagal memperbarui data stok.', { show_alert: true }).catch(()=>{});
        }
    });
};


