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
-- 6. SUPPORT_TICKETS table (NEW)
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
-- 7. PAYMENT_METHODS table (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    card_last4 VARCHAR(4) NOT NULL,
    card_brand VARCHAR(50) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);

-- ============================================
-- 8. CATEGORIES table (NEW)
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
-- 9. BUDGETS table (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    spent DECIMAL(12,2) DEFAULT 0,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(month, year);

-- ============================================
-- 10. GOALS table (NEW)
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
-- 11. SECURITY_LOGS table (Optional)
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
('Others', 'expense', 'fa-tag', '#a0aec0')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SAMPLE USERS (password: password123)
-- ============================================
INSERT INTO users (id, name, email, password_hash, role, balance, status, created_at) VALUES
(1, 'Laiba Kanwal', 'bsse2480204@szabist.pk', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'user', 15000, 'active', NOW() - INTERVAL '30 days'),
(2, 'Shahla Abbasi', 'bsse2480221@szabist.pk', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'user', 8000, 'active', NOW() - INTERVAL '30 days'),
(3, 'Admin User', 'admin@digitalwallet.com', '$2a$12$FDXyAsfaaegL4.MMuoubBeJpmcgaDVOl2RPwcvPHOXppvO99bsoc2', 'admin', 0, 'active', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ============================================
-- SAMPLE NOTIFICATIONS
-- ============================================
INSERT INTO notifications (user_id, message, is_read, created_at) VALUES
(1, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(2, 'Welcome to Digital Wallet!', true, NOW() - INTERVAL '30 days'),
(1, '$500 deposited successfully!', false, NOW() - INTERVAL '5 days'),
(2, '$300 deposited successfully!', false, NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE BENEFICIARIES
-- ============================================
INSERT INTO beneficiaries (user_id, beneficiary_name, beneficiary_email, is_favorite) VALUES
(1, 'Shahla Abbasi', 'bsse2480221@szabist.pk', true),
(2, 'Laiba Kanwal', 'bsse2480204@szabist.pk', true)
ON CONFLICT (user_id, beneficiary_email) DO NOTHING;

-- ============================================
-- SAMPLE TRANSACTIONS
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
('SENT_JUN1', 1, 'sent', 50, 'Lunch with friend', 'completed', NOW() - INTERVAL '1 day')
ON CONFLICT (reference) DO NOTHING;

-- ============================================
-- UPDATE SEQUENCES
-- ============================================
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));
SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications));
SELECT setval('beneficiaries_id_seq', (SELECT MAX(id) FROM beneficiaries));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));