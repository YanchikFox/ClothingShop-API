const { Pool } = require('pg');

// Configure PostgreSQL connection pool
const pool = new Pool({
  user: 'myuser',
  host: 'localhost',
  database: 'mydatabase',
  password: 'mypassword',
  port: 5432,
});

/**
 * Basic database schema creation script
 * 
 * Creates fundamental tables for users and products.
 * This is a simplified version compared to setup-database.js
 */
const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

/**
 * Execute database setup with basic error handling
 */
async function setupDatabase() {
  try {
    const client = await pool.connect();
    await client.query(createTablesQuery);
    console.log('✅ Basic database tables created successfully!');
    client.release();
  } catch (err) {
    console.error('❌ Error creating database tables:', err);
  } finally {
    await pool.end();
  }
}

setupDatabase();