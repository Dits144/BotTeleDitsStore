const { getDB } = require('../database/db');

const generateInvoiceId = () => {
    const date = require('../utils/time').getWIBTime().format('DDMMYY');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV-${date}-${random}`;
};

async function createOrder(userId, productId, variantId, qty, paymentMethod) {
    const db = await getDB();
    
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const variant = await db.get('SELECT * FROM variants WHERE id = ?', [variantId]);
    const total_price = variant.price * qty;

    if (paymentMethod === 'saldo') {
        if (user.saldo < total_price) {
            return { success: false, message: 'Saldo Anda tidak cukup.' };
        }
    }

    const availableStocks = await db.all('SELECT * FROM stock_items WHERE variant_id = ? AND status = "available" LIMIT ?', [variantId, qty]);
    
    if (availableStocks.length === 0) {
        return { success: false, message: 'Stok produk ini sedang kosong.' };
    }
    
    if (availableStocks.length < qty) {
        return { success: false, message: `Stok tidak mencukupi. Stok tersedia: ${availableStocks.length}` };
    }

    if (paymentMethod === 'saldo') {
        await db.run('UPDATE users SET saldo = saldo - ?, total_spent = total_spent + ? WHERE id = ?', [total_price, total_price, userId]);
        await db.run('INSERT INTO saldo_logs (user_id, type, amount, note) VALUES (?, ?, ?, ?)', [userId, 'purchase', -total_price, `Beli ${variant.name} x${qty}`]);
    }

    const invoice_id = generateInvoiceId();

    const result = await db.run(
        'INSERT INTO transactions (invoice_id, user_id, product_id, variant_id, qty, total_price, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoice_id, userId, productId, variantId, qty, total_price, paymentMethod, 'success']
    );
    
    const transactionId = result.lastID;

    for (const stock of availableStocks) {
        await db.run('UPDATE stock_items SET status = "sold", sold_to_user_id = ?, sold_transaction_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?', [userId, transactionId, stock.id]);
    }

    await db.run('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', [qty, productId]);

    return { 
        success: true, 
        transactionId, 
        invoice_id,
        total_price,
        items: availableStocks.map(s => s.content) 
    };
}

async function getUserTransactions(userId) {
    const db = await getDB();
    return await db.all(`
        SELECT t.*, p.name as product_name, v.name as variant_name 
        FROM transactions t 
        JOIN products p ON t.product_id = p.id 
        LEFT JOIN variants v ON t.variant_id = v.id 
        WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 10
    `, [userId]);
}

async function getAllTransactions(page = 1, limit = 10, filter = 'all') {
    const db = await getDB();
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    if (filter === 'today') whereClause = "WHERE date(t.created_at) = date('now')";
    else if (filter === '7days') whereClause = "WHERE date(t.created_at) >= date('now', '-7 days')";
    else if (filter === '30days') whereClause = "WHERE date(t.created_at) >= date('now', '-30 days')";

    const query = `
        SELECT t.*, u.username, u.full_name, p.name as product_name, v.name as variant_name 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        JOIN products p ON t.product_id = p.id 
        LEFT JOIN variants v ON t.variant_id = v.id 
        ${whereClause} 
        ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `;
    
    const countQuery = `SELECT COUNT(*) as count FROM transactions t ${whereClause}`;
    
    const txs = await db.all(query, [limit, offset]);
    const countRes = await db.get(countQuery);
    
    return {
        transactions: txs,
        totalItems: countRes.count,
        totalPages: Math.ceil(countRes.count / limit),
        currentPage: page
    };
}

module.exports = { createOrder, getUserTransactions, getAllTransactions };
