const { getOrCreateUser } = require('../services/userService');
const { getSetting } = require('../services/adminService');
const { mainMenu } = require('../keyboards/userKeyboard');
const { showProductList, safeEditMessage } = require('./product');

// Fungsi pembantu untuk membuat animasi loading bertema cyber/hacker yang keren
async function animateLoading(ctx, isPhoto, bannerId) {
    const chat = ctx.chat.id;
    const steps = [
        `🤖 [ DITSSTORE OS ] INITIALIZING SYSTEM BOOT...\n[█▒▒▒▒▒▒▒▒▒] 10%`,
        `📡 [ SECURE ] CONNECTING TO DATABASE SYSTEMS...\n[███▒▒▒▒▒▒▒] 30%`,
        `🛰 [ DITSSTORE ] SECURING TELEGRAM PROTOCOLS...\n[██████▒▒▒▒] 60%`,
        `⚡ [ PREMIUM ] LOAD INTERFACE CONFIGURATIONS...\n[█████████▒] 90%`,
        `🚀 [ ACCESS ] WELCOME TO DITSSTORE PREMIUM!\n[██████████] 100%`
    ];

    let msg;
    if (isPhoto && bannerId) {
        msg = await ctx.replyWithPhoto(bannerId, { caption: steps[0] }).catch(()=>{});
    } else {
        msg = await ctx.reply(steps[0]).catch(()=>{});
    }

    if (!msg) return null;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    for (let i = 1; i < steps.length; i++) {
        await delay(300); // 300ms agar animasinya cepat, dinamis, dan responsif!
        if (isPhoto && bannerId) {
            await ctx.telegram.editMessageCaption(chat, msg.message_id, undefined, steps[i]).catch(()=>{});
        } else {
            await ctx.telegram.editMessageText(chat, msg.message_id, undefined, steps[i]).catch(()=>{});
        }
    }

    await delay(300);
    return msg;
}

module.exports = (bot) => {
    bot.start(async (ctx) => {
        try {
            await getOrCreateUser(ctx);
            const bannerId = await getSetting('start_banner_file_id');
            
            // Jalankan animasi hacker loading yang sangat keren
            const msg = await animateLoading(ctx, !!bannerId, bannerId);
            
            // Setelah loading selesai, ubah pesan tersebut menjadi menu daftar produk
            if (msg) {
                await showProductList(ctx, 1, false, bannerId, msg.message_id);
            } else {
                await showProductList(ctx, 1, true, bannerId);
            }
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
