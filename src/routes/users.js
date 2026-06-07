const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

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
        
        delete user.password_hash;
        res.json({ user, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

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

module.exports = router;