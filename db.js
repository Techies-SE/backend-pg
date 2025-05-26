const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables from .env file

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // host: process.env.DB_HOST,
    // user: process.env.DB_USER,
    // password: process.env.DB_PASSWORD,
    // database: process.env.DB_NAME,
    // port: process.env.DB_PORT, // PostgreSQL default port
    // max: 10, // Maximum number of clients in the pool (similar to connectionLimit)
    // idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    //connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
    ssl: {
        rejectUnauthorized: false,
    }
});

// Optional: Log connection events for debugging
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool, // Export the pool directly if needed
};