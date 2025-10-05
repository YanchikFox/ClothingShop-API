require('dotenv').config();

const { Pool } = require('pg');
const {
    DATABASE_URL,
    DB_HOST = 'localhost',
    DB_PORT = '5432',
    DB_USER = 'myuser',
    DB_PASSWORD = 'mypassword',
    DB_NAME = 'mydatabase',
    DB_SSL = 'false',
} = process.env;

console.log("▶️ Database setup script started...");

// Configure PostgreSQL connection using environment variables
const poolConfig = DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : {
          host: DB_HOST,
          port: Number(DB_PORT),
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
      };

if (DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

/**
 * Complete database schema setup with sample data
 * 
 * This script will:
 * 1. Drop existing tables (in correct order to handle foreign keys)
 * 2. Create fresh tables for users, categories, products, carts, and cart items
 * 3. Insert sample categories and products for testing
 */
const setupQuery = `
    -- Drop tables in correct order due to foreign key relationships
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS carts;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;

    -- Core user table
    CREATE TABLE users ( 
        id SERIAL PRIMARY KEY, 
        email VARCHAR(255) UNIQUE NOT NULL, 
        password VARCHAR(255) NOT NULL, 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP 
    );
    
    -- Product categories (male, female, unisex)
    CREATE TABLE categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        parent_id VARCHAR(50) REFERENCES categories(id),
        image_path VARCHAR(255) NOT NULL,
        icon_path VARCHAR(255) NOT NULL
    );

    -- Product catalog
    CREATE TABLE products (
        id VARCHAR(50) PRIMARY KEY,
        article VARCHAR(50) NOT NULL,
        category_id VARCHAR(50) REFERENCES categories(id),
        image_path VARCHAR(255) NOT NULL,
        image_urls JSONB DEFAULT '[]',
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        price_string VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        is_bestseller BOOLEAN NOT NULL,
        gender VARCHAR(50) NOT NULL,
        composition TEXT DEFAULT '',
        care_instructions TEXT DEFAULT '',
        features JSONB DEFAULT '[]',
        reviews JSONB DEFAULT '[]'
    );

    -- Shopping cart tables for e-commerce functionality

    -- User shopping carts (one cart per user)
    CREATE TABLE carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    -- Items within each cart
    CREATE TABLE cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        UNIQUE (cart_id, product_id) -- Prevent duplicate products in same cart
    );

    -- Sample data for development and testing
    INSERT INTO categories (id, name, slug, parent_id, image_path, icon_path) VALUES
        ('female', 'Женщины', 'women', NULL, 'images/categories/women.jpg', 'images/categories/women_icon.jpg'),
        ('male', 'Мужчины', 'men', NULL, 'images/categories/men.jpg', 'images/categories/men_icon.jpg'),
        ('unisex', 'Унисекс', 'unisex', NULL, 'images/categories/unisex.jpg', 'images/categories/unisex_icon.jpg');

    INSERT INTO products (
        id, article, category_id, image_path, image_urls, name, price, price_string,
        description, is_bestseller, gender, composition, care_instructions, features, reviews
    ) VALUES
        (
            'su001', '1023', 'unisex', 'images/1.jpg',
            '["images/1.jpg", "images/1_detail.jpg"]'::jsonb,
            'Embroidered T-shirt', 1200.00, '1 200 ₴',
            'Комфортная и стильная футболка с вышивкой.', true, 'unisex',
            '100% хлопок', 'Деликатная стирка при 30°C, не отбеливать.',
            '[{"title": "Посадка", "value": "Свободная"}, {"title": "Производство", "value": "Украина"}]'::jsonb,
            '[{"author": "Олена", "rating": 5, "comment": "Очень мягкая ткань"}]'::jsonb
        ),
        (
            'su002', '2045', 'male', 'images/2.jpg',
            '["images/2.jpg"]'::jsonb,
            'Basic Long Sleeve', 1340.00, '1 340 ₴',
            'Базовый лонгслив из дышащей ткани.', false, 'male',
            '95% хлопок, 5% эластан', 'Стирка при 30°C, сушить на воздухе.',
            '[{"title": "Посадка", "value": "Регулярная"}]'::jsonb,
            '[{"author": "Андрій", "rating": 4, "comment": "Отлично сидит"}]'::jsonb
        );

`;

/**
 * Database Setup Function
 * 
 * Establishes connection to PostgreSQL and executes the complete setup script.
 * Includes error handling and proper connection cleanup.
 */
async function setupDatabase() {
    let client;
    try {
        console.log("🔗 Attempting to connect to PostgreSQL database...");
        client = await pool.connect();
        console.log("✅ Database connection established successfully!");
        
        console.log("⚙️ Executing database setup script...");
        await client.query(setupQuery);
        console.log('🎉 Database tables and sample data created successfully!');
        
    } catch (err) {
        console.error('❌ Database setup failed:', err.message);
    } finally {
        if (client) {
            client.release();
            console.log("🔌 Database connection closed.");
        }
        await pool.end();
    }
}

// Execute the setup
setupDatabase();