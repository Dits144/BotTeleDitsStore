const { Telegraf, session } = require('telegraf');
const env = require('./config/env');
const { runMigrations } = require('./database/migrations');

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
            { command: 'start', description: '🚀 Mulai bot & lihat produk' },
            { command: 'stok', description: '📦 Lihat stok produk' },
            { command: 'saldo', description: '💰 Cek & isi saldo' },
            { command: 'riwayat', description: '📜 Riwayat transaksi' },
            { command: 'caraorder', description: '📘 Cara order' }
        ];
        
        await bot.telegram.setMyCommands(userCommands, { scope: { type: 'default' } }).catch(console.error);

        if (env.OWNER_ID) {
            const adminCommands = [
                ...userCommands,
                { command: 'adminmenu', description: '🛠 Menu admin (khusus admin)' }
            ];
            await bot.telegram.setMyCommands(adminCommands, { 
                scope: { type: 'chat', chat_id: env.OWNER_ID } 
            }).catch(console.error);
        }

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
