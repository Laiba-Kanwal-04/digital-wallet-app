-- ============================================
-- COMPLETE DIGITAL WALLET DATABASE SCHEMA
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,                        -- Primary Key (Auto-increment)
    name VARCHAR(100) NOT NULL,                    -- NOT NULL Constraint
    email VARCHAR(255) UNIQUE NOT NULL,            -- UNIQUE Constraint
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user'                -- DEFAULT Value
        CHECK (role IN ('user', 'admin')),         -- CHECK Constraint
    balance DECIMAL(12,2) DEFAULT 0.00
        CHECK (balance >= 0),                      -- CHECK Constraint (no negative balance)
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);      -- Index on frequently queried column
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. USER_PROFILES TABLE (One-to-One Relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE                        -- UNIQUE = One-to-One
        REFERENCES users(id) ON DELETE CASCADE,   -- Foreign Key with CASCADE
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    date_of_birth DATE
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================
-- 3. TRANSACTIONS TABLE (Core Business Logic)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,        -- UNIQUE for idempotency
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,    -- FK with CASCADE
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('deposit', 'withdraw', 'sent', 'received')), -- ENUM validation
    amount DECIMAL(12,2) NOT NULL
        CHECK (amount > 0),                        -- CHECK (positive amount)
    fee DECIMAL(12,2) DEFAULT 0
        CHECK (fee >= 0),
    status VARCHAR(20) DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed')),
    recipient_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,   -- FK with SET NULL
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Composite Indexes for complex queries
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_reference ON transactions(reference);

-- ============================================
-- 4. BENEFICIARIES TABLE 
-- ============================================
CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_name VARCHAR(100) NOT NULL,
    beneficiary_email VARCHAR(255),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_beneficiary               -- Named Constraint
        UNIQUE (user_id, beneficiary_email)         -- Composite UNIQUE
);

CREATE INDEX idx_beneficiaries_user_id ON beneficiaries(user_id);

-- ============================================
-- 5. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ============================================
-- 6. CATEGORIES TABLE 
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) DEFAULT 'expense',
    icon VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. BUDGETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER
        REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL
        CHECK (amount > 0),
    spent DECIMAL(12,2) DEFAULT 0
        CHECK (spent >= 0),
    month INTEGER NOT NULL
        CHECK (month BETWEEN 1 AND 12),            -- CHECK for valid month
    year INTEGER NOT NULL
        CHECK (year >= 2000),                      -- CHECK for valid year
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id, month, year)      -- Composite UNIQUE (upsert)
);

CREATE INDEX idx_budgets_user_month ON budgets(user_id, month, year);

-- ============================================
-- 8. GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL
        CHECK (target_amount > 0),
    current_amount DECIMAL(12,2) DEFAULT 0
        CHECK (current_amount >= 0),
    deadline DATE,
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goals_user_status ON goals(user_id, status);

-- ============================================
-- 9. SUPPORT_TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- ============================================
-- 10. PAYMENT_METHODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    card_last4 VARCHAR(4) NOT NULL,
    card_brand VARCHAR(50) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. SECURITY_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,  -- Preserve logs even if user deleted
    action VARCHAR(100),
    ip_address VARCHAR(45),                        -- IPv6 compatible
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_logs_user_action ON security_logs(user_id, action);

-- Get user profile with their profile info, total transactions, and balance
SELECT 
    u.id,
    u.name,
    u.email,
    u.balance,
    u.status,
    p.phone,
    p.address,
    p.city,
    p.country,
    COUNT(t.id) as total_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'sent' THEN t.amount ELSE 0 END), 0) as total_sent,
    COALESCE(SUM(CASE WHEN t.type = 'received' THEN t.amount ELSE 0 END), 0) as total_received
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id           -- LEFT JOIN (One-to-One)
LEFT JOIN transactions t ON u.id = t.user_id            -- LEFT JOIN (One-to-Many)
WHERE u.id = $1
GROUP BY u.id, p.phone, p.address, p.city, p.country;   -- GROUP BY with aggregation

-- Get all transactions with sender and receiver names
SELECT 
    t.id,
    t.reference,
    t.type,
    t.amount,
    t.description,
    t.created_at,
    t.status,
    sender.name as sender_name,        -- Alias for clarity
    receiver.name as receiver_name     -- Self-Join alias
FROM transactions t
LEFT JOIN users sender ON t.user_id = sender.id         -- Self-Join (Sender)
LEFT JOIN users receiver ON t.recipient_id = receiver.id -- Self-Join (Receiver)
WHERE t.user_id = $1 OR t.recipient_id = $1             -- OR condition
ORDER BY t.created_at DESC
LIMIT 50;

