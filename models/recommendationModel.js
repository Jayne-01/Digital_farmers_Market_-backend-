const db = require('../config/database');

class Recommendation {
    static async getMarketInsights(farmer_id) {
        // Analyze customer behavior and market demand
        const query = `
            WITH product_analysis AS (
                SELECT 
                    p.product_id,
                    p.product_name,
                    p.category,
                    COUNT(DISTINCT pv.view_id) as view_count,
                    COUNT(DISTINCT oi.order_item_id) as purchase_count,
                    COALESCE(AVG(f.rating), 0) as avg_rating,
                    SUM(CASE WHEN o.order_status IN ('PENDING', 'NO_STOCK') THEN 1 ELSE 0 END) as unmet_demand
                FROM products p
                LEFT JOIN product_views pv ON p.product_id = pv.product_id
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.order_status IN ('PENDING', 'NO_STOCK')
                LEFT JOIN feedback f ON p.product_id = f.product_id
                WHERE p.farmer_id = $1
                GROUP BY p.product_id, p.product_name, p.category
            ),
            market_trends AS (
                SELECT 
                    category,
                    AVG(price) as avg_price,
                    COUNT(*) as total_listings,
                    SUM(quantity) as total_available,
                    COUNT(DISTINCT farmer_id) as farmers_count
                FROM products 
                WHERE status = 'AVAILABLE'
                GROUP BY category
            )
            SELECT 
                pa.*,
                mt.avg_price as market_avg_price,
                mt.farmers_count as market_competition,
                ROUND(
                    (pa.view_count * 0.3) + 
                    (pa.purchase_count * 0.4) + 
                    (pa.avg_rating * 0.2) + 
                    (pa.unmet_demand * 0.1),
                    2
                ) as demand_score
            FROM product_analysis pa
            LEFT JOIN market_trends mt ON pa.category = mt.category
            ORDER BY demand_score DESC
        `;
        return await db.query(query, [farmer_id]);
    }

    static async getCustomerPreferences() {
        // Get trending products based on customer behavior
        const query = `
            SELECT 
                p.category,
                p.product_name,
                COUNT(DISTINCT pv.customer_id) as unique_viewers,
                COUNT(DISTINCT oi.order_item_id) as total_purchases,
                COALESCE(AVG(f.rating), 0) as avg_rating,
                ROUND(
                    (COUNT(DISTINCT pv.customer_id) * 0.4) + 
                    (COUNT(DISTINCT oi.order_item_id) * 0.5) + 
                    (COALESCE(AVG(f.rating), 0) * 0.1),
                    2
                ) as popularity_score
            FROM products p
            LEFT JOIN product_views pv ON p.product_id = pv.product_id
            LEFT JOIN order_items oi ON p.product_id = oi.product_id
            LEFT JOIN feedback f ON p.product_id = f.product_id
            WHERE p.status = 'AVAILABLE'
            GROUP BY p.category, p.product_name
            HAVING COUNT(DISTINCT pv.customer_id) > 0
            ORDER BY popularity_score DESC
            LIMIT 10
        `;
        return await db.query(query);
    }

    static async getSeasonalRecommendations() {
        const currentMonth = new Date().getMonth() + 1;
        
        const query = `
            SELECT 
                category,
                COUNT(*) as total_listings,
                AVG(price) as avg_price,
                EXTRACT(MONTH FROM harvest_date) as harvest_month
            FROM products 
            WHERE status = 'AVAILABLE' 
            AND harvest_date IS NOT NULL
            GROUP BY category, EXTRACT(MONTH FROM harvest_date)
            HAVING EXTRACT(MONTH FROM harvest_date) BETWEEN $1 AND $2
            ORDER BY total_listings DESC
        `;
        
        // Look for products harvested in current and next month
        return await db.query(query, [currentMonth, (currentMonth % 12) + 1]);
    }
}

module.exports = Recommendation;