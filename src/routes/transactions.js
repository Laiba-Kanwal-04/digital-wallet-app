const express = require('express');
const db = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/transactions/deposit
router.post('/deposit', auth, async (req, res) => {
    const client = await db.getClient();
    
    try {
        const { amount, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        await client.query('BEGIN');
        
        const balanceResult = await client.query(
            `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
            [amount, req.user.id]
        );
        
        const reference = `DEP_${Date.now()}_${req.user.id}`;
        const transactionResult = await client.query(
            `INSERT INTO transactions (reference, user_id, type, amount, description, status)
             VALUES ($1, $2, 'deposit', $3, $4, 'completed') RETURNING *`,
            [reference, req.user.id, amount, description || 'Deposit']
        );
        
        // Simple notification for deposit
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, created_at)
             VALUES ($1, $2, false, NOW())`,
            [req.user.id, `$${amount} deposited successfully!`]
        );
        
        await client.query('COMMIT');
        
        res.json({
            message: 'Deposit successful',
            transaction: transactionResult.rows[0],
            new_balance: balanceResult.rows[0].balance
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Deposit failed' });
    } finally {
        client.release();
    }
});

// POST /api/transactions/withdraw
router.post('/withdraw', auth, async (req, res) => {
    const client = await db.getClient();
    
    try {
        const { amount, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        await client.query('BEGIN');
        
        const balanceCheck = await client.query(
            'SELECT balance FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (balanceCheck.rows[0].balance < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        const balanceResult = await client.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance`,
            [amount, req.user.id]
        );
        
        const reference = `WTH_${Date.now()}_${req.user.id}`;
        const transactionResult = await client.query(
            `INSERT INTO transactions (reference, user_id, type, amount, description, status)
             VALUES ($1, $2, 'withdraw', $3, $4, 'completed') RETURNING *`,
            [reference, req.user.id, amount, description || 'Withdrawal']
        );
        
        // Simple notification for withdrawal
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, created_at)
             VALUES ($1, $2, false, NOW())`,
            [req.user.id, `$${amount} withdrawn successfully!`]
        );
        
        await client.query('COMMIT');
        
        res.json({
            message: 'Withdrawal successful',
            transaction: transactionResult.rows[0],
            new_balance: balanceResult.rows[0].balance
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Withdrawal failed' });
    } finally {
        client.release();
    }
});

// POST /api/transactions/transfer
router.post('/transfer', auth, async (req, res) => {
    const client = await db.getClient();
    
    try {
        const { recipient_email, amount, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        await client.query('BEGIN');
        
        // Get recipient
        const recipientResult = await client.query(
            'SELECT id, name, email FROM users WHERE email = $1',
            [recipient_email]
        );
        
        if (recipientResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Recipient not found' });
        }
        
        const recipient = recipientResult.rows[0];
        
        if (recipient.id === req.user.id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot transfer to yourself' });
        }
        
        // Check sender balance
        const balanceCheck = await client.query(
            'SELECT balance FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (balanceCheck.rows[0].balance < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Update sender balance
        const senderBalanceResult = await client.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance`,
            [amount, req.user.id]
        );
        
        // Update recipient balance
        const recipientBalanceResult = await client.query(
            `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
            [amount, recipient.id]
        );
        
        // Create transaction for SENDER (money sent)
        const senderRef = `SENT_${Date.now()}_${req.user.id}`;
        await client.query(
            `INSERT INTO transactions (reference, user_id, type, amount, description, recipient_id, status)
             VALUES ($1, $2, 'sent', $3, $4, $5, 'completed')`,
            [senderRef, req.user.id, amount, description || `Sent to ${recipient.name}`, recipient.id]
        );
        
        // Create transaction for RECIPIENT (money received)
        const recipientRef = `REC_${Date.now()}_${recipient.id}`;
        await client.query(
            `INSERT INTO transactions (reference, user_id, type, amount, description, recipient_id, status)
             VALUES ($1, $2, 'received', $3, $4, $5, 'completed')`,
            [recipientRef, recipient.id, amount, description || `Received from ${req.user.name}`, req.user.id]
        );
        
        // Simple notification for SENDER
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, created_at)
             VALUES ($1, $2, false, NOW())`,
            [req.user.id, `You sent $${amount} to ${recipient.name}`]
        );
        
        // Simple notification for RECIPIENT
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, created_at)
             VALUES ($1, $2, false, NOW())`,
            [recipient.id, `You received $${amount} from ${req.user.name}`]
        );
        
        await client.query('COMMIT');
        
        res.json({
            message: `Successfully transferred $${amount} to ${recipient.name}`,
            new_balance: senderBalanceResult.rows[0].balance,
            recipient: recipient.name
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Transfer failed: ' + error.message });
    } finally {
        client.release();
    }
});

// GET /api/transactions/history
router.get('/history', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                t.id,
                t.reference,
                t.type,
                t.amount,
                t.description,
                t.created_at,
                t.status,
                CASE 
                    WHEN t.type = 'sent' THEN 
                        (SELECT name FROM users WHERE id = t.recipient_id)
                    WHEN t.type = 'received' THEN 
                        (SELECT name FROM users WHERE id = t.recipient_id)
                    ELSE NULL
                END as counterparty
             FROM transactions t
             WHERE t.user_id = $1
             ORDER BY t.created_at DESC
             LIMIT 100`,
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Failed to get transaction history: ' + error.message });
    }
});

module.exports = router;