-- Get spending breakdown by category for a specific user
SELECT 
    c.name as category_name,
    c.icon,
    c.color,
    COALESCE(SUM(t.amount), 0) as total_spent,
    COUNT(t.id) as transaction_count
FROM categories c
LEFT JOIN budgets b ON c.id = b.category_id AND b.user_id = $1
LEFT JOIN transactions t ON t.user_id = $1 
    AND t.type IN ('sent', 'withdraw')
    AND LOWER(t.description) LIKE '%' || LOWER(c.name) || '%'
    AND t.created_at >= DATE_TRUNC('month', NOW())
WHERE c.type = 'expense'
GROUP BY c.id, c.name, c.icon, c.color
ORDER BY total_spent DESC;

-- Find users who have above average balance
SELECT 
    name,
    email,
    balance,
    (SELECT COUNT(*) FROM transactions WHERE user_id = users.id) as tx_count
FROM users
WHERE balance > (
    SELECT AVG(balance) FROM users WHERE role != 'admin'  -- Subquery
)
AND role != 'admin'
ORDER BY balance DESC;

-- Get top 5 users by spending
SELECT 
    user_stats.user_id,
    user_stats.name,
    user_stats.total_spent
FROM (
    SELECT 
        u.id as user_id,
        u.name,
        COALESCE(SUM(t.amount), 0) as total_spent
    FROM users u
    LEFT JOIN transactions t ON u.id = t.user_id
        AND t.type IN ('sent', 'withdraw')
    WHERE u.role != 'admin'
    GROUP BY u.id, u.name
) AS user_stats                              -- Derived Table (Subquery in FROM)
WHERE user_stats.total_spent > 0
ORDER BY user_stats.total_spent DESC
LIMIT 5;

-- Find users who have never made a transaction
SELECT 
    u.id,
    u.name,
    u.email,
    u.created_at
FROM users u
WHERE NOT EXISTS (                           -- NOT EXISTS Subquery
    SELECT 1 FROM transactions t 
    WHERE t.user_id = u.id
)
AND u.role != 'admin';

-- Active users OR users with recent transactions
SELECT id, name, email, 'Active User' as status
FROM users 
WHERE status = 'active' AND role != 'admin'

UNION                                               -- UNION (removes duplicates)

SELECT id, name, email, 'Recent User' as status
FROM users 
WHERE id IN (
    SELECT DISTINCT user_id 
    FROM transactions 
    WHERE created_at > NOW() - INTERVAL '30 days'
)
ORDER BY name;

-- Users who are active AND have recent transactions
SELECT id, name, email
FROM users 
WHERE status = 'active' AND role != 'admin'

INTERSECT                                           -- INTERSECT

SELECT user_id
FROM transactions 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Calculate running balance for a user's transactions
SELECT 
    t.id,
    t.type,
    t.amount,
    t.created_at,
    SUM(CASE 
        WHEN t.type IN ('deposit', 'received') THEN t.amount
        WHEN t.type IN ('withdraw', 'sent') THEN -t.amount
        ELSE 0
    END) OVER (ORDER BY t.created_at) as running_balance   -- Window Function
FROM transactions t
WHERE t.user_id = $1
ORDER BY t.created_at;

-- Rank users by balance
SELECT 
    id,
    name,
    balance,
    RANK() OVER (ORDER BY balance DESC) as balance_rank,      -- RANK
    DENSE_RANK() OVER (ORDER BY balance DESC) as dense_rank, -- DENSE_RANK
    ROW_NUMBER() OVER (ORDER BY balance DESC) as row_num     -- ROW_NUMBER
FROM users 
WHERE role != 'admin'
ORDER BY balance DESC;

-- Monthly summary of all transactions
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_transactions,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(amount) as total_volume,
    AVG(amount) as average_amount,
    MIN(amount) as min_amount,
    MAX(amount) as max_amount,
    SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
    SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as total_withdrawals,
    SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END) as total_sent,
    SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END) as total_received
FROM transactions
WHERE created_at > NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Pivot table: Monthly spending by category (CROSSTAB-like)
SELECT 
    EXTRACT(YEAR FROM t.created_at) as year,
    EXTRACT(MONTH FROM t.created_at) as month,
    COALESCE(SUM(CASE WHEN c.name = 'Food' THEN t.amount ELSE 0 END), 0) as food,
    COALESCE(SUM(CASE WHEN c.name = 'Shopping' THEN t.amount ELSE 0 END), 0) as shopping,
    COALESCE(SUM(CASE WHEN c.name = 'Bills' THEN t.amount ELSE 0 END), 0) as bills,
    COALESCE(SUM(CASE WHEN c.name = 'Entertainment' THEN t.amount ELSE 0 END), 0) as entertainment,
    COALESCE(SUM(CASE WHEN c.name = 'Others' THEN t.amount ELSE 0 END), 0) as others
