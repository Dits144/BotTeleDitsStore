require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    OWNER_ID: process.env.OWNER_ID,
    PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'pakasir',
    PAKASIR_API_KEY: process.env.PAKASIR_API_KEY || '8ARNMqo7uXgU5NTweEmWn46Hvewjcp1PtqfXTKDZTj29',
    PAKASIR_PROJECT: process.env.PAKASIR_PROJECT || 'ditstore',
    QRIS_EXPIRE_MINUTES: parseInt(process.env.QRIS_EXPIRE_MINUTES || '5', 10),
    TESTIMONI_BOT_TOKEN: process.env.TESTIMONI_BOT_TOKEN,
    TESTIMONI_CHANNEL_ID: process.env.TESTIMONI_CHANNEL_ID
};
