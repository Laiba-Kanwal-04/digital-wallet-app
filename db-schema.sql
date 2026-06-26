-- ============================================
-- COMPLETE DIGITAL WALLET DATABASE SETUP
-- ============================================

-- ============================================
-- 1. USERS table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    balance DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 2. USER_PROFILES table
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    date_of_birth DATE,
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================
-- 3. TRANSACTIONS table
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdraw', 'sent', 'received')),
    amount DECIMAL(12,2) NOT NULL,
    fee DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    recipient_id INTEGER REFERENCES users(id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id ON transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ============================================
-- 4. BENEFICIARIES table
-- ============================================
CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_name VARCHAR(100) NOT NULL,
    beneficiary_email VARCHAR(255),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_beneficiary UNIQUE (user_id, beneficiary_email)
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON beneficiaries(user_id);

-- ============================================
-- 5. NOTIFICATIONS table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- 6. SUPPORT_TICKETS table
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ============================================
-- 7. PAYMENT_METHODS table
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);

-- ============================================
-- 8. SESSIONS table
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- 9. SECURITY_LOGS table
-- ============================================
CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);

-- ============================================
-- 10. CATEGORIES table
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20),
    icon VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. TRANSACTION_CATEGORIES (Junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_categories (
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, category_id)
);

-- ============================================
-- 12. BUDGETS table
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    spent DECIMAL(12,2) DEFAULT 0,
    month INTEGER,
    year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(month, year);

-- ============================================
-- 13. GOALS table
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    deadline DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- ============================================
-- 14. REFERRALS table
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_email VARCHAR(255),
    referred_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    bonus_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ============================================
-- 15. REWARDS table
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);

-- ============================================
-- 16. TRANSACTION_ATTACHMENTS table
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_attachments (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_attachments_transaction_id ON transaction_attachments(transaction_id);

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW regular_users AS 
SELECT * FROM users WHERE role != 'admin';

CREATE OR REPLACE VIEW user_transaction_summary AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    COUNT(t.id) as total_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'sent' THEN t.amount ELSE 0 END), 0) as total_sent,
    COALESCE(SUM(CASE WHEN t.type = 'received' THEN t.amount ELSE 0 END), 0) as total_received,
    COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
    COALESCE(SUM(CASE WHEN t.type = 'withdraw' THEN t.amount ELSE 0 END), 0) as total_withdrawals
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
WHERE u.role != 'admin'
GROUP BY u.id, u.name, u.email;

CREATE OR REPLACE VIEW daily_platform_activity AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as transaction_count,
    SUM(amount) as total_volume,
    COUNT(DISTINCT user_id) as active_users
