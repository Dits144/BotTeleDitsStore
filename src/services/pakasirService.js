const axios = require('axios');
const env = require('../config/env');

const PAKASIR_BASE_URL = 'https://app.pakasir.com';

/**
 * Membuat transaksi QRIS dinamis di Pakasir
 * @param {string} orderId ID Transaksi / Invoice ID
 * @param {number} amount Total Pembayaran (Rupiah)
 * @returns {Promise<object>} Detail transaksi dari Pakasir
 */
async function createQRISTransaction(orderId, amount) {
    const payload = {
        project: env.PAKASIR_PROJECT,
        order_id: orderId,
        amount: parseInt(amount, 10),
        api_key: env.PAKASIR_API_KEY
    };

    try {
        console.log(`[Pakasir] Creating QRIS transaction for order ${orderId} with amount ${amount}`);
        const response = await axios.post(`${PAKASIR_BASE_URL}/api/transactioncreate/qris`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'PakasirClient/1.0.0'
            },
            timeout: 15000
        });

        if (response.data && response.data.status === 'success') {
            return response.data;
        } else {
            throw new Error(response.data?.message || 'Gagal membuat QRIS di Pakasir.');
        }
    } catch (error) {
        console.error('[Pakasir Error] Failed to create QRIS transaction:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Mengecek status transaksi ke API Pakasir secara langsung
 * @param {string} orderId ID Transaksi / Invoice ID
 * @param {number} amount Total Pembayaran (Rupiah)
 * @returns {Promise<object>} Status transaksi
 */
async function checkTransactionStatus(orderId, amount) {
    const params = new URLSearchParams({
        project: env.PAKASIR_PROJECT,
        amount: parseInt(amount, 10).toString(),
        order_id: orderId,
        api_key: env.PAKASIR_API_KEY
    });

    try {
        console.log(`[Pakasir] Checking transaction status for order ${orderId}`);
        const response = await axios.get(`${PAKASIR_BASE_URL}/api/transactiondetail?${params.toString()}`, {
            headers: {
                'User-Agent': 'PakasirClient/1.0.0'
            },
            timeout: 15000
        });

        return response.data;
    } catch (error) {
        console.error('[Pakasir Error] Failed to check transaction status:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Validasi payload webhook sederhana dari Pakasir
 * @param {object} payload Body dari webhook request
 * @returns {boolean} True jika payload valid
 */
function validateWebhook(payload) {
    if (!payload || typeof payload !== 'object') return false;

    const requiredFields = ['amount', 'order_id', 'project', 'status', 'payment_method'];
    const hasAllFields = requiredFields.every(field => Object.prototype.hasOwnProperty.call(payload, field));

    if (!hasAllFields) return false;

    // Tambahan validasi kecocokan project slug untuk keamanan
    return payload.project === env.PAKASIR_PROJECT;
}

module.exports = {
    createQRISTransaction,
    checkTransactionStatus,
    validateWebhook
};
