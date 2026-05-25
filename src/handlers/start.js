const { getOrCreateUser } = require('../services/userService');
const { getSetting } = require('../services/adminService');
const { mainMenu } = require('../keyboards/userKeyboard');
const { showProductList, safeEditMessage } = require('./product');

module.exports = (bot) => {
    bot.start(async (ctx) => {
        try {
            await getOrCreateUser(ctx);
            const bannerId = await getSetting('start_banner_file_id');
            
            await showProductList(ctx, 1, true, bannerId);
        } catch (error) {
            console.error('Error in /start:', error);
            ctx.reply('Terjadi kesalahan. Silakan coba lagi nanti.').catch(()=>{});
        }
    });

    bot.action('menu_utama', async (ctx) => {
        try {
            const user = await getOrCreateUser(ctx);
            const text = `Menu Utama DitsStore\n\nSilakan pilih menu di bawah ini:`;
            
            await safeEditMessage(ctx, text, mainMenu()).catch(() => {});
            ctx.answerCbQuery().catch(()=>{});
        } catch (error) {
            console.error('Error in menu_utama:', error);
        }
    });
};
