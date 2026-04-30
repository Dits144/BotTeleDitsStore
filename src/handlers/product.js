const { getProducts, getProductById, getVariantsByProductId, getPopularProducts } = require('../services/productService');
const { getTopBuyers } = require('../services/userService');
const { formatRupiah } = require('../utils/format');
const { formatDateTimeWIB } = require('../utils/time');
const { Markup } = require('telegraf');

module.exports = (bot) => {
    bot.action('menu_list_produk', async (ctx) => {
        await showProductList(ctx, 1);
    });

    bot.action(/page_prod_(\d+)/, async (ctx) => {
        const page = parseInt(ctx.match[1]);
        await showProductList(ctx, page);
    });

    bot.action(/prod_(\d+)/, async (ctx) => {
        const productId = parseInt(ctx.match[1]);
        await showProductDetail(ctx, productId);
    });

    bot.action('menu_populer', async (ctx) => {
        try {
            const products = await getPopularProducts();
            if (products.length === 0) {
                return ctx.editMessageText('Belum ada produk populer.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]]));
            }

            let text = `🔥 PRODUK POPULER 🔥\n\n`;
            products.forEach((p, i) => {
                text += `${i + 1}. ${p.name} (${p.sold_count} terjual)\n`;
            });

            await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]])).catch(()=>{});
        } catch (error) {
            console.error(error);
        }
    });

    bot.action('menu_top_buyer', async (ctx) => {
        try {
            const buyers = await getTopBuyers();
            let text = `🏆 TOP BUYER 🏆\n\n`;
            buyers.forEach((b, i) => {
                text += `${i + 1}. ${b.full_name || b.username || b.telegram_id} - Rp ${formatRupiah(b.total_spent)}\n`;
            });
            await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'menu_utama')]])).catch(()=>{});
        } catch (err) {
            console.error(err);
        }
    });
};

async function showProductList(ctx, page, isReply = false) {
    try {
        const { getProducts } = require('../services/productService');
        const { products, totalPages, currentPage } = await getProducts(page, 10);
        
        let text = `╭ - - - - - - - - - - - - - - - - - - - ╮\n┊ LIST PRODUK\n┊- - - - - - - - - - - - - - - - - - - - -\n`;
        
        const keyboard = [];
        let row = [];

        products.forEach((p, index) => {
            const num = (page - 1) * 10 + index + 1;
            text += `┊ [ ${num} ] ${p.name}\n`;
            
            row.push(Markup.button.callback(num.toString(), `prod_${p.id}`));
            if (row.length === 5) {
                keyboard.push(row);
                row = [];
            }
        });

        if (row.length > 0) keyboard.push(row);

        text += `┊- - - - - - - - - - - - - - - - - - - - -\n┊ Halaman ${currentPage} dari ${totalPages || 1}\n╰ - - - - - - - - - - - - - - - - - - - ╯`;

        const navRow = [];
        if (currentPage > 1) navRow.push(Markup.button.callback('⬅️ Prev', `page_prod_${currentPage - 1}`));
        navRow.push(Markup.button.callback('🔄 Refresh', `page_prod_${currentPage}`));
        if (currentPage < totalPages) navRow.push(Markup.button.callback('Next ➡️', `page_prod_${currentPage + 1}`));
        
        keyboard.push(navRow);
        keyboard.push([Markup.button.callback('⬅️ Menu Utama', 'menu_utama')]);

        if (ctx.updateType === 'message' || isReply) {
            await ctx.reply(text, Markup.inlineKeyboard(keyboard));
        } else {
            await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard)).catch(()=>{});
        }
    } catch (error) {
        console.error('Error showProductList:', error);
    }
}

module.exports.showProductList = showProductList;

async function showProductDetail(ctx, productId) {
    try {
        const product = await getProductById(productId);
        if (!product) return ctx.answerCbQuery('Produk tidak ditemukan.', { show_alert: true });

        const variants = await getVariantsByProductId(productId);
        
        let text = `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
        text += `┊・Produk: ${product.name}\n`;
        text += `┊・Stok Terjual: ${product.sold_count}\n`;
        text += `┊・Desk: ${product.description || '-'}\n`;
        text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
        text += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
        text += `┊ Variasi, Harga & Stok:\n`;

        const keyboard = [];

        if (variants.length === 0) {
            text += `┊・Produk ini belum memiliki variasi/stok.\n`;
        } else {
            variants.forEach(v => {
                text += `┊・${v.name} : Rp ${formatRupiah(v.price)} - Stok: ${v.stock}.\n`;
                keyboard.push([Markup.button.callback(`${v.name} - Rp ${formatRupiah(v.price)}`, `var_${v.id}`)]);
            });
        }
        text += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
        text += `╰➤ Refresh at ${formatDateTimeWIB()}`;

        keyboard.push([
            Markup.button.callback('⬅️ Back', 'menu_list_produk'),
            Markup.button.callback('🔄 Refresh', `prod_${productId}`)
        ]);

        await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard)).catch(()=>{});
    } catch (error) {
        console.error('Error showProductDetail:', error);
    }
}
