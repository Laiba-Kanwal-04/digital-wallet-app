const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// POST /api/users/register - Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await db.query(
            `INSERT INTO users (name, email, password_hash, balance) 
             VALUES ($1, $2, $3, 100) RETURNING id, name, email, role, balance`,
            [name, email, hashedPassword]
        );
        
        const user = result.rows[0];
        
        // Create user profile
        await db.query(
            `INSERT INTO user_profiles (user_id) VALUES ($1)`,
            [user.id]
        );
        
        // Create welcome notification
        await db.query(
            `INSERT INTO notifications (user_id, message) VALUES ($1, $2)`,
            [user.id, 'Welcome to Digital Wallet! You received $100 bonus!']
        );
        
        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({ user, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/users/login - Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await db.query(
            `SELECT id, name, email, password_hash, role, balance FROM users WHERE email = $1`,
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Log security event
        await db.query(
            `INSERT INTO security_logs (user_id, action, ip_address, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [user.id, 'login_success', req.ip || req.connection.remoteAddress, req.headers['user-agent'] || 'Unknown']
        );
        
        delete user.password_hash;
        res.json({ user, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================
// PROFILE ROUTES
// ============================================

// GET /api/users/profile - Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.balance, 
                    up.phone, up.address, up.city, up.country
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// PUT /api/users/profile - Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { phone, address, city, country } = req.body;
        
        await db.query(
            `UPDATE user_profiles 
             SET phone = COALESCE($1, phone),
                 address = COALESCE($2, address),
                 city = COALESCE($3, city),
                 country = COALESCE($4, country)
             WHERE user_id = $5`,
            [phone, address, city, country, req.user.id]
        );
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============================================
// NOTIFICATION ROUTES
// ============================================

// GET /api/users/notifications - Get notifications
router.get('/notifications', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

// PUT /api/users/notifications/:id/read - Mark notification as read
router.put('/notifications/:id/read', auth, async (req, res) => {
    try {
        await db.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// ============================================
// BENEFICIARY ROUTES
// ============================================

// GET /api/users/beneficiaries - Get beneficiaries
router.get('/beneficiaries', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM beneficiaries WHERE user_id = $1 ORDER BY is_favorite DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get beneficiaries' });
    }
});

// POST /api/users/beneficiaries - Add beneficiary
router.post('/beneficiaries', auth, async (req, res) => {
    try {
        const { beneficiary_name, beneficiary_email, is_favorite } = req.body;
        
        const result = await db.query(
            `INSERT INTO beneficiaries (user_id, beneficiary_name, beneficiary_email, is_favorite)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.user.id, beneficiary_name, beneficiary_email, is_favorite || false]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add beneficiary' });
    }
});

// DELETE /api/users/beneficiaries/:id - Delete beneficiary
router.delete('/beneficiaries/:id', auth, async (req, res) => {
    try {
        await db.query(
            `DELETE FROM beneficiaries WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Beneficiary deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete beneficiary' });
    }
});

// ============================================
// SUPPORT TICKET ROUTES (NEW)
// ============================================

// POST /api/users/tickets - Create support ticket
router.post('/tickets', auth, async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }
        
        const result = await db.query(
            `INSERT INTO support_tickets (user_id, subject, message, status)
             VALUES ($1, $2, $3, 'open') RETURNING *`,
            [req.user.id, subject, message]
        );
        
        await db.query(
            `INSERT INTO notifications (user_id, message, is_read)
             VALUES ($1, $2, false)`,
            [req.user.id, `Support ticket #${result.rows[0].id} created successfully`]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// GET /api/users/tickets - Get user's tickets
router.get('/tickets', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM support_tickets 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get tickets' });
    }
});

// ============================================
// PAYMENT METHOD ROUTES (NEW)
// ============================================

// POST /api/users/payment-methods - Add payment method
router.post('/payment-methods', auth, async (req, res) => {
    try {
        const { card_last4, card_brand, is_default } = req.body;
        
        // If this is default, remove default from others
        if (is_default) {
            await db.query(
                'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
                [req.user.id]
            );
        }
        
        const result = await db.query(
            `INSERT INTO payment_methods (user_id, card_last4, card_brand, is_default)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.user.id, card_last4, card_brand, is_default || false]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// GET /api/users/payment-methods - Get user's payment methods
router.get('/payment-methods', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM payment_methods 
             WHERE user_id = $1 
             ORDER BY is_default DESC, created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

// ============================================
// CATEGORY ROUTES (NEW)
// ============================================

// GET /api/users/categories - Get all categories
router.get('/categories', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM categories ORDER BY name'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

// POST /api/users/categories - Add custom category (admin only)
router.post('/categories', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }
        
        const { name, type, icon, color } = req.body;
        
        const result = await db.query(
            `INSERT INTO categories (name, type, icon, color)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, type, icon, color]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

// ============================================
// BUDGET ROUTES (NEW)
// ============================================
// POST /api/users/budgets - Create/Update budget
router.post('/budgets', auth, async (req, res) => {
    try {
        const { category_name, amount, month, year } = req.body;
        
        console.log('Creating budget:', { category_name, amount, month, year }); // Debug log
        
        // Get category ID
        const categoryResult = await db.query(
            'SELECT id FROM categories WHERE name = $1',
            [category_name]
        );
        
        if (categoryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        const categoryId = categoryResult.rows[0].id;
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();
        
        // Upsert budget
        const result = await db.query(
            `INSERT INTO budgets (user_id, category_id, amount, month, year)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, category_id, month, year) 
             DO UPDATE SET amount = $3, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [req.user.id, categoryId, amount, targetMonth, targetYear]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Budget creation error:', error);
        res.status(500).json({ error: 'Failed to set budget: ' + error.message });
    }
});

// GET /api/users/budgets - Get user's budgets
router.get('/budgets', auth, async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();
        
        const result = await db.query(
            `SELECT b.*, c.name as category_name, c.color, c.icon
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
             ORDER BY c.name`,
            [req.user.id, targetMonth, targetYear]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching budgets:', error);
        res.status(500).json({ error: 'Failed to get budgets' });
    }
});

// ============================================
// GOAL ROUTES (NEW)
// ============================================

// POST /api/users/goals - Create goal
router.post('/goals', auth, async (req, res) => {
    try {
        const { name, target_amount, deadline } = req.body;
        
        if (!name || !target_amount) {
            return res.status(400).json({ error: 'Name and target amount required' });
        }
        
        const result = await db.query(
            `INSERT INTO goals (user_id, name, target_amount, deadline, status)
             VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
            [req.user.id, name, target_amount, deadline || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

// GET /api/users/goals - Get user's goals
router.get('/goals', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM goals 
             WHERE user_id = $1 
             ORDER BY deadline ASC NULLS LAST`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get goals' });
    }
});

// PUT /api/users/goals/:id/progress - Update goal progress
router.put('/goals/:id/progress', auth, async (req, res) => {
    try {
        const { current_amount } = req.body;
        
        const result = await db.query(
            `UPDATE goals 
             SET current_amount = $1,
                 status = CASE 
                     WHEN $1 >= target_amount THEN 'completed' 
                     ELSE 'active' 
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [current_amount, req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update goal progress' });
    }
});

// DELETE /api/users/goals/:id - Delete goal
router.delete('/goals/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

module.exports = router;