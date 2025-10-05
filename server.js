require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./authMiddleware');
const {
    cartItemBodySchema,
    cartItemParamsSchema,
    cartQuantitySchema,
    formatZodError,
} = require('./schemas/cartSchemas');
const { profileUpdateSchema } = require('./schemas/profileSchemas');
const { createError, errorHandler } = require('./errors');

const app = express();
app.use(express.json());

const {
    PORT = 3000,
    DATABASE_URL,
    DB_HOST = 'localhost',
    DB_PORT = '5432',
    DB_USER = 'myuser',
    DB_PASSWORD = 'mypassword',
    DB_NAME = 'mydatabase',
    JWT_SECRET = 'dev-secret-change-me',
    DB_SSL = 'false',
} = process.env;


// Configure PostgreSQL database connection pool using environment variables
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

const SUPPORTED_LANGUAGES = ['en', 'ru', 'uk'];
const DEFAULT_LANGUAGE = 'en';

const normalizeLanguageTag = (tag) => {
    if (!tag || typeof tag !== 'string') {
        return null;
    }
    const normalized = tag.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    return normalized.split('-')[0];
};

const parseAcceptLanguageHeader = (headerValue) => {
    if (!headerValue || typeof headerValue !== 'string') {
        return [];
    }
    return headerValue
        .split(',')
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean);
};

const resolveLanguage = (req) => {
    const queryLang = normalizeLanguageTag(req.query?.lang);
    if (queryLang && SUPPORTED_LANGUAGES.includes(queryLang)) {
        return queryLang;
    }

    const headerLanguages = parseAcceptLanguageHeader(req.headers['accept-language']);
    for (const lang of headerLanguages) {
        const normalized = normalizeLanguageTag(lang);
        if (normalized && SUPPORTED_LANGUAGES.includes(normalized)) {
            return normalized;
        }
    }

    return DEFAULT_LANGUAGE;
};

const validationErrorResponse = (error) => ({
    error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formatZodError(error),
    },
});

const parseJsonField = (value, fallback = []) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (_err) {
            return fallback;
        }
    }

    if (typeof value === 'object') {
        return value;
    }

    return fallback;
};

const parseJsonObjectField = (value, fallback = {}) => {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch (_err) {
            return fallback;
        }
    }

    return fallback;
};

const getLocalizedText = (baseValue, translations, language) => {
    const translationMap = parseJsonObjectField(translations, {});
    if (language && translationMap[language]) {
        return translationMap[language];
    }

    if (translationMap[DEFAULT_LANGUAGE]) {
        return translationMap[DEFAULT_LANGUAGE];
    }

    return baseValue ?? '';
};

const buildLocalizedFeatures = (row, language) => {
    const features = parseJsonField(row.features, []);
    if (!Array.isArray(features)) {
        return [];
    }

    return features.map((feature) => {
        const title = getLocalizedText(feature.title ?? '', feature.title_translations, language);
        const value = getLocalizedText(feature.value ?? '', feature.value_translations, language);

        return {
            title,
            value,
        };
    });
};

const buildImageList = (row) => {
    const images = parseJsonField(row.image_urls ?? row.imageUrls, []);
    if (images.length > 0) {
        return images;
    }

    return row.image_path ? [row.image_path] : [];
};

const parsePriceValue = (row) => {
    if (typeof row.price === 'number') {
        return row.price;
    }

    if (typeof row.price === 'string') {
        const numeric = Number.parseFloat(row.price);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }

    if (typeof row.price_string === 'string') {
        const cleaned = row.price_string.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const numeric = Number.parseFloat(cleaned);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }

    return 0;
};

