import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DB_URL,
});

await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        price NUMERIC,
        wallet VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )
`);

console.log('DB connected, table ready');

export default pool;