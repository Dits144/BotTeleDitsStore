const { getOrCreateUser, getAllUsers, updateUserSaldo, getAllUsersForBroadcast, getUserById } = require('../services/userService');
const { getDashboardStats, setAdmin, getSetting, setSetting, getSalesStatistics, getAllSettings } = require('../services/adminService');
const { getPendingTopups, processTopup } = require('../services/topupService');
const { 
    getAllProductsAdmin, getVariantsAdmin, addProduct, updateProduct, deleteProduct, 
    addVariant, updateVariant, deleteVariant, addSingleStockItem, getAllProductsStokReport, getProductById, getVariantById, getSoldStocksAdmin, getAvailableStocksAdmin, getStockContent, deleteStockItem
} = require('../services/productService');
const { getAllTransactions } = require('../services/orderService');
const { formatRupiah } = require('../utils/format');
const { adminMenuKeyboard, backToAdminMenu } = require('../keyboards/adminKeyboard');
const env = require('../config/env');
const { Markup } = require('telegraf');

const isAdmin = async (ctx) => {
    const user = await getOrCreateUser(ctx);
    return user.role === 'admin';
};

const backBtnAdmin = [Markup.button.callback('⬅️ Kembali Admin Menu', 'admin_menu')];

module.exports = (bot) => {
    bot.command('adminmenu', async (ctx) => {
        const user = await getOrCreateUser(ctx);
        if (user.role === 'admin') {
            await ctx.reply('Menu Admin:', adminMenuKeyboard());
        } else {
            await ctx.reply('❌ Anda tidak memiliki akses admin.');
        }
    });

    bot.action('admin_menu', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.', { show_alert: true });
        if (ctx.session) { ctx.session.admin = null; }
        await ctx.editMessageText('Menu Admin:', adminMenuKeyboard()).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_dashboard', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        try {
            const stats = await getDashboardStats();
            let text = `📊 DASHBOARD ADMIN\n\n`;
            text += `- Total User: ${stats.totalUsers}\n`;
            text += `- Total Produk: ${stats.totalProducts}\n`;
            text += `- Total Varian: ${stats.totalVariants}\n`;
            text += `- Total Trx Sukses: ${stats.totalSuccessTx}\n`;
            text += `- Total Pendapatan: Rp ${formatRupiah(stats.totalIncome)}\n`;
            text += `- Topup Pending: ${stats.totalPendingTopups}\n`;
            await ctx.editMessageText(text, Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
            ctx.answerCbQuery().catch(()=>{});
        } catch (err) {
            console.error(err);
        }
    });

    // 1. TAMBAH PRODUK
    bot.action('admin_add_product', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {};
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'add_prod_name' };
        await ctx.editMessageText('Masukkan nama produk baru:', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 2. HAPUS PRODUK
    bot.action('admin_del_product', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showProductSelection(ctx, 'admin_delete_product_select', 1, 'Pilih produk yang ingin dihapus:');
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_delete_product_select_page:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showProductSelection(ctx, 'admin_delete_product_select', parseInt(ctx.match[1]), 'Pilih produk yang ingin dihapus:');
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_delete_product_select:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const p = await getProductById(id);
        if(!p) return ctx.answerCbQuery('Produk tidak ditemukan.', {show_alert:true}).catch(()=>{});

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya, Hapus', `admin_delete_product_confirm:${id}`)],
            [Markup.button.callback('❌ Tidak', 'admin_delete_product_cancel')]
        ]);
        
        let text = `⚠️ Konfirmasi Hapus Produk\n\n`;
        text += `Apakah Anda yakin ingin menghapus produk:\n${p.name}?\n\n`;
        text += `Tindakan ini akan menghapus:\n`;
        text += `- Produk dari List Produk\n`;
        text += `- Semua variasi produk\n`;
        text += `- Semua stok produk\n`;

        await ctx.editMessageText(text, kb).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_delete_product_confirm:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const p = await getProductById(id);
        if (!p) return ctx.answerCbQuery('Produk tidak ditemukan.', {show_alert:true}).catch(()=>{});
        
        await deleteProduct(id);
        ctx.answerCbQuery(`Produk dihapus.`).catch(()=>{});
        await ctx.editMessageText(`✅ Produk ${p.name} berhasil dihapus.`, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Kembali ke Hapus Produk', 'admin_del_product')],
            [Markup.button.callback('🏠 Menu Utama', 'admin_menu')]
        ])).catch(()=>{});
    });

    bot.action('admin_delete_product_cancel', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showProductSelection(ctx, 'admin_delete_product_select', 1, 'Pilih produk yang ingin dihapus:');
        ctx.answerCbQuery().catch(()=>{});
    });

    // 3. KELOLA PRODUK
    bot.action('admin_manage_product', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showProductSelection(ctx, 'admin_manage_product', 1, 'Pilih produk yang ingin dikelola:');
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_manage_product_page:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showProductSelection(ctx, 'admin_manage_product', parseInt(ctx.match[1]), 'Pilih produk yang ingin dikelola:');
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_manage_product:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        await sendKelolaProdukMenuEdit(ctx, id);
        ctx.answerCbQuery().catch(()=>{});
    });

    // MP - UPDATE DESK
    bot.action(/admin_mp_upddesk_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'mp_update_desc', id };
        await ctx.editMessageText('Masukkan isi desk/deskripsi produk:', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `admin_manage_product:${id}`)]])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // MP - ADD VARIASI
    bot.action(/admin_mp_addvar_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'WAITING_VARIANT_NAME', selected_product_id: id };
        await ctx.editMessageText('Kirim nama varian.\nContoh: CHATGPT PLUS 1 BULAN', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `admin_manage_product:${id}`)]])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // MP - DEL VARIASI
    bot.action(/admin_mp_delvar_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showVariantSelection(ctx, parseInt(ctx.match[1]), 'admin_delete_variant_select');
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_delete_variant_select:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const v = await getVariantById(id);
        if (!v) return ctx.answerCbQuery('❌ Varian tidak ditemukan.', {show_alert:true}).catch(()=>{});
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya', `admin_delete_variant_confirm:${id}`), Markup.button.callback('❌ Tidak', `admin_manage_product:${v.product_id}`)]
        ]);
        await ctx.editMessageText(`Apakah yakin ingin menghapus variasi ${v.name}?`, kb).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_delete_variant_confirm:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const v = await getVariantById(id);
        if (!v) return ctx.answerCbQuery('❌ Varian tidak ditemukan.', {show_alert:true}).catch(()=>{});
        await deleteVariant(id);
        ctx.answerCbQuery('✅ Variasi berhasil dihapus.', { show_alert: true }).catch(()=>{});
        await sendKelolaProdukMenuEdit(ctx, v.product_id);
    });

    // MP - ADD STOK
    bot.action(/admin_mp_addstok_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showVariantSelection(ctx, parseInt(ctx.match[1]), 'admin_add_stock_variant');
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_add_stock_variant:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const v = await getVariantById(id);
        if (!v) return ctx.answerCbQuery('❌ Varian tidak ditemukan.', {show_alert:true}).catch(()=>{});
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'mp_addstok', id };
        await ctx.editMessageText('Kirim stok dengan format:\nemail@account detail lengkap\n\nContoh:\nnapss57@6ub.capcut.asia@🔐 Account Details...', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `admin_manage_product:${v.product_id}`)]])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // MP - LIST STOK
    bot.action(/admin_mp_liststok_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showVariantSelection(ctx, parseInt(ctx.match[1]), 'admin_list_stock_variant');
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_list_stock_variant:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const variantId = parseInt(ctx.match[1]);
        const variant = await getVariantById(variantId);
        if (!variant) return ctx.answerCbQuery('❌ Varian tidak ditemukan.', {show_alert:true}).catch(()=>{});
        const product = await getProductById(variant.product_id);
        const stocks = await getAvailableStocksAdmin(variantId);
        
        let text = `LIST STOK\nProduk: ${product.name}\nVariasi: ${variant.name}\n\n`;
        const kbRows = [];
        let currentRow = [];

        if (stocks.length === 0) {
            text += '❌ Stok tersedia masih kosong.';
        } else {
            stocks.forEach((s, i) => {
                text += `(${i + 1}). ${s.stock_label}\n`;
                currentRow.push(Markup.button.callback(`[${i + 1}]`, `admin_mp_viewstok_${s.id}`));
                if (currentRow.length === 5) {
                    kbRows.push(currentRow);
                    currentRow = [];
                }
            });
            if (currentRow.length > 0) kbRows.push(currentRow);
        }

        kbRows.push([Markup.button.callback('⬅️ Back', `admin_manage_product:${product.id}`)]);
        await ctx.editMessageText(text, Markup.inlineKeyboard(kbRows)).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // MP - DEL STOK
    bot.action(/admin_mp_delstok_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        await showVariantSelection(ctx, parseInt(ctx.match[1]), 'admin_del_stock_variant');
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_del_stock_variant:(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const variantId = parseInt(ctx.match[1]);
        const variant = await getVariantById(variantId);
        if (!variant) return ctx.answerCbQuery('❌ Varian tidak ditemukan.', {show_alert:true}).catch(()=>{});
        const product = await getProductById(variant.product_id);
        const stocks = await getAvailableStocksAdmin(variantId);
        
        let text = `DEL STOK\nProduk: ${product.name}\nVariasi: ${variant.name}\n\nPilih stok yang akan dihapus:`;
        const kbRows = [];
        
        if (stocks.length === 0) {
            text = `❌ Stok tersedia masih kosong.`;
        } else {
            stocks.forEach((s, i) => {
                kbRows.push([Markup.button.callback(`[${i + 1}] ${s.stock_label}`, `admin_mp_delstok_item_${s.id}`)]);
            });
        }
        
        kbRows.push([Markup.button.callback('⬅️ Back', `admin_manage_product:${product.id}`)]);
        await ctx.editMessageText(text, Markup.inlineKeyboard(kbRows)).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_mp_delstok_item_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const stockContent = await getStockContent(id); 
        if (!stockContent) return ctx.answerCbQuery('Stok tidak ditemukan.', {show_alert:true}).catch(()=>{});
        
        const db = require('../database/db');
        const dbInstance = await db.getDB();
        const stockInfo = await dbInstance.get("SELECT stock_label, variant_id FROM stock_items WHERE id = ?", [id]);
        
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('Ya', `admin_mp_delstok_conf_${id}`), Markup.button.callback('Tidak', `admin_del_stock_variant:${stockInfo.variant_id}`)]
        ]);
        await ctx.editMessageText(`Apakah yakin ingin menghapus stok ${stockInfo.stock_label}?`, kb).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_mp_delstok_conf_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const db = require('../database/db');
        const dbInstance = await db.getDB();
        const stockInfo = await dbInstance.get("SELECT variant_id FROM stock_items WHERE id = ?", [id]);
        await deleteStockItem(id);
        ctx.answerCbQuery('✅ Stok berhasil dihapus.', { show_alert: true }).catch(()=>{});
        if(stockInfo) {
            await showVariantSelection(ctx, stockInfo.variant_id, 'admin_del_stock_variant');
        } else {
            await ctx.editMessageText('Menu Admin:', adminMenuKeyboard()).catch(()=>{});
        }
    });

    // 4. Lihat Stok Terjual
    bot.action('admin_view_sold_stok', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        await showSoldStocks(ctx, 1);
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_vss_page_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        await showSoldStocks(ctx, parseInt(ctx.match[1]));
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action(/admin_vss_det_(\d+)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const content = await getStockContent(parseInt(ctx.match[1]));
        await ctx.reply(`Detail Content:\n\n${content}`);
        ctx.answerCbQuery().catch(()=>{});
    });

    // 9. Konfirmasi Pembayaran
    bot.action('admin_confirm_payment', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const { getPendingTopups } = require('../services/topupService');
        const pending = await getPendingTopups();
        if (pending.length === 0) {
            await ctx.editMessageText('Tidak ada top up pending.', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
            return ctx.answerCbQuery().catch(()=>{});
        }
        const topup = pending[0];
        let text = `TOP UP PENDING\n\nUser: ${topup.full_name}\nUsername: @${topup.username || '-'}\nNominal: Rp ${formatRupiah(topup.amount)}\nWaktu: ${topup.created_at}\n\nSisa pending: ${pending.length - 1}`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ ACC Top Up', `admin_topup_acc:${topup.id}`),
                Markup.button.callback('❌ Tolak Top Up', `admin_topup_reject:${topup.id}`)
            ],
            backBtnAdmin
        ]);
        await ctx.deleteMessage().catch(()=>{});
        if(topup.proof_file_id) await ctx.replyWithPhoto(topup.proof_file_id, { caption: text, reply_markup: keyboard.reply_markup }).catch(()=>{});
        else await ctx.reply(text, keyboard).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/^admin_topup_acc:(\d+)$/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const userAdmin = await getOrCreateUser(ctx);
        const { processTopup, getTopupById } = require('../services/topupService');
        const { getUserById } = require('../services/userService');
        
        const topupBefore = await getTopupById(id);
        if (!topupBefore || topupBefore.status !== 'pending') {
            return ctx.answerCbQuery('⚠️ Top up ini sudah diproses.', { show_alert: true }).catch(()=>{});
        }
        
        const topup = await processTopup(id, 'approved', userAdmin.id);
        if (topup) {
            await ctx.answerCbQuery('Top up berhasil di-ACC.', { show_alert: true }).catch(()=>{});
            
            const full_name = topupBefore.full_name;
            const amount = topup.amount;
            const u = await getUserById(topup.user_id);
            const new_balance = u ? u.saldo : 0;
            
            await ctx.editMessageCaption(`✅ Top up Rp ${formatRupiah(amount)} milik ${full_name} berhasil di-ACC.`).catch(()=>{});
            
            let notifText = `✅ Top Up Saldo Berhasil\n\n`;
            notifText += `Saldo Anda telah ditambahkan:\n💰 Rp ${formatRupiah(amount)}\n\n`;
            notifText += `💳 Saldo sekarang: Rp ${formatRupiah(new_balance)}\n\n`;
            notifText += `Sekarang saldo Anda bisa digunakan untuk transaksi di DitsStore.`;
            
            bot.telegram.sendMessage(topup.user_id, notifText).catch(()=>{});
        } else {
            await ctx.answerCbQuery('Gagal ACC top up (mungkin sudah diproses).', { show_alert: true }).catch(()=>{});
        }
    });

    bot.action(/^admin_topup_reject:(\d+)$/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        const id = parseInt(ctx.match[1]);
        const userAdmin = await getOrCreateUser(ctx);
        const { processTopup, getTopupById } = require('../services/topupService');
        
        const topupBefore = await getTopupById(id);
        if (!topupBefore || topupBefore.status !== 'pending') {
            return ctx.answerCbQuery('⚠️ Top up ini sudah diproses.', { show_alert: true }).catch(()=>{});
        }
        
        const topup = await processTopup(id, 'rejected', userAdmin.id);
        if (topup) {
            await ctx.answerCbQuery('Top up ditolak.', { show_alert: true }).catch(()=>{});
            
            const full_name = topupBefore.full_name;
            const amount = topup.amount;
            
            await ctx.editMessageCaption(`❌ Top up Rp ${formatRupiah(amount)} milik ${full_name} berhasil ditolak.`).catch(()=>{});
            
            let notifText = `❌ Top Up Ditolak\n\n`;
            notifText += `Top up saldo Rp ${formatRupiah(amount)} ditolak oleh admin.\n`;
            notifText += `Silakan hubungi admin jika merasa ada kesalahan.`;
            
            bot.telegram.sendMessage(topup.user_id, notifText).catch(()=>{});
        } else {
            await ctx.answerCbQuery('Gagal menolak top up.', { show_alert: true }).catch(()=>{});
        }
    });

    // 10. Data User
    bot.action(/admin_data_user(?:_(\d+))?/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const page = parseInt(ctx.match[1] || 1);
        const res = await getAllUsers(page, 5);
        let text = `👥 DATA USER\n\n`;
        res.users.forEach(u => {
            text += `ID: ${u.id} | Telegram: ${u.telegram_id}\nNama: ${u.full_name} (@${u.username})\nSaldo: Rp ${formatRupiah(u.saldo)}\nTotal Belanja: Rp ${formatRupiah(u.total_spent)}\nRole: ${u.role}\n\n`;
        });
        const nav = [];
        if (page > 1) nav.push(Markup.button.callback('⬅️ Prev', `admin_data_user_${page - 1}`));
        if (page < res.totalPages) nav.push(Markup.button.callback('Next ➡️', `admin_data_user_${page + 1}`));
        
        await ctx.editMessageText(`${text}`, Markup.inlineKeyboard([nav, [Markup.button.callback('🔍 Cari User', 'admin_search_user')], backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_search_user', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'search_user' };
        await ctx.editMessageText('Masukkan username atau Telegram ID user:', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 11. Riwayat Transaksi Semua
    bot.action(/admin_all_transactions(?:_(all|today|7days|30days))?(?:_(\d+))?/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const filter = ctx.match[1] || 'all';
        const page = parseInt(ctx.match[2] || 1);
        
        const res = await getAllTransactions(page, 5, filter);
        let text = `🧾 RIWAYAT TRANSAKSI (${filter.toUpperCase()})\n\n`;
        res.transactions.forEach(t => {
            text += `${t.created_at} | Rp ${formatRupiah(t.total_price)}\nUser: ${t.full_name} | Produk: ${t.product_name} (${t.variant_name || '-'})\nQty: ${t.qty} | Status: ${t.status}\n\n`;
        });

        const filters = [
            Markup.button.callback('Hari Ini', `admin_all_transactions_today_1`),
            Markup.button.callback('7 Hari', `admin_all_transactions_7days_1`),
            Markup.button.callback('30 Hari', `admin_all_transactions_30days_1`),
            Markup.button.callback('Semua', `admin_all_transactions_all_1`)
        ];
        
        const nav = [];
        if (page > 1) nav.push(Markup.button.callback('⬅️ Prev', `admin_all_transactions_${filter}_${page - 1}`));
        if (page < res.totalPages) nav.push(Markup.button.callback('Next ➡️', `admin_all_transactions_${filter}_${page + 1}`));

        await ctx.editMessageText(`${text}`, Markup.inlineKeyboard([filters, nav, backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 12 & 13 Saldo
    bot.action('admin_add_saldo', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'saldo_search_user', type: 'add' };
        await ctx.editMessageText('Masukkan Username atau Telegram ID user untuk ditambah saldonya:', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_reduce_saldo', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'saldo_search_user', type: 'reduce' };
        await ctx.editMessageText('Masukkan Username atau Telegram ID user untuk dikurangi saldonya:', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 14 & 15 QRIS
    bot.action('admin_upload_qris', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'admin_upload_qris' };
        await ctx.editMessageText('Silakan kirim foto/gambar QRIS baru.', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });
    bot.action('admin_update_qris', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'admin_upload_qris' };
        await ctx.editMessageText('Silakan kirim foto/gambar QRIS baru untuk mengupdate.', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 16 Broadcast
    bot.action('admin_broadcast', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'broadcast_msg' };
        await ctx.editMessageText('Kirim teks pesan broadcast:', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_confirm_broadcast', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const msg = ctx.session.admin.broadcastText;
        if (!msg) return ctx.answerCbQuery('Pesan kosong.');
        
        const users = await getAllUsersForBroadcast();
        let success = 0; let failed = 0;
        
        await ctx.editMessageText().catch(()=>{});
        for(let u of users) {
            try {
                await bot.telegram.sendMessage(u.telegram_id, `📢 BROADCAST MESSAGE\n\n${msg}`);
                success++;
            } catch(e) {
                failed++;
            }
        }
        await ctx.reply(`✅ Broadcast selesai.\nBerhasil: ${success}\nGagal: ${failed}`, Markup.inlineKeyboard([backBtnAdmin]));
        ctx.answerCbQuery().catch(()=>{});
    });

    // 17 Statistik
    bot.action('admin_statistics', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const stats = await getSalesStatistics();
        let text = `📈 STATISTIK PENJUALAN\n\n`;
        text += `- Total Trx Sukses: ${stats.totalSuccessTx}\n`;
        text += `- Total Pendapatan: Rp ${formatRupiah(stats.totalIncome)}\n`;
        text += `- Total Produk Terjual: ${stats.totalProductsSold}\n\n`;
        text += `- Pendapatan Hari Ini: Rp ${formatRupiah(stats.incomeToday)}\n`;
        text += `- Pendapatan 7 Hari: Rp ${formatRupiah(stats.income7Days)}\n`;
        text += `- Pendapatan 30 Hari: Rp ${formatRupiah(stats.income30Days)}\n\n`;
        text += `🔥 Produk Terlaris:\n`;
        stats.topProducts.forEach(p => text += `  - ${p.name} (${p.sold_count}x)\n`);
        text += `\n🏆 Top Buyer:\n`;
        stats.topBuyers.forEach(b => text += `  - ${b.full_name || b.username} (Rp ${formatRupiah(b.total_spent)})\n`);

        await ctx.editMessageText(`${text}`, Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // 18 Setting Bot
    bot.action('admin_settings', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('Nama Toko', 'admin_set_toko'), Markup.button.callback('Pesan Welcome', 'admin_set_welcome')],
            [Markup.button.callback('Minimal Topup', 'admin_set_min_topup'), Markup.button.callback('QRIS Mode', 'admin_set_qris_mode')],
            [Markup.button.callback('Maintenance Status', 'admin_set_mt'), Markup.button.callback('Contact Admin', 'admin_set_contact')],
            [Markup.button.callback('Upload Start Banner', 'admin_upload_banner'), Markup.button.callback('Update Start Banner', 'admin_update_banner')],
            [Markup.button.callback('🧹 Clear All Data', 'admin_clear_all_data')],
            backBtnAdmin
        ]);
        await ctx.editMessageText('⚙️ Setting Bot\nPilih pengaturan yang ingin diubah:', kb).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_set_(toko|welcome|min_topup|contact)/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const type = ctx.match[1];
        ctx.session = ctx.session || {}; ctx.session.admin = { step: `setting_${type}` };
        await ctx.editMessageText(`Masukkan nilai baru untuk pengaturan ini:`, Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action(/admin_set_mt/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const val = await getSetting('mt') === '1' ? '0' : '1';
        await setSetting('mt', val);
        await ctx.answerCbQuery(`Status berhasil diubah menjadi: ${val === '1' ? 'ON' : 'OFF'}`, { show_alert: true });
    });

    bot.action('admin_set_qris_mode', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const current = await getSetting('qris_mode') || 'manual';
        const newVal = current === 'dynamic' ? 'manual' : 'dynamic';
        await setSetting('qris_mode', newVal);
        await ctx.answerCbQuery(`QRIS Mode diubah menjadi: ${newVal.toUpperCase()} ${newVal === 'dynamic' ? '(ON)' : '(OFF)'}`, { show_alert: true });
    });

    bot.action(/^admin_qris_acc:(.+)$/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const invoiceId = ctx.match[1];
        const { updateOrderToSuccess } = require('../services/orderService');
        
        const res = await updateOrderToSuccess(invoiceId);
        if (!res.success) {
            return ctx.answerCbQuery(`❌ Gagal: ${res.message || (res.outOfStock ? 'Stok Habis' : 'Error')}`, { show_alert: true });
        }
        
        await ctx.editMessageCaption(`✅ Pembayaran QRIS Manual untuk ${invoiceId} berhasil di-ACC.`).catch(()=>{});
        
        const tx = res.transaction;
        let text = `✅ Pembayaran Berhasil di-ACC admin\n`;
        text += `📅 Tanggal : ${require('../utils/time').formatDateTimeWIB()}\n\n`;
        text += `Informasi Pembelian:\n`;
        text += `ID Transaksi: ${tx.invoice_id}\n`;
        text += `Jumlah Pesanan: ${tx.qty}\n`;
        text += `Total Pembayaran: Rp ${formatRupiah(tx.total_price)}\n\n`;
        text += `🔐 Account Details\n`;
        
        bot.telegram.sendMessage(tx.user_id, text).then(async () => {
            for (const item of res.items) {
                await bot.telegram.sendMessage(tx.user_id, item);
            }
            const { getProductById, getVariantById } = require('../services/productService');
            const { getUserById } = require('../services/userService');
            const product = await getProductById(tx.product_id);
            const variant = await getVariantById(tx.variant_id);
            const user = await getUserById(tx.user_id);
            
            const { sendTestimoni } = require('../utils/testimoni');
            sendTestimoni(bot, { total_price: tx.total_price, payment_method: 'qris_manual', invoice_id: tx.invoice_id }, product, variant, user);
        }).catch(()=>{});
    });

    bot.action(/^admin_qris_reject:(.+)$/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const invoiceId = ctx.match[1];
        const db = await require('../database/db').getDB();
        
        const tx = await db.get('SELECT * FROM transactions WHERE invoice_id = ?', [invoiceId]);
        if (!tx || tx.status !== 'pending') return ctx.answerCbQuery('Transaksi sudah diproses.', {show_alert:true});
        
        await db.run('UPDATE transactions SET status = "rejected", rejected_at = CURRENT_TIMESTAMP WHERE id = ?', [tx.id]);
        
        await ctx.editMessageCaption(`❌ Pembayaran QRIS Manual untuk ${invoiceId} ditolak.`).catch(()=>{});
        
        const text = `❌ Pembayaran QRIS Anda ditolak admin.\nSilakan hubungi admin jika ada kesalahan.`;
        bot.telegram.sendMessage(tx.user_id, text).catch(()=>{});
    });

    bot.action(/admin_(upload|update)_banner/, async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.').catch(()=>{});
        ctx.session = ctx.session || {}; ctx.session.admin = { step: 'admin_upload_banner' };
        await ctx.editMessageText('Silakan kirim foto/gambar banner untuk /start.', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_clear_all_data', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const user = await getOrCreateUser(ctx);
        if (user.telegram_id.toString() !== env.OWNER_ID.toString()) {
            return ctx.answerCbQuery('❌ Fitur ini hanya untuk owner.', { show_alert: true });
        }

        let text = `⚠️ PERINGATAN!\nFitur ini akan menghapus SEMUA data:\n`;
        text += `- Produk\n- Varian\n- Stok\n- Transaksi\n- Top up\n- Riwayat saldo\n- User saldo akan di-reset ke 0\n\n`;
        text += `Apakah Anda yakin?`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya, Clear All', 'admin_confirm_clear_all')],
            [Markup.button.callback('❌ Batal', 'admin_settings')]
        ]);

        await ctx.editMessageText(text, kb).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('admin_confirm_clear_all', async (ctx) => {
        if (!(await isAdmin(ctx))) return ctx.answerCbQuery('Akses ditolak.');
        const user = await getOrCreateUser(ctx);
        if (user.telegram_id.toString() !== env.OWNER_ID.toString()) {
            return ctx.answerCbQuery('❌ Fitur ini hanya untuk owner.', { show_alert: true });
        }

        ctx.session = ctx.session || {};
        ctx.session.admin = { step: 'clear_all_input' };
        await ctx.editMessageText('Ketik konfirmasi manual:\n\nCLEAR ALL DITSSTORE', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
        ctx.answerCbQuery().catch(()=>{});
    });

    // FALLBACK
    bot.action(/.*/, async (ctx, next) => {
        if (ctx.match[0].startsWith('admin_')) {
             return ctx.answerCbQuery('⚠️ Menu tidak dikenali atau sudah kedaluwarsa. Silakan buka /adminmenu lagi.', { show_alert: true });
        }
        return next();
    });

    // TEXT HANDLER
    bot.on('text', async (ctx, next) => {
        if (!ctx.session || !ctx.session.admin || !ctx.session.admin.step) {
             const textLower = ctx.message.text.toLowerCase();
             if (textLower === 'list produk' && require('./product').showProductList) {
                  return require('./product').showProductList(ctx, 1);
             }
             return next();
        }
        
        const step = ctx.session.admin.step;
        const text = ctx.message.text;

        if (step === 'input_admin_password') {
            if (text === env.ADMIN_PASSWORD) {
                const user = await getOrCreateUser(ctx);
                await setAdmin(user.id);
                ctx.session = ctx.session || {}; ctx.session.admin = null;
                await ctx.reply('✅ Akses Admin diberikan.', adminMenuKeyboard());
            } else {
                ctx.session = ctx.session || {}; ctx.session.admin = null;
                await ctx.reply('❌ Password salah.');
            }
        } 
        else if (step === 'add_prod_name') {
            await addProduct(text);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Produk berhasil ditambahkan ke List Produk.', adminMenuKeyboard());
        }
        else if (step === 'mp_update_desc') {
            await updateProduct(ctx.session.admin.id, { description: text });
            const pId = ctx.session.admin.id;
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Desk produk berhasil diperbarui.');
            await sendKelolaProdukMenuReply(ctx, pId);
        }
        else if (step === 'WAITING_VARIANT_NAME') {
            ctx.session.admin.pending_variant_name = text;
            ctx.session.admin.step = 'WAITING_VARIANT_PRICE';
            await ctx.reply('Kirim harga varian.\nContoh: 5.000', Markup.inlineKeyboard([backBtnAdmin]));
        }
        else if (step === 'WAITING_VARIANT_PRICE') {
            const price = parseInt(text.replace(/[^0-9]/g, ''));
            if (isNaN(price) || price <= 0) {
                return ctx.reply('❌ Harga tidak valid. Contoh format: 5.000 atau 5000', Markup.inlineKeyboard([backBtnAdmin]));
            }
            const name = ctx.session.admin.pending_variant_name;
            const productId = ctx.session.admin.selected_product_id;
            const p = await getProductById(productId);
            await addVariant(productId, name, price, '', '');
            
            // clear states but keep product context for replying
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply(`✅ Varian berhasil dibuat.\nProduk: ${p.name}\nVarian: ${name}\nHarga: Rp ${formatRupiah(price)}`);
            await sendKelolaProdukMenuReply(ctx, productId);
        }
        else if (step === 'mp_addstok') {
            const variantId = ctx.session.admin.id;
            const v = await getVariantById(variantId);
            const p = await getProductById(v.product_id);
            
            const emailMatch = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            let stock_label = emailMatch ? emailMatch[0] : text.split('\n')[0].substring(0, 30);
            
            await addSingleStockItem(variantId, stock_label, text);
            
            const availableStocks = await getAvailableStocksAdmin(variantId);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply(`✅ Stok berhasil ditambahkan.\nProduk: ${p.name}\nVariasi: ${v.name}\nLabel: ${stock_label}\nStok sekarang: ${availableStocks.length}`);
            await sendKelolaProdukMenuReply(ctx, p.id);
        }
        else if (step === 'search_user') {
            const res = await getAllUsers(1, 10, text);
            if(res.users.length === 0) {
                await ctx.reply('User tidak ditemukan.', Markup.inlineKeyboard([backBtnAdmin]));
            } else {
                let txt = `Hasil Pencarian:\n\n`;
                res.users.forEach(u => txt += `ID: ${u.id} | Telegram: ${u.telegram_id}\nNama: ${u.full_name} (@${u.username})\nSaldo: Rp ${formatRupiah(u.saldo)}\n\n`);
                await ctx.reply(txt, Markup.inlineKeyboard([backBtnAdmin]));
            }
            ctx.session = ctx.session || {}; ctx.session.admin = null;
        }
        else if (step === 'saldo_search_user') {
            const user = await getUserById(text);
            if(!user) return ctx.reply('❌ User tidak ditemukan. Coba lagi:', Markup.inlineKeyboard([backBtnAdmin]));
            ctx.session.admin.userId = user.id;
            ctx.session.admin.step = 'saldo_input_amount';
            await ctx.reply(`User ditemukan: ${user.full_name}\nSaldo saat ini: Rp ${formatRupiah(user.saldo)}\n\nMasukkan nominal yang ingin di${ctx.session.admin.type === 'add' ? 'tambahkan' : 'kurangi'}:`, Markup.inlineKeyboard([backBtnAdmin]));
        }
        else if (step === 'saldo_input_amount') {
            const amount = parseInt(text);
            if(isNaN(amount) || amount <= 0) return ctx.reply('❌ Nominal harus angka positif.', Markup.inlineKeyboard([backBtnAdmin]));
            
            const admin = await getOrCreateUser(ctx);
            const ok = await updateUserSaldo(ctx.session.admin.userId, amount, ctx.session.admin.type, admin.id);
            if(ok) {
                const target = await getUserById(ctx.session.admin.userId);
                ctx.reply('✅ Saldo berhasil diupdate.', adminMenuKeyboard());
                bot.telegram.sendMessage(target.telegram_id, `Notifikasi: Saldo Anda telah ${ctx.session.admin.type === 'add' ? 'ditambah' : 'dikurangi'} sebesar Rp ${formatRupiah(amount)} oleh Admin.`);
                ctx.session = ctx.session || {}; ctx.session.admin = null;
            } else {
                ctx.reply('❌ Gagal. Saldo tidak mencukupi untuk dikurangi.', adminMenuKeyboard());
                ctx.session = ctx.session || {}; ctx.session.admin = null;
            }
        }
        else if (step === 'broadcast_msg') {
            ctx.session.admin.broadcastText = text;
            ctx.session.admin.step = 'broadcast_confirm';
            await ctx.reply(`📢 BROADCAST MESSAGE\n\n${text}`, Markup.inlineKeyboard([
                [Markup.button.callback('Kirim Broadcast', 'admin_confirm_broadcast')],
                backBtnAdmin
            ]));
        }
        else if (step === 'setting_toko') {
            await setSetting('toko', text);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Nama Toko berhasil diperbarui.', adminMenuKeyboard());
        }
        else if (step === 'setting_welcome') {
            await setSetting('welcome', text);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Pesan Welcome berhasil diperbarui.', adminMenuKeyboard());
        }
        else if (step === 'setting_min_topup') {
            await setSetting('min_topup', parseInt(text) || 5000);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Minimal Topup berhasil diperbarui.', adminMenuKeyboard());
        }
        else if (step === 'setting_contact') {
            await setSetting('contact', text);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Contact Admin berhasil diperbarui.', adminMenuKeyboard());
        }
        else if (step === 'clear_all_input') {
            if (text === 'CLEAR ALL DITSSTORE') {
                const db = require('../database/db');
                const dbInstance = await db.getDB();
                
                // Clear tables
                await dbInstance.exec(`
                    DELETE FROM stock_items;
                    DELETE FROM variants;
                    DELETE FROM products;
                    DELETE FROM transactions;
                    DELETE FROM topups;
                    DELETE FROM saldo_logs;
                    UPDATE users SET saldo = 0, total_spent = 0;
                `);
                
                ctx.session = ctx.session || {}; ctx.session.admin = null;
                await ctx.reply('✅ Semua data berhasil di-reset dari awal.', adminMenuKeyboard());
            } else {
                ctx.session = ctx.session || {}; ctx.session.admin = null;
                await ctx.reply('❌ Konfirmasi salah. Clear all dibatalkan.', adminMenuKeyboard());
            }
        }
        else {
            next();
        }
    });

    bot.on('photo', async (ctx, next) => {
        if (ctx.session && ctx.session.admin && ctx.session.admin.step === 'admin_upload_qris') {
            if (!(await isAdmin(ctx))) return next();
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await setSetting('qris_file_id', fileId);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ QRIS berhasil disimpan/diupdate.', adminMenuKeyboard());
        } else if (ctx.session && ctx.session.admin && ctx.session.admin.step === 'admin_upload_banner') {
            if (!(await isAdmin(ctx))) return next();
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await setSetting('start_banner_file_id', fileId);
            ctx.session = ctx.session || {}; ctx.session.admin = null;
            await ctx.reply('✅ Banner /start berhasil diperbarui.', adminMenuKeyboard());
        } else {
            return next();
        }
    });
};

async function showProductSelection(ctx, actionPrefix, page = 1, textPrompt = 'Pilih produk:') {
    const res = await getAllProductsAdmin(page, 10);
    const kb = [];
    if (res.products.length === 0) {
        return ctx.editMessageText('Produk belum tersedia.', Markup.inlineKeyboard([backBtnAdmin])).catch(()=>{});
    }
    res.products.forEach(p => {
        kb.push([Markup.button.callback(p.name, `${actionPrefix}:${p.id}`)]);
    });
    const nav = [];
    if(page > 1) nav.push(Markup.button.callback('⬅️ Prev', `${actionPrefix}_page:${page-1}`));
    if(page < res.totalPages) nav.push(Markup.button.callback('Next ➡️', `${actionPrefix}_page:${page+1}`));
    if(nav.length>0) kb.push(nav);
    kb.push(backBtnAdmin);
    await ctx.editMessageText(textPrompt, Markup.inlineKeyboard(kb)).catch(()=>{});
}

async function showVariantSelection(ctx, productId, actionPrefix) {
    const { getVariantsAdmin, getProductById } = require('../services/productService');
    const vars = await getVariantsAdmin(productId);
    const p = await getProductById(productId);
    if(vars.length === 0) {
        return ctx.editMessageText(`❌ Produk ini belum memiliki variasi.`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `admin_manage_product:${p.id}`)]])).catch(()=>{});
    }
    const kb = [];
    vars.forEach(v => {
        kb.push([Markup.button.callback(v.name, `${actionPrefix}:${v.id}`)]);
    });
    kb.push([Markup.button.callback('⬅️ Back', `admin_manage_product:${p.id}`)]);
    await ctx.editMessageText(`Pilih variasi untuk ${p.name}:`, Markup.inlineKeyboard(kb)).catch(()=>{});
}

async function sendKelolaProdukMenuEdit(ctx, productId) {
    const { getProductById, getVariantsByProductId } = require('../services/productService');
    const { formatRupiah } = require('../utils/format');
    const { formatDateTimeWIB } = require('../utils/time');
    
    const p = await getProductById(productId);
    if (!p) return;
    const variants = await getVariantsByProductId(productId);
    
    let text = `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊・ Produk: ${p.name}\n`;
    text += `┊・ Stok Terjual: ${p.sold_count}\n`;
    text += `┊・ Desk: ${p.description || '-'}\n`;
    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    text += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊ Variasi, Harga & Stok:\n`;

    if (variants.length === 0) {
        text += `┊ Belum ada variasi.\n`;
    } else {
        variants.forEach(v => {
            text += `┊・ ${v.name}: Rp ${formatRupiah(v.price)} - Stok: ${v.stock}\n`;
        });
    }
    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    text += `╰➤ Refresh at ${formatDateTimeWIB()}`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Update Desk', `admin_mp_upddesk_${p.id}`), Markup.button.callback('➕ Add Variasi', `admin_mp_addvar_${p.id}`)],
        [Markup.button.callback('🗑️ Del Variasi', `admin_mp_delvar_${p.id}`), Markup.button.callback('📦 Add Stok', `admin_mp_addstok_${p.id}`)],
        [Markup.button.callback('📋 List Stok', `admin_mp_liststok_${p.id}`), Markup.button.callback('🗑️ Del Stok', `admin_mp_delstok_${p.id}`)],
        [Markup.button.callback('⬅️ Back', 'admin_manage_product'), Markup.button.callback('🔄 Refresh', `admin_manage_product:${p.id}`)]
    ]);
    await ctx.editMessageText(text, kb).catch(()=>{});
}

async function sendKelolaProdukMenuReply(ctx, productId) {
    const { getProductById, getVariantsByProductId } = require('../services/productService');
    const { formatRupiah } = require('../utils/format');
    const { formatDateTimeWIB } = require('../utils/time');
    
    const p = await getProductById(productId);
    if (!p) return;
    const variants = await getVariantsByProductId(productId);
    
    let text = `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊・ Produk: ${p.name}\n`;
    text += `┊・ Stok Terjual: ${p.sold_count}\n`;
    text += `┊・ Desk: ${p.description || '-'}\n`;
    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    text += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    text += `┊ Variasi, Harga & Stok:\n`;

    if (variants.length === 0) {
        text += `┊ Belum ada variasi.\n`;
    } else {
        variants.forEach(v => {
            text += `┊・ ${v.name}: Rp ${formatRupiah(v.price)} - Stok: ${v.stock}\n`;
        });
    }
    text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    text += `╰➤ Refresh at ${formatDateTimeWIB()}`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Update Desk', `admin_mp_upddesk_${p.id}`), Markup.button.callback('➕ Add Variasi', `admin_mp_addvar_${p.id}`)],
        [Markup.button.callback('🗑️ Del Variasi', `admin_mp_delvar_${p.id}`), Markup.button.callback('📦 Add Stok', `admin_mp_addstok_${p.id}`)],
        [Markup.button.callback('📋 List Stok', `admin_mp_liststok_${p.id}`), Markup.button.callback('🗑️ Del Stok', `admin_mp_delstok_${p.id}`)],
        [Markup.button.callback('⬅️ Back', 'admin_manage_product'), Markup.button.callback('🔄 Refresh', `admin_manage_product:${p.id}`)]
    ]);
    await ctx.reply(text, kb).catch(()=>{});
}

async function showSoldStocks(ctx, page) {
    const res = await getSoldStocksAdmin(page, 5);
    if (res.items.length === 0) {
        return ctx.editMessageText('Belum ada stok yang terjual.', Markup.inlineKeyboard([backBtnAdmin]));
    }
    let text = `STOK TERJUAL\n\n`;
    const kb = [];
    res.items.forEach(s => {
        text += `╭ - - - - - - - - - - - - - - - - - ╮\n`;
        text += `┊ Produk: ${s.p_name}\n`;
        text += `┊ Variant: ${s.v_name}\n`;
        text += `┊ Buyer: ${s.u_name} / ${s.u_tg}\n`;
        text += `┊ Tanggal Beli: ${s.sold_at}\n`;
        text += `┊ Label: ${s.stock_label}\n`;
        text += `╰ - - - - - - - - - - - - - - - - - ╯\n`;
        kb.push([Markup.button.callback(`Detail Label: ${s.stock_label}`, `admin_vss_det_${s.id}`)]);
    });
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback('⬅️ Prev', `admin_vss_page_${page-1}`));
    if (page < res.totalPages) nav.push(Markup.button.callback('Next ➡️', `admin_vss_page_${page+1}`));
    if (nav.length > 0) kb.push(nav);
    kb.push(backBtnAdmin);
        await ctx.editMessageText(text, Markup.inlineKeyboard(kb)).catch(()=>{});
}