FROM transactions t
LEFT JOIN categories c ON LOWER(t.description) LIKE '%' || LOWER(c.name) || '%'
WHERE t.type IN ('sent', 'withdraw')
    AND t.created_at > NOW() - INTERVAL '6 months'
GROUP BY EXTRACT(YEAR FROM t.created_at), EXTRACT(MONTH FROM t.created_at)
ORDER BY year DESC, month DESC;


-- Transfer money with full ACID compliance
BEGIN TRANSACTION;  -- Atomicity

-- 1. Lock sender's row (Isolation)
SELECT balance FROM users WHERE id = $1 FOR UPDATE;

-- 2. Check sufficient balance
DO $$
DECLARE
    sender_balance DECIMAL;
BEGIN
    SELECT balance INTO sender_balance FROM users WHERE id = $1;
    IF sender_balance < $2 THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
END $$;

-- 3. Deduct from sender
UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1;

-- 4. Add to recipient
UPDATE users SET balance = balance + $2, updated_at = NOW() WHERE id = $3;

-- 5. Record transaction (audit)
INSERT INTO transactions (reference, user_id, type, amount, recipient_id, description)
VALUES ($4, $1, 'sent', $2, $3, $5);

INSERT INTO transactions (reference, user_id, type, amount, recipient_id, description)
VALUES ($6, $3, 'received', $2, $1, $7);

-- 6. Create notifications
INSERT INTO notifications (user_id, message) VALUES 
($1, 'You sent $' || $2 || ' to ' || (SELECT name FROM users WHERE id = $3)),
($3, 'You received $' || $2 || ' from ' || (SELECT name FROM users WHERE id = $1));

COMMIT;  -- Durability (if all succeeds)
-- ROLLBACK; -- If any error occurs (Atomicity)

-- Using Savepoints for partial rollback
BEGIN;

SAVEPOINT before_update;

UPDATE users SET balance = balance - 100 WHERE id = 1;

-- Check if something went wrong
SELECT balance FROM users WHERE id = 1;

ROLLBACK TO SAVEPOINT before_update;  -- Rollback only the update

-- Continue with other operations
UPDATE users SET balance = balance + 100 WHERE id = 2;

COMMIT;

-- Single Column Index
CREATE INDEX idx_users_email ON users(email);

-- Composite Index (for queries filtering on both columns)
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);

-- Partial Index (only index rows that meet condition)
CREATE INDEX idx_active_users ON users(id) WHERE status = 'active';

-- Expression Index (index on function result)
CREATE INDEX idx_lower_email ON users(LOWER(email));

-- Covering Index (includes all columns needed for query)
CREATE INDEX idx_transactions_covering ON transactions(user_id, type, amount, created_at);

-- Explain plan to check index usage
EXPLAIN ANALYZE
SELECT * FROM transactions WHERE user_id = 1 AND type = 'deposit';

-- Check unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Never used
ORDER BY idx_scan;

-- View: User Financial Summary
CREATE OR REPLACE VIEW vw_user_financial_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.balance,
    COALESCE(p.phone, 'Not Provided') as phone,
    COUNT(DISTINCT t.id) as transaction_count,
    COALESCE(SUM(CASE WHEN t.type IN ('sent', 'withdraw') THEN t.amount ELSE 0 END), 0) as total_outgoing,
    COALESCE(SUM(CASE WHEN t.type IN ('received', 'deposit') THEN t.amount ELSE 0 END), 0) as total_incoming,
    u.created_at as member_since,
    CASE 
        WHEN u.balance = 0 THEN 'Zero Balance'
        WHEN u.balance < 100 THEN 'Low Balance'
        WHEN u.balance < 1000 THEN 'Medium Balance'
        ELSE 'High Balance'
    END as balance_category
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN transactions t ON u.id = t.user_id
WHERE u.role != 'admin'
GROUP BY u.id, u.name, u.email, u.balance, p.phone, u.created_at;

-- View: Daily Platform Activity
CREATE OR REPLACE VIEW vw_daily_activity AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    SUM(amount) as total_volume,
    COUNT(DISTINCT user_id) as active_users,
    AVG(amount) as avg_transaction,
    SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposits,
    SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as withdrawals,
    SUM(CASE WHEN type = 'sent' THEN amount ELSE 0 END) as sent,
    SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END) as received
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on users table
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger on budgets table
CREATE TRIGGER trigger_budgets_updated_at
BEFORE UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();