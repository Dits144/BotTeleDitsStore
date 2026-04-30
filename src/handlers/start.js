const { getOrCreateUser } = require('../services/userService');
const { getSetting } = require('../services/adminService');
const { mainMenu } = require('../keyboards/userKeyboard');
const { showProductList } = require('./product');

module.exports = (bot) => {
    bot.start(async (ctx) => {
        try {
            await getOrCreateUser(ctx);
            const bannerId = await getSetting('start_banner_file_id');
            
            if (bannerId) {
                await ctx.replyWithPhoto(bannerId).catch(()=>{});
            }
            
            await showProductList(ctx, 1, true);
        } catch (error) {
            console.error('Error in /start:', error);
            ctx.reply('Terjadi kesalahan. Silakan coba lagi nanti.').catch(()=>{});
        }
    });

    bot.action('menu_utama', async (ctx) => {
        try {
            const user = await getOrCreateUser(ctx);
            const text = `Menu Utama DitsStore\n\nSilakan pilih menu di bawah ini:`;
            
            await ctx.editMessageText(text, mainMenu()).catch(() => {});
            ctx.answerCbQuery().catch(()=>{});
        } catch (error) {
            console.error('Error in menu_utama:', error);
        }
    });
};
