const express = require('express');
const authMiddleware = require('../authMiddleware');
const { createError } = require('../errors');
const {
    cartItemBodySchema,
    cartItemParamsSchema,
    cartQuantitySchema,
} = require('../schemas/cartSchemas');
const { resolveLanguage, toProductResponse } = require('../utils/productResponse');
const { validationErrorResponse } = require('../utils/validation');

const createCartRouter = (pool) => {
    const router = express.Router();

    router.get('/cart', authMiddleware, async (req, res, next) => {
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

    router.post('/cart', authMiddleware, async (req, res, next) => {
        const validationResult = cartItemBodySchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(validationErrorResponse(validationResult.error));
        }

        const { productId, quantity } = validationResult.data;
        try {
            let cart = await pool.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
            if (cart.rows.length === 0) {
                cart = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING *', [req.user.id]);
            }
            const cartId = cart.rows[0].id;

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

    router.put('/cart/item/:productId', authMiddleware, async (req, res, next) => {
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
            const cart = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
            if (cart.rows.length === 0) {
                return res.status(404).json({
                    error: {
                        code: 'CART_NOT_FOUND',
                        message: 'Cart not found',
                    },
                });
            }
            const cartId = cart.rows[0].id;

            const updatedItem = await pool.query(
                'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3 RETURNING *',
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

    router.delete('/cart/item/:productId', authMiddleware, async (req, res, next) => {
        const { productId } = req.params;

        try {
            const cart = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
            if (cart.rows.length === 0) {
                return res.status(404).json({
                    error: {
                        code: 'CART_NOT_FOUND',
                        message: 'Cart not found',
                    },
                });
            }
            const cartId = cart.rows[0].id;

            await pool.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, productId]);

            res.json({ message: 'Product removed from cart' });
        } catch (err) {
            next(createError('DELETE_CART_ITEM_FAILED', 500, 'Unable to remove cart item', err));
        }
    });

    return router;
};

module.exports = createCartRouter;