const toProductResponse = (row, language) => {
    const nameTranslations = row.name_translations ?? row.nameTranslations;
    const descriptionTranslations = row.description_translations ?? row.descriptionTranslations;
    const compositionTranslations = row.composition_translations ?? row.compositionTranslations;
    const careTranslations = row.care_instructions_translations ?? row.careInstructionsTranslations;

    return {
        id: row.id,
        article: row.article,
        category_id: row.category_id ?? row.gender ?? null,
        name: getLocalizedText(row.name, nameTranslations, language),
        description: getLocalizedText(row.description ?? '', descriptionTranslations, language),
        price: parsePriceValue(row),
        price_string: row.price_string ?? '',
        is_bestseller: Boolean(row.is_bestseller),
        imageUrls: buildImageList(row),
        image_path: row.image_path ?? null,
        composition: getLocalizedText(row.composition ?? '', compositionTranslations, language),
        careInstructions: getLocalizedText(
            row.care_instructions ?? row.careInstructions ?? '',
            careTranslations,
            language
        ),
        features: buildLocalizedFeatures(row, language),
        reviews: parseJsonField(row.reviews),
        gender: row.gender ?? row.category_id ?? null,
    };
};

const toCategoryResponse = (row, language) => ({
    id: row.id,
    name: getLocalizedText(row.name, row.name_translations, language),
    slug: row.slug ?? row.id,
    parent_id: row.parent_id ?? null,
    image_path: row.image_path ?? '',
    icon_path: row.icon_path ?? row.image_path ?? '',
});

const fetchUserProfile = async (userId) => {
    const userResult = await pool.query(
        `SELECT id, email, full_name, phone_number, created_at
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (userResult.rows.length === 0) {
        return null;
    }

    const user = userResult.rows[0];

    const addressesResult = await pool.query(
        `SELECT id, label, line1, line2, city, postal_code, country, is_default
         FROM user_addresses
         WHERE user_id = $1
         ORDER BY is_default DESC, id`,
        [userId]
    );

    const ordersResult = await pool.query(
        `SELECT id, order_number, status, total_amount, placed_at
         FROM orders
         WHERE user_id = $1
         ORDER BY placed_at DESC`,
        [userId]
    );

    return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        phone: user.phone_number,
        created_at: user.created_at,
        addresses: addressesResult.rows,
        order_history: ordersResult.rows,
    };
};

const sanitizeAddresses = (addresses) => {
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return [];
    }

    let defaultAssigned = false;

    return addresses.map((address, index) => {
        let isDefault = false;

        if (address.is_default && !defaultAssigned) {
            isDefault = true;
            defaultAssigned = true;
        } else if (!defaultAssigned && index === 0) {
            isDefault = true;
            defaultAssigned = true;
        }

        return {
            ...address,
            line2: address.line2 ?? null,
            is_default: isDefault,
        };
    });
};

/**
 * GET /api/products - Retrieve products with optional gender filtering
 * Query parameters:
 *   - gender (optional): Filter products by gender category (male, female, unisex)
 */
app.get('/api/products', async (req, res, next) => {
    try {
        const language = resolveLanguage(req);
        const { gender, categoryId } = req.query;
        const filter = gender ?? categoryId;

        let query = 'SELECT * FROM products';
        const queryParams = [];

        if (filter) {
            query += ' WHERE gender = $1';
            queryParams.push(filter);
        }

        query += ' ORDER BY id';

        const allProducts = await pool.query(query, queryParams);
        res.json(allProducts.rows.map((row) => toProductResponse(row, language)));

    } catch (err) {
        next(createError('GET_PRODUCTS_FAILED', 500, 'Unable to retrieve products', err));
    }
});

/**
 * POST /api/register - Create a new user account
 * Request body:
 *   - email: User's email address (required)
 *   - password: User's password (required)
 */
app.post('/api/register', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: {
                    code: 'REGISTRATION_VALIDATION_ERROR',
                    message: 'Email and password are required',
                },
            });
        }

        // Check if user already exists
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length > 0) {
            return res.status(400).json({
                error: {
                    code: 'USER_ALREADY_EXISTS',
                    message: 'User with this email already exists',
                },
            });
        }

        // Hash password before storing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
            [email, hashedPassword]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        next(createError('REGISTER_FAILED', 500, 'Unable to register user', err));
    }
});

/**
 * POST /api/login - Authenticate user and return JWT token
 * Request body:
 *   - email: User's email address (required)
 *   - password: User's password (required)
 */
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: {
                    code: 'LOGIN_VALIDATION_ERROR',
                    message: 'Email and password are required',
                },
            });
        }

        // Find user by email
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid credentials',
                },
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid credentials',
                },
            });
        }

        // Generate JWT token
        const payload = { user: { id: user.rows[0].id } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });

    } catch (err) {
        next(createError('LOGIN_FAILED', 500, 'Unable to log in user', err));
    }
});

/**
 * GET /api/cart - Retrieve current user's cart items
 * Requires authentication token in x-auth-token header
 */
app.get('/api/cart', authMiddleware, async (req, res, next) => {
    try {
        const language = resolveLanguage(req);
        const cartItems = await pool.query(
            `SELECT p.*, ci.quantity
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             JOIN carts c ON ci.cart_id = c.id
             WHERE c.user_id = $1`,
            [req.user.id]
        );

        const payload = cartItems.rows.map((row) => ({
            ...toProductResponse(row, language),
            quantity: Number(row.quantity) || 0,
        }));

        res.json(payload);
    } catch (err) {
        next(createError('GET_CART_FAILED', 500, 'Unable to retrieve cart', err));
    }
});

/**
 * POST /api/cart - Add or update product quantity in cart
 * Requires authentication token in x-auth-token header
 * Request body:
 *   - productId: ID of the product to add (required)
 *   - quantity: Quantity to add (required)
 */
app.post('/api/cart', authMiddleware, async (req, res) => {
    const validationResult = cartItemBodySchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json(validationErrorResponse(validationResult.error));
    }

    const { productId, quantity } = validationResult.data;
    try {
        // Get or create user's cart
        let cart = await pool.query("SELECT * FROM carts WHERE user_id = $1", [req.user.id]);
        if (cart.rows.length === 0) {
            cart = await pool.query("INSERT INTO carts (user_id) VALUES ($1) RETURNING *", [req.user.id]);
        }
        const cartId = cart.rows[0].id;

        // Insert new item or update existing quantity using UPSERT
        const query = `
            INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
            ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3
            RETURNING *;
        `;
        const newItem = await pool.query(query, [cartId, productId, quantity]);
        res.status(201).json(newItem.rows[0]);
    } catch (err) {
        next(createError('UPSERT_CART_ITEM_FAILED', 500, 'Unable to add product to cart', err));
    }
});

/**
 * PUT /api/cart/item/:productId - Update product quantity in cart
 * Requires authentication token in x-auth-token header
 * URL parameters:
 *   - productId: ID of the product to update
 * Request body:
 *   - quantity: New quantity value (required)
 */
app.put('/api/cart/item/:productId', authMiddleware, async (req, res, next) => {
    const paramsValidation = cartItemParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        return res.status(400).json(validationErrorResponse(paramsValidation.error));
    }

    const bodyValidation = cartQuantitySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json(validationErrorResponse(bodyValidation.error));
    }

    const { productId } = paramsValidation.data;
    const { quantity } = bodyValidation.data;
    
    try {
        // Find user's cart
        const cart = await pool.query("SELECT id FROM carts WHERE user_id = $1", [req.user.id]);
        if (cart.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'CART_NOT_FOUND',
                    message: 'Cart not found',
                },
            });
        }
        const cartId = cart.rows[0].id;

        // Update item quantity
        const updatedItem = await pool.query(
            "UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3 RETURNING *",
            [quantity, cartId, productId]
        );

        if (updatedItem.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'CART_PRODUCT_NOT_FOUND',
                    message: 'Product not found in cart',
                },
            });
        }

        res.json(updatedItem.rows[0]);
    } catch (err) {
        next(createError('UPDATE_CART_ITEM_FAILED', 500, 'Unable to update cart item', err));
    }
});

/**
 * DELETE /api/cart/item/:productId - Remove product from cart
 * Requires authentication token in x-auth-token header
 * URL parameters:
 *   - productId: ID of the product to remove
 */
app.delete('/api/cart/item/:productId', authMiddleware, async (req, res, next) => {
    const { productId } = req.params;

    try {
        // Find user's cart
        const cart = await pool.query("SELECT id FROM carts WHERE user_id = $1", [req.user.id]);
        if (cart.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'CART_NOT_FOUND',
                    message: 'Cart not found',
                },
            });
        }
        const cartId = cart.rows[0].id;

        // Remove product from cart
        await pool.query(
            "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2",
            [cartId, productId]
        );

        res.json({ message: "Product removed from cart" });
    } catch (err) {
        next(createError('DELETE_CART_ITEM_FAILED', 500, 'Unable to remove cart item', err));
    }
});

/**
 * GET /api/profile - Get authenticated user's profile information
 * Requires authentication token in x-auth-token header
 */
app.get('/api/profile', authMiddleware, async (req, res, next) => {
    try {
        const profile = await fetchUserProfile(req.user.id);

        if (!profile) {
            return res.status(404).json({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                },
            });
        }

        res.json(profile);
    } catch (err) {
        next(createError('GET_PROFILE_FAILED', 500, 'Unable to retrieve profile', err));
    }
});

app.put('/api/profile', authMiddleware, async (req, res, next) => {
    const validationResult = profileUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json(validationErrorResponse(validationResult.error));
    }

    const { name, phone, addresses } = validationResult.data;
    const sanitizedAddresses = sanitizeAddresses(addresses);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'UPDATE users SET full_name = $1, phone_number = $2 WHERE id = $3',
            [name.trim(), phone ?? '', req.user.id]
        );

        await client.query('DELETE FROM user_addresses WHERE user_id = $1', [req.user.id]);

        for (const address of sanitizedAddresses) {
            await client.query(
                `INSERT INTO user_addresses (
                    user_id, label, line1, line2, city, postal_code, country, is_default
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    req.user.id,
                    address.label,
                    address.line1,
                    address.line2,
                    address.city,
                    address.postal_code,
                    address.country,
                    address.is_default,
                ]
            );
        }

        await client.query('COMMIT');

        const updatedProfile = await fetchUserProfile(req.user.id);
        res.json(updatedProfile);
    } catch (err) {
        await client.query('ROLLBACK');
        next(createError('UPDATE_PROFILE_FAILED', 500, 'Unable to update profile', err));
    } finally {
        client.release();
    }
});

