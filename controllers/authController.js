const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Farmer = require('../models/farmerModel');

const register = async (req, res) => {
    try {
        const { full_name, email, password, role, contact_number, address, ...additionalData } = req.body;

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userResult = await User.create({
            full_name,
            email,
            password: hashedPassword,
            role,
            contact_number,
            address
        });

        const user = userResult.rows[0];

        // If role is farmer, create farmer profile
        if (role === 'FARMER') {
            await Farmer.create(user.user_id, {
                farm_name: additionalData.farm_name || `${full_name}'s Farm`,
                barangay: additionalData.barangay || address,
                product_categories: additionalData.product_categories || ''
            });
        }

        // Generate token
        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                contact_number: user.contact_number,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const userResult = await User.findByEmail(email);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Generate token
        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get additional farmer info if applicable
        let farmerProfile = null;
        if (user.role === 'FARMER') {
            const farmerResult = await Farmer.findByUserId(user.user_id);
            if (farmerResult.rows.length > 0) {
                farmerProfile = farmerResult.rows[0];
            }
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                contact_number: user.contact_number,
                address: user.address,
                farmer_profile: farmerProfile
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userResult = await User.findById(req.user.user_id);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        let farmerProfile = null;

        if (user.role === 'FARMER') {
            const farmerResult = await Farmer.findByUserId(user.user_id);
            if (farmerResult.rows.length > 0) {
                farmerProfile = farmerResult.rows[0];
            }
        }

        res.json({
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                contact_number: user.contact_number,
                address: user.address,
                created_at: user.created_at,
                farmer_profile: farmerProfile
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { full_name, contact_number, address } = req.body;
        const updateData = {};

        if (full_name) updateData.full_name = full_name;
        if (contact_number) updateData.contact_number = contact_number;
        if (address) updateData.address = address;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No data provided for update' });
        }

        const result = await User.update(req.user.user_id, updateData);
        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile
};