const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
});

const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time');
        console.log('✅ Connected to Neon PostgreSQL successfully!');
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
};

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = {
    query,
    getClient,
    pool,
    testConnection
};
