const { getVariantById, getProductById } = require('../services/productService');
const { createOrder, getUserTransactions } = require('../services/orderService');
const { getOrCreateUser } = require('../services/userService');
const { formatRupiah } = require('../utils/format');
const { formatDateTimeWIB } = require('../utils/time');
const { Markup } = require('telegraf');

// Helper to safely edit message caption if it has a photo, otherwise edit message text
async function safeEditMessage(ctx, text, keyboardMarkup) {
    if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo) {
        return await ctx.editMessageCaption(text, {
            reply_markup: keyboardMarkup?.reply_markup
        }).catch(()=>{});
    } else {
        return await ctx.editMessageText(text, keyboardMarkup).catch(()=>{});
    }
}

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
        text += `🔐 Account Details\n`;
        
        // Wait, Telegraf max length is 4096. Account details can be long.
        // Send the header first
        await safeEditMessage(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Menu Utama', 'menu_utama')]])).catch(()=>{});
        
        // Send details individually
        for (const item of res.items) {
            await ctx.reply(item);
        }

        const { sendTestimoni } = require('../utils/testimoni');
        sendTestimoni(bot, { total_price: res.total_price, payment_method: 'saldo', invoice_id: res.invoice_id }, product, variant, user);
    });

    bot.action('pay_qris', async (ctx) => {
        if (!ctx.session || !ctx.session.order) return ctx.answerCbQuery('Sesi habis.', { show_alert: true });
        
        const { variantId, qty } = ctx.session.order;
        const user = await getOrCreateUser(ctx);
        const variant = await getVariantById(variantId);
        if(!variant) return ctx.answerCbQuery('Varian tidak ditemukan.');

        const product = await getProductById(variant.product_id);
        const total = variant.price * qty;

        // Check stock first
        const db = require('../database/db');
        const dbInstance = await db.getDB();
        const availableStocks = await dbInstance.all('SELECT id FROM stock_items WHERE variant_id = ? AND status = "available" LIMIT ?', [variantId, qty]);
        if (availableStocks.length < qty) {
            return ctx.answerCbQuery('❌ Stok tidak mencukupi.', { show_alert: true });
        }

        const { getSetting } = require('../services/adminService');
        const qrisMode = await getSetting('qris_mode') || 'manual';

        if (qrisMode === 'dynamic') {
            const { createPendingOrder } = require('../services/orderService');
            const { createDynamicQRIS } = require('../services/midtransService');
            
            // Create pending transaction first
            const tx = await createPendingOrder(user.id, variant.product_id, variantId, qty, 'qris_dynamic');
            
            try {
                // Generate QRIS using Midtrans
                const midtransResponse = await createDynamicQRIS(tx.invoice_id, tx.total_price);
                const qrUrl = midtransResponse.actions.find(a => a.name === 'generate-qr-code')?.url;
                
                // Update TX with QR URL
                await dbInstance.run('UPDATE transactions SET payment_qr_url = ? WHERE invoice_id = ?', [qrUrl, tx.invoice_id]);

                let text = `💳 Pembayaran QRIS Dinamis\n\n`;
                text += `ID Transaksi: ${tx.invoice_id}\n`;
                text += `Produk: ${product.name}\n`;
                text += `Variant: ${variant.name}\n`;
                text += `Jumlah: ${qty}\n`;
                text += `Total: Rp ${formatRupiah(total)}\n\n`;
                text += `Silakan scan QRIS berikut.\nQRIS berlaku selama 5 menit.`;

                const kb = Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Cek Status Pembayaran', `cek_status_qris:${tx.invoice_id}`)],
                    [Markup.button.callback('❌ Batalkan', `cancel_order:${tx.invoice_id}`)]
                ]);

                ctx.session.order = null;
                
                if (qrUrl) {
                    await safeEditMessage(ctx, 'Mohon tunggu, generate QRIS...').catch(()=>{});
                    await ctx.deleteMessage().catch(()=>{});
                    await ctx.replyWithPhoto(qrUrl, { caption: text, reply_markup: kb.reply_markup });
                } else {
                    await safeEditMessage(ctx, '❌ Gagal mendapatkan QRIS dari payment gateway.');
                }
            } catch (error) {
                console.error(error);
                await safeEditMessage(ctx, '❌ Terjadi kesalahan saat membuat QRIS Dinamis.');
            }
        } else {
            // Manual QRIS
            const qrisFileId = await getSetting('qris_file_id');
            if (!qrisFileId) return ctx.answerCbQuery('❌ QRIS belum diatur oleh admin.', { show_alert: true });

            ctx.session.order.total = total;
            ctx.session.order.qris_manual = true;
            
            let text = `Pembayaran QRIS Manual\n\nTotal: Rp ${formatRupiah(total)}\nSilakan transfer ke QRIS berikut dan kirim bukti transfer.`;
            const kb = Markup.inlineKeyboard([[Markup.button.callback('❌ Batalkan', 'cancel_order_session')]]);

            ctx.session.order = null;
            ctx.session.manual_qris_payment = {
                variantId, qty, total, productId: variant.product_id
            };
            
            await ctx.deleteMessage().catch(()=>{});
            await ctx.replyWithPhoto(qrisFileId, { caption: text, reply_markup: kb.reply_markup });
        }
    });

    bot.action('cancel_order_session', async (ctx) => {
        ctx.session.manual_qris_payment = null;
        ctx.session.order = null;
        await ctx.editMessageCaption('Pesanan dibatalkan.').catch(()=>{});
    });

    bot.action(/^cek_status_qris:(.+)$/, async (ctx) => {
        const invoiceId = ctx.match[1];
        const { getTransactionByInvoice } = require('../services/orderService');
        const tx = await getTransactionByInvoice(invoiceId);
        
        if (!tx) return ctx.answerCbQuery('Transaksi tidak ditemukan.', {show_alert: true});
        
        if (tx.status === 'pending') {
            if (new Date(tx.expired_at) < new Date()) {
                const db = await require('../database/db').getDB();
                await db.run('UPDATE transactions SET status = "expired" WHERE id = ?', [tx.id]);
                return ctx.answerCbQuery('❌ QRIS sudah kadaluarsa. Silakan buat pesanan baru.', {show_alert: true});
            }
            return ctx.answerCbQuery('⏳ Pembayaran belum diterima.', {show_alert: true});
        } else if (tx.status === 'success') {
            return ctx.answerCbQuery('✅ Pembayaran sudah berhasil. Akun telah dikirim.', {show_alert: true});
        } else if (tx.status === 'expired') {
            return ctx.answerCbQuery('❌ QRIS sudah kadaluarsa. Silakan buat pesanan baru.', {show_alert: true});
        } else {
            return ctx.answerCbQuery('❌ Pembayaran gagal atau dibatalkan.', {show_alert: true});
        }
    });

    bot.action(/^cancel_order:(.+)$/, async (ctx) => {
        const invoiceId = ctx.match[1];
        const db = await require('../database/db').getDB();
        await db.run('UPDATE transactions SET status = "cancelled" WHERE invoice_id = ? AND status = "pending"', [invoiceId]);
        await ctx.editMessageCaption('❌ Pesanan dibatalkan.').catch(()=>{});
    });

    bot.on('photo', async (ctx, next) => {
        if (ctx.session && ctx.session.manual_qris_payment) {
            const orderInfo = ctx.session.manual_qris_payment;
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const caption = ctx.message.caption || '-';
            const user = await getOrCreateUser(ctx);
            const { createPendingOrder } = require('../services/orderService');
            
            try {
                const tx = await createPendingOrder(user.id, orderInfo.productId, orderInfo.variantId, orderInfo.qty, 'qris_manual');
                const db = await require('../database/db').getDB();
                await db.run('UPDATE transactions SET proof_file_id = ?, proof_caption = ? WHERE invoice_id = ?', [fileId, caption, tx.invoice_id]);

                ctx.session.manual_qris_payment = null;

                await ctx.reply('✅ Bukti transfer berhasil dikirim.\nSilakan tunggu admin mengkonfirmasi pembayaran Anda.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Menu Utama', 'menu_utama')]]));

                const { formatDateTimeWIB } = require('../utils/time');
                const { getAllAdmins } = require('../services/userService');
                const product = await getProductById(orderInfo.productId);
                const variant = await getVariantById(orderInfo.variantId);
                const env = require('../config/env');
                
                let text = `🔔 PEMBAYARAN QRIS MANUAL BARU\n\n`;
                text += `👤 User: ${user.full_name}\n`;
                text += `🔗 Username: @${user.username || '-'}\n`;
                text += `🆔 Telegram ID: ${user.telegram_id}\n\n`;
                text += `🧾 ID Transaksi: ${tx.invoice_id}\n`;
                text += `📦 Produk: ${product.name}\n`;
                text += `🎛 Variant: ${variant.name}\n`;
                text += `🔢 Jumlah: ${orderInfo.qty}\n`;
                text += `💰 Total: Rp ${formatRupiah(orderInfo.total)}\n\n`;
                text += `📝 Caption Buyer:\n${caption}\n\n`;
                text += `Status: Menunggu konfirmasi admin.`;

                const keyboard = Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ ACC Pembayaran', `admin_qris_acc:${tx.invoice_id}`),
                        Markup.button.callback('❌ Tolak Pembayaran', `admin_qris_reject:${tx.invoice_id}`)
                    ]
                ]);

                const admins = await getAllAdmins();
                let adminIds = admins.map(a => a.telegram_id);
                if (env.OWNER_ID && !adminIds.includes(env.OWNER_ID)) {
                    adminIds.push(env.OWNER_ID);
                }

                if (adminIds.length > 0) {
                    for (const adminId of adminIds) {
                        await bot.telegram.sendPhoto(adminId, fileId, {
                            caption: text,
                            reply_markup: keyboard.reply_markup
                        }).catch(()=>{});
                    }
                }
            } catch (err) {
                console.error(err);
                ctx.reply('❌ Gagal memproses pesanan.');
            }
        } else {
            return next();
        }
    });

    bot.action('menu_riwayat', async (ctx) => {
        await handleRiwayat(ctx, true);
    });

    bot.command('riwayat', async (ctx) => {
        await handleRiwayat(ctx, false);
    });

    bot.action('menu_cara_order', async (ctx) => {
        await handleCaraOrder(ctx, true);
    });

    bot.command('caraorder', async (ctx) => {
        await handleCaraOrder(ctx, false);
    });
};

