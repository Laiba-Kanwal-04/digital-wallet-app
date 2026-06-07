const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./db/database');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Digital Wallet API is running',
        timestamp: new Date().toISOString()
    });
});

// Catch-all route for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
    console.log('🔄 Starting Digital Wallet Server...');
    console.log('📡 Checking database connection...');
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ Cannot start server without database');
        process.exit(1);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log(`✅ Open your browser at the Codespace URL on port ${PORT}`);
        console.log(`\n📋 Test Accounts:`);
        console.log(`   Laiba: bsse2480204@szabist.pk / password123`);
        console.log(`   Shahla: bsse2480221@szabist.pk / password123`);
        console.log(`   Admin: admin@digitalwallet.com / password123`);
    });
};

startServer();
