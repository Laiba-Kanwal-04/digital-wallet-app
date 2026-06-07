const express = require('express');
const db = require('../db/database');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.use(adminAuth);

// GET /api/admin/users - Get all users (EXCLUDE ADMIN)
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, email, role, balance, 
                    COALESCE(status, 'active') as status,
                    created_at
             FROM users 
             WHERE role != 'admin'
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// GET /api/admin/stats - Enhanced system statistics
router.get('/stats', async (req, res) => {
    try {
        // Total users (excluding admin)
        const totalUsers = await db.query("SELECT COUNT(*) FROM users WHERE role != 'admin'");
        
        // Count ACTIVE users (where status = 'active')
        const activeUsers = await db.query("SELECT COUNT(*) FROM users WHERE role != 'admin' AND status = 'active'");
        
        const totalTransactions = await db.query('SELECT COUNT(*) FROM transactions');
        const totalVolume = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions');
        const totalBalance = await db.query("SELECT COALESCE(SUM(balance), 0) as total FROM users WHERE role != 'admin'");
        const blockedUsers = await db.query("SELECT COUNT(*) FROM users WHERE status = 'blocked' AND role != 'admin'");
        
        // ============ DAILY ACTIVITY (Last 30 days) ============
        const dailyActivity = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total
             FROM transactions 
             WHERE created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC`
        );
        
        // ============ MONTHLY SUMMARY (Last 6 months) ============
        const monthlySummary = await db.query(
            `SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                COUNT(*) as transaction_count,
                COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
                COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0) as total_withdrawals,
                COALESCE(SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END), 0) as total_sent,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) as total_received,
                COALESCE(SUM(amount), 0) as total_volume
             FROM transactions 
             WHERE created_at > NOW() - INTERVAL '6 months'
             GROUP BY DATE_TRUNC('month', created_at)
             ORDER BY month DESC`
        );
        
        // Transaction type distribution (pie chart)
        const typeDistribution = await db.query(
            `SELECT 
                type,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
             FROM transactions 
             GROUP BY type`
        );
        
        // Top users by balance
        const topUsers = await db.query(
            "SELECT name, balance, COALESCE((SELECT COUNT(*) FROM transactions WHERE user_id = users.id), 0) as transaction_count FROM users WHERE role != 'admin' ORDER BY balance DESC LIMIT 5"
        );
        
        res.json({
            summary: {
                total_users: parseInt(totalUsers.rows[0].count),
                active_users: parseInt(activeUsers.rows[0].count),
                total_transactions: parseInt(totalTransactions.rows[0].count),
                total_volume: parseFloat(totalVolume.rows[0].total),
                total_balance: parseFloat(totalBalance.rows[0].total),
                blocked_users: parseInt(blockedUsers.rows[0].count)
            },
            daily_activity: dailyActivity.rows,
            monthly_summary: monthlySummary.rows,
            type_distribution: typeDistribution.rows,
            top_users: topUsers.rows
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics: ' + error.message });
    }
});

// GET /api/admin/users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        const userResult = await db.query(
            `SELECT id, name, email, role, balance, 
                    COALESCE(status, 'active') as status,
                    created_at
             FROM users 
             WHERE id = $1 AND role != 'admin'`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const profileResult = await db.query(
            `SELECT phone, address, city, country, date_of_birth
             FROM user_profiles 
             WHERE user_id = $1`,
            [userId]
        );
        
        const transactionsResult = await db.query(
            `SELECT t.*, 
                    CASE 
                        WHEN t.type = 'sent' THEN (SELECT name FROM users WHERE id = t.recipient_id)
                        WHEN t.type = 'received' THEN (SELECT name FROM users WHERE id = t.recipient_id)
                        ELSE NULL
                    END as counterparty
             FROM transactions t
             WHERE t.user_id = $1
             ORDER BY t.created_at DESC
             LIMIT 100`,
            [userId]
        );
        
        const statsResult = await db.query(
            `SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END), 0) as total_sent,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) as total_received,
                COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
                COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0) as total_withdrawals
             FROM transactions
             WHERE user_id = $1`,
            [userId]
        );
        
        res.json({
            user: userResult.rows[0],
            profile: profileResult.rows[0] || {},
            transactions: transactionsResult.rows,
            stats: statsResult.rows[0] || { total_transactions: 0, total_sent: 0, total_received: 0, total_deposits: 0, total_withdrawals: 0 }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

// PUT /api/admin/users/:id - Update user info
router.put('/users/:id', async (req, res) => {
    const client = await db.getClient();
    
    try {
        const userId = req.params.id;
        const { name, email, phone, address, city, country, balance } = req.body;
        
        const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheck.rows[0]?.role === 'admin') {
            return res.status(403).json({ error: 'Cannot modify admin user' });
        }
        
        await client.query('BEGIN');
        
        if (name || email || balance !== undefined) {
            const updates = [];
            const values = [];
            let idx = 1;
            
            if (name) {
                updates.push(`name = $${idx++}`);
                values.push(name);
            }
            if (email) {
                updates.push(`email = $${idx++}`);
                values.push(email);
            }
            if (balance !== undefined) {
                updates.push(`balance = $${idx++}`);
                values.push(balance);
            }
            
            values.push(userId);
            await client.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
                values
            );
        }
        
        const profileCheck = await client.query(
            'SELECT id FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (profileCheck.rows.length > 0) {
            const updates = [];
            const values = [];
            let idx = 1;
            
            if (phone !== undefined) {
                updates.push(`phone = $${idx++}`);
                values.push(phone);
            }
            if (address !== undefined) {
                updates.push(`address = $${idx++}`);
                values.push(address);
            }
            if (city !== undefined) {
                updates.push(`city = $${idx++}`);
                values.push(city);
            }
            if (country !== undefined) {
                updates.push(`country = $${idx++}`);
                values.push(country);
            }
            
            if (updates.length > 0) {
                values.push(userId);
                await client.query(
                    `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = $${idx}`,
                    values
                );
            }
        } else if (phone || address || city || country) {
            await client.query(
                `INSERT INTO user_profiles (user_id, phone, address, city, country)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, phone, address, city, country]
            );
        }
        
        await client.query('COMMIT');
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Failed to update user' });
    } finally {
        client.release();
    }
});

