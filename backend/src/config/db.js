import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,                          // max simultaneous connections
  min: 2,                           // keep 2 warm connections alive
  idleTimeoutMillis: 30000,         // close idle connections after 30s
  connectionTimeoutMillis: 10000,   // fail fast if no connection in 10s
  keepAlive: true,                  // TCP keep-alive — prevents Supabase from killing idle connections
  keepAliveInitialDelayMillis: 0,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

pool.connect()
  .then(client => {
    console.log('✅ Connected to Supabase PostgreSQL');
    client.release();
  })
  .catch((err) => console.error('❌ Database connection failed:', err.message));

export default pool;
