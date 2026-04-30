const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

async function getDB() {
    if (!dbInstance) {
        dbInstance = await open({
            filename: path.join(__dirname, '../../database.sqlite'),
            driver: sqlite3.Database
        });
    }
    return dbInstance;
}

module.exports = { getDB };