// PUT /api/admin/users/:id/status - Block/Enable user
router.put('/users/:id/status', async (req, res) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        
        const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheck.rows[0]?.role === 'admin') {
            return res.status(403).json({ error: 'Cannot modify admin user' });
        }
        
        await db.query(
            `UPDATE users SET status = $1 WHERE id = $2 AND role != 'admin'`,
            [status, userId]
        );
        
        res.json({ message: `User ${status === 'active' ? 'enabled' : 'blocked'} successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// GET /api/admin/users/:id/statement - Generate statement
router.get('/users/:id/statement', async (req, res) => {
    try {
        const userId = req.params.id;
        const { start_date, end_date } = req.query;
        
        const userResult = await db.query(
            `SELECT name, email FROM users WHERE id = $1`,
            [userId]
        );
        
        let query = `
            SELECT t.*, 
                    CASE 
                        WHEN t.type = 'sent' THEN (SELECT name FROM users WHERE id = t.recipient_id)
                        WHEN t.type = 'received' THEN (SELECT name FROM users WHERE id = t.recipient_id)
                        ELSE NULL
                    END as counterparty
            FROM transactions t
            WHERE t.user_id = $1
        `;
        
        const queryParams = [userId];
        let paramIndex = 2;
        
        if (start_date) {
            query += ` AND t.created_at >= $${paramIndex}`;
            queryParams.push(start_date);
            paramIndex++;
        }
        
        if (end_date) {
            query += ` AND t.created_at <= $${paramIndex}`;
            queryParams.push(end_date + ' 23:59:59');
            paramIndex++;
        }
        
        query += ` ORDER BY t.created_at DESC`;
        
        const transactionsResult = await db.query(query, queryParams);
        
        const summary = {
            total_sent: 0,
            total_received: 0,
            total_deposits: 0,
            total_withdrawals: 0
        };
        
        transactionsResult.rows.forEach(t => {
            if (t.type === 'sent') summary.total_sent += parseFloat(t.amount);
            else if (t.type === 'received') summary.total_received += parseFloat(t.amount);
            else if (t.type === 'deposit') summary.total_deposits += parseFloat(t.amount);
            else if (t.type === 'withdraw') summary.total_withdrawals += parseFloat(t.amount);
        });
        
        res.json({
            user: userResult.rows[0],
            transactions: transactionsResult.rows,
            summary: summary,
            date_range: { start_date, end_date }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate statement' });
    }
});

// PUT /api/admin/users/:id/balance - Update balance
router.put('/users/:id/balance', async (req, res) => {
    try {
        const { balance } = req.body;
        const userId = req.params.id;
        
        const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheck.rows[0]?.role === 'admin') {
            return res.status(403).json({ error: 'Cannot modify admin user' });
        }
        
        const result = await db.query(
            `UPDATE users SET balance = $1 WHERE id = $2 AND role != 'admin' RETURNING id, name, balance`,
            [balance, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Balance updated', user: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update balance' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
    const client = await db.getClient();
    
    try {
        const userId = req.params.id;
        
        const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheck.rows[0]?.role === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin user' });
        }
        
        await client.query('BEGIN');
        await client.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM beneficiaries WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Failed to delete user' });
    } finally {
        client.release();
    }
});

// GET /api/admin/stats - Enhanced system statistics
router.get('/stats', async (req, res) => {
    try {
        // Total users (excluding admin)
        const totalUsers = await db.query("SELECT COUNT(*) FROM users WHERE role != 'admin'");
        
        // Total transactions
        const totalTransactions = await db.query('SELECT COUNT(*) FROM transactions');
        
        // Total volume (sum of all transactions)
        const totalVolume = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions');
        
        // Total balance across all user accounts
        const totalBalance = await db.query("SELECT COALESCE(SUM(balance), 0) as total FROM users WHERE role != 'admin'");
        
        // Daily activity for last 7 days
        const dailyActivity = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                SUM(amount) as volume,
                SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposits,
                SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as withdrawals,
                SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END) as sent,
                SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END) as received
             FROM transactions 
             WHERE created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC
             LIMIT 30`
        );
        
        // Transaction type distribution (pie chart)
        const typeDistribution = await db.query(
            `SELECT 
                type,
                COUNT(*) as count,
                SUM(amount) as total_amount
             FROM transactions 
             GROUP BY type`
        );
        
        // Top 10 users by transaction volume
        const topUsersByVolume = await db.query(
            `SELECT 
                u.name,
                u.email,
                COUNT(t.id) as transaction_count,
                SUM(t.amount) as total_volume
             FROM users u
             JOIN transactions t ON u.id = t.user_id
             WHERE u.role != 'admin'
             GROUP BY u.id, u.name, u.email
             ORDER BY total_volume DESC
             LIMIT 10`
        );
        
        // Monthly summary for bar chart
        const monthlySummary = await db.query(
            `SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                COUNT(*) as transaction_count,
                SUM(amount) as total_volume,
                SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
                SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as total_withdrawals,
                SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END) as total_sent,
                SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END) as total_received
             FROM transactions 
             WHERE created_at > NOW() - INTERVAL '6 months'
             GROUP BY DATE_TRUNC('month', created_at)
             ORDER BY month DESC`
        );
        
        // User registration trend
        const registrationTrend = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as new_users
             FROM users 
             WHERE role != 'admin' AND created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC`
        );
        
        // Blocked users count
        const blockedUsers = await db.query(
            "SELECT COUNT(*) FROM users WHERE status = 'blocked' AND role != 'admin'"
        );
        
        // Active users (have done at least one transaction in last 30 days)
        const activeUsers = await db.query(
            `SELECT COUNT(DISTINCT user_id) as active
             FROM transactions 
             WHERE created_at > NOW() - INTERVAL '30 days'`
        );
        
        res.json({
            summary: {
                total_users: parseInt(totalUsers.rows[0].count),
                total_transactions: parseInt(totalTransactions.rows[0].count),
                total_volume: parseFloat(totalVolume.rows[0].total),
                total_balance: parseFloat(totalBalance.rows[0].total),
                blocked_users: parseInt(blockedUsers.rows[0].count),
                active_users: parseInt(activeUsers.rows[0].count)
            },
            daily_activity: dailyActivity.rows,
            type_distribution: typeDistribution.rows,
            top_users: topUsersByVolume.rows,
            monthly_summary: monthlySummary.rows,
            registration_trend: registrationTrend.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// GET /api/admin/transactions - All transactions
router.get('/transactions', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, 
                    sender.name as sender_name,
                    recipient.name as recipient_name
             FROM transactions t
             LEFT JOIN users sender ON t.user_id = sender.id
             LEFT JOIN users recipient ON t.recipient_id = recipient.id
             ORDER BY t.created_at DESC
             LIMIT 200`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

module.exports = router;