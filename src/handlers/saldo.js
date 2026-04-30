const { getOrCreateUser } = require('../services/userService');
const { createTopup } = require('../services/topupService');
const { getSetting } = require('../services/adminService');
const { formatRupiah } = require('../utils/format');
const { Markup } = require('telegraf');
const env = require('../config/env');

module.exports = (bot) => {
    bot.command('saldo', async (ctx) => {
        await showSaldoMenu(ctx);
    });
    
    bot.action('menu_saldo', async (ctx) => {
        await showSaldoMenu(ctx, true);
    });

    bot.action(/^topup_(\d+)$/, async (ctx) => {
        const nominal = parseInt(ctx.match[1]);
        await processTopupNominal(ctx, nominal);
    });

    bot.action('topup_manual', async (ctx) => {
        ctx.session = ctx.session || {};
        ctx.session.step = 'input_topup_nominal';
        await ctx.reply('Silakan ketik nominal top up (minimal Rp 5.000).\nContoh: 15000', Markup.inlineKeyboard([[Markup.button.callback('Batal', 'cancel_topup')]]));
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.action('cancel_topup', async (ctx) => {
        if (ctx.session) ctx.session.step = null;
        await ctx.editMessageText('Top up dibatalkan.').catch(()=>{});
    });

    bot.action(/^topup_upload_proof:(\d+)$/, async (ctx) => {
        const nominal = parseInt(ctx.match[1]);
        ctx.session = ctx.session || {};
        ctx.session.topup_state = 'WAITING_PROOF';
        ctx.session.topup_amount = nominal;
        
        await ctx.reply(`📤 Silakan upload screenshot/foto bukti transfer untuk top up Rp ${formatRupiah(nominal)}.\nKirim gambar ke chat ini.`, Markup.inlineKeyboard([[Markup.button.callback('Batal', 'cancel_topup')]]));
        ctx.answerCbQuery().catch(()=>{});
    });

    bot.on('photo', async (ctx, next) => {
        if (ctx.session && ctx.session.topup_state === 'WAITING_PROOF') {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const caption = ctx.message.caption || '-';
            const nominal = ctx.session.topup_amount;
            const user = await getOrCreateUser(ctx);

            try {
                const topupId = await createTopup(user.id, nominal, fileId, caption);
                ctx.session.topup_state = null;
                ctx.session.topup_amount = null;

                await ctx.reply('✅ Bukti transfer berhasil dikirim.\nSilakan tunggu admin mengkonfirmasi pembayaran Anda.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Menu Utama', 'menu_utama')]]));

                const { formatDateTimeWIB } = require('../utils/time');
                const { getAllAdmins } = require('../services/userService');
                
                let text = `🔔 TOP UP BARU MENUNGGU KONFIRMASI\n\n`;
                text += `👤 User: ${user.full_name}\n`;
                text += `🔗 Username: @${user.username || '-'}\n`;
                text += `🆔 Telegram ID: ${user.telegram_id}\n`;
                text += `💰 Nominal: Rp ${formatRupiah(nominal)}\n`;
                text += `📅 Tanggal: ${formatDateTimeWIB()}\n\n`;
                text += `📝 Caption Buyer:\n${caption}\n\n`;
                text += `Status: Menunggu konfirmasi admin.`;

                const keyboard = Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ ACC Top Up', `admin_topup_acc:${topupId}`),
                        Markup.button.callback('❌ Tolak Top Up', `admin_topup_reject:${topupId}`)
                    ]
                ]);

                const admins = await getAllAdmins();
                let adminIds = admins.map(a => a.telegram_id);
                if (env.OWNER_ID && !adminIds.includes(env.OWNER_ID)) {
                    adminIds.push(env.OWNER_ID);
                }

                if (adminIds.length === 0) {
                    await ctx.reply('❌ Admin belum tersedia, silakan hubungi owner.');
                } else {
                    for (const adminId of adminIds) {
                        await bot.telegram.sendPhoto(adminId, fileId, {
                            caption: text,
                            reply_markup: keyboard.reply_markup
                        }).catch(()=>{});
                    }
                }
            } catch (err) {
                console.error(err);
                ctx.reply('Gagal memproses topup.');
            }
        } else {
            return next();
        }
    });

    bot.on('text', async (ctx, next) => {
        if (ctx.session && ctx.session.topup_state === 'WAITING_PROOF') {
            return ctx.reply('❌ Mohon kirim foto/screenshot bukti transfer.');
        }
        return next();
    });
};

async function showSaldoMenu(ctx, isEdit = false) {
    try {
        const user = await getOrCreateUser(ctx);
        const text = `Detail Saldo Anda di DitsStore\n\nSaldo Anda saat ini: Rp ${formatRupiah(user.saldo)}\n\nMau isi saldo? Silakan pilih nominal dibawah ini:`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Rp 10.000', 'topup_10000'), Markup.button.callback('Rp 25.000', 'topup_25000')],
            [Markup.button.callback('Rp 50.000', 'topup_50000'), Markup.button.callback('Rp 100.000', 'topup_100000')],
            [Markup.button.callback('Isi Nominal', 'topup_manual')],
            [Markup.button.callback('⬅️ Back', 'menu_utama')]
        ]);

        if (isEdit && ctx.updateType === 'callback_query') {
            await ctx.editMessageText(text, keyboard).catch(()=>{});
        } else {
            await ctx.reply(text, keyboard);
        }
    } catch (err) {
        console.error(err);
    }
}

async function processTopupNominal(ctx, nominal) {
    try {
        const qrisFileId = await getSetting('qris_file_id');
        let text = `Anda akan top up sebesar Rp ${formatRupiah(nominal)}.\n\nSilakan transfer ke QRIS berikut.`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📤 Upload Bukti Transfer', `topup_upload_proof:${nominal}`)],
            [Markup.button.callback('⬅️ Back', 'menu_saldo')]
        ]);

        if (qrisFileId) {
            await ctx.deleteMessage().catch(() => {});
            await ctx.replyWithPhoto(qrisFileId, { caption: text, reply_markup: keyboard.reply_markup });
        } else {
            await ctx.editMessageText(text + '\n\n(QRIS belum diatur oleh admin)', keyboard).catch(()=>{});
        }
    } catch (err) {
        console.error(err);
    }
}

// Export the function to reuse if needed
module.exports.processTopupNominal = processTopupNominal;
