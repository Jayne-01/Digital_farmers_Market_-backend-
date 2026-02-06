const db = require('../config/database');

class Product {
    static async create(productData) {
        const { farmer_id, product_name, category, price, quantity, harvest_date, description, image_url } = productData;
        const query = `
            INSERT INTO products (farmer_id, product_name, category, price, quantity, harvest_date, description, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        return await db.query(query, [farmer_id, product_name, category, price, quantity, harvest_date, description, image_url]);
    }

    static async findByFarmer(farmer_id) {
        const query = 'SELECT * FROM products WHERE farmer_id = $1 AND status = $2 ORDER BY created_at DESC';
        return await db.query(query, [farmer_id, 'AVAILABLE']);
    }

    static async findById(product_id) {
        const query = `
            SELECT p.*, f.farm_name, u.full_name as farmer_name, u.contact_number
            FROM products p
            JOIN farmers f ON p.farmer_id = f.farmer_id
            JOIN users u ON f.user_id = u.user_id
            WHERE p.product_id = $1
        `;
        return await db.query(query, [product_id]);
    }

    static async getAllProducts(filters = {}) {
        let query = `
            SELECT p.*, f.farm_name, u.full_name as farmer_name, u.barangay
            FROM products p
            JOIN farmers f ON p.farmer_id = f.farmer_id
            JOIN users u ON f.user_id = u.user_id
            WHERE p.status = 'AVAILABLE'
        `;
        const values = [];
        let paramIndex = 1;

        if (filters.category) {
            query += ` AND p.category = $${paramIndex}`;
            values.push(filters.category);
            paramIndex++;
        }

        if (filters.barangay) {
            query += ` AND u.barangay = $${paramIndex}`;
            values.push(filters.barangay);
            paramIndex++;
        }

        if (filters.minPrice) {
            query += ` AND p.price >= $${paramIndex}`;
            values.push(filters.minPrice);
            paramIndex++;
        }

        if (filters.maxPrice) {
            query += ` AND p.price <= $${paramIndex}`;
            values.push(filters.maxPrice);
            paramIndex++;
        }

        query += ' ORDER BY p.created_at DESC';
        return await db.query(query, values);
    }

    static async update(product_id, updateData) {
        const fields = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const values = Object.values(updateData);
        const query = `UPDATE products SET ${fields} WHERE product_id = $1 RETURNING *`;
        return await db.query(query, [product_id, ...values]);
    }

    static async delete(product_id) {
        const query = 'UPDATE products SET status = $1 WHERE product_id = $2';
        return await db.query(query, ['UNAVAILABLE', product_id]);
    }

    static async recordProductView(customer_id, product_id) {
        const query = `
            INSERT INTO product_views (customer_id, product_id)
            VALUES ($1, $2)
            ON CONFLICT (customer_id, product_id) 
            DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
        `;
        return await db.query(query, [customer_id, product_id]);
    }
}

module.exports = Product;