const Recommendation = require('../models/recommendationModel');
const Product = require('../models/productModel');

const getMarketInsights = async (req, res) => {
    try {
        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0) {
            return res.status(403).json({ error: 'User is not a registered farmer' });
        }

        const farmer_id = farmerResult.rows[0].farmer_id;
        const insights = await Recommendation.getMarketInsights(farmer_id);
        
        res.json({
            insights: insights.rows,
            farmer_id
        });
    } catch (error) {
        console.error('Get market insights error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCustomerPreferences = async (req, res) => {
    try {
        const preferences = await Recommendation.getCustomerPreferences();
        
        res.json({
            preferences: preferences.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get customer preferences error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getSeasonalRecommendations = async (req, res) => {
    try {
        const recommendations = await Recommendation.getSeasonalRecommendations();
        
        res.json({
            recommendations: recommendations.rows,
            current_month: new Date().getMonth() + 1
        });
    } catch (error) {
        console.error('Get seasonal recommendations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getPersonalizedRecommendations = async (req, res) => {
    try {
        // Get user's viewing and purchase history
        const userId = req.user.user_id;
        
        // Query for user's recently viewed products
        const viewedQuery = `
            SELECT p.*, pv.viewed_at
            FROM product_views pv
            JOIN products p ON pv.product_id = p.product_id
            WHERE pv.customer_id = $1
            ORDER BY pv.viewed_at DESC
            LIMIT 10
        `;
        
        // Query for similar products based on viewed categories
        const similarQuery = `
            SELECT DISTINCT p.*, f.farm_name
            FROM products p
            JOIN farmers f ON p.farmer_id = f.farmer_id
            WHERE p.category IN (
                SELECT DISTINCT category 
                FROM product_views pv
                JOIN products p ON pv.product_id = p.product_id
                WHERE pv.customer_id = $1
            )
            AND p.status = 'AVAILABLE'
            AND p.product_id NOT IN (
                SELECT product_id FROM product_views WHERE customer_id = $1
            )
            ORDER BY RANDOM()
            LIMIT 5
        `;
        
        // Query for trending products
        const trendingQuery = `
            SELECT 
                p.*,
                f.farm_name,
                COUNT(DISTINCT pv.view_id) as view_count,
                COUNT(DISTINCT oi.order_item_id) as purchase_count
            FROM products p
            JOIN farmers f ON p.farmer_id = f.farmer_id
            LEFT JOIN product_views pv ON p.product_id = pv.product_id
            LEFT JOIN order_items oi ON p.product_id = oi.product_id
            WHERE p.status = 'AVAILABLE'
            AND pv.viewed_at > CURRENT_DATE - INTERVAL '7 days'
            GROUP BY p.product_id, f.farm_name
            ORDER BY (view_count * 0.6 + purchase_count * 0.4) DESC
            LIMIT 5
        `;

        const [viewedResult, similarResult, trendingResult] = await Promise.all([
            db.query(viewedQuery, [userId]),
            db.query(similarQuery, [userId]),
            db.query(trendingQuery)
        ]);

        res.json({
            recently_viewed: viewedResult.rows,
            similar_products: similarResult.rows,
            trending_products: trendingResult.rows
        });
    } catch (error) {
        console.error('Get personalized recommendations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getDemandAnalysis = async (req, res) => {
    try {
        // This implements the demand scoring function from your paper
        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0) {
            return res.status(403).json({ error: 'User is not a registered farmer' });
        }

        const farmer_id = farmerResult.rows[0].farmer_id;
        
        // Demand scoring query based on your paper's formula
        const demandQuery = `
            WITH product_metrics AS (
                SELECT 
                    p.product_id,
                    p.product_name,
                    p.category,
                    COUNT(DISTINCT pv.view_id) as freq_c,
                    CASE 
                        WHEN COUNT(DISTINCT oi.order_item_id) > 0 THEN 1.0
                        ELSE 0.5
                    END as price_trend_c,
                    COUNT(CASE WHEN o.order_status = 'PENDING' THEN 1 END) as unmet_demand_c
                FROM products p
                LEFT JOIN product_views pv ON p.product_id = pv.product_id
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id
                WHERE p.farmer_id = $1
                AND p.status = 'AVAILABLE'
                GROUP BY p.product_id, p.product_name, p.category
            )
            SELECT 
                *,
                ROUND(
                    (freq_c * 0.4) + 
                    (price_trend_c * 0.3) + 
                    (unmet_demand_c * 0.3),
                    2
                ) as demand_score
            FROM product_metrics
            ORDER BY demand_score DESC
        `;

        const result = await db.query(demandQuery, [farmer_id]);
        
        res.json({
            demand_analysis: result.rows,
            weights: {
                frequency: 0.4,
                price_trend: 0.3,
                unmet_demand: 0.3
            }
        });
    } catch (error) {
        console.error('Get demand analysis error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getMarketInsights,
    getCustomerPreferences,
    getSeasonalRecommendations,
    getPersonalizedRecommendations,
    getDemandAnalysis
};