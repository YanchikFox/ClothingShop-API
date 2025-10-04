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

const validationErrorResponse = (error) => ({
    error: 'ValidationError',
    details: formatZodError(error),
});

/**
 * GET /api/products - Retrieve products with optional gender filtering
 * Query parameters:
 *   - gender (optional): Filter products by gender category (male, female, unisex)
 */
app.get('/api/products', async (req, res) => {
    try {
        const { gender } = req.query;

        let query = "SELECT * FROM products";
        const queryParams = [];

        // Apply gender filter if specified
        if (gender) {
            query += " WHERE gender = $1";
            queryParams.push(gender);
        }

        query += " ORDER BY id";

        const allProducts = await pool.query(query, queryParams);
        res.json(allProducts.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * POST /api/register - Create a new user account
 * Request body:
 *   - email: User's email address (required)
 *   - password: User's password (required)
 */
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check if user already exists
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length > 0) {
            return res.status(400).json({ message: "User with this email already exists" });
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
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * POST /api/login - Authenticate user and return JWT token
 * Request body:
 *   - email: User's email address (required)
 *   - password: User's password (required)
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Find user by email
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const payload = { user: { id: user.rows[0].id } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * GET /api/cart - Retrieve current user's cart items
 * Requires authentication token in x-auth-token header
 */
app.get('/api/cart', authMiddleware, async (req, res) => {
        const validationResult = cartItemBodySchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json(validationErrorResponse(validationResult.error));
    }

    const { productId, quantity } = validationResult.data;
    try {
        // Query cart items with product details for the authenticated user
        const cartItems = await pool.query(
            `SELECT p.*, ci.quantity FROM cart_items ci 
             JOIN products p ON ci.product_id = p.id 
             JOIN carts c ON ci.cart_id = c.id 
             WHERE c.user_id = $1`,
            [req.user.id]
        );
        res.json(cartItems.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
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
    const { productId, quantity } = req.body;
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
        console.error(err.message);
        res.status(500).send("Server Error");
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
app.put('/api/cart/item/:productId', authMiddleware, async (req, res) => {
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
            return res.status(404).json({ message: "Cart not found" });
        }
        const cartId = cart.rows[0].id;

        // Update item quantity
        const updatedItem = await pool.query(
            "UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3 RETURNING *",
            [quantity, cartId, productId]
        );

        if (updatedItem.rows.length === 0) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        res.json(updatedItem.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * DELETE /api/cart/item/:productId - Remove product from cart
 * Requires authentication token in x-auth-token header
 * URL parameters:
 *   - productId: ID of the product to remove
 */
app.delete('/api/cart/item/:productId', authMiddleware, async (req, res) => {
    const { productId } = req.params;
    
    try {
        // Find user's cart
        const cart = await pool.query("SELECT id FROM carts WHERE user_id = $1", [req.user.id]);
        if (cart.rows.length === 0) {
            return res.status(404).json({ message: "Cart not found" });
        }
        const cartId = cart.rows[0].id;

        // Remove product from cart
        await pool.query(
            "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2",
            [cartId, productId]
        );

        res.json({ message: "Product removed from cart" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * GET /api/profile - Get authenticated user's profile information
 * Requires authentication token in x-auth-token header
 */
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        // Retrieve user profile data using ID from JWT token
        const user = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [
            req.user.id
        ]);

        if (user.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * GET /api/categories - Retrieve all product categories
 */
app.get('/api/categories', async (req, res) => {
    try {
        const allCategories = await pool.query("SELECT * FROM categories ORDER BY id");
        res.json(allCategories.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

/**
 * GET /api/search - Search products by name or description
 * Query parameters:
 *   - q: Search query string (required)
 */

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.json([]); // Return empty array for empty queries
        }

        // Perform case-insensitive search across product names and descriptions
        const searchResults = await pool.query(
            "SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $1",
            [`%${q}%`]
        );

        res.json(searchResults.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Start the Express server

const port = Number(PORT) || 3000;
if (require.main === module) {
    app.listen(port, () => {
        console.log(`🚀 Server started on port ${port}`);
    });
}

module.exports = { app, pool };