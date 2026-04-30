const { getDB } = require('../database/db');

async function setAdmin(userId) {
    const db = await getDB();
    await db.run('UPDATE users SET role = "admin" WHERE id = ?', [userId]);
}

async function getDashboardStats() {
    const db = await getDB();
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const totalProducts = await db.get('SELECT COUNT(*) as count FROM products');
    const totalVariants = await db.get('SELECT COUNT(*) as count FROM variants');
    const totalSuccessTx = await db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "success"');
    const totalIncome = await db.get('SELECT SUM(total_price) as sum FROM transactions WHERE status = "success"');
    const totalPendingTopups = await db.get('SELECT COUNT(*) as count FROM topups WHERE status = "pending"');
    
    return {
        totalUsers: totalUsers.count,
        totalProducts: totalProducts.count,
        totalVariants: totalVariants.count,
        totalSuccessTx: totalSuccessTx.count,
        totalIncome: totalIncome.sum || 0,
        totalPendingTopups: totalPendingTopups.count
    };
}

async function getSetting(key) {
    const db = await getDB();
    const s = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return s ? s.value : null;
}

async function setSetting(key, value) {
    const db = await getDB();
    await db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = ?
    `, [key, value, value]);
}

async function getAllSettings() {
    const db = await getDB();
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    return settings;
}

async function getSalesStatistics() {
    const db = await getDB();
    const totalTx = await db.get('SELECT COUNT(*) as count, SUM(total_price) as sum, SUM(qty) as qty FROM transactions WHERE status = "success"');
    const today = await db.get('SELECT SUM(total_price) as sum FROM transactions WHERE status = "success" AND created_at >= date("now")');
    const days7 = await db.get('SELECT SUM(total_price) as sum FROM transactions WHERE status = "success" AND created_at >= date("now", "-7 days")');
    const days30 = await db.get('SELECT SUM(total_price) as sum FROM transactions WHERE status = "success" AND created_at >= date("now", "-30 days")');
    const topProducts = await db.all('SELECT name, sold_count FROM products WHERE sold_count > 0 ORDER BY sold_count DESC LIMIT 3');
    const topBuyers = await db.all('SELECT username, full_name, total_spent FROM users WHERE total_spent > 0 ORDER BY total_spent DESC LIMIT 3');
    
    return {
        totalSuccessTx: totalTx.count || 0,
        totalIncome: totalTx.sum || 0,
        totalProductsSold: totalTx.qty || 0,
        incomeToday: today.sum || 0,
        income7Days: days7.sum || 0,
        income30Days: days30.sum || 0,
        topProducts,
        topBuyers
    };
}

module.exports = { setAdmin, getDashboardStats, getSetting, setSetting, getAllSettings, getSalesStatistics };
