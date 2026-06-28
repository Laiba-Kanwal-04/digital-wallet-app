-- ============================================
-- COMPLETE DIGITAL WALLET DATABASE SETUP
-- RUN THIS ENTIRE FILE IN NEON TECH SQL EDITOR
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    balance DECIMAL(12,2) DEFAULT 0.00
        CHECK (balance >= 0),
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. USER_PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    date_of_birth DATE
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================
-- 3. TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('deposit', 'withdraw', 'sent', 'received')),
    amount DECIMAL(12,2) NOT NULL
        CHECK (amount > 0),
    fee DECIMAL(12,2) DEFAULT 0
        CHECK (fee >= 0),
    status VARCHAR(20) DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed')),
    recipient_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    CONSTRAINT unique_user_beneficiary
        UNIQUE (user_id, beneficiary_email)
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
        CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL
        CHECK (year >= 2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id, month, year)
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
        REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_logs_user_action ON security_logs(user_id, action);

-- ============================================
-- 12. VIEWS
-- ============================================

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

-- ============================================
-- 13. TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for users table
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Triggers for budgets table
CREATE TRIGGER trigger_budgets_updated_at
BEFORE UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Triggers for goals table
CREATE TRIGGER trigger_goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 14. SAMPLE DATA
-- ============================================

-- Insert Categories
INSERT INTO categories (name, type, icon, color) VALUES
('Food', 'expense', 'fa-utensils', '#48bb78'),
('Shopping', 'expense', 'fa-shopping-bag', '#f56565'),
('Bills', 'expense', 'fa-file-invoice-dollar', '#ed8936'),
('Entertainment', 'expense', 'fa-film', '#4299e1'),
('Transport', 'expense', 'fa-car', '#9f7aea'),
('Healthcare', 'expense', 'fa-heartbeat', '#e53e3e'),
('Education', 'expense', 'fa-graduation-cap', '#38b2ac'),
('Salary', 'income', 'fa-briefcase', '#48bb78'),
('Others', 'expense', 'fa-tag', '#a0aec0')
ON CONFLICT (name) DO NOTHING;

-- Insert Sample Users (password: password123)
INSERT INTO users (id, name, email, password_hash, role, balance, status) VALUES
(1, 'Laiba Kanwal', 'bsse2480204@szabist.pk', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'user', 15000.00, 'active'),
(2, 'Shahla Abbasi', 'bsse2480221@szabist.pk', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'user', 8000.00, 'active'),
(3, 'Admin User', 'admin@digitalwallet.com', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'admin', 0.00, 'active')
ON CONFLICT (id) DO NOTHING;

-- Reset user ID sequence
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Insert User Profiles
INSERT INTO user_profiles (user_id, phone, address, city, country) VALUES
(1, '+92 300 1234567', '123 University Road', 'Karachi', 'Pakistan'),
(2, '+92 300 7654321', '456 College Street', 'Karachi', 'Pakistan')
ON CONFLICT (user_id) DO NOTHING;

