const Product = require('../models/productModel');

const createProduct = async (req, res) => {
    try {
        const { product_name, category, price, quantity, harvest_date, description, image_url } = req.body;
        
        // Get farmer_id from user
        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0) {
            return res.status(403).json({ error: 'User is not a registered farmer' });
        }

        const farmer_id = farmerResult.rows[0].farmer_id;

        const productData = {
            farmer_id,
            product_name,
            category,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            harvest_date: harvest_date || null,
            description: description || '',
            image_url: image_url || ''
        };

        const result = await Product.create(productData);
        res.status(201).json({
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getFarmerProducts = async (req, res) => {
    try {
        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0) {
            return res.status(403).json({ error: 'User is not a registered farmer' });
        }

        const farmer_id = farmerResult.rows[0].farmer_id;
        const result = await Product.findByFarmer(farmer_id);
        
        res.json({
            products: result.rows
        });
    } catch (error) {
        console.error('Get farmer products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getAllProducts = async (req, res) => {
    try {
        const filters = {
            category: req.query.category,
            barangay: req.query.barangay,
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice
        };

        const result = await Product.getAllProducts(filters);
        
        // Record view if user is logged in and not a farmer
        if (req.user && req.user.role === 'CUSTOMER') {
            // Record views for all products in the list
            // In production, you might want to record only when user clicks on a product
        }

        res.json({
            products: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getProductById = async (req, res) => {
    try {
        const product_id = req.params.id;
        const result = await Product.findById(product_id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Record product view if user is a customer
        if (req.user && req.user.role === 'CUSTOMER') {
            await Product.recordProductView(req.user.user_id, product_id);
        }

        res.json({
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Get product by ID error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product_id = req.params.id;
        const updateData = req.body;

        // Verify ownership
        const productResult = await Product.findById(product_id);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0 || 
            farmerResult.rows[0].farmer_id !== productResult.rows[0].farmer_id) {
            return res.status(403).json({ error: 'Not authorized to update this product' });
        }

        // Convert numeric fields if present
        if (updateData.price) updateData.price = parseFloat(updateData.price);
        if (updateData.quantity) updateData.quantity = parseInt(updateData.quantity);

        const result = await Product.update(product_id, updateData);
        res.json({
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product_id = req.params.id;

        // Verify ownership
        const productResult = await Product.findById(product_id);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const farmerResult = await require('../models/farmerModel').findByUserId(req.user.user_id);
        if (farmerResult.rows.length === 0 || 
            farmerResult.rows[0].farmer_id !== productResult.rows[0].farmer_id) {
            return res.status(403).json({ error: 'Not authorized to delete this product' });
        }

        await Product.delete(product_id);
        res.json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    createProduct,
    getFarmerProducts,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct
};