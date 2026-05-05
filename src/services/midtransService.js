const midtransClient = require('midtrans-client');
const env = require('../config/env');

const coreApi = new midtransClient.CoreApi({
    isProduction: env.MIDTRANS_IS_PRODUCTION,
    serverKey: env.MIDTRANS_SERVER_KEY,
    clientKey: env.MIDTRANS_CLIENT_KEY
});

async function createDynamicQRIS(invoiceId, grossAmount) {
    let parameter = {
        "payment_type": "qris",
        "transaction_details": {
            "order_id": invoiceId,
            "gross_amount": grossAmount
        },
        "qris": {
            "acquirer": "gopay"
        },
        "custom_expiry": {
            "expiry_duration": env.QRIS_EXPIRE_MINUTES,
            "unit": "minute"
        }
    };

    const response = await coreApi.charge(parameter);
    return response;
}

module.exports = {
    coreApi,
    createDynamicQRIS
};
