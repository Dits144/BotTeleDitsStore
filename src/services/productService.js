const { getDB } = require('../database/db');

async function getProducts(page = 1, limit = 10) {
    const db = await getDB();
    const offset = (page - 1) * limit;
    const products = await db.all('SELECT * FROM products WHERE is_active = 1 LIMIT ? OFFSET ?', [limit, offset]);
    const countResult = await db.get('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
    return {
        products,
        totalItems: countResult.count,
        totalPages: Math.ceil(countResult.count / limit),
        currentPage: page
    };
}

async function getProductById(id) {
    const db = await getDB();
    return await db.get('SELECT * FROM products WHERE id = ?', [id]);
}

async function getVariantsByProductId(productId) {
    const db = await getDB();
    const variants = await db.all('SELECT * FROM variants WHERE product_id = ? AND is_active = 1', [productId]);
    for (let variant of variants) {
        const stockResult = await db.get('SELECT COUNT(*) as count FROM stock_items WHERE variant_id = ? AND status = "available"', [variant.id]);
        variant.stock = stockResult.count;
    }
    return variants;
}

async function getVariantById(id) {
    const db = await getDB();
    const variant = await db.get('SELECT * FROM variants WHERE id = ?', [id]);
    if (variant) {
        const stockResult = await db.get('SELECT COUNT(*) as count FROM stock_items WHERE variant_id = ? AND status = "available"', [variant.id]);
        variant.stock = stockResult.count;
    }
    return variant;
}

async function getPopularProducts() {
    const db = await getDB();
    return await db.all('SELECT * FROM products WHERE is_active = 1 ORDER BY sold_count DESC LIMIT 10');
}

async function getAllProductsStokReport() {
    const db = await getDB();
    const products = await db.all('SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC');
    let report = [];
    for (const prod of products) {
        const variants = await db.all('SELECT id, name FROM variants WHERE product_id = ? AND is_active = 1', [prod.id]);
        if (variants.length === 0) {
            const stockResult = await db.get('SELECT COUNT(*) as count FROM stock_items WHERE variant_id IN (SELECT id FROM variants WHERE product_id = ?) AND status = "available"', [prod.id]);
            report.push({ name: prod.name, stock: stockResult.count || 0 });
        } else {
            for (const v of variants) {
                const stockResult = await db.get('SELECT COUNT(*) as count FROM stock_items WHERE variant_id = ? AND status = "available"', [v.id]);
                report.push({ name: `${prod.name} - ${v.name}`, stock: stockResult.count });
            }
        }
    }
    return report;
}

// Admin functions
async function getAllProductsAdmin(page = 1, limit = 10) {
    const db = await getDB();
    const offset = (page - 1) * limit;
    const products = await db.all('SELECT * FROM products ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    const countResult = await db.get('SELECT COUNT(*) as count FROM products');
    return { products, totalPages: Math.ceil(countResult.count / limit), currentPage: page };
}

async function getVariantsAdmin(productId) {
    const db = await getDB();
    return await db.all('SELECT * FROM variants WHERE product_id = ?', [productId]);
}

async function addProduct(name) {
    const db = await getDB();
    const res = await db.run('INSERT INTO products (name, is_active, sold_count) VALUES (?, 1, 0)', [name]);
    return res.lastID;
}

async function updateProduct(id, updates) {
    const db = await getDB();
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    await db.run(`UPDATE products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
}

async function deleteProduct(id) {
    const db = await getDB();
    await db.run('DELETE FROM stock_items WHERE variant_id IN (SELECT id FROM variants WHERE product_id = ?)', [id]);
    await db.run('DELETE FROM variants WHERE product_id = ?', [id]);
    await db.run('DELETE FROM products WHERE id = ?', [id]);
}

async function addVariant(productId, name, price, warranty, description) {
    const db = await getDB();
    const res = await db.run(
        'INSERT INTO variants (product_id, name, price, warranty, description, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [productId, name, price, warranty, description]
    );
    return res.lastID;
}

async function updateVariant(id, updates) {
    const db = await getDB();
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    await db.run(`UPDATE variants SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
}

async function deleteVariant(id) {
    const db = await getDB();
    await db.run('DELETE FROM stock_items WHERE variant_id = ?', [id]);
    await db.run('DELETE FROM variants WHERE id = ?', [id]);
}

async function addSingleStockItem(variantId, label, content) {
    const db = await getDB();
    await db.run('INSERT INTO stock_items (variant_id, stock_label, content, status) VALUES (?, ?, ?, "available")', [variantId, label, content]);
}

async function getAvailableStocksAdmin(variantId) {
    const db = await getDB();
    return await db.all("SELECT id, stock_label FROM stock_items WHERE variant_id = ? AND status = 'available' ORDER BY created_at ASC", [variantId]);
}

async function getStockContent(stockId) {
    const db = await getDB();
    const res = await db.get("SELECT content FROM stock_items WHERE id = ?", [stockId]);
    return res ? res.content : null;
}

async function deleteStockItem(stockId) {
    const db = await getDB();
    await db.run("DELETE FROM stock_items WHERE id = ?", [stockId]);
}

async function getSoldStocksAdmin(page = 1, limit = 10) {
    const db = await getDB();
    const offset = (page - 1) * limit;
    const items = await db.all(`
        SELECT s.*, p.name as p_name, v.name as v_name, u.full_name as u_name, u.telegram_id as u_tg
        FROM stock_items s
        JOIN variants v ON s.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        LEFT JOIN users u ON s.sold_to_user_id = u.id
        WHERE s.status = 'sold'
        ORDER BY s.sold_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);
    const countRes = await db.get("SELECT COUNT(*) as count FROM stock_items WHERE status = 'sold'");
    return { items, totalPages: Math.ceil(countRes.count / limit), currentPage: page };
}

module.exports = { 
    getProducts, getProductById, getVariantsByProductId, getVariantById, getPopularProducts, getAllProductsStokReport,
    getAllProductsAdmin, getVariantsAdmin, addProduct, updateProduct, deleteProduct,
    addVariant, updateVariant, deleteVariant, addSingleStockItem, getAvailableStocksAdmin, getStockContent, deleteStockItem, getSoldStocksAdmin
};
