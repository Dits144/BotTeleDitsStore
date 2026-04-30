const { getDB } = require('./db');

async function runMigrations() {
    const db = await getDB();
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE,
            username TEXT,
            full_name TEXT,
            saldo INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user',
            total_spent INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            sold_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            name TEXT,
            price INTEGER,
            warranty TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS stock_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id INTEGER,
            stock_label TEXT,
            content TEXT,
            status TEXT DEFAULT 'available',
            sold_to_user_id INTEGER,
            sold_transaction_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sold_at DATETIME,
            FOREIGN KEY(variant_id) REFERENCES variants(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id TEXT,
            user_id INTEGER,
            product_id INTEGER,
            variant_id INTEGER,
            qty INTEGER,
            total_price INTEGER,
            payment_method TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS topups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            proof_file_id TEXT,
            proof_caption TEXT,
            status TEXT DEFAULT 'pending',
            approved_by INTEGER,
            rejected_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS saldo_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            amount INTEGER,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

    const countProd = await db.get('SELECT COUNT(*) as count FROM products');
    if (countProd.count === 0) {
        const seedProducts = [
            'ALIGHT MOTION', 'APPLE MUSIC', 'CANVA', 'CAPCUT', 'CAPCUT HEAD', 
            'CHATGPT', 'DISNEY', 'DUOLINGO', 'GETCONTACT', 'GROK AI', 
            'MEITU', 'PRIME VIDEO', 'SCRIBD', 'SPOTIFY', 'VID10', 'VIU', 'VPN', 'YOUTUBE', 'ZOOM'
        ];
        
        for (const p of seedProducts) {
            await db.run('INSERT INTO products (name) VALUES (?)', [p]);
        }
    }
}

module.exports = { runMigrations };
