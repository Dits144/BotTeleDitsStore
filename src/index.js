const { Telegraf, session, Markup } = require('telegraf');
const env = require('./config/env');
const { runMigrations } = require('./database/migrations');
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { updateOrderToSuccess } = require('./services/orderService');
const { formatRupiah } = require('./utils/format');
const crypto = require('crypto');
const { getDB } = require('./database/db');

// Handlers
const startHandler = require('./handlers/start');
const productHandler = require('./handlers/product');
const orderHandler = require('./handlers/order');
const saldoHandler = require('./handlers/saldo');
const stokHandler = require('./handlers/stok');
const adminHandler = require('./handlers/admin');

if (!env.BOT_TOKEN || env.BOT_TOKEN === 'isi_token_bot_disini') {
    console.error('Bot token is missing or default. Please set BOT_TOKEN in .env file.');
    process.exit(1);
}

const bot = new Telegraf(env.BOT_TOKEN);

// Middleware
bot.use(session());

// Error handling middleware
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

// Init Handlers
startHandler(bot);
productHandler(bot);
orderHandler(bot);
saldoHandler(bot);
stokHandler(bot);

// Admin handler needs to be last to catch text and photos properly without blocking others
adminHandler(bot);

async function startBot() {
    try {
        console.log('Running database migrations...');
        await runMigrations();
        console.log('Database ready.');

        // Setup commands menu
        const userCommands = [
            { command: 'start', description: 'Mulai bot & lihat produk' },
            { command: 'stok', description: 'Lihat stok produk' },
            { command: 'saldo', description: 'Cek & isi saldo' },
            { command: 'riwayat', description: 'Riwayat transaksi' },
            { command: 'caraorder', description: 'Cara order' },
            { command: 'adminmenu', description: 'Menu admin' }
        ];
        
        await bot.telegram.setMyCommands(userCommands).catch(console.error);

        // Webhook Server Setup
        const app = express();
        app.use(bodyParser.json());

        app.post('/webhook/payment', async (req, res) => {
            try {
                const data = req.body;
                
                // Validate Signature Key Midtrans
                const hash = crypto.createHash('sha512').update(data.order_id + data.status_code + data.gross_amount + env.MIDTRANS_SERVER_KEY).digest('hex');
                if (data.signature_key !== hash) {
                    return res.status(401).send('Invalid signature');
                }

                if (data.transaction_status === 'settlement' || data.transaction_status === 'capture') {
                    const result = await updateOrderToSuccess(data.order_id);
                    if (result.success) {
                        const tx = result.transaction;
                        
                        let text = `✅ Pembayaran Berhasil\n`;
                        text += `📅 Tanggal : ${require('./utils/time').formatDateTimeWIB()}\n\n`;
                        text += `Informasi Pembelian:\n`;
                        text += `ID Transaksi: ${tx.invoice_id}\n`;
                        text += `Jumlah Pesanan: ${tx.qty}\n`;
                        text += `Total Pembayaran: Rp ${formatRupiah(tx.total_price)}\n\n`;
                        text += `🔐 Account Details\n`;
                        
                        // Send account details
                        bot.telegram.sendMessage(tx.user_id, text).then(async () => {
                            for (const item of result.items) {
                                await bot.telegram.sendMessage(tx.user_id, item);
                            }
                            
                            const { getVariantById } = require('./services/productService');
                            const variant = await getVariantById(tx.variant_id);
                            
                            let tnc = `───「 📋 SYARAT & KETENTUAN 」───\n\n`;
                            if (variant && variant.warranty) {
                                tnc += `GARANSI ${variant.warranty.toUpperCase()}\n\n`;
                            } else {
                                tnc += `GARANSI RESMI DITSSTORE\n\n`;
                            }
                            tnc += `Thank you for your purchase 🙏\n`;
                            tnc += `If you need help, please contact admin.`;
                            
                            await bot.telegram.sendMessage(tx.user_id, tnc).catch(console.error);
                            
                            const { getProductById } = require('./services/productService');
                            const { getUserById } = require('./services/userService');
                            const product = await getProductById(tx.product_id);
                            const user = await getUserById(tx.user_id);
                            
                            const { sendTestimoni } = require('./utils/testimoni');
                            sendTestimoni(bot, { total_price: tx.total_price, payment_method: 'qris_dynamic', invoice_id: tx.invoice_id }, product, variant, user);
                        }).catch(console.error);
                    } else if (result.outOfStock) {
                        const tx = result.transaction;
                        bot.telegram.sendMessage(tx.user_id, `⚠️ Pembayaran Anda telah diterima untuk invoice ${tx.invoice_id}, namun mohon maaf stok produk sedang habis. Admin akan segera memproses refund atau mengirim akun secara manual. Silakan hubungi admin.`);
                        
                        // Notify owner
                        if (env.OWNER_ID) {
                            bot.telegram.sendMessage(env.OWNER_ID, `⚠️ URGENT: Pembayaran masuk tapi stok habis!\nInvoice: ${tx.invoice_id}\nUser ID: ${tx.user_id}\nTotal: Rp ${formatRupiah(tx.total_price)}`);
                        }
                    }
                }

                res.status(200).send('OK');
            } catch (err) {
                console.error('Webhook Error:', err);
                res.status(500).send('Internal Server Error');
            }
        });

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Webhook server is listening on port ${PORT}`);
        });

        // Scheduler for expired QRIS
        cron.schedule('* * * * *', async () => {
            try {
                const db = await getDB();
                const expiredTxs = await db.all('SELECT id, invoice_id FROM transactions WHERE status = "pending" AND payment_method = "qris_dynamic" AND datetime(expired_at) < datetime("now", "localtime")');
                
                for (const tx of expiredTxs) {
                    await db.run('UPDATE transactions SET status = "expired" WHERE id = ?', [tx.id]);
                    console.log(`Transaction ${tx.invoice_id} expired.`);
                }
            } catch (err) {
                console.error('Cron Error:', err);
            }
        });

        console.log('Starting bot...');
        bot.launch();
        console.log('Bot is running!');
    } catch (error) {
        console.error('Failed to start bot:', error);
    }
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
