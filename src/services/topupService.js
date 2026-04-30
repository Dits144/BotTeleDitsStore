const { getDB } = require('../database/db');

async function createTopup(userId, amount, proofFileId, proofCaption = '') {
    const db = await getDB();
    const result = await db.run(
        'INSERT INTO topups (user_id, amount, proof_file_id, proof_caption, status) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, proofFileId, proofCaption, 'pending']
    );
    return result.lastID;
}

async function getTopupById(id) {
    const db = await getDB();
    return await db.get(`
        SELECT t.*, u.telegram_id, u.full_name, u.username 
        FROM topups t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.id = ?
    `, [id]);
}

async function getPendingTopups() {
    const db = await getDB();
    return await db.all(`
        SELECT t.*, u.telegram_id, u.full_name, u.username 
        FROM topups t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.status = 'pending' ORDER BY t.created_at ASC
    `);
}

async function processTopup(topupId, status, adminId) {
    const db = await getDB();
    const topup = await db.get('SELECT * FROM topups WHERE id = ?', [topupId]);
    if (!topup || topup.status !== 'pending') return false;

    if (status === 'approved') {
        await db.run('UPDATE topups SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, adminId, topupId]);
    } else {
        await db.run('UPDATE topups SET status = ?, rejected_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, adminId, topupId]);
    }

    if (status === 'approved') {
        await db.run('UPDATE users SET saldo = saldo + ? WHERE id = ?', [topup.amount, topup.user_id]);
        await db.run('INSERT INTO saldo_logs (user_id, type, amount, note) VALUES (?, ?, ?, ?)', [topup.user_id, 'topup', topup.amount, 'Top up saldo via transfer']);
    }
    
    return topup;
}

module.exports = { createTopup, getPendingTopups, processTopup, getTopupById };