FROM transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- INITIAL DATA (Categories)
-- ============================================
INSERT INTO categories (name, type, icon, color) VALUES
('Food', 'expense', 'fa-utensils', '#48bb78'),
('Shopping', 'expense', 'fa-shopping-bag', '#f56565'),
('Bills', 'expense', 'fa-file-invoice-dollar', '#ed8936'),
('Entertainment', 'expense', 'fa-film', '#4299e1'),
('Transport', 'expense', 'fa-car', '#9f7aea'),
('Healthcare', 'expense', 'fa-heartbeat', '#e53e3e'),
('Education', 'expense', 'fa-graduation-cap', '#38b2ac'),
('Salary', 'income', 'fa-briefcase', '#48bb78'),
('Transfer', 'transfer', 'fa-exchange-alt', '#a0aec0')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SAMPLE USERS (password: password123)
-- ============================================
INSERT INTO users (id, name, email, password_hash, role, balance, status, created_at) VALUES
(1, 'Laiba Kanwal', 'bsse2480204@szabist.pk', '$2a$10$rZkZVQ6yXsZQEFhKZ/XZHORLq1XSsk2q8Q4Kx4vFyVqEJqIW5bCNq', 'user', 15000, 'active', NOW() - INTERVAL '30 days'),
(2, 'Shahla Abbasi', 'bsse2480221@szabist.pk', '$2a$10$rZkZVQ6yXsZQEFhKZ/XZHORLq1XSsk2q8Q4Kx4vFyVqEJqIW5bCNq', 'user', 8000, 'active', NOW() - INTERVAL '30 days'),
(3, 'Admin User', 'admin@digitalwallet.com', '$2a$10$rZkZVQ6yXsZQEFhKZ/XZHORLq1XSsk2q8Q4Kx4vFyVqEJqIW5bCNq', 'admin', 0, 'active', NOW() - INTERVAL '30 days'),
(4, 'Alishba Islam', 'bsse2480187@szabist.pk', '$2a$10$rZkZVQ6yXsZQEFhKZ/XZHORLq1XSsk2q8Q4Kx4vFyVqEJqIW5bCNq', 'user', 50000, 'active', NOW() - INTERVAL '25 days'),
(5, 'Test User', 'test@example.com', '$2a$10$rZkZVQ6yXsZQEFhKZ/XZHORLq1XSsk2q8Q4Kx4vFyVqEJqIW5bCNq', 'user', 1000, 'active', NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence after manual IDs
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ============================================
-- SAMPLE PROFILES
-- ============================================
INSERT INTO user_profiles (user_id, phone, address, city, country) VALUES
(1, '+92 300 1234567', '123 University Road', 'Karachi', 'Pakistan'),
(2, '+92 300 7654321', '456 College Street', 'Karachi', 'Pakistan'),
(4, '+92 300 9876543', '789 Main Boulevard', 'Lahore', 'Pakistan')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- SAMPLE NOTIFICATIONS
-- ============================================
INSERT INTO notifications (user_id, message, is_read, created_at) VALUES
(1, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(2, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(4, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '25 days'),
(1, '$500 deposited successfully!', false, NOW() - INTERVAL '5 days'),
(2, '$300 deposited successfully!', false, NOW() - INTERVAL '4 days');

-- ============================================
-- SAMPLE BENEFICIARIES
-- ============================================
INSERT INTO beneficiaries (user_id, beneficiary_name, beneficiary_email, is_favorite) VALUES
(1, 'Shahla Abbasi', 'bsse2480221@szabist.pk', true),
(2, 'Laiba Kanwal', 'bsse2480204@szabist.pk', true),
(1, 'Alishba Islam', 'bsse2480187@szabist.pk', false)
ON CONFLICT (user_id, beneficiary_email) DO NOTHING;

-- ============================================
-- SAMPLE HISTORICAL TRANSACTIONS (For charts)
-- ============================================
INSERT INTO transactions (reference, user_id, type, amount, description, status, created_at) VALUES
('DEP_JAN', 1, 'deposit', 5000, 'January Salary', 'completed', '2025-01-15'),
('DEP_FEB', 1, 'deposit', 5200, 'February Salary', 'completed', '2025-02-15'),
('DEP_MAR', 1, 'deposit', 5500, 'March Salary', 'completed', '2025-03-15'),
('DEP_APR', 1, 'deposit', 6000, 'April Salary', 'completed', '2025-04-15'),
('DEP_MAY', 1, 'deposit', 5800, 'May Salary', 'completed', '2025-05-15'),
('DEP_JUN', 1, 'deposit', 6200, 'June Salary', 'completed', '2025-06-15'),
('WTH_JAN', 1, 'withdraw', 2000, 'January Expenses', 'completed', '2025-01-20'),
('WTH_FEB', 1, 'withdraw', 2200, 'February Expenses', 'completed', '2025-02-20'),
('WTH_MAR', 1, 'withdraw', 2500, 'March Expenses', 'completed', '2025-03-20'),
('WTH_APR', 1, 'withdraw', 2800, 'April Expenses', 'completed', '2025-04-20'),
('WTH_MAY', 1, 'withdraw', 2600, 'May Expenses', 'completed', '2025-05-20'),
('WTH_JUN', 1, 'withdraw', 3000, 'June Expenses', 'completed', '2025-06-20'),
('DEP_JUN1', 1, 'deposit', 500, 'Salary', 'completed', NOW() - INTERVAL '5 days'),
('DEP_JUN2', 2, 'deposit', 300, 'Freelance', 'completed', NOW() - INTERVAL '4 days'),
('WTH_JUN1', 1, 'withdraw', 100, 'ATM', 'completed', NOW() - INTERVAL '3 days'),
('DEP_JUN3', 4, 'deposit', 1000, 'Bonus', 'completed', NOW() - INTERVAL '2 days'),
('SENT_JUN1', 1, 'sent', 50, 'Lunch', 'completed', NOW() - INTERVAL '1 day')  -- Removed the extra '2'
ON CONFLICT (reference) DO NOTHING;

-- ============================================
-- UPDATE SEQUENCES
-- ============================================
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));
SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications));
SELECT setval('beneficiaries_id_seq', (SELECT MAX(id) FROM beneficiaries));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- ============================================
-- VERIFICATION QUERIES (Run these to check)
-- ============================================
-- SELECT 'Users count:' as info, COUNT(*) FROM users;
-- SELECT 'Transactions count:' as info, COUNT(*) FROM transactions;
-- SELECT 'Categories count:' as info, COUNT(*) FROM categories;
-- SELECT 'Monthly Summary:' as info, TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, SUM(amount) as total FROM transactions GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC LIMIT 6;
