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
 * 2. Create fresh tables for users, categories, products, carts, and related data
 * 3. Insert sample categories and products for testing with translations
 */
const setupQuery = `
    -- Drop tables in correct order due to foreign key relationships
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS carts;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS user_addresses;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;

    -- Core user table
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone_number VARCHAR(50),
        language_preference VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Product categories (male, female, unisex)
    CREATE TABLE categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        parent_id VARCHAR(50) REFERENCES categories(id),
        image_path VARCHAR(255) NOT NULL,
        icon_path VARCHAR(255) NOT NULL,
        name_translations JSONB DEFAULT '{}'::jsonb
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
        reviews JSONB DEFAULT '[]',
        name_translations JSONB DEFAULT '{}'::jsonb,
        description_translations JSONB DEFAULT '{}'::jsonb,
        composition_translations JSONB DEFAULT '{}'::jsonb,
        care_instructions_translations JSONB DEFAULT '{}'::jsonb
    );

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

    CREATE TABLE user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        line1 VARCHAR(255) NOT NULL,
        line2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(100) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_amount VARCHAR(50) NOT NULL,
        placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Sample data for development and testing
    INSERT INTO categories (id, name, slug, parent_id, image_path, icon_path, name_translations) VALUES
        (
            'female',
            'Women',
            'women',
            NULL,
            'images/categories/women.jpg',
            'images/categories/women_icon.jpg',
            '{"ru": "Женщины", "uk": "Жінки"}'::jsonb
        ),
        (
            'male',
            'Men',
            'men',
            NULL,
            'images/categories/men.jpg',
            'images/categories/men_icon.jpg',
            '{"ru": "Мужчины", "uk": "Чоловіки"}'::jsonb
        ),
        (
            'unisex',
            'Unisex',
            'unisex',
            NULL,
            'images/categories/unisex.jpg',
            'images/categories/unisex_icon.jpg',
            '{"ru": "Унисекс", "uk": "Унісекс"}'::jsonb
        );

    INSERT INTO products (
        id,
        article,
        category_id,
        image_path,
        image_urls,
        name,
        price,
        price_string,
        description,
        is_bestseller,
        gender,
        composition,
        care_instructions,
        features,
        reviews,
        name_translations,
        description_translations,
        composition_translations,
        care_instructions_translations
    ) VALUES
        (
            'su001',
            '1023',
            'unisex',
            'images/1.jpg',
            '["images/1.jpg", "images/1_detail.jpg"]'::jsonb,
            'Embroidered T-shirt',
            1200.00,
            '1 200 ₴',
            'Soft cotton T-shirt with tonal embroidery.',
            true,
            'unisex',
            '100% cotton',
            'Delicate machine wash at 30°C. Do not bleach.',
            '[
                {
                    "title": "Fit",
                    "value": "Relaxed",
                    "title_translations": {"ru": "Посадка", "uk": "Посадка"},
                    "value_translations": {"ru": "Свободная", "uk": "Вільна"}
                },
                {
                    "title": "Made in",
                    "value": "Ukraine",
                    "title_translations": {"ru": "Производство", "uk": "Виробництво"},
                    "value_translations": {"ru": "Украина", "uk": "Україна"}
                }
            ]'::jsonb,
            '[{"author": "Olena", "rating": 5, "comment": "Very soft fabric"}]'::jsonb,
            '{"ru": "Футболка с вышивкой", "uk": "Футболка з вишивкою"}'::jsonb,
            '{"ru": "Комфортная и стильная футболка с вышивкой.", "uk": "Зручна та стильна футболка з вишивкою."}'::jsonb,
            '{"ru": "100% хлопок", "uk": "100% бавовна"}'::jsonb,
            '{"ru": "Деликатная стирка при 30°C, не отбеливать.", "uk": "Делікатне прання при 30°C, не відбілювати."}'::jsonb
        ),
        (
            'su002',
            '2045',
            'male',
            'images/2.jpg',
            '["images/2.jpg"]'::jsonb,
            'Breathable Long Sleeve',
            1340.00,
            '1 340 ₴',
            'Lightweight jersey long sleeve that keeps its shape.',
            false,
            'male',
            '95% cotton, 5% elastane',
            'Wash inside out at 30°C and dry flat.',
            '[
                {
                    "title": "Fit",
                    "value": "Regular",
                    "title_translations": {"ru": "Посадка", "uk": "Посадка"},
                    "value_translations": {"ru": "Стандартная", "uk": "Стандартна"}
                }
            ]'::jsonb,
            '[{"author": "Andriy", "rating": 4, "comment": "Great everyday base"}]'::jsonb,
            '{"ru": "Базовый лонгслив", "uk": "Базовий лонгслів"}'::jsonb,
            '{"ru": "Базовый лонгслив из дышащей ткани.", "uk": "Базовий лонгслів із дихаючої тканини."}'::jsonb,
            '{"ru": "95% хлопок, 5% эластан", "uk": "95% бавовна, 5% еластан"}'::jsonb,
            '{"ru": "Стирка при 30°C, сушить на воздухе.", "uk": "Прати при 30°C, сушити на повітрі."}'::jsonb
        ),
        (
            'su003',
            '3051',
            'female',
            'images/3.jpg',
            '["images/3.jpg", "images/3_detail.jpg"]'::jsonb,
            'Linen Midi Dress',
            2450.00,
            '2 450 ₴',
            'Breathable linen midi dress with removable belt.',
            true,
            'female',
            '100% linen',
            'Gentle machine wash, reshape while damp.',
            '[
                {
                    "title": "Length",
                    "value": "Midi",
                    "title_translations": {"ru": "Длина", "uk": "Довжина"},
                    "value_translations": {"ru": "Миди", "uk": "Міді"}
                },
                {
                    "title": "Belt",
                    "value": "Detachable",
                    "title_translations": {"ru": "Пояс", "uk": "Пояс"},
                    "value_translations": {"ru": "Съемный", "uk": "Знімний"}
                }
            ]'::jsonb,
            '[{"author": "Iryna", "rating": 5, "comment": "Perfect for summer"}]'::jsonb,
            '{"ru": "Льняное миди-платье", "uk": "Лляна сукня міді"}'::jsonb,
            '{"ru": "Легкое льняное платье с ремешком.", "uk": "Легка лляна сукня зі знімним поясом."}'::jsonb,
            '{"ru": "100% лен", "uk": "100% льон"}'::jsonb,
            '{"ru": "Деликатная стирка, придать форму во влажном виде.", "uk": "Делікатне прання, надати форму у вологому стані."}'::jsonb
        ),
        (
            'su004',
            '4102',
            'unisex',
            'images/4.jpg',
            '["images/4.jpg"]'::jsonb,
            'Oversized Fleece Hoodie',
            1890.00,
            '1 890 ₴',
            'Warm oversized hoodie with brushed interior.',
            false,
            'unisex',
            '80% cotton, 20% polyester',
            'Wash at 30°C with similar colors.',
            '[
                {
                    "title": "Pocket",
                    "value": "Kangaroo",
                    "title_translations": {"ru": "Карман", "uk": "Кишеня"},
                    "value_translations": {"ru": "Кенгуру", "uk": "Кенгуру"}
                }
            ]'::jsonb,
            '[{"author": "Maksym", "rating": 5, "comment": "Super cozy"}]'::jsonb,
            '{"ru": "Оверсайз худи", "uk": "Оверсайз худі"}'::jsonb,
            '{"ru": "Теплое худи с мягким начесом.", "uk": "Тепле худі з мяким начосом."}'::jsonb,
            '{"ru": "80% хлопок, 20% полиэстер", "uk": "80% бавовна, 20% поліестер"}'::jsonb,
            '{"ru": "Стирка при 30°C с вещами похожих цветов.", "uk": "Прати при 30°C з подібними кольорами."}'::jsonb
        ),
        (
            'su005',
            '5120',
            'female',
            'images/5.jpg',
            '["images/5.jpg"]'::jsonb,
            'High-rise Mom Jeans',
            2100.00,
            '2 100 ₴',
            'Classic mom-fit jeans with cropped length.',
            false,
            'female',
            '99% cotton, 1% elastane',
            'Wash cold, do not tumble dry.',
            '[
                {
                    "title": "Rise",
                    "value": "High",
                    "title_translations": {"ru": "Посадка", "uk": "Посадка"},
                    "value_translations": {"ru": "Высокая", "uk": "Висока"}
                },
                {
                    "title": "Length",
                    "value": "Ankle",
                    "title_translations": {"ru": "Длина", "uk": "Довжина"},
                    "value_translations": {"ru": "По щиколотку", "uk": "До щиколотки"}
                }
            ]'::jsonb,
            '[{"author": "Sofiia", "rating": 4, "comment": "Nice stretch"}]'::jsonb,
            '{"ru": "Джинсы mom fit", "uk": "Джинси mom fit"}'::jsonb,
            '{"ru": "Классические джинсы mom fit укороченной длины.", "uk": "Класичні джинси mom fit укороченої довжини."}'::jsonb,
            '{"ru": "99% хлопок, 1% эластан", "uk": "99% бавовна, 1% еластан"}'::jsonb,
            '{"ru": "Стирка в холодной воде, не сушить в сушилке.", "uk": "Прати у холодній воді, не сушити в сушарці."}'::jsonb
        ),
        (
            'su006',
            '6188',
            'male',
            'images/6.jpg',
            '["images/6.jpg", "images/6_detail.jpg"]'::jsonb,
            'Minimalist Leather Sneakers',
            3150.00,
            '3 150 ₴',
            'Smooth leather sneakers with cushioned insole.',
            true,
            'male',
            'Upper: leather, lining: textile',
            'Clean with damp cloth, avoid direct heat.',
            '[
                {
                    "title": "Sole",
                    "value": "Rubber",
                    "title_translations": {"ru": "Подошва", "uk": "Підошва"},
                    "value_translations": {"ru": "Резиновая", "uk": "Гумова"}
                }
            ]'::jsonb,
            '[{"author": "Dmytro", "rating": 5, "comment": "Look premium"}]'::jsonb,
            '{"ru": "Минималистичные кеды", "uk": "Мінімалістичні кеди"}'::jsonb,
            '{"ru": "Гладкие кожаные кеды с мягкой стелькой.", "uk": "Гладкі шкіряні кеди з мякою устілкою."}'::jsonb,
            '{"ru": "Верх: кожа, подкладка: текстиль", "uk": "Верх: шкіра, підкладка: текстиль"}'::jsonb,
            '{"ru": "Протирать влажной тканью, избегать прямого тепла.", "uk": "Протирати вологою ганчіркою, уникати прямого тепла."}'::jsonb
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