-- Insert Sample Transactions
INSERT INTO transactions (reference, user_id, type, amount, description, status, created_at) VALUES
('DEP_JAN_001', 1, 'deposit', 5000.00, 'January Salary', 'completed', '2025-01-15 10:00:00'),
('DEP_FEB_001', 1, 'deposit', 5200.00, 'February Salary', 'completed', '2025-02-15 10:00:00'),
('DEP_MAR_001', 1, 'deposit', 5500.00, 'March Salary', 'completed', '2025-03-15 10:00:00'),
('DEP_APR_001', 1, 'deposit', 6000.00, 'April Salary', 'completed', '2025-04-15 10:00:00'),
('DEP_MAY_001', 1, 'deposit', 5800.00, 'May Salary', 'completed', '2025-05-15 10:00:00'),
('DEP_JUN_001', 1, 'deposit', 6200.00, 'June Salary', 'completed', '2025-06-15 10:00:00'),
('WTH_JAN_001', 1, 'withdraw', 2000.00, 'January Expenses', 'completed', '2025-01-20 14:30:00'),
('WTH_FEB_001', 1, 'withdraw', 2200.00, 'February Expenses', 'completed', '2025-02-20 14:30:00'),
('WTH_MAR_001', 1, 'withdraw', 2500.00, 'March Expenses', 'completed', '2025-03-20 14:30:00'),
('WTH_APR_001', 1, 'withdraw', 2800.00, 'April Expenses', 'completed', '2025-04-20 14:30:00'),
('WTH_MAY_001', 1, 'withdraw', 2600.00, 'May Expenses', 'completed', '2025-05-20 14:30:00'),
('WTH_JUN_001', 1, 'withdraw', 3000.00, 'June Expenses', 'completed', '2025-06-20 14:30:00'),
('SENT_JUN_001', 1, 'sent', 50.00, 'Lunch with friend', 'completed', NOW() - INTERVAL '1 day'),
('DEP_JUN_002', 2, 'deposit', 300.00, 'Freelance Payment', 'completed', NOW() - INTERVAL '2 days'),
('WTH_JUN_002', 1, 'withdraw', 100.00, 'ATM Withdrawal', 'completed', NOW() - INTERVAL '3 days')
ON CONFLICT (reference) DO NOTHING;

-- Reset transaction sequence
SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));

-- Insert Beneficiaries
INSERT INTO beneficiaries (user_id, beneficiary_name, beneficiary_email, is_favorite) VALUES
(1, 'Shahla Abbasi', 'bsse2480221@szabist.pk', true),
(2, 'Laiba Kanwal', 'bsse2480204@szabist.pk', true)
ON CONFLICT (user_id, beneficiary_email) DO NOTHING;

-- Insert Notifications
INSERT INTO notifications (user_id, message, is_read, created_at) VALUES
(1, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(2, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(1, '$500 deposited successfully!', false, NOW() - INTERVAL '5 days'),
(2, '$300 deposited successfully!', false, NOW() - INTERVAL '4 days');

-- Insert Budgets
INSERT INTO budgets (user_id, category_id, amount, month, year) VALUES
(1, (SELECT id FROM categories WHERE name = 'Food'), 500.00, EXTRACT(MONTH FROM NOW()), EXTRACT(YEAR FROM NOW())),
(1, (SELECT id FROM categories WHERE name = 'Shopping'), 300.00, EXTRACT(MONTH FROM NOW()), EXTRACT(YEAR FROM NOW())),
(1, (SELECT id FROM categories WHERE name = 'Bills'), 400.00, EXTRACT(MONTH FROM NOW()), EXTRACT(YEAR FROM NOW()))
ON CONFLICT (user_id, category_id, month, year) DO NOTHING;

-- Insert Goals
INSERT INTO goals (user_id, name, target_amount, current_amount, deadline) VALUES
(1, 'Vacation Fund', 1000.00, 200.00, '2026-12-31'),
(1, 'New Laptop', 800.00, 150.00, '2026-09-30'),
(2, 'Emergency Fund', 5000.00, 500.00, '2026-12-31');

-- Insert Support Tickets
INSERT INTO support_tickets (user_id, subject, message, status) VALUES
(1, 'Login Issue', 'I cannot login to my account after password reset', 'open'),
(2, 'Transaction Failed', 'My transaction failed but money was deducted', 'in_progress');

-- Insert Payment Methods
INSERT INTO payment_methods (user_id, card_last4, card_brand, is_default) VALUES
(1, '1234', 'visa', true),
(1, '5678', 'mastercard', false),
(2, '9012', 'visa', true);

-- Insert Security Logs
INSERT INTO security_logs (user_id, action, ip_address) VALUES
(1, 'login_success', '192.168.1.100'),
(1, 'login_success', '192.168.1.101'),
(2, 'login_success', '192.168.1.102'),
(1, 'password_change', '192.168.1.100'),
(2, 'login_failed', '192.168.1.200');

-- ============================================
-- 15. UPDATE ALL SEQUENCES
-- ============================================
SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications));
SELECT setval('beneficiaries_id_seq', (SELECT MAX(id) FROM beneficiaries));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('budgets_id_seq', (SELECT MAX(id) FROM budgets));
SELECT setval('goals_id_seq', (SELECT MAX(id) FROM goals));
SELECT setval('support_tickets_id_seq', (SELECT MAX(id) FROM support_tickets));
SELECT setval('payment_methods_id_seq', (SELECT MAX(id) FROM payment_methods));
SELECT setval('security_logs_id_seq', (SELECT MAX(id) FROM security_logs));

-- ============================================
-- 16. VERIFICATION QUERIES
-- ============================================

-- Check all tables have data
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'beneficiaries', COUNT(*) FROM beneficiaries
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'budgets', COUNT(*) FROM budgets
UNION ALL
SELECT 'goals', COUNT(*) FROM goals
UNION ALL
SELECT 'support_tickets', COUNT(*) FROM support_tickets
UNION ALL
SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL
SELECT 'security_logs', COUNT(*) FROM security_logs;

-- Show sample data
SELECT '=== USERS ===' as info;
SELECT id, name, email, role, balance, status FROM users;

SELECT '=== TRANSACTIONS ===' as info;
SELECT reference, user_id, type, amount, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 10;

SELECT '=== CATEGORIES ===' as info;
SELECT * FROM categories;

SELECT '=== BUDGETS ===' as info;
SELECT b.*, c.name as category_name FROM budgets b JOIN categories c ON b.category_id = c.id;

SELECT '=== GOALS ===' as info;
SELECT * FROM goals;

SELECT '=== SUPPORT TICKETS ===' as info;
SELECT * FROM support_tickets;

-- ============================================
-- 17. SAMPLE COMPLEX QUERIES
-- ============================================

-- Query 1: User Financial Summary
SELECT '=== USER FINANCIAL SUMMARY ===' as info;
SELECT * FROM vw_user_financial_summary;

-- Query 2: Daily Activity
SELECT '=== DAILY ACTIVITY ===' as info;
SELECT * FROM vw_daily_activity LIMIT 10;

-- Query 3: Top Spenders
SELECT '=== TOP SPENDERS ===' as info;
SELECT 
    u.name,
    COALESCE(SUM(t.amount), 0) as total_spent
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id AND t.type IN ('sent', 'withdraw')
WHERE u.role != 'admin'
GROUP BY u.id, u.name
ORDER BY total_spent DESC
LIMIT 5;

-- Query 4: Monthly Summary
SELECT '=== MONTHLY SUMMARY ===' as info;
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as transactions,
    SUM(amount) as total_volume,
    AVG(amount) as avg_amount
FROM transactions
WHERE created_at > NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ============================================
-- 18. DROP STATEMENTS (If Needed)
-- ============================================
-- Uncomment below to drop all tables
-- DROP TABLE IF EXISTS security_logs CASCADE;
-- DROP TABLE IF EXISTS payment_methods CASCADE;
-- DROP TABLE IF EXISTS support_tickets CASCADE;
-- DROP TABLE IF EXISTS goals CASCADE;
-- DROP TABLE IF EXISTS budgets CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS beneficiaries CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS user_profiles CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP VIEW IF EXISTS vw_user_financial_summary CASCADE;
-- DROP VIEW IF EXISTS vw_daily_activity CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================
-- 19. COMPLETE DATABASE INFO
-- ============================================
SELECT '=== DATABASE SETUP COMPLETE ===' as info;
SELECT 'Total Tables: 11' as info;
SELECT 'Total Views: 2' as info;
SELECT 'Total Triggers: 3' as info;
SELECT 'Sample Users: ' || COUNT(*) FROM users;
SELECT 'Sample Transactions: ' || COUNT(*) FROM transactions;