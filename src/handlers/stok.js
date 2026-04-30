const { getAllProductsStokReport } = require('../services/productService');
const { formatDayDateWIB } = require('../utils/time');

module.exports = (bot) => {
    bot.command('stok', async (ctx) => {
        try {
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

            await ctx.reply(text);
        } catch (error) {
            console.error('Error in /stok:', error);
            ctx.reply('Gagal mengambil data stok.');
        }
    });
};
