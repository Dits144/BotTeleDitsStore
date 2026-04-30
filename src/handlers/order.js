const { getVariantById, getProductById } = require('../services/productService');
const { createOrder, getUserTransactions } = require('../services/orderService');
const { getOrCreateUser } = require('../services/userService');
const { formatRupiah } = require('../utils/format');
const { formatDateTimeWIB } = require('../utils/time');
const { Markup } = require('telegraf');

module.exports = (bot) => {
    bot.action(/^var_(\d+)$/, async (ctx) => {
        const variantId = parseInt(ctx.match[1]);
        ctx.session = ctx.session || {};
        ctx.session.order = { variantId, qty: 1 };
        await renderOrderConf(ctx);
    });

    bot.action(/^qty_([a-z]+)_(\d+)$/, async (ctx) => {
        const op = ctx.match[1];
        const val = parseInt(ctx.match[2]);
        
        if (!ctx.session || !ctx.session.order) return ctx.answerCbQuery('Sesi habis, silakan ulangi.', { show_alert: true });
        
        if (op === 'add') ctx.session.order.qty += val;
        if (op === 'sub') ctx.session.order.qty -= val;
        
        if (ctx.session.order.qty < 1) ctx.session.order.qty = 1;
        
        await renderOrderConf(ctx);
    });

    bot.action('refresh_order', async (ctx) => {
        if (!ctx.session || !ctx.session.order) return ctx.answerCbQuery().catch(()=>{});
        await renderOrderConf(ctx);
    });

    bot.action('pay_saldo', async (ctx) => {
        if (!ctx.session || !ctx.session.order) return ctx.answerCbQuery('Sesi habis.', { show_alert: true });
        
        const { variantId, qty } = ctx.session.order;
        const user = await getOrCreateUser(ctx);
        const variant = await getVariantById(variantId);
        if(!variant) return ctx.answerCbQuery('Varian tidak ditemukan.');

        const product = await getProductById(variant.product_id);

        const res = await createOrder(user.id, variant.product_id, variantId, qty, 'saldo');
        
        if (!res.success) {
            return ctx.answerCbQuery(`❌ ${res.message}`, { show_alert: true });
        }

        ctx.session.order = null;
        
        const currentUser = await getOrCreateUser(ctx); // refresh saldo

        let text = `✅ Pembayaran Berhasil\n`;
        text += `📅 Tanggal : ${formatDateTimeWIB()}\n\n`;
        text += `Informasi Pembelian:\n`;
        text += `ID Transaksi: ${res.invoice_id}\n`;
        text += `Produk: ${product.name}\n`;
        text += `Variant: ${variant.name}\n`;
        text += `Jumlah Pesanan: ${qty}\n`;
        text += `Total Pembayaran: Rp ${formatRupiah(res.total_price)}\n\n`;
        text += `💳 Sisa Saldo: Rp ${formatRupiah(currentUser.saldo)}\n\n`;
        
        // Wait, Telegraf max length is 4096. Account details can be long.
        // Send the header first
        await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Menu Utama', 'menu_utama')]])).catch(()=>{});
        
        // Send details individually
        for (const item of res.items) {
            await ctx.reply(item);
        }
    });

    bot.action('pay_qris', (ctx) => {
        ctx.answerCbQuery('Bayar dengan QRIS Belum Tersedia.', { show_alert: true });
    });

    bot.action('menu_riwayat', async (ctx) => {
        const user = await getOrCreateUser(ctx);
        const txs = await getUserTransactions(user.id);
        
        if (txs.length === 0) {
            return ctx.editMessageText('Belum ada riwayat transaksi.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]]));
        }

        let text = `🧾 RIWAYAT TRANSAKSI\n\n`;
        txs.forEach(t => {
            text += `ID: ${t.invoice_id || t.id} | ${t.created_at}\n`;
            text += `Produk: ${t.product_name} - ${t.variant_name || '-'}\n`;
            text += `Qty: ${t.qty} | Total: Rp ${formatRupiah(t.total_price)}\n`;
            text += `Status: ${t.status}\n\n`;
        });

        await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]])).catch(()=>{});
    });

    bot.action('menu_cara_order', async (ctx) => {
        const text = `📖 CARA ORDER\n\n1. Klik List Produk\n2. Pilih produk\n3. Pilih varian\n4. Atur jumlah pesanan\n5. Bayar pakai saldo\n6. Produk dikirim otomatis oleh bot`;
        await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]])).catch(()=>{});
    });
};

async function renderOrderConf(ctx) {
    try {
        const order = ctx.session.order;
        const variant = await getVariantById(order.variantId);
        if (!variant) return ctx.answerCbQuery('Varian tidak ditemukan.');
        
        const product = await getProductById(variant.product_id);
        
        if (order.qty > variant.stock) order.qty = variant.stock;
        if (order.qty < 1) order.qty = 1;
        
        const total = variant.price * order.qty;

        let text = `KONFIRMASI PESANAN\n╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
        text += `┊・Produk: ${product.name}\n`;
        text += `┊・Variant: ${variant.name}\n`;
        text += `┊・Harga: Rp ${formatRupiah(variant.price)}\n`;
        text += `┊・Garansi: ${variant.warranty || '-'}\n`;
        text += `┊・Stok tersedia: ${variant.stock}\n`;
        text += `┊ - - - - - - - - - - - - - - - - - - - - -\n`;
        text += `┊・Jumlah Pesanan: ${order.qty}\n`;
        text += `┊・Total Pembayaran: Rp ${formatRupiah(total)}\n`;
        text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
        text += `╰➤ Refresh at ${formatDateTimeWIB()}`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('-1', 'qty_sub_1'), Markup.button.callback('+1', 'qty_add_1')],
            [Markup.button.callback('-5', 'qty_sub_5'), Markup.button.callback('+5', 'qty_add_5')],
            [Markup.button.callback('-10', 'qty_sub_10'), Markup.button.callback('+10', 'qty_add_10')],
            [Markup.button.callback('💰 Bayar dengan Saldo', 'pay_saldo')],
            [Markup.button.callback('💳 Bayar dengan QRIS', 'pay_qris')],
            [Markup.button.callback('⬅️ Back', `prod_${product.id}`), Markup.button.callback('🔄 Refresh', 'refresh_order')]
        ]);

        await ctx.editMessageText(text, keyboard).catch(() => {});
    } catch (err) {
        console.error(err);
    }
}
