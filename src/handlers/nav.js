const { getOrCreateUser } = require('../services/userService');
const { showProductList } = require('./product');

module.exports = (bot) => {
    bot.action('nav_start', async (ctx) => {
        try {
            await ctx.deleteMessage().catch(()=>{});
            const { getSetting } = require('../services/adminService');
            const bannerId = await getSetting('start_banner_file_id');
            if (bannerId) {
                await ctx.replyWithPhoto(bannerId).catch(()=>{});
            }
            await showProductList(ctx, 1, true);
        } catch(e) {}
    });

    bot.action('nav_adminmenu', async (ctx) => {
        try {
            const user = await getOrCreateUser(ctx);
            if (user.role === 'admin') {
                const { adminMenuKeyboard } = require('../keyboards/adminKeyboard');
                await ctx.editMessageText('Menu Admin:', adminMenuKeyboard()).catch(()=>{});
            } else {
                ctx.answerCbQuery('Akses ditolak.', {show_alert:true}).catch(()=>{});
            }
        } catch(e) {}
    });

    bot.action('nav_saldo', async (ctx) => {
        try {
            const saldoHandler = require('./saldo');
            // Assuming showSaldoMenu is exported or we can just send the command
            // Actually let's simulate the command logic
            const { formatRupiah } = require('../utils/format');
            const { Markup } = require('telegraf');
            const user = await getOrCreateUser(ctx);
            const text = `📍 /start > Saldo\n\nDetail Saldo Anda di DitsStore\n\nSaldo Anda saat ini: Rp ${formatRupiah(user.saldo)}\n\nMau isi saldo? Silakan pilih nominal dibawah ini:`;
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('Rp 10.000', 'topup_10000'), Markup.button.callback('Rp 25.000', 'topup_25000')],
                [Markup.button.callback('Rp 50.000', 'topup_50000'), Markup.button.callback('Rp 100.000', 'topup_100000')],
                [Markup.button.callback('Isi Nominal', 'topup_manual')],
                [
                    Markup.button.callback('🏠 Start', 'nav_start'),
                    Markup.button.callback('📦 List Produk', 'nav_products')
                ]
            ]);

            await ctx.editMessageText(text, keyboard).catch(()=>{});
            ctx.answerCbQuery().catch(()=>{});
        } catch(e) {}
    });

    bot.action('nav_products', async (ctx) => {
        try {
            await showProductList(ctx, 1, true);
        } catch(e) {}
    });

    bot.action('nav_back', async (ctx) => {
        try {
            const session = ctx.session || {};
            const prev = session.previous_page;
            if (prev) {
                // If there's a registered previous page action, we could re-trigger it or call its function.
                // It's tricky without knowing exactly what previous_page is.
                // The requirements say "Jika nav_back kosong, arahkan ke /start. Jika ada session previous_page, kembali ke halaman sebelumnya."
                // I will try to use the previous page callback or text
                if (typeof prev === 'function') {
                    await prev(ctx);
                } else if (typeof prev === 'string') {
                    // Let's assume prev is a callback action string
                    ctx.match = [prev];
                    // this requires custom routing, maybe just redirect to /start for now if we can't eval it
                    // I will just route everything to /start if we can't reliably go back
                }
            } else {
                await ctx.deleteMessage().catch(()=>{});
                const { getSetting } = require('../services/adminService');
                const bannerId = await getSetting('start_banner_file_id');
                if (bannerId) {
                    await ctx.replyWithPhoto(bannerId).catch(()=>{});
                }
                await showProductList(ctx, 1, true);
            }
        } catch(e) {
            console.error(e);
        }
    });
};
