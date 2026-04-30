const { getDB } = require('../database/db');

async function getOrCreateUser(ctx) {
    const db = await getDB();
    const tgUser = ctx.from;
    
    let user = await db.get('SELECT * FROM users WHERE telegram_id = ?', [tgUser.id.toString()]);
    
    if (!user) {
        const result = await db.run(
            'INSERT INTO users (telegram_id, username, full_name) VALUES (?, ?, ?)',
            [tgUser.id.toString(), tgUser.username || '', tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')]
        );
        user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    } else {
        if (user.username !== tgUser.username) {
            await db.run('UPDATE users SET username = ? WHERE id = ?', [tgUser.username || '', user.id]);
            user.username = tgUser.username;
        }
    }
    return user;
}

async function getUserById(telegramId) {
    const db = await getDB();
    return await db.get('SELECT * FROM users WHERE telegram_id = ? OR username = ?', [telegramId.toString(), telegramId.toString().replace('@','')]);
}

async function getTopBuyers() {
    const db = await getDB();
    return await db.all('SELECT * FROM users ORDER BY total_spent DESC LIMIT 10');
}

async function getAllUsers(page = 1, limit = 10, search = '') {
    const db = await getDB();
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM users';
    let countQuery = 'SELECT COUNT(*) as count FROM users';
    let params = [];
    
    if (search) {
        query += ' WHERE username LIKE ? OR telegram_id LIKE ? OR full_name LIKE ?';
        countQuery += ' WHERE username LIKE ? OR telegram_id LIKE ? OR full_name LIKE ?';
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const users = await db.all(query, [...params, limit, offset]);
    const countRes = await db.get(countQuery, params);
    
    return {
        users,
        totalItems: countRes.count,
        totalPages: Math.ceil(countRes.count / limit),
        currentPage: page
    };
}

async function updateUserSaldo(userId, amount, type, adminId) {
    const db = await getDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return false;
    
    if (type === 'reduce' && user.saldo < amount) return false;
    
    const newSaldo = type === 'add' ? user.saldo + amount : user.saldo - amount;
    await db.run('UPDATE users SET saldo = ? WHERE id = ?', [newSaldo, userId]);
    
    await db.run(
        'INSERT INTO saldo_logs (user_id, type, amount, note) VALUES (?, ?, ?, ?)',
        [userId, type === 'add' ? 'admin_add' : 'admin_reduce', type === 'add' ? amount : -amount, `By Admin ${adminId}`]
    );
    
    return true;
}

async function getAllUsersForBroadcast() {
    const db = await getDB();
    return await db.all('SELECT telegram_id FROM users');
}

async function getAllAdmins() {
    const db = await getDB();
    return await db.all("SELECT * FROM users WHERE role = 'admin'");
}

module.exports = { getOrCreateUser, getUserById, getTopBuyers, getAllUsers, updateUserSaldo, getAllUsersForBroadcast, getAllAdmins };