async function handleRiwayat(ctx, isEdit) {
    const user = await getOrCreateUser(ctx);
    const { getUserTransactions } = require('../services/orderService');
    const txs = await getUserTransactions(user.id);
    
    if (txs.length === 0) {
        const txt = 'Belum ada riwayat transaksi.';
        const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]]);
        return isEdit ? safeEditMessage(ctx, txt, kb) : ctx.reply(txt, kb);
    }

    let text = `🧾 RIWAYAT TRANSAKSI\n\n`;
    txs.forEach(t => {
        text += `ID: ${t.invoice_id || t.id} | ${t.created_at}\n`;
        text += `Produk: ${t.product_name} - ${t.variant_name || '-'}\n`;
        text += `Qty: ${t.qty} | Total: Rp ${formatRupiah(t.total_price)}\n`;
        text += `Status: ${t.status}\n\n`;
    });

    const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]]);
    if (isEdit) {
        await safeEditMessage(ctx, text, kb).catch(()=>{});
    } else {
        await ctx.reply(text, kb);
    }
}

async function handleCaraOrder(ctx, isEdit) {
    const text = `📖 CARA ORDER\n\n1. Klik List Produk\n2. Pilih produk\n3. Pilih varian\n4. Atur jumlah pesanan\n5. Bayar pakai saldo\n6. Produk dikirim otomatis oleh bot`;
    const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]]);
    if (isEdit) {
        await safeEditMessage(ctx, text, kb).catch(()=>{});
    } else {
        await ctx.reply(text, kb);
    }
}

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

        await safeEditMessage(ctx, text, keyboard).catch(() => {});
    } catch (err) {
        console.error(err);
    }
}