/**
 * GET /api/categories - Retrieve all product categories
 */
app.get('/api/categories', async (req, res, next) => {
    try {
        const language = resolveLanguage(req);
        const allCategories = await pool.query('SELECT * FROM categories ORDER BY id');
        res.json(allCategories.rows.map((row) => toCategoryResponse(row, language)));
    } catch (err) {
        next(createError('GET_CATEGORIES_FAILED', 500, 'Unable to retrieve categories', err));
    }
});

/**
 * GET /api/search - Search products by name or description
 * Query parameters:
 *   - q: Search query string (required)
 */

app.get('/api/search', async (req, res, next) => {
    try {
        const language = resolveLanguage(req);
        const { q, gender, categoryId } = req.query;

        if (!q) {
            return res.json([]); // Return empty array for empty queries
        }

        const params = [`%${q}%`, language];
        let query = `
            SELECT * FROM products
            WHERE (
                name ILIKE $1
                OR description ILIKE $1
                OR COALESCE(name_translations ->> $2, '') ILIKE $1
                OR COALESCE(description_translations ->> $2, '') ILIKE $1
            )
        `;

        const additionalFilters = [];

        if (gender) {
            params.push(gender);
            additionalFilters.push(`gender = $${params.length}`);
        }

        if (categoryId) {
            params.push(categoryId);
            additionalFilters.push(`category_id = $${params.length}`);
        }

        if (additionalFilters.length > 0) {
            query += ` AND ${additionalFilters.join(' AND ')}`;
        }

        query += ' ORDER BY id';

        const searchResults = await pool.query(query, params);

        res.json(searchResults.rows.map((row) => toProductResponse(row, language)));
    } catch (err) {
        next(createError('SEARCH_FAILED', 500, 'Unable to perform search', err));
    }
});

// Start the Express server

app.use(errorHandler);

const port = Number(PORT) || 3000;
if (require.main === module) {
    app.listen(port, () => {
        console.log(`🚀 Server started on port ${port}`);
    });
}

module.exports = { app, pool };
