const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function test() {
    try {
        const db = await open({
            filename: path.join(__dirname, 'database.sqlite'),
            driver: sqlite3.Database
        });
        
        console.log('--- DATABASE STATUS ---');
        
        const txCount = await db.get('SELECT COUNT(*) as c FROM transactions');
        console.log('Total Transactions:', txCount.c);
        
        const successTxCount = await db.get('SELECT COUNT(*) as c FROM transactions WHERE status = "success"');
        console.log('Success Transactions:', successTxCount.c);
        
        const soldProducts = await db.all('SELECT id, name, sold_count FROM products WHERE sold_count > 0');
        console.log('Products with Sold Count > 0:', soldProducts);
        
        const spendUsers = await db.all('SELECT id, username, full_name, total_spent FROM users WHERE total_spent > 0');
        console.log('Users with Spent > 0:', spendUsers);
        
    } catch (err) {
        console.error('Error running test script:', err);
    }
}

test();
