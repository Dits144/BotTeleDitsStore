require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    OWNER_ID: process.env.OWNER_ID,
    PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'midtrans',
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
    MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    QRIS_EXPIRE_MINUTES: parseInt(process.env.QRIS_EXPIRE_MINUTES || '5', 10),
    TESTIMONI_BOT_TOKEN: process.env.TESTIMONI_BOT_TOKEN,
    TESTIMONI_CHANNEL_ID: process.env.TESTIMONI_CHANNEL_ID
};